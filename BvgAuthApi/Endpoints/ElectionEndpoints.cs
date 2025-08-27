using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using BvgAuthApi.Data;
using BvgAuthApi.Hubs;
using BvgAuthApi.Models;
using System.Security.Claims;

namespace BvgAuthApi.Endpoints
{
    public static class ElectionEndpoints
    {
        public static IEndpointRouteBuilder MapElections(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/elections");

            g.MapPost("/", async ([FromBody] CreateElectionDto dto, BvgDbContext db) =>
            {
                var e = new Election
                {
                    Name = dto.Name,
                    Details = dto.Details ?? "",
                    ScheduledAt = dto.ScheduledAt,
                    QuorumMinimo = dto.QuorumMinimo
                };
                foreach (var q in dto.Questions)
                {
                    var qn = new ElectionQuestion { Text = q.Text };
                    foreach (var op in q.Options)
                        qn.Options.Add(new ElectionOption { Text = op });
                    e.Questions.Add(qn);
                }
                db.Elections.Add(e);
                await db.SaveChangesAsync();
                return Results.Created($"/api/elections/{e.Id}", new { e.Id });
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapGet("/", async (BvgDbContext db) =>
                Results.Ok(await db.Elections.AsNoTracking()
                    .Select(e => new {
                        e.Id, e.Name, e.Details, e.ScheduledAt, e.QuorumMinimo,
                        Questions = e.Questions.Select(q => new { q.Id, q.Text, Options = q.Options.Select(o => new { o.Id, o.Text }) })
                    }).ToListAsync()))
                .RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapPost("/{id}/padron", async (Guid id, IFormFile file, BvgDbContext db) =>
            {
                const long maxFileSize = 5 * 1024 * 1024; // 5MB
                const int maxRows = 1000;

                if (file.Length == 0 || file.Length > maxFileSize)
                    return Results.BadRequest("Archivo demasiado grande.");

                var election = await db.Elections.Include(x => x.Padron).FirstOrDefaultAsync(x => x.Id == id);
                if (election is null) return Results.NotFound();

                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                ms.Position = 0;
                using var pkg = new ExcelPackage(ms);
                var ws = pkg.Workbook.Worksheets.First();

                for (int row = 2; ws.Cells[row,1].Value != null; row++)
                {
                    if (row - 1 > maxRows)
                        return Results.BadRequest("Cantidad de filas excede el máximo permitido.");

                    if (!decimal.TryParse(ws.Cells[row,5].Text, out var shares))
                        return Results.BadRequest($"Valor de acciones inválido en la fila {row}.");

                    var entry = new PadronEntry
                    {
                        ElectionId = id,
                        ShareholderId = ws.Cells[row,1].Text,
                        ShareholderName = ws.Cells[row,2].Text,
                        LegalRepresentative = ws.Cells[row,3].Text,
                        Proxy = ws.Cells[row,4].Text,
                        Shares = shares
                    };
                    election.Padron.Add(entry);
                }
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapPost("/{id}/assignments", async (Guid id, [FromBody] AssignmentDto dto, BvgDbContext db) =>
            {
                var election = await db.Elections.FindAsync(id);
                if (election is null) return Results.NotFound();
                db.ElectionUserAssignments.Add(new ElectionUserAssignment
                {
                    ElectionId = id,
                    UserId = dto.UserId,
                    Role = dto.Role
                });
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapGet("/{id}/assignments", async (Guid id, BvgDbContext db) =>
            {
                var items = await db.ElectionUserAssignments
                    .Where(a => a.ElectionId == id)
                    .Select(a => new { a.Id, a.UserId, a.Role })
                    .ToListAsync();
                return Results.Ok(items);
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapDelete("/{id}/assignments/{assignmentId}", async (Guid id, Guid assignmentId, BvgDbContext db) =>
            {
                var assignment = await db.ElectionUserAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId && a.ElectionId == id);
                if (assignment is null) return Results.NotFound();
                db.ElectionUserAssignments.Remove(assignment);
                await db.SaveChangesAsync();
                return Results.NoContent();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapGet("/{id}/padron/template", () =>
            {
                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var pkg = new ExcelPackage();
                var ws = pkg.Workbook.Worksheets.Add("Padron");
                ws.Cells[1,1].Value = "Id";
                ws.Cells[1,2].Value = "NombreAccionista";
                ws.Cells[1,3].Value = "RepresentanteLegal";
                ws.Cells[1,4].Value = "Apoderado";
                ws.Cells[1,5].Value = "Acciones";
                var bytes = pkg.GetAsByteArray();
                return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "padron.xlsx");
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapPost("/{id}/attendance/{padronId}", async (Guid id, Guid padronId, [FromBody] AttendanceDto dto, BvgDbContext db, IHubContext<LiveHub> hub, ClaimsPrincipal user) =>
            {
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Results.Forbid();
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Results.NotFound();
                if (election.IsClosed) return Results.BadRequest();
                var padron = election.Padron.FirstOrDefault(p => p.Id == padronId);
                if (padron is null) return Results.NotFound();
                padron.Attendance = dto.Attendance;
                await db.SaveChangesAsync();
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                await hub.Clients.All.SendAsync("quorumUpdated", new { ElectionId = id, Total = total, Present = present });
                return Results.Ok();
            }).RequireAuthorization(AppRoles.ElectionRegistrar);

            g.MapGet("/{id}/quorum", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Results.NotFound();
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.ElectionRegistrar));
                    if (!hasAssign) return Results.Forbid();
                }
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                return Results.Ok(new { Total = total, Present = present, Quorum = total == 0 ? 0 : present / total });
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.ElectionObserver, AppRoles.ElectionRegistrar));

            g.MapPost("/{id}/votes", async (Guid id, [FromBody] VoteDto dto, BvgDbContext db, IHubContext<LiveHub> hub, ClaimsPrincipal user) =>
            {
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Results.Forbid();
                var election = await db.Elections.Include(e => e.Padron).Include(e => e.Votes).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Results.NotFound();
                if (election.IsClosed) return Results.BadRequest();
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                if (total == 0 || present / total < election.QuorumMinimo)
                    return Results.BadRequest();
                var registrarId = userId;
                var vote = new VoteRecord
                {
                    ElectionId = id,
                    PadronEntryId = dto.PadronId,
                    ElectionQuestionId = dto.QuestionId,
                    ElectionOptionId = dto.OptionId,
                    RegistrarId = registrarId
                };
                db.Votes.Add(vote);
                await db.SaveChangesAsync();
                await hub.Clients.All.SendAsync("voteRegistered", new { ElectionId = id, QuestionId = dto.QuestionId, OptionId = dto.OptionId });
                return Results.Ok();
            }).RequireAuthorization(AppRoles.ElectionRegistrar);

            g.MapGet("/{id}/results", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                var election = await db.Elections.Include(e => e.Questions).ThenInclude(q => q.Options).Include(e => e.Votes).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Results.NotFound();
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionObserver);
                    if (!hasAssign) return Results.Forbid();
                }
                var results = election.Questions.Select(q => new {
                    QuestionId = q.Id,
                    q.Text,
                    Options = q.Options.Select(o => new {
                        OptionId = o.Id,
                        o.Text,
                        Votes = election.Votes.Count(v => v.ElectionQuestionId == q.Id && v.ElectionOptionId == o.Id)
                    })
                });
                return Results.Ok(results);
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.ElectionObserver));

            g.MapPost("/{id}/close", async (Guid id, BvgDbContext db) =>
            {
                var election = await db.Elections.FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Results.NotFound();
                election.IsClosed = true;
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            return app;
        }

        public record CreateElectionDto(string Name, string? Details, DateTimeOffset ScheduledAt, decimal QuorumMinimo, List<CreateQuestionDto> Questions);
        public record CreateQuestionDto(string Text, List<string> Options);
        public record AttendanceDto(AttendanceType Attendance);
        public record VoteDto(Guid PadronId, Guid QuestionId, Guid OptionId);
        public record AssignmentDto(string UserId, string Role);
    }
}

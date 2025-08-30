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

            // Excel template for Padron upload
            g.MapGet("/padron-template", () =>
            {
                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var pkg = new ExcelPackage();
                var ws = pkg.Workbook.Worksheets.Add("Padron");
                ws.Cells[1,1].Value = "ID";
                ws.Cells[1,2].Value = "ShareholderName";
                ws.Cells[1,3].Value = "LegalRepresentative";
                ws.Cells[1,4].Value = "Proxy";
                ws.Cells[1,5].Value = "Shares";
                ws.Cells[1,1,1,5].Style.Font.Bold = true;
                var bytes = pkg.GetAsByteArray();
                return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "padron_template.xlsx");
            }).AllowAnonymous().DisableAntiforgery();

            g.MapPost("/", async ([FromBody] CreateElectionDto dto, BvgDbContext db) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);

                if (string.IsNullOrWhiteSpace(dto.Name)) return Err("missing_name", 400);
                if (dto.Questions is null || dto.Questions.Count == 0) return Err("missing_questions", 400);
                if (dto.QuorumMinimo <= 0 || dto.QuorumMinimo > 1) return Err("invalid_quorum", 400);
                if (dto.Questions.Any(q => string.IsNullOrWhiteSpace(q.Text))) return Err("missing_question_text", 400);
                if (dto.Questions.Any(q => q.Options is null || q.Options.Count == 0)) return Err("missing_question_options", 400);
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

            // List Padron entries for an election
            g.MapGet("/{id}/padron", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IWebHostEnvironment env, IConfiguration cfg) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar);
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var list = await db.Padron.Where(p => p.ElectionId == id)
                    .Select(p => new { p.Id, p.ShareholderId, p.ShareholderName, p.LegalRepresentative, p.Proxy, p.Shares, p.Attendance })
                    .ToListAsync();
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var dir = Path.Combine(root, "elections", id.ToString(), "actas");
                var items = list.Select(p => new {
                    p.Id, p.ShareholderId, p.ShareholderName, p.LegalRepresentative, p.Proxy, p.Shares, p.Attendance,
                    HasActa = File.Exists(Path.Combine(dir, p.Id + ".pdf"))
                });
                return Results.Ok(items);
            }).RequireAuthorization();

            g.MapPost("/{id}/padron", async (Guid id, IFormFile file, BvgDbContext db) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                const long maxFileSize = 5 * 1024 * 1024; // 5MB
                const int maxRows = 1000;

                if (file.Length == 0 || file.Length > maxFileSize)
                    return Err("invalid_file_size", 400);

                var election = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (election is null) return Err("election_not_found", 404);

                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                ms.Position = 0;
                using var pkg = new ExcelPackage(ms);
                var ws = pkg.Workbook.Worksheets.First();

                // Limpia el padrón previo para evitar inconsistencias/duplicados
                await db.Padron.Where(p => p.ElectionId == id).ExecuteDeleteAsync();

                for (int row = 2; ws.Cells[row,1].Value != null; row++)
                {
                    if (row - 1 > maxRows)
                        return Err("too_many_rows", 400);

                    if (!decimal.TryParse(ws.Cells[row,5].Text, out var shares))
                        return Err("invalid_shares", 400, new { row });

                    var entry = new PadronEntry
                    {
                        ElectionId = id,
                        ShareholderId = ws.Cells[row,1].Text,
                        ShareholderName = ws.Cells[row,2].Text,
                        LegalRepresentative = ws.Cells[row,3].Text,
                        Proxy = ws.Cells[row,4].Text,
                        Shares = shares
                    };
                    db.Padron.Add(entry);
                }
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapPost("/{id}/assignments", async (Guid id, [FromBody] AssignmentDto dto, BvgDbContext db) =>
            {
                var election = await db.Elections.FindAsync(id);
                if (election is null) return Results.NotFound();
                // Allow only per-election roles
                var allowed = new[] { AppRoles.ElectionRegistrar, AppRoles.ElectionObserver, AppRoles.ElectionVoter, AppRoles.VoteOperator };
                if (!allowed.Contains(dto.Role))
                    return Results.Json(new { error = "invalid_assignment_role" }, statusCode: 400);
                db.ElectionUserAssignments.Add(new ElectionUserAssignment
                {
                    ElectionId = id,
                    UserId = dto.UserId,
                    Role = dto.Role
                });
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin)).DisableAntiforgery();

            g.MapGet("/{id}/assignments", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                var q = db.ElectionUserAssignments.Where(a => a.ElectionId == id);
                if (!isAdmin)
                {
                    // Permitir ver las asignaciones solo si el usuario tiene alguna asignación en esta elección
                    var hasAssign = await q.AnyAsync(a => a.UserId == userId);
                    if (!hasAssign) return Results.Json(new { error = "forbidden" }, statusCode: 403);
                }
                var items = await (from a in db.ElectionUserAssignments
                                   where a.ElectionId == id
                                   join u in db.Users on a.UserId equals u.Id into gj
                                   from u in gj.DefaultIfEmpty()
                                   select new { a.Id, a.UserId, a.Role, UserName = (string?)u!.UserName }).ToListAsync();
                return Results.Ok(items);
            }).RequireAuthorization();

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
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Err("forbidden", 403);
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.IsClosed) return Err("election_closed", 400);
                var padron = election.Padron.FirstOrDefault(p => p.Id == padronId);
                if (padron is null) return Err("padron_entry_not_found", 404);
                padron.Attendance = dto.Attendance;
                await db.SaveChangesAsync();
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                await hub.Clients.All.SendAsync("quorumUpdated", new { ElectionId = id, Total = total, Present = present });
                return Results.Ok();
            }).RequireAuthorization();

            // Assigned elections for current user and role
            g.MapGet("/assigned", async (string? role, BvgDbContext db, ClaimsPrincipal user) =>
            {
                var userId = user.FindFirst("sub")?.Value ?? "";
                var r = string.IsNullOrWhiteSpace(role) ? AppRoles.ElectionRegistrar : role!;
                r = r.Trim();
                var rLower = r.ToLower();
                var ids = await db.ElectionUserAssignments
                    .Where(a => a.UserId == userId && a.Role.ToLower() == rLower)
                    .Select(a => a.ElectionId)
                    .ToListAsync();
                var items = await db.Elections.Where(e => ids.Contains(e.Id)).Select(e => new { e.Id, e.Name, e.ScheduledAt, e.IsClosed }).ToListAsync();
                return Results.Ok(items);
            }).RequireAuthorization();

            // Batch attendance
            g.MapPost("/{id}/attendance/batch", async (Guid id, [FromBody] BatchAttendanceDto body, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Err("forbidden", 403);
                var q = db.Padron.Where(p => p.ElectionId == id);
                if (body.Ids is not null && body.Ids.Count > 0) q = q.Where(p => body.Ids.Contains(p.Id));
                await q.ExecuteUpdateAsync(u => u.SetProperty(p => p.Attendance, body.Attendance));
                return Results.Ok();
            }).RequireAuthorization();

            // Upload proxy (PDF max 10MB)
            g.MapPost("/{id}/padron/{padronId}/proxy", async (Guid id, Guid padronId, IFormFile file, IWebHostEnvironment env, IConfiguration cfg, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (file.Length == 0 || file.Length > 10 * 1024 * 1024) return Err("invalid_file_size", 400);
                if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase)) return Err("invalid_content_type", 400);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Err("forbidden", 403);
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                if (string.IsNullOrWhiteSpace(entry.Proxy)) return Err("proxy_required", 400);
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var dir = Path.Combine(root, "elections", id.ToString(), "actas");
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, padronId + ".pdf");
                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write)) await file.CopyToAsync(fs);
                var url = $"/uploads/elections/{id}/actas/{padronId}.pdf";
                return Results.Ok(new { url });
            }).RequireAuthorization().DisableAntiforgery();

            // Alias route: /acta
            g.MapPost("/{id}/padron/{padronId}/acta", async (Guid id, Guid padronId, IFormFile file, IWebHostEnvironment env, IConfiguration cfg, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (file.Length == 0 || file.Length > 10 * 1024 * 1024) return Err("invalid_file_size", 400);
                if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase)) return Err("invalid_content_type", 400);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar))
                    return Err("forbidden", 403);
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                if (string.IsNullOrWhiteSpace(entry.Proxy)) return Err("proxy_required", 400);
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var dir = Path.Combine(root, "elections", id.ToString(), "actas");
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, padronId + ".pdf");
                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write)) await file.CopyToAsync(fs);
                var url = $"/uploads/elections/{id}/actas/{padronId}.pdf";
                return Results.Ok(new { url });
            }).RequireAuthorization().DisableAntiforgery();

            g.MapGet("/{id}/quorum", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.ElectionRegistrar));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                return Results.Ok(new { Total = total, Present = present, Quorum = total == 0 ? 0 : present / total });
            }).RequireAuthorization();

            g.MapPost("/{id}/votes", async (Guid id, [FromBody] VoteDto dto, BvgDbContext db, IHubContext<LiveHub> hub, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionRegistrar || a.Role == AppRoles.VoteOperator)))
                    return Err("forbidden", 403);
                var election = await db.Elections.Include(e => e.Padron).Include(e => e.Votes).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.IsClosed) return Err("election_closed", 400);
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                if (total == 0 || present / total < election.QuorumMinimo)
                    return Err("quorum_not_met", 400);
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
            }).RequireAuthorization();

            // Attendance marking
            g.MapPost("/{id}/padron/{padronId}/attendance", async (Guid id, Guid padronId, [FromBody] AttendanceDto dto, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionRegistrar);
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                entry.Attendance = dto.Attendance;
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization();

            g.MapGet("/{id}/results", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections.Include(e => e.Questions).ThenInclude(q => q.Options).Include(e => e.Votes).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.ElectionObserver);
                    if (!hasAssign) return Err("forbidden", 403);
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
            }).RequireAuthorization();

            g.MapPost("/{id}/close", async (Guid id, BvgDbContext db) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections.FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                election.IsClosed = true;
                await db.SaveChangesAsync();
                return Results.Ok();
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin)).DisableAntiforgery();

            // Update election basic fields (name, details, scheduledAt, quorum)
            g.MapPut("/{id}", async (Guid id, [FromBody] UpdateElectionDto dto, BvgDbContext db) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                var e = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (!string.IsNullOrWhiteSpace(dto.Name)) e.Name = dto.Name!;
                if (dto.Details is not null) e.Details = dto.Details!;
                if (dto.ScheduledAt.HasValue) e.ScheduledAt = dto.ScheduledAt.Value;
                if (dto.QuorumMinimo.HasValue)
                {
                    var q = dto.QuorumMinimo.Value;
                    if (q <= 0 || q > 1) return Err("invalid_quorum", 400);
                    e.QuorumMinimo = q;
                }
                await db.SaveChangesAsync();
                return Results.Ok(new { e.Id });
            }).RequireAuthorization();

            return app;
        }

        public record CreateElectionDto(string Name, string? Details, DateTimeOffset ScheduledAt, decimal QuorumMinimo, List<CreateQuestionDto> Questions);
        public record CreateQuestionDto(string Text, List<string> Options);
        public record AttendanceDto(AttendanceType Attendance);
        public record VoteDto(Guid PadronId, Guid QuestionId, Guid OptionId);
        public record AssignmentDto(string UserId, string Role);
        public record BatchAttendanceDto(List<Guid>? Ids, AttendanceType Attendance);
        public record UpdateElectionDto(string? Name, string? Details, DateTimeOffset? ScheduledAt, decimal? QuorumMinimo);
    }
}

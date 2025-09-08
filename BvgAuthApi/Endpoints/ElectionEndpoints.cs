using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using BvgAuthApi.Data;
using BvgAuthApi.Hubs;
using BvgAuthApi.Models;
using System.Security.Claims;
using System.Text.Json;
using System.Collections.Generic;

namespace BvgAuthApi.Endpoints
{
    public static class ElectionEndpoints
    {
        private static string ComputeLogHash(AttendanceLog log)
        {
            var payload = $"{log.ElectionId}|{log.PadronEntryId}|{(int)log.OldAttendance}|{(int)log.NewAttendance}|{log.UserId}|{log.Timestamp:O}|{log.PrevHash}";
            var bytes = System.Text.Encoding.UTF8.GetBytes(payload);
            var hash = System.Security.Cryptography.SHA256.HashData(bytes);
            return Convert.ToHexString(hash);
        }
        public static IEndpointRouteBuilder MapElections(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/elections");
            // Batch status: /api/elections/status?ids=guid1,guid2
            g.MapGet("/status", async ([FromQuery] string? ids, BvgDbContext db) =>
            {
                var result = new Dictionary<Guid, object>();
                if (string.IsNullOrWhiteSpace(ids)) return Results.Ok(result);
                var list = new List<Guid>();
                foreach (var raw in ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    if (Guid.TryParse(raw, out var gid)) list.Add(gid);
                }
                if (list.Count == 0) return Results.Ok(result);
                var elections = await db.Elections.Where(e => list.Contains(e.Id)).Include(e => e.Padron).ToListAsync();
                var flags = await db.ElectionFlags.Where(f => list.Contains(f.ElectionId)).ToListAsync();
                foreach (var e in elections)
                {
                    var f = flags.FirstOrDefault(x => x.ElectionId == e.Id);
                    var totalShares = e.Padron.Sum(p => p.Shares);
                    var presentShares = e.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                    var status = e.Status.ToString();
                    bool CanOpenReg = e.Status == ElectionStatus.Draft;
                    bool CanCloseReg = e.Status == ElectionStatus.RegistrationOpen;
                    bool CanOpenVote = e.Status == ElectionStatus.RegistrationClosed;
                    bool CanCloseVote = e.Status == ElectionStatus.VotingOpen;
                    bool CanCertify = e.Status == ElectionStatus.VotingClosed;
                    bool CanReopenReg = e.Status == ElectionStatus.RegistrationClosed;
                    result[e.Id] = new
                    {
                        e.Id,
                        Status = status,
                        Locked = f?.AttendanceClosed == true,
                        e.QuorumMinimo,
                        Shares = new { Total = totalShares, Present = presentShares },
                        Actions = new { CanOpenReg, CanCloseReg, CanOpenVote, CanCloseVote, CanCertify, CanReopenReg }
                    };
                }
                return Results.Ok(result);
            }).RequireAuthorization();
            // Estado actual + acciones permitidas
            g.MapGet("/{id}/status", async (Guid id, BvgDbContext db) =>
            {
                var e = await db.Elections.Include(x => x.Padron).FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Results.Json(new { error = "election_not_found" }, statusCode: 404);
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                var totalShares = e.Padron.Sum(p => p.Shares);
                var presentShares = e.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var status = e.Status.ToString();
                bool CanOpenReg = e.Status == ElectionStatus.Draft;
                bool CanCloseReg = e.Status == ElectionStatus.RegistrationOpen;
                bool CanOpenVote = e.Status == ElectionStatus.RegistrationClosed;
                bool CanCloseVote = e.Status == ElectionStatus.VotingOpen;
                bool CanCertify = e.Status == ElectionStatus.VotingClosed;
                bool CanReopenReg = e.Status == ElectionStatus.RegistrationClosed;
                return Results.Ok(new {
                    e.Id,
                    Status = status,
                    Locked = flags?.AttendanceClosed == true,
                    e.QuorumMinimo,
                    Shares = new { Total = totalShares, Present = presentShares },
                    Actions = new { CanOpenReg, CanCloseReg, CanOpenVote, CanCloseVote, CanCertify, CanReopenReg }
                });
            }).RequireAuthorization();
            // Estado de elección: transiciones y reglas
            g.MapPost("/{id}/status/open-registration", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.Draft) return Err("invalid_state", 400);
                e.Status = ElectionStatus.RegistrationOpen;
                e.RegistrationOpenedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (f is null) { f = new ElectionFlag { ElectionId = id, AttendanceClosed = false }; db.ElectionFlags.Add(f); } else f.AttendanceClosed = false;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceLockChanged", new { ElectionId = id, Locked = false });
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();

            g.MapPost("/{id}/status/close-registration", async (Guid id, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.RegistrationOpen) return Err("invalid_state", 400);
                var confirm = body.TryGetProperty("confirm", out var c) && c.ValueKind == JsonValueKind.True;
                if (!confirm) return Err("confirm_required", 409, new { action = "close-registration" });
                e.Status = ElectionStatus.RegistrationClosed;
                e.RegistrationClosedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (f is null) { f = new ElectionFlag { ElectionId = id, AttendanceClosed = true }; db.ElectionFlags.Add(f); } else f.AttendanceClosed = true;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceLockChanged", new { ElectionId = id, Locked = true });

                // Auto-open voting disabled: opening voting is a manual action after quorum validation
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();

            // Re-abrir registro (solo si estaba cerrado y no se abrió votación)
            g.MapPost("/{id}/status/reopen-registration", async (Guid id, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.RegistrationClosed) return Err("invalid_state", 400);
                var confirm = body.TryGetProperty("confirm", out var c) && c.ValueKind == JsonValueKind.True;
                if (!confirm) return Err("confirm_required", 409, new { action = "reopen-registration" });
                e.Status = ElectionStatus.RegistrationOpen;
                e.RegistrationOpenedAt ??= DateTimeOffset.UtcNow;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (f is null) { f = new ElectionFlag { ElectionId = id, AttendanceClosed = false }; db.ElectionFlags.Add(f); } else f.AttendanceClosed = false;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceLockChanged", new { ElectionId = id, Locked = false });
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();

            g.MapPost("/{id}/status/open-voting", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.Include(x => x.Padron).FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.RegistrationClosed) return Err("invalid_state", 400);
                var totalShares = e.Padron.Sum(p => p.Shares);
                var presentShares = e.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var ratio = totalShares == 0 ? 0 : presentShares / (totalShares == 0 ? 1 : totalShares);
                if (ratio < e.QuorumMinimo) return Err("quorum_not_met", 400, new { TotalShares = totalShares, PresentShares = presentShares, Ratio = ratio, QuorumMinimo = e.QuorumMinimo });
                e.Status = ElectionStatus.VotingOpen;
                e.VotingOpenedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();

            g.MapPost("/{id}/status/close-voting", async (Guid id, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.Include(x=>x.Questions).Include(x=>x.Padron).Include(x=>x.Votes).FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.VotingOpen) return Err("invalid_state", 400);
                var confirm = body.TryGetProperty("confirm", out var c) && c.ValueKind == JsonValueKind.True;
                if (!confirm) return Err("confirm_required", 409, new { action = "close-voting" });
                // Enforce 100% responses: each present must have voted every question
                var presentIds = e.Padron.Where(p => p.Attendance != AttendanceType.None).Select(p => p.Id).ToList();
                foreach (var pid in presentIds)
                    foreach (var q in e.Questions)
                        if (!e.Votes.Any(v => v.PadronEntryId == pid && v.ElectionQuestionId == q.Id))
                            return Err("incomplete_votes", 400, new { message = "Faltan votos para completar 100% de respuestas de presentes en todas las preguntas" });
                e.Status = ElectionStatus.VotingClosed;
                e.VotingClosedAt = DateTimeOffset.UtcNow;
                e.IsClosed = true;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var fcv = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (fcv is null) { fcv = new ElectionFlag { ElectionId = id, AttendanceClosed = true }; db.ElectionFlags.Add(fcv); } else fcv.AttendanceClosed = true;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();

            g.MapPost("/{id}/status/certify", async (Guid id, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub, IConfiguration cfg, BvgAuthApi.Services.AppRuntimeSettings runtime) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var e = await db.Elections.Include(x=>x.Questions).Include(x=>x.Padron).Include(x=>x.Votes).FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.VotingClosed) return Err("invalid_state", 400);
                var confirm = body.TryGetProperty("confirm", out var c) && c.ValueKind == JsonValueKind.True;
                if (!confirm) return Err("confirm_required", 409, new { action = "certify" });
                // Enforce 100% responses
                var presentIds2 = e.Padron.Where(p => p.Attendance != AttendanceType.None).Select(p => p.Id).ToList();
                foreach (var pid in presentIds2)
                    foreach (var q in e.Questions)
                        if (!e.Votes.Any(v => v.PadronEntryId == pid && v.ElectionQuestionId == q.Id))
                            return Err("incomplete_results", 400);
                // Optional: require signing configured
                var requireSign = e.SigningRequired || runtime.SigningRequireForCertification || cfg.GetValue<bool>("Signing:RequireForCertification");
                // If election explicitly requires signing, a per-election profile must be set
                if (e.SigningRequired && string.IsNullOrWhiteSpace(e.SigningProfile))
                    return Err("signing_profile_missing", 400);
                if (requireSign)
                {
                    // If using per-election profile, trust it at signing time; otherwise ensure default PFX exists
                    if (string.IsNullOrWhiteSpace(e.SigningProfile))
                    {
                        var pfxPath = string.IsNullOrWhiteSpace(runtime.SigningDefaultPfxPath) ? cfg["Signing:DefaultPfxPath"] ?? string.Empty : runtime.SigningDefaultPfxPath;
                        if (string.IsNullOrWhiteSpace(pfxPath) || !System.IO.File.Exists(pfxPath))
                            return Err("signing_not_configured", 500);
                    }
                }
                e.Status = ElectionStatus.Certified;
                e.CertifiedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedAt = DateTimeOffset.UtcNow;
                e.LastStatusChangedBy = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("statusChanged", new { ElectionId = id, Status = e.Status.ToString() });
                return Results.Ok(new { e.Status });
            }).RequireAuthorization();
            g.MapGet("/{id}/dashboard", async (Guid id, BvgAuthApi.Services.MetricsService metrics, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                // Same auth model: admins or per-election assignment
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId &&
                        (a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar || a.Role == AppRoles.ElectionObserver));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var data = await metrics.ComputeDashboard(id);
                return Results.Ok(data);
            }).RequireAuthorization().DisableAntiforgery();

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
                    // Ensure Abstention option exists by default
                    if (!qn.Options.Any(o => string.Equals(o.Text, "Abstención", StringComparison.OrdinalIgnoreCase) || string.Equals(o.Text, "Abstencion", StringComparison.OrdinalIgnoreCase)))
                        qn.Options.Add(new ElectionOption { Text = "Abstención" });
                    e.Questions.Add(qn);
                }
                db.Elections.Add(e);
                await db.SaveChangesAsync();
                return Results.Created($"/api/elections/{e.Id}", new { e.Id });
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin)).DisableAntiforgery();

            g.MapGet("/", async (BvgDbContext db) =>
                Results.Ok(await db.Elections.AsNoTracking()
                    .Select(e => new {
                        e.Id, e.Name, e.Details, e.ScheduledAt, e.QuorumMinimo,
                        Questions = e.Questions.Select(q => new { q.Id, q.Text, Options = q.Options.Select(o => new { o.Id, o.Text }) })
                    }).ToListAsync()))
                .RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapGet("/{id}", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections
                    .AsNoTracking()
                    .Include(e => e.Questions).ThenInclude(q => q.Options)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId &&
                        (a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar || a.Role == AppRoles.ElectionObserver));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var info = new
                {
                    election.Id,
                    election.Name,
                    election.Details,
                    election.ScheduledAt,
                    election.QuorumMinimo,
                    election.IsClosed,
                    Questions = election.Questions.Select(q => new { q.Id, q.Text, Options = q.Options.Select(o => new { o.Id, o.Text }) })
                };
                return Results.Ok(info);
            }).RequireAuthorization();

            // List Padron entries for an election
            g.MapGet("/{id}/padron", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IWebHostEnvironment env, IConfiguration cfg) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
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
            }).RequireAuthorization().DisableAntiforgery();

            g.MapPost("/{id}/padron", async (Guid id, IFormFile file, BvgDbContext db) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                const long maxFileSize = 5 * 1024 * 1024; // 5MB
                const int maxRows = 1000;

                // Validate file size and extension (.xlsx)
                var ext = System.IO.Path.GetExtension(file.FileName)?.ToLowerInvariant();
                if (file.Length == 0 || file.Length > maxFileSize || ext != ".xlsx")
                    return Err("invalid_file_size", 400);

                var election = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.Status == ElectionStatus.RegistrationClosed || election.Status == ElectionStatus.VotingOpen || election.Status == ElectionStatus.VotingClosed || election.Status == ElectionStatus.Certified)
                    return Err("padron_locked", 400);

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

                if (!decimal.TryParse(ws.Cells[row,5].Text, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var shares))
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

            // Preview Padron upload (no persist): validates and returns errors/sample
            g.MapPost("/{id}/padron/preview", async (Guid id, IFormFile file, BvgDbContext db) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                const long maxFileSize = 5 * 1024 * 1024; // 5MB
                const int maxRows = 5000;
                var ext = System.IO.Path.GetExtension(file.FileName)?.ToLowerInvariant();
                if (file.Length == 0 || file.Length > maxFileSize || ext != ".xlsx") return Err("invalid_file_size", 400);

                var election = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.Status == ElectionStatus.RegistrationClosed || election.Status == ElectionStatus.VotingOpen || election.Status == ElectionStatus.VotingClosed || election.Status == ElectionStatus.Certified)
                    return Err("padron_locked", 400);

                OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                ms.Position = 0;
                using var pkg = new OfficeOpenXml.ExcelPackage(ms);
                var ws = pkg.Workbook.Worksheets.First();

                var preview = new List<object>();
                var errors = new List<object>();
                var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (int row = 2; ws.Cells[row,1].Value != null; row++)
                {
                    if (row - 1 > maxRows) { errors.Add(new { row, error = "too_many_rows" }); break; }
                    var idCell = ws.Cells[row,1].Text?.Trim();
                    var name = ws.Cells[row,2].Text?.Trim();
                    var rep = ws.Cells[row,3].Text?.Trim();
                    var proxy = ws.Cells[row,4].Text?.Trim();
                    var sharesText = ws.Cells[row,5].Text?.Trim();
                    if (string.IsNullOrWhiteSpace(idCell) || string.IsNullOrWhiteSpace(name))
                        errors.Add(new { row, error = "missing_required" });
                    if (!decimal.TryParse(sharesText, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var shares) || shares < 0)
                        errors.Add(new { row, error = "invalid_shares" });
                    if (!string.IsNullOrWhiteSpace(idCell) && !seenIds.Add(idCell))
                        errors.Add(new { row, error = "duplicate_id" });
                    preview.Add(new { ShareholderId = idCell, ShareholderName = name, LegalRepresentative = rep, Proxy = proxy, Shares = sharesText });
                }
                return Results.Ok(new { Count = preview.Count, Errors = errors, Sample = preview.Take(10) });
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            g.MapPost("/{id}/assignments", async (Guid id, [FromBody] AssignmentDto dto, BvgDbContext db) =>
            {
                var election = await db.Elections.FindAsync(id);
                if (election is null) return Results.NotFound();
                // Allow only per-election roles
                var allowed = new[] { AppRoles.AttendanceRegistrar, AppRoles.VoteRegistrar, AppRoles.ElectionObserver };
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
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
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
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.AttendanceRegistrar))
                    return Err("forbidden", 403);
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id);
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.IsClosed) return Err("election_closed", 400);
                if (election.Status != ElectionStatus.RegistrationOpen) return Err("attendance_not_allowed", 400);
                if (flags?.AttendanceClosed == true) return Err("attendance_closed", 400);
                var padron = election.Padron.FirstOrDefault(p => p.Id == padronId);
                if (padron is null) return Err("padron_entry_not_found", 404);
                var oldAtt2 = padron.Attendance;
                padron.Attendance = dto.Attendance;
                var last3 = await db.AttendanceLogs.Where(l => l.ElectionId == id)
                    .OrderByDescending(l => l.Timestamp).Select(l => new { l.SelfHash }).FirstOrDefaultAsync();
                var prev3 = last3?.SelfHash ?? string.Empty;
                var log3 = new AttendanceLog
                {
                    ElectionId = id,
                    PadronEntryId = padronId,
                    OldAttendance = oldAtt2,
                    NewAttendance = padron.Attendance,
                    UserId = userId,
                    PrevHash = prev3
                };
                log3.SelfHash = ComputeLogHash(log3);
                db.AttendanceLogs.Add(log3);
                await db.SaveChangesAsync();
                // Broadcast richer summary and metrics
                var totalShares = election.Padron.Sum(p => p.Shares);
                var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var quorum = totalShares == 0 ? 0 : presentShares / totalShares;
                var quorumOk = totalShares > 0 && quorum >= election.QuorumMinimo;
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceUpdated", new { ElectionId = id, PadronId = padronId, Attendance = padron.Attendance.ToString() });
                await hub.Clients.Group($"election-{id}").SendAsync("quorumUpdated", new { ElectionId = id, TotalShares = totalShares, PresentShares = presentShares, Quorum = quorum, Achieved = quorumOk });
                var total = election.Padron.Count;
                var presencial = election.Padron.Count(p => p.Attendance == AttendanceType.Presencial);
                var @virtual = election.Padron.Count(p => p.Attendance == AttendanceType.Virtual);
                var ausente = election.Padron.Count(p => p.Attendance == AttendanceType.None);
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceSummary", new { ElectionId = id, Total = total, Presencial = presencial, Virtual = @virtual, Ausente = ausente, TotalShares = totalShares, PresentShares = presentShares, Locked = false, QuorumMin = election.QuorumMinimo });
                var metrics = new BvgAuthApi.Services.MetricsService(db);
                var data = await metrics.ComputeDashboard(id);
                await hub.Clients.Group($"election-{id}").SendAsync("metricsUpdated", data);
                return Results.Ok();
            }).RequireAuthorization();

            // Assigned elections for current user and role
            g.MapGet("/assigned", async (string role, BvgDbContext db, ClaimsPrincipal user) =>
            {
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var rLower = role.Trim().ToLower();
                var ids = await db.ElectionUserAssignments
                    .Where(a => a.UserId == userId && a.Role.ToLower() == rLower)
                    .Select(a => a.ElectionId)
                    .ToListAsync();
                var items = await db.Elections
                    .Where(e => ids.Contains(e.Id))
                    .Select(e => new { e.Id, e.Name, e.ScheduledAt, e.IsClosed })
                    .ToListAsync();
                return Results.Ok(items);
            }).RequireAuthorization();

            // Batch attendance
            g.MapPost("/{id}/attendance/batch", async (Guid id, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.AttendanceRegistrar))
                    return Err("forbidden", 403);
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id);
                var e = await db.Elections.FirstOrDefaultAsync(x => x.Id == id);
                if (e is null) return Err("election_not_found", 404);
                if (e.Status != ElectionStatus.RegistrationOpen) return Err("attendance_not_allowed", 400);
                if (flags?.AttendanceClosed == true) return Err("attendance_closed", 400);
                // Parse attendance from body (accept string or number)
                if (!body.TryGetProperty("attendance", out var attProp)) return Err("missing_attendance", 400);
                AttendanceType newAtt;
                if (attProp.ValueKind == JsonValueKind.Number && attProp.TryGetInt32(out var attNum))
                {
                    newAtt = attNum == 2 ? AttendanceType.Presencial : attNum == 1 ? AttendanceType.Virtual : AttendanceType.None;
                }
                else if (attProp.ValueKind == JsonValueKind.String)
                {
                    var s = attProp.GetString() ?? string.Empty;
                    newAtt = s.Equals("Presencial", StringComparison.OrdinalIgnoreCase) ? AttendanceType.Presencial
                         : s.Equals("Virtual", StringComparison.OrdinalIgnoreCase) ? AttendanceType.Virtual
                         : AttendanceType.None;
                }
                else return Err("invalid_attendance", 400);

                // Optional ids
                var idsFilter = new List<Guid>();
                if (body.TryGetProperty("ids", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var it in idsEl.EnumerateArray())
                    {
                        if (it.ValueKind == JsonValueKind.String && Guid.TryParse(it.GetString(), out var gid)) idsFilter.Add(gid);
                        else if (it.ValueKind == JsonValueKind.Object && it.TryGetProperty("id", out var idStr) && Guid.TryParse(idStr.GetString(), out var gid2)) idsFilter.Add(gid2);
                    }
                }

                var q = db.Padron.Where(p => p.ElectionId == id);
                if (idsFilter.Count > 0) q = q.Where(p => idsFilter.Contains(p.Id));
                var list = await q.ToListAsync();
                var reason = body.TryGetProperty("reason", out var reasonProp) && reasonProp.ValueKind == JsonValueKind.String ? reasonProp.GetString() : null;
                foreach (var entry in list)
                {
                    if (entry.Attendance != newAtt)
                    {
                        var old = entry.Attendance;
                        entry.Attendance = newAtt;
                        var last = await db.AttendanceLogs.Where(l => l.ElectionId == id)
                            .OrderByDescending(l => l.Timestamp).Select(l => new { l.SelfHash }).FirstOrDefaultAsync();
                        var prev = last?.SelfHash ?? string.Empty;
                        var log = new AttendanceLog
                        {
                            ElectionId = id,
                            PadronEntryId = entry.Id,
                            OldAttendance = old,
                            NewAttendance = entry.Attendance,
                            UserId = userId,
                            Reason = reason,
                            PrevHash = prev
                        };
                        log.SelfHash = ComputeLogHash(log);
                        db.AttendanceLogs.Add(log);
                    }
                }
                await db.SaveChangesAsync();
                // Broadcast summary update for observers/registrars
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is not null)
                {
                    var total = election.Padron.Count;
                    var presencial = election.Padron.Count(p => p.Attendance == AttendanceType.Presencial);
                    var @virtual = election.Padron.Count(p => p.Attendance == AttendanceType.Virtual);
                    var ausente = election.Padron.Count(p => p.Attendance == AttendanceType.None);
                    var totalShares = election.Padron.Sum(p => p.Shares);
                    var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                    var locked = (await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id))?.AttendanceClosed == true;
                    var quorum = totalShares == 0 ? 0 : presentShares / totalShares;
                    var quorumOk = totalShares > 0 && quorum >= election.QuorumMinimo;
                    await hub.Clients.Group($"election-{id}").SendAsync("attendanceSummary", new { ElectionId = id, Total = total, Presencial = presencial, Virtual = @virtual, Ausente = ausente, TotalShares = totalShares, PresentShares = presentShares, Locked = locked, QuorumMin = election.QuorumMinimo });
                    await hub.Clients.Group($"election-{id}").SendAsync("quorumUpdated", new { ElectionId = id, TotalShares = totalShares, PresentShares = presentShares, Quorum = quorum, Achieved = quorumOk });
                    var metrics = new BvgAuthApi.Services.MetricsService(db);
                    var data = await metrics.ComputeDashboard(id);
                    await hub.Clients.Group($"election-{id}").SendAsync("metricsUpdated", data);
                }
                return Results.Ok();
            }).RequireAuthorization().DisableAntiforgery();

            // Upload proxy (PDF max 10MB)
            g.MapPost("/{id}/padron/{padronId}/proxy", async (Guid id, Guid padronId, IFormFile file, IWebHostEnvironment env, IConfiguration cfg, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                var ext = System.IO.Path.GetExtension(file.FileName)?.ToLowerInvariant();
                if (file.Length == 0 || file.Length > 10 * 1024 * 1024) return Err("invalid_file_size", 400);
                if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase) || ext != ".pdf") return Err("invalid_content_type", 400);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.AttendanceRegistrar))
                    return Err("forbidden", 403);
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                if (string.IsNullOrWhiteSpace(entry.Proxy)) return Err("proxy_required", 400);
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var dir = Path.Combine(root, "elections", id.ToString(), "actas");
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, padronId + ".pdf");
                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write)) await file.CopyToAsync(fs);
                var url = $"/api/elections/{id}/padron/{padronId}/acta";
                await hub.Clients.Group($"election-{id}").SendAsync("actaUploaded", new { ElectionId = id, PadronId = padronId, Url = url });
                return Results.Ok(new { url });
            }).RequireAuthorization().DisableAntiforgery();

            // Alias route: /acta
            g.MapPost("/{id}/padron/{padronId}/acta", async (Guid id, Guid padronId, IFormFile file, IWebHostEnvironment env, IConfiguration cfg, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
                var ext = System.IO.Path.GetExtension(file.FileName)?.ToLowerInvariant();
                if (file.Length == 0 || file.Length > 10 * 1024 * 1024) return Err("invalid_file_size", 400);
                if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase) || ext != ".pdf") return Err("invalid_content_type", 400);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.AttendanceRegistrar))
                    return Err("forbidden", 403);
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                if (string.IsNullOrWhiteSpace(entry.Proxy)) return Err("proxy_required", 400);
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var dir = Path.Combine(root, "elections", id.ToString(), "actas");
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, padronId + ".pdf");
                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write)) await file.CopyToAsync(fs);
                var url = $"/api/elections/{id}/padron/{padronId}/acta";
                await hub.Clients.Group($"election-{id}").SendAsync("actaUploaded", new { ElectionId = id, PadronId = padronId, Url = url });
                return Results.Ok(new { url });
            }).RequireAuthorization().DisableAntiforgery();

            // Download acta/proxy PDF (authorized)
            g.MapGet("/{id}/padron/{padronId}/acta", async (Guid id, Guid padronId, IWebHostEnvironment env, IConfiguration cfg, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar || a.Role == AppRoles.ElectionObserver));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var root = Path.Combine(env.ContentRootPath, cfg["Storage:Root"] ?? "uploads");
                var path = Path.Combine(root, "elections", id.ToString(), "actas", padronId + ".pdf");
                if (!System.IO.File.Exists(path)) return Err("not_found", 404);
                return Results.File(path, "application/pdf");
            }).RequireAuthorization();

            g.MapGet("/{id}/quorum", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var totalShares = total;
                var presentShares = present;
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id);
                var locked = flags?.AttendanceClosed == true;
                return Results.Ok(new { Total = total, Present = present, Quorum = total == 0 ? 0 : present / total, TotalShares = totalShares, PresentShares = presentShares, QuorumMin = election.QuorumMinimo, Locked = locked });
            }).RequireAuthorization();

            // Attendance summary (counts per status) for charts
            g.MapGet("/{id}/attendance/summary", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var total = election.Padron.Count;
                var presencial = election.Padron.Count(p => p.Attendance == AttendanceType.Presencial);
                var @virtual = election.Padron.Count(p => p.Attendance == AttendanceType.Virtual);
                var ausente = election.Padron.Count(p => p.Attendance == AttendanceType.None);
                var totalShares = election.Padron.Sum(p => p.Shares);
                var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id);
                var locked = flags?.AttendanceClosed == true;
                return Results.Ok(new { total, presencial, @virtual, ausente, totalShares, presentShares, quorumMin = election.QuorumMinimo, locked });
            }).RequireAuthorization();

            // Attendance logs (audit)
            g.MapGet("/{id}/attendance/logs", async (Guid id, BvgDbContext db, ClaimsPrincipal user, int? take) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var limit = take.HasValue && take.Value > 0 ? Math.Min(take.Value, 500) : 200;
                var logs = await (
                    from l in db.AttendanceLogs
                    join u in db.Users on l.UserId equals u.Id into gj
                    from u in gj.DefaultIfEmpty()
                    where l.ElectionId == id
                    orderby l.Timestamp descending
                    select new { l.PadronEntryId, l.OldAttendance, l.NewAttendance, l.UserId, UserName = (string?)u!.UserName, l.Timestamp }
                )
                .Take(limit)
                .ToListAsync();
                return Results.Ok(logs);
            }).RequireAuthorization();

            // Start election and return first question with present padron
            g.MapPost("/{id}/start", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections
                    .Include(e => e.Questions).ThenInclude(q => q.Options)
                    .Include(e => e.Padron)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.VoteRegistrar);
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var firstQ = election.Questions
                    .OrderBy(q => q.Id)
                    .Select(q => new { q.Id, q.Text, Options = q.Options.Select(o => new { o.Id, o.Text }) })
                    .FirstOrDefault();
                var present = election.Padron
                    .Where(p => p.Attendance != AttendanceType.None)
                    .Select(p => new { p.Id, p.ShareholderName, p.Shares })
                    .ToList();
                return Results.Ok(new { Question = firstQ, Padron = present });
            }).RequireAuthorization().DisableAntiforgery();

            g.MapPost("/{id}/votes", async (Guid id, [FromBody] VoteDto dto, BvgDbContext db, IHubContext<LiveHub> hub, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.VoteRegistrar))
                    return Err("forbidden", 403);
                var election = await db.Elections
                    .Include(e => e.Padron)
                    .Include(e => e.Votes)
                    .Include(e => e.Questions).ThenInclude(q => q.Options)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.IsClosed) return Err("election_closed", 400);
                if (election.Status != ElectionStatus.VotingOpen) return Err("voting_not_open", 400);
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                if (total == 0 || present / total < election.QuorumMinimo)
                    return Err("quorum_not_met", 400);
                var padron = election.Padron.FirstOrDefault(p => p.Id == dto.PadronId);
                if (padron is null) return Err("padron_not_found", 400);
                if (padron.Attendance == AttendanceType.None) return Err("padron_not_present", 400);
                var question = election.Questions.FirstOrDefault(q => q.Id == dto.QuestionId);
                if (question is null) return Err("question_not_found", 400);
                if (!question.Options.Any(o => o.Id == dto.OptionId)) return Err("option_not_found", 400);
                if (election.Votes.Any(v => v.PadronEntryId == dto.PadronId && v.ElectionQuestionId == dto.QuestionId))
                    return Err("vote_duplicate", 400);
                var registrarId = userId;
                db.Votes.Add(new VoteRecord
                {
                    ElectionId = id,
                    PadronEntryId = dto.PadronId,
                    ElectionQuestionId = dto.QuestionId,
                    ElectionOptionId = dto.OptionId,
                    RegistrarId = registrarId
                });
                try
                {
                    await db.SaveChangesAsync();
                }
                catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true)
                {
                    return Err("vote_duplicate", 400);
                }
                await hub.Clients.Group($"election-{id}").SendAsync("voteRegistered", new { ElectionId = id, QuestionId = dto.QuestionId, OptionId = dto.OptionId });
                return Results.Ok();
            }).RequireAuthorization();

            g.MapPost("/{id}/votes/batch", async (Guid id, [FromBody] BatchVoteDto dto, BvgDbContext db, IHubContext<LiveHub> hub, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin && !await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.VoteRegistrar))
                    return Err("forbidden", 403);
                var election = await db.Elections
                    .Include(e => e.Padron)
                    .Include(e => e.Votes)
                    .Include(e => e.Questions).ThenInclude(q => q.Options)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (election.IsClosed) return Err("election_closed", 400);
                if (election.Status != ElectionStatus.VotingOpen) return Err("voting_not_open", 400);
                var total = election.Padron.Sum(p => p.Shares);
                var present = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                if (total == 0 || present / total < election.QuorumMinimo)
                    return Err("quorum_not_met", 400);
                var registrarId = userId;
                var existingPairs = new HashSet<(Guid, Guid)>(election.Votes.Select(v => (v.PadronEntryId, v.ElectionQuestionId)));
                var batchPairs = new HashSet<(Guid, Guid)>();
                foreach (var v in dto.Votes)
                {
                    if (!election.Padron.Any(p => p.Id == v.PadronId)) return Err("padron_not_found", 400);
                    if (election.Padron.First(p => p.Id == v.PadronId).Attendance == AttendanceType.None) return Err("padron_not_present", 400);
                    var q = election.Questions.FirstOrDefault(q => q.Id == v.QuestionId);
                    if (q is null) return Err("question_not_found", 400);
                    if (!q.Options.Any(o => o.Id == v.OptionId)) return Err("option_not_found", 400);
                    var key = (v.PadronId, v.QuestionId);
                    if (existingPairs.Contains(key) || !batchPairs.Add(key)) return Err("vote_duplicate", 400);
                    db.Votes.Add(new VoteRecord
                    {
                        ElectionId = id,
                        PadronEntryId = v.PadronId,
                        ElectionQuestionId = v.QuestionId,
                        ElectionOptionId = v.OptionId,
                        RegistrarId = registrarId
                    });
                }
                try
                {
                    await db.SaveChangesAsync();
                }
                catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true)
                {
                    return Err("vote_duplicate", 400);
                }
                foreach (var v in dto.Votes)
                    await hub.Clients.Group($"election-{id}").SendAsync("voteRegistered", new { ElectionId = id, QuestionId = v.QuestionId, OptionId = v.OptionId });
                // Broadcast metrics update to election group
                var metrics = new BvgAuthApi.Services.MetricsService(db);
                var data = await metrics.ComputeDashboard(id);
                await hub.Clients.Group($"election-{id}").SendAsync("metricsUpdated", data);
                return Results.Ok(new { Count = dto.Votes.Count });
            }).RequireAuthorization();

            g.MapGet("/{id}/votes/logs", async (Guid id, BvgDbContext db) =>
            {
                var logs = await db.Votes.Where(v => v.ElectionId == id)
                    .Select(v => new { v.Id, v.PadronEntryId, v.ElectionQuestionId, v.ElectionOptionId, v.RegistrarId, v.Timestamp })
                    .ToListAsync();
                return Results.Ok(logs);
            }).RequireAuthorization(p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));

            // Attendance marking
            g.MapPost("/{id}/padron/{padronId}/attendance", async (Guid id, Guid padronId, [FromBody] JsonElement body, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && a.Role == AppRoles.AttendanceRegistrar);
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var flags = await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id);
                if (flags?.AttendanceClosed == true) return Err("attendance_closed", 400);
                // Parse attendance
                if (!body.TryGetProperty("attendance", out var attProp)) return Err("missing_attendance", 400);
                AttendanceType newAtt;
                if (attProp.ValueKind == JsonValueKind.Number && attProp.TryGetInt32(out var attNum))
                {
                    newAtt = attNum == 2 ? AttendanceType.Presencial : attNum == 1 ? AttendanceType.Virtual : AttendanceType.None;
                }
                else if (attProp.ValueKind == JsonValueKind.String)
                {
                    var s = attProp.GetString() ?? string.Empty;
                    newAtt = s.Equals("Presencial", StringComparison.OrdinalIgnoreCase) ? AttendanceType.Presencial
                         : s.Equals("Virtual", StringComparison.OrdinalIgnoreCase) ? AttendanceType.Virtual
                         : AttendanceType.None;
                }
                else return Err("invalid_attendance", 400);
                var entry = await db.Padron.FirstOrDefaultAsync(p => p.Id == padronId && p.ElectionId == id);
                if (entry is null) return Err("padron_entry_not_found", 404);
                var oldAtt = entry.Attendance;
                entry.Attendance = newAtt;
                var reason = body.TryGetProperty("reason", out var reasonProp) && reasonProp.ValueKind == JsonValueKind.String ? reasonProp.GetString() : null;
                // Append immutable attendance log with PrevHash/SelfHash
                var last = await db.AttendanceLogs.Where(l => l.ElectionId == id)
                    .OrderByDescending(l => l.Timestamp).Select(l => new { l.SelfHash }).FirstOrDefaultAsync();
                var prev = last?.SelfHash ?? string.Empty;
                var log = new AttendanceLog
                {
                    ElectionId = id,
                    PadronEntryId = padronId,
                    OldAttendance = oldAtt,
                    NewAttendance = entry.Attendance,
                    UserId = userId,
                    Reason = reason,
                    PrevHash = prev
                };
                log.SelfHash = ComputeLogHash(log);
                db.AttendanceLogs.Add(log);
                await db.SaveChangesAsync();
                // Broadcast per-row update and quorum summary (optional)
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceUpdated", new { ElectionId = id, PadronId = padronId, Attendance = entry.Attendance.ToString() });
                var election = await db.Elections.Include(e => e.Padron).FirstOrDefaultAsync(e => e.Id == id);
                if (election is not null)
                {
                    var total = election.Padron.Count;
                    var presencial = election.Padron.Count(p => p.Attendance == AttendanceType.Presencial);
                    var @virtual = election.Padron.Count(p => p.Attendance == AttendanceType.Virtual);
                    var ausente = election.Padron.Count(p => p.Attendance == AttendanceType.None);
                    var totalShares = election.Padron.Sum(p => p.Shares);
                    var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                    var locked = (await db.ElectionFlags.FirstOrDefaultAsync(f => f.ElectionId == id))?.AttendanceClosed == true;
                    var quorum = totalShares == 0 ? 0 : presentShares / totalShares;
                    var quorumOk = totalShares > 0 && quorum >= election.QuorumMinimo;
                    await hub.Clients.Group($"election-{id}").SendAsync("attendanceSummary", new { ElectionId = id, Total = total, Presencial = presencial, Virtual = @virtual, Ausente = ausente, TotalShares = totalShares, PresentShares = presentShares, Locked = locked, QuorumMin = election.QuorumMinimo });
                    await hub.Clients.Group($"election-{id}").SendAsync("quorumUpdated", new { ElectionId = id, TotalShares = totalShares, PresentShares = presentShares, Quorum = quorum, Achieved = quorumOk });
                    var metrics = new BvgAuthApi.Services.MetricsService(db);
                    var data = await metrics.ComputeDashboard(id);
                    await hub.Clients.Group($"election-{id}").SendAsync("metricsUpdated", data);
                }
                return Results.Ok();
            }).RequireAuthorization().DisableAntiforgery();

            // Attendance lock/unlock (admins)
            g.MapPost("/{id}/attendance/lock", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (f is null) { f = new ElectionFlag { ElectionId = id, AttendanceClosed = true }; db.ElectionFlags.Add(f); }
                else f.AttendanceClosed = true;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceLockChanged", new { ElectionId = id, Locked = true });
                return Results.Ok(new { locked = true });
            }).RequireAuthorization();

            g.MapPost("/{id}/attendance/unlock", async (Guid id, BvgDbContext db, ClaimsPrincipal user, IHubContext<LiveHub> hub) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                if (!(user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin))) return Err("forbidden", 403);
                var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == id);
                if (f is null) { f = new ElectionFlag { ElectionId = id, AttendanceClosed = false }; db.ElectionFlags.Add(f); }
                else f.AttendanceClosed = false;
                await db.SaveChangesAsync();
                await hub.Clients.Group($"election-{id}").SendAsync("attendanceLockChanged", new { ElectionId = id, Locked = false });
                return Results.Ok(new { locked = false });
            }).RequireAuthorization();

            g.MapGet("/{id}/results", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                var election = await db.Elections
                    .Include(e => e.Questions).ThenInclude(q => q.Options)
                    .Include(e => e.Votes)
                    .Include(e => e.Padron)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (election is null) return Err("election_not_found", 404);
                if (!election.IsClosed) return Err("election_not_closed", 400);
                var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
                var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
                if (!isAdmin)
                {
                    var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId &&
                        (a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.VoteRegistrar || a.Role == AppRoles.AttendanceRegistrar));
                    if (!hasAssign) return Err("forbidden", 403);
                }
                var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);
                var results = election.Questions.Select(q => new {
                    QuestionId = q.Id,
                    q.Text,
                    Options = q.Options.Select(o => {
                        var votes = election.Votes.Where(v => v.ElectionQuestionId == q.Id && v.ElectionOptionId == o.Id);
                        var shares = (from v in votes join p in election.Padron on v.PadronEntryId equals p.Id select p.Shares).Sum();
                        var pct = presentShares == 0 ? 0 : shares / presentShares;
                        return new { OptionId = o.Id, o.Text, Votes = votes.Count(), Percent = pct };
                    })
                });
                return Results.Ok(results);
            }).RequireAuthorization();

            g.MapPost("/{id}/close", async (Guid id, BvgDbContext db) =>
            {
                return Results.Json(new { error = "operation_removed" }, statusCode: 410);
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
                if (dto.SigningRequired.HasValue) e.SigningRequired = dto.SigningRequired.Value;
                if (dto.SigningProfile is not null) e.SigningProfile = dto.SigningProfile;
                await db.SaveChangesAsync();
                return Results.Ok(new { e.Id });
            }).RequireAuthorization();

            return app;
        }

        public record CreateElectionDto(string Name, string? Details, DateTimeOffset ScheduledAt, decimal QuorumMinimo, List<CreateQuestionDto> Questions);
        public record CreateQuestionDto(string Text, List<string> Options);
        public record AttendanceDto(AttendanceType Attendance);
        public record VoteDto(Guid PadronId, Guid QuestionId, Guid OptionId);
        public record BatchVoteDto(List<VoteDto> Votes);
        public record AssignmentDto(string UserId, string Role);
        public record BatchAttendanceDto(List<Guid>? Ids, AttendanceType Attendance);
        public record UpdateElectionDto(string? Name, string? Details, DateTimeOffset? ScheduledAt, decimal? QuorumMinimo, bool? SigningRequired, string? SigningProfile);
    }
}

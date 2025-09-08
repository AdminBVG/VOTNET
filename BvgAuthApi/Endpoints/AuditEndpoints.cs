using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using BvgAuthApi.Data;
using BvgAuthApi.Models;

namespace BvgAuthApi.Endpoints;

public static class AuditEndpoints
{
    public static IEndpointRouteBuilder MapAudit(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/elections/{id:guid}/audit");

        g.MapGet("/attendance", async (Guid id, DateTimeOffset? from, DateTimeOffset? to, string? format, BvgDbContext db, ClaimsPrincipal user) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
            var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
            var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
            if (!isAdmin)
            {
                var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (
                    a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                if (!hasAssign) return Err("forbidden", 403);
            }
            var q = db.AttendanceLogs.Where(l => l.ElectionId == id);
            if (from.HasValue) q = q.Where(l => l.Timestamp >= from.Value);
            if (to.HasValue) q = q.Where(l => l.Timestamp <= to.Value);
            var logs = await (from l in q
                              join u in db.Users on l.UserId equals u.Id into gj
                              from u in gj.DefaultIfEmpty()
                              orderby l.Timestamp descending
                              select new { l.PadronEntryId, l.OldAttendance, l.NewAttendance, l.UserId, UserName = (string?)u!.UserName, l.Timestamp })
                              .ToListAsync();
            if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                var sb = new StringBuilder();
                sb.AppendLine("PadronEntryId,OldAttendance,NewAttendance,UserId,UserName,Timestamp");
                foreach (var l in logs)
                    sb.AppendLine(string.Join(',', new[] { l.PadronEntryId.ToString(), l.OldAttendance.ToString(), l.NewAttendance.ToString(), l.UserId, (l.UserName ?? "").Replace(',', ';'), l.Timestamp.ToString("o", CultureInfo.InvariantCulture) }));
                return Results.Text(sb.ToString(), "text/csv", Encoding.UTF8);
            }
            return Results.Ok(logs);
        }).RequireAuthorization();

        g.MapGet("/votes", async (Guid id, DateTimeOffset? from, DateTimeOffset? to, string? format, BvgDbContext db, ClaimsPrincipal user) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
            var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
            var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
            if (!isAdmin)
            {
                var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (
                    a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                if (!hasAssign) return Err("forbidden", 403);
            }
            var q = db.Votes.Where(v => v.ElectionId == id);
            if (from.HasValue) q = q.Where(v => v.Timestamp >= from.Value);
            if (to.HasValue) q = q.Where(v => v.Timestamp <= to.Value);
            var logs = await q.Select(v => new { v.Id, v.PadronEntryId, v.ElectionQuestionId, v.ElectionOptionId, v.RegistrarId, v.Timestamp }).ToListAsync();
            if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                var sb = new StringBuilder();
                sb.AppendLine("Id,PadronEntryId,QuestionId,OptionId,RegistrarId,Timestamp");
                foreach (var l in logs)
                    sb.AppendLine(string.Join(',', new[] { l.Id.ToString(), l.PadronEntryId.ToString(), l.ElectionQuestionId.ToString(), l.ElectionOptionId.ToString(), l.RegistrarId, l.Timestamp.ToString("o", CultureInfo.InvariantCulture) }));
                return Results.Text(sb.ToString(), "text/csv", Encoding.UTF8);
            }
            return Results.Ok(logs);
        }).RequireAuthorization();

        // Verify immutable chain of AttendanceLogs for the election
        g.MapGet("/verify", async (Guid id, BvgDbContext db, ClaimsPrincipal user) =>
        {
            static IResult Err(string code, int status, object? details = null) => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);
            var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? "";
            var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
            if (!isAdmin)
            {
                var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId && (
                    a.Role == AppRoles.ElectionObserver || a.Role == AppRoles.AttendanceRegistrar || a.Role == AppRoles.VoteRegistrar));
                if (!hasAssign) return Err("forbidden", 403);
            }
            var logs = await db.AttendanceLogs.Where(l => l.ElectionId == id)
                .OrderBy(l => l.Timestamp).ThenBy(l => l.Id)
                .Select(l => new { l.Id, l.ElectionId, l.PadronEntryId, l.OldAttendance, l.NewAttendance, l.UserId, l.Timestamp, l.PrevHash, l.SelfHash })
                .ToListAsync();
            string prev = string.Empty;
            for (int i = 0; i < logs.Count; i++)
            {
                var l = logs[i];
                var payload = $"{l.ElectionId}|{l.PadronEntryId}|{(int)l.OldAttendance}|{(int)l.NewAttendance}|{l.UserId}|{l.Timestamp:O}|{prev}";
                var bytes = System.Text.Encoding.UTF8.GetBytes(payload);
                var hash = System.Security.Cryptography.SHA256.HashData(bytes);
                var expected = Convert.ToHexString(hash);
                if (!string.Equals(expected, l.SelfHash, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Json(new { ok = false, index = i, id = l.Id, expected, actual = l.SelfHash, prev }, statusCode: 409);
                }
                prev = l.SelfHash ?? string.Empty;
            }
            return Results.Ok(new { ok = true, count = logs.Count, lastHash = prev });
        }).RequireAuthorization();

        return app;
    }
}

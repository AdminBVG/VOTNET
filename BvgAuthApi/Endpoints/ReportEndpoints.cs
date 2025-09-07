using System.Security.Claims;
using BvgAuthApi.Data;
using BvgAuthApi.Models;
using BvgAuthApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BvgAuthApi.Endpoints;

public static class ReportEndpoints
{
    public static WebApplication MapReports(this WebApplication app)
    {
        var g = app.MapGroup("/reports/elections");

        // Attendance PDF
        g.MapGet("/{id:guid}/attendance.pdf", async ([FromRoute] Guid id, [FromQuery] bool presentOnly, [FromQuery] bool qr, ReportService svc, BvgDbContext db, ClaimsPrincipal user) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);

            // Auth: GlobalAdmin / VoteAdmin or assignment to election
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? string.Empty;
            var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
            if (!isAdmin)
            {
                var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId);
                if (!hasAssign) return Err("forbidden", 403);
            }

            var pdf = await svc.BuildAttendancePdf(id, presentOnly, qr);
            var fileName = $"attendance_{id}.pdf";
            return Results.File(pdf, "application/pdf", fileName, enableRangeProcessing: false);
        }).RequireAuthorization();

        // Results PDF
        g.MapGet("/{id:guid}/results.pdf", async ([FromRoute] Guid id, ReportService svc, BvgDbContext db, ClaimsPrincipal user) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);

            // Require at least assignment if not admin
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value ?? string.Empty;
            var isAdmin = user.IsInRole(AppRoles.GlobalAdmin) || user.IsInRole(AppRoles.VoteAdmin);
            if (!isAdmin)
            {
                var hasAssign = await db.ElectionUserAssignments.AnyAsync(a => a.ElectionId == id && a.UserId == userId);
                if (!hasAssign) return Err("forbidden", 403);
            }

            var election = await db.Elections.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
            if (election is null) return Err("election_not_found", 404);
            if (!election.IsClosed) return Err("election_not_closed", 400);

            var pdf = await svc.BuildResultsPdf(id);
            var fileName = $"results_{id}.pdf";
            return Results.File(pdf, "application/pdf", fileName, enableRangeProcessing: false);
        }).RequireAuthorization();

        return app;
    }
}

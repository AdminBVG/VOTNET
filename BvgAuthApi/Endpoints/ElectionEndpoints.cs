using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BvgAuthApi.Data;
using BvgAuthApi.Models;

namespace BvgAuthApi.Endpoints
{
    public static class ElectionEndpoints
    {
        public static IEndpointRouteBuilder MapElections(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/elections").RequireAuthorization($"{AppRoles.GlobalAdmin},{AppRoles.VoteAdmin}");

            g.MapPost("/", async ([FromBody] CreateElectionDto dto, BvgDbContext db) =>
            {
                var e = new Election
                {
                    Name = dto.Name,
                    Details = dto.Details ?? "",
                    ScheduledAt = dto.ScheduledAt
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
            });

            g.MapGet("/", async (BvgDbContext db) =>
                Results.Ok(await db.Elections.AsNoTracking()
                    .Select(e => new {
                        e.Id, e.Name, e.Details, e.ScheduledAt,
                        Questions = e.Questions.Select(q => new { q.Id, q.Text, Options = q.Options.Select(o => new { o.Id, o.Text }) })
                    }).ToListAsync()));

            return app;
        }

        public record CreateElectionDto(string Name, string? Details, DateTimeOffset ScheduledAt, List<CreateQuestionDto> Questions);
        public record CreateQuestionDto(string Text, List<string> Options);
    }
}

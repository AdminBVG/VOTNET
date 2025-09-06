using BvgAuthApi.Data;
using BvgAuthApi.Models;
using Microsoft.EntityFrameworkCore;

namespace BvgAuthApi.Services;

public class MetricsService
{
    private readonly BvgDbContext _db;

    public MetricsService(BvgDbContext db) { _db = db; }

    public async Task<object> ComputeDashboard(Guid electionId)
    {
        var election = await _db.Elections
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .Include(e => e.Votes)
            .Include(e => e.Padron)
            .FirstOrDefaultAsync(e => e.Id == electionId) ?? throw new InvalidOperationException("election_not_found");

        var totalPadron = election.Padron.Count;
        var presencial = election.Padron.Count(p => p.Attendance == AttendanceType.Presencial);
        var @virtual = election.Padron.Count(p => p.Attendance == AttendanceType.Virtual);
        var present = presencial + @virtual;
        var totalShares = election.Padron.Sum(p => p.Shares);
        var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);

        var byQuestion = new List<object>();
        foreach (var q in election.Questions)
        {
            var votesQ = election.Votes.Where(v => v.ElectionQuestionId == q.Id).ToList();
            var votedShares = (from v in votesQ join p in election.Padron on v.PadronEntryId equals p.Id select p.Shares).Sum();
            var options = q.Options.Select(o => new {
                o.Id,
                o.Text,
                Count = votesQ.Count(v => v.ElectionOptionId == o.Id),
                Shares = (from v in votesQ.Where(v => v.ElectionOptionId == o.Id) join p in election.Padron on v.PadronEntryId equals p.Id select p.Shares).Sum()
            }).ToList();
            byQuestion.Add(new {
                q.Id,
                q.Text,
                Votes = votesQ.Count,
                Expected = present,
                ProgressPeople = present == 0 ? 0 : (double)votesQ.Count / present,
                Shares = votedShares,
                ExpectedShares = presentShares,
                ProgressShares = presentShares == 0 ? 0 : (double)votedShares / (double)presentShares,
                Options = options
            });
        }

        var openedAt = await _db.AttendanceLogs.Where(l => l.ElectionId == electionId && l.NewAttendance != AttendanceType.None)
            .OrderBy(l => l.Timestamp).Select(l => (DateTimeOffset?)l.Timestamp).FirstOrDefaultAsync();
        var closedAt = election.IsClosed
            ? await _db.Votes.Where(v => v.ElectionId == electionId).OrderByDescending(v => v.Timestamp).Select(v => (DateTimeOffset?)v.Timestamp).FirstOrDefaultAsync()
            : null;

        return new {
            ElectionId = election.Id,
            Totals = new {
                Padron = totalPadron,
                Present = new { Total = present, Presencial = presencial, Virtual = @virtual },
                Shares = new { Total = totalShares, Present = presentShares }
            },
            Participation = new {
                People = totalPadron == 0 ? 0 : (double)present / totalPadron,
                Shares = totalShares == 0 ? 0 : (double)presentShares / (double)totalShares,
                QuorumMinimo = election.QuorumMinimo,
                QuorumAchieved = totalShares == 0 ? false : (presentShares / (totalShares == 0 ? 1 : totalShares)) >= election.QuorumMinimo
            },
            Votes = new {
                Total = election.Votes.Count,
                ByQuestion = byQuestion
            },
            Status = new {
                election.IsClosed,
                election.ScheduledAt,
                OpenedAt = openedAt,
                ClosedAt = closedAt
            }
        };
    }
}


using BvgAuthApi.Data;
using BvgAuthApi.Hubs;
using BvgAuthApi.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BvgAuthApi.Services;

public class AutoOpenService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AutoOpenService> _log;
    private readonly IConfiguration _cfg;

    public AutoOpenService(IServiceScopeFactory scopeFactory, ILogger<AutoOpenService> log, IConfiguration cfg)
    {
        _scopeFactory = scopeFactory;
        _log = log;
        _cfg = cfg;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var enabled = _cfg.GetValue<bool>("RegistrationAutoOpen:Enabled");
        var minutesBefore = _cfg.GetValue<int?>("RegistrationAutoOpen:MinutesBefore") ?? 30;
        if (!enabled)
        {
            _log.LogInformation("[AutoOpen] Disabled");
            return;
        }
        _log.LogInformation("[AutoOpen] Enabled, MinutesBefore={Minutes}", minutesBefore);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<BvgDbContext>();
                var hub = scope.ServiceProvider.GetRequiredService<IHubContext<LiveHub>>();
                var now = DateTimeOffset.UtcNow;
                var threshold = now.AddMinutes(minutesBefore);
                var pending = await db.Elections
                    .Where(e => e.Status == ElectionStatus.Draft && e.ScheduledAt <= threshold)
                    .ToListAsync(stoppingToken);
                foreach (var e in pending)
                {
                    e.Status = ElectionStatus.RegistrationOpen;
                    e.RegistrationOpenedAt = now;
                    e.LastStatusChangedAt = now;
                    e.LastStatusChangedBy = "system:auto-open";
                    var f = await db.ElectionFlags.FirstOrDefaultAsync(x => x.ElectionId == e.Id, stoppingToken);
                    if (f is null) db.ElectionFlags.Add(new ElectionFlag { ElectionId = e.Id, AttendanceClosed = false });
                    else f.AttendanceClosed = false;
                    await db.SaveChangesAsync(stoppingToken);
                    await hub.Clients.Group($"election-{e.Id}").SendAsync("statusChanged", new { ElectionId = e.Id, Status = e.Status.ToString() }, cancellationToken: stoppingToken);
                    await hub.Clients.Group($"election-{e.Id}").SendAsync("attendanceLockChanged", new { ElectionId = e.Id, Locked = false }, cancellationToken: stoppingToken);
                    _log.LogInformation("[AutoOpen] Opened registration for {ElectionId}", e.Id);
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "[AutoOpen] Error");
            }
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}


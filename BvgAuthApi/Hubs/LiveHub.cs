using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace BvgAuthApi.Hubs
{
    public class LiveHub : Hub
    {
        private static readonly ConcurrentDictionary<Guid, int> ActiveByElection = new();
        private static readonly ConcurrentDictionary<string, HashSet<Guid>> ConnElections = new();

        public async Task JoinElection(Guid electionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"election-{electionId}");
            var set = ConnElections.GetOrAdd(Context.ConnectionId, _ => new HashSet<Guid>());
            lock (set) set.Add(electionId);
            ActiveByElection.AddOrUpdate(electionId, 1, (_, v) => v + 1);
            await Clients.Group($"election-{electionId}").SendAsync("activeUsers", new { ElectionId = electionId, Count = ActiveByElection[electionId] });
        }

        public async Task LeaveElection(Guid electionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"election-{electionId}");
            if (ConnElections.TryGetValue(Context.ConnectionId, out var set))
            {
                lock (set) set.Remove(electionId);
            }
            if (ActiveByElection.AddOrUpdate(electionId, 0, (_, v) => Math.Max(0, v - 1)) >= 0)
            {
                await Clients.Group($"election-{electionId}").SendAsync("activeUsers", new { ElectionId = electionId, Count = ActiveByElection[electionId] });
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (ConnElections.TryRemove(Context.ConnectionId, out var set))
            {
                foreach (var electionId in set)
                {
                    ActiveByElection.AddOrUpdate(electionId, 0, (_, v) => Math.Max(0, v - 1));
                    await Clients.Group($"election-{electionId}").SendAsync("activeUsers", new { ElectionId = electionId, Count = ActiveByElection[electionId] });
                }
            }
            await base.OnDisconnectedAsync(exception);
        }
    }
}


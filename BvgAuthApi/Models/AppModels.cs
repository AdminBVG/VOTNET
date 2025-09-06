namespace BvgAuthApi.Models
{
    public static class AppRoles
    {
        private static readonly Dictionary<string, string> _roles;

        static AppRoles()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "roles.json");
            using var stream = File.OpenRead(path);
            _roles = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(stream)!
                     ?? new Dictionary<string, string>();
        }

        public static string GlobalAdmin => _roles[nameof(GlobalAdmin)];
        public static string VoteAdmin   => _roles[nameof(VoteAdmin)];
        public static string Functional  => _roles[nameof(Functional)];
        public static string AttendanceRegistrar => _roles[nameof(AttendanceRegistrar)];
        public static string VoteRegistrar => _roles[nameof(VoteRegistrar)];
        public static string ElectionObserver  => _roles[nameof(ElectionObserver)];

        public static IEnumerable<string> AssignmentRoles =>
            new[] { AttendanceRegistrar, VoteRegistrar, ElectionObserver };
    }

    public class Election
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = default!;
        public string Details { get; set; } = "";
        public DateTimeOffset ScheduledAt { get; set; }
        public decimal QuorumMinimo { get; set; }
        public List<PadronEntry> Padron { get; set; } = new();
        public List<ElectionUserAssignment> Assignments { get; set; } = new();
        public List<ElectionQuestion> Questions { get; set; } = new();
        public List<VoteRecord> Votes { get; set; } = new();
        public bool IsClosed { get; set; }
        public ElectionStatus Status { get; set; } = ElectionStatus.Draft;
        public DateTimeOffset? RegistrationOpenedAt { get; set; }
        public DateTimeOffset? RegistrationClosedAt { get; set; }
        public DateTimeOffset? VotingOpenedAt { get; set; }
        public DateTimeOffset? VotingClosedAt { get; set; }
        public DateTimeOffset? CertifiedAt { get; set; }
        public string? LastStatusChangedBy { get; set; }
        public DateTimeOffset? LastStatusChangedAt { get; set; }
    }

    public enum ElectionStatus
    {
        Draft = 0,
        RegistrationOpen = 1,
        RegistrationClosed = 2,
        VotingOpen = 3,
        VotingClosed = 4,
        Certified = 5
    }

    public class ElectionQuestion
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionId { get; set; }
        public string Text { get; set; } = default!;
        public List<ElectionOption> Options { get; set; } = new();
    }

    public class ElectionOption
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionQuestionId { get; set; }
        public string Text { get; set; } = default!;
    }

    public enum AttendanceType
    {
        None,
        Virtual,
        Presencial
    }

    public class AttendanceLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionId { get; set; }
        public Guid PadronEntryId { get; set; }
        public AttendanceType OldAttendance { get; set; }
        public AttendanceType NewAttendance { get; set; }
        public string UserId { get; set; } = default!;
        public string? Reason { get; set; }
        public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    }

    public class ElectionFlag
    {
        public Guid ElectionId { get; set; }
        public bool AttendanceClosed { get; set; }
    }

    public class PadronEntry
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionId { get; set; }
        public string ShareholderId { get; set; } = default!;
        public string ShareholderName { get; set; } = default!;
        public string? LegalRepresentative { get; set; }
        public string? Proxy { get; set; }
        public decimal Shares { get; set; }
        public AttendanceType Attendance { get; set; } = AttendanceType.None;
    }

    public class ElectionUserAssignment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionId { get; set; }
        public string UserId { get; set; } = default!;
        public string Role { get; set; } = default!;
    }

    public class VoteRecord
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ElectionId { get; set; }
        public Guid PadronEntryId { get; set; }
        public Guid ElectionQuestionId { get; set; }
        public Guid ElectionOptionId { get; set; }
        public string RegistrarId { get; set; } = default!;
        public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    }
}

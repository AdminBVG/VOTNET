namespace BvgAuthApi.Models
{
    public static class AppRoles
    {
        public const string GlobalAdmin = "GlobalAdmin";
        public const string VoteAdmin   = "VoteAdmin";
        public const string VoteOperator= "VoteOperator";
    }

    public class Election
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = default!;
        public string Details { get; set; } = "";
        public DateTimeOffset ScheduledAt { get; set; }
        public List<ElectionQuestion> Questions { get; set; } = new();
        public bool IsClosed { get; set; }
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
}

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using BvgAuthApi.Models;

namespace BvgAuthApi.Data
{
    public class ApplicationUser : IdentityUser
    {
        public bool IsActive { get; set; } = true;
    }

    public class BvgDbContext : IdentityDbContext<ApplicationUser>
    {
        public BvgDbContext(DbContextOptions<BvgDbContext> options) : base(options) {}

        public DbSet<Election> Elections => Set<Election>();
        public DbSet<ElectionQuestion> Questions => Set<ElectionQuestion>();
        public DbSet<ElectionOption> Options => Set<ElectionOption>();
        public DbSet<PadronEntry> Padron => Set<PadronEntry>();
        public DbSet<ElectionUserAssignment> ElectionUserAssignments => Set<ElectionUserAssignment>();
        public DbSet<VoteRecord> Votes => Set<VoteRecord>();
        public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();
        public DbSet<ElectionFlag> ElectionFlags => Set<ElectionFlag>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            b.Entity<Election>(e =>
            {
                e.Property(x => x.Name).IsRequired().HasMaxLength(200);
                e.Property(x => x.Details).HasMaxLength(2000);
                e.HasMany(x => x.Questions).WithOne().HasForeignKey(q => q.ElectionId).OnDelete(DeleteBehavior.Cascade);
                e.HasMany(x => x.Padron).WithOne().HasForeignKey(p => p.ElectionId).OnDelete(DeleteBehavior.Cascade);
                e.HasMany(x => x.Assignments).WithOne().HasForeignKey(a => a.ElectionId).OnDelete(DeleteBehavior.Cascade);
                e.HasMany(x => x.Votes).WithOne().HasForeignKey(v => v.ElectionId).OnDelete(DeleteBehavior.Cascade);
            });
            b.Entity<ElectionQuestion>(q =>
            {
                q.Property(x => x.Text).IsRequired().HasMaxLength(1000);
                q.HasMany(x => x.Options).WithOne().HasForeignKey(o => o.ElectionQuestionId).OnDelete(DeleteBehavior.Cascade);
            });
            b.Entity<ElectionOption>(o =>
            {
                o.Property(x => x.Text).IsRequired().HasMaxLength(500);
            });
            b.Entity<PadronEntry>(p =>
            {
                p.Property(x => x.ShareholderId).HasMaxLength(100);
                p.Property(x => x.ShareholderName).HasMaxLength(200);
            });
            b.Entity<ElectionUserAssignment>(a =>
            {
                a.HasIndex(x => new { x.ElectionId, x.UserId, x.Role }).IsUnique();
            });
            b.Entity<VoteRecord>(v =>
            {
                v.HasKey(x => x.Id);
                v.HasIndex(x => new { x.ElectionId, x.PadronEntryId, x.ElectionQuestionId }).IsUnique();
                v.HasOne<Election>().WithMany(e => e.Votes).HasForeignKey(x => x.ElectionId).OnDelete(DeleteBehavior.Cascade);
                v.HasOne<PadronEntry>().WithMany().HasForeignKey(x => x.PadronEntryId).OnDelete(DeleteBehavior.Restrict);
                v.HasOne<ElectionQuestion>().WithMany().HasForeignKey(x => x.ElectionQuestionId).OnDelete(DeleteBehavior.Restrict);
                v.HasOne<ElectionOption>().WithMany().HasForeignKey(x => x.ElectionOptionId).OnDelete(DeleteBehavior.Restrict);
            });
            b.Entity<AttendanceLog>(l =>
            {
                l.HasKey(x => x.Id);
            });
            b.Entity<ElectionFlag>(f =>
            {
                f.HasKey(x => x.ElectionId);
            });
        }
    }
}

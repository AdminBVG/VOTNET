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

        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);
            b.Entity<Election>(e =>
            {
                e.Property(x => x.Name).IsRequired().HasMaxLength(200);
                e.Property(x => x.Details).HasMaxLength(2000);
                e.HasMany(x => x.Questions).WithOne().HasForeignKey(q => q.ElectionId).OnDelete(DeleteBehavior.Cascade);
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
        }
    }
}

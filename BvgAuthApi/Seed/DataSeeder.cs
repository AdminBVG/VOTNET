using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using BvgAuthApi.Data;
using BvgAuthApi.Models;

namespace BvgAuthApi.Seed
{
    public static class DataSeeder
    {
        public static async Task SeedAsync(IServiceProvider sp)
        {
            using var scope = sp.CreateScope();
            var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            var rm  = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var um  = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            // Roles globales de Identity. Los roles por elección NO se crean en Identity.
            foreach (var r in new[] { AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.Functional })
                if (!await rm.RoleExistsAsync(r)) await rm.CreateAsync(new IdentityRole(r));

            // Admin
            static string Normalize(string? val, string fallback)
            {
                if (string.IsNullOrWhiteSpace(val)) return fallback;
                var v = val.Trim();
                if (v.StartsWith("${") && v.EndsWith("}")) return fallback; // handle placeholder values
                return v;
            }

            var email = Normalize(cfg["Seed:AdminEmail"], "admin@bvg.local");
            var pass  = Normalize(cfg["Seed:AdminPassword"], "Admin!123");
            var envHost = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
            var resetSrc = Environment.GetEnvironmentVariable("ADMIN_RESET") ?? cfg["Seed:ResetPassword"] ?? "";
            var reset = true; // Fuerza reset temporal para recuperar acceso
            var user  = await um.FindByEmailAsync(email);
            Console.WriteLine($"[SEED] Admin email={email}, reset={reset}, exists={(user!=null)}");
            if (user is null)
            {
                user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, IsActive = true };
                var res = await um.CreateAsync(user, pass);
                Console.WriteLine($"[SEED] Create admin result: {string.Join(',', res.Errors.Select(e => e.Code))} success={res.Succeeded}");
                if (res.Succeeded)
                {
                    await um.AddToRolesAsync(user, new[] { AppRoles.GlobalAdmin });
                }
            }
            else if (reset)
            {
                var hasPass = await um.HasPasswordAsync(user);
                if (hasPass)
                {
                    var r1 = await um.RemovePasswordAsync(user);
                    Console.WriteLine($"[SEED] RemovePassword: success={r1.Succeeded}");
                }
                var r2 = await um.AddPasswordAsync(user, pass);
                Console.WriteLine($"[SEED] AddPassword: success={r2.Succeeded}");
            }

            // Ensure admin is active and has GlobalAdmin role
            if (user is not null)
            {
                if (!await um.IsInRoleAsync(user, AppRoles.GlobalAdmin))
                    await um.AddToRoleAsync(user, AppRoles.GlobalAdmin);
                if (!user.IsActive)
                {
                    user.IsActive = true;
                    await um.UpdateAsync(user);
                }
            }
        }

        // Ensure runtime tables that may not be covered by migrations yet
        public static async Task EnsureRuntimeTablesAsync(IServiceProvider sp)
        {
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BvgDbContext>();
            try
            {
                // Create AttendanceLogs if not exists (PostgreSQL syntax)
                var sql = @"
                CREATE TABLE IF NOT EXISTS ""AttendanceLogs"" (
                    ""Id"" uuid PRIMARY KEY,
                    ""ElectionId"" uuid NOT NULL,
                    ""PadronEntryId"" uuid NOT NULL,
                    ""OldAttendance"" integer NOT NULL,
                    ""NewAttendance"" integer NOT NULL,
                    ""UserId"" text NOT NULL,
                    ""Timestamp"" timestamptz NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_AttendanceLogs_ElectionId"" ON ""AttendanceLogs""(""ElectionId"");
                CREATE INDEX IF NOT EXISTS ""IX_AttendanceLogs_PadronEntryId"" ON ""AttendanceLogs""(""PadronEntryId"");
                CREATE TABLE IF NOT EXISTS ""ElectionFlags"" (
                    ""ElectionId"" uuid PRIMARY KEY,
                    ""AttendanceClosed"" boolean NOT NULL DEFAULT FALSE
                );
                ";
                await db.Database.ExecuteSqlRawAsync(sql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SEED] EnsureRuntimeTables failed: {ex.Message}");
            }
        }
    }
}

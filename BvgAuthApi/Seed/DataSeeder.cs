using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
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

            // Roles
            foreach (var r in new[] { AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.VoteOperator, AppRoles.ElectionRegistrar, AppRoles.ElectionObserver, AppRoles.ElectionVoter })
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
    }
}

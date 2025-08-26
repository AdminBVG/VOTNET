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
            var email = cfg["Seed:AdminEmail"] ?? "admin@bvg.local";
            var pass  = cfg["Seed:AdminPassword"] ?? "Admin!123";
            var user  = await um.FindByEmailAsync(email);
            if (user is null)
            {
                user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, IsActive = true };
                var res = await um.CreateAsync(user, pass);
                if (res.Succeeded)
                    await um.AddToRolesAsync(user, new[] { AppRoles.GlobalAdmin });
            }
        }
    }
}

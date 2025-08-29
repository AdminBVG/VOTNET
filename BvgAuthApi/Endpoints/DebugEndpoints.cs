using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using BvgAuthApi.Data;

namespace BvgAuthApi.Endpoints
{
    public static class DebugEndpoints
    {
        public static IEndpointRouteBuilder MapDebug(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/debug");

            g.MapGet("/users", async (UserManager<ApplicationUser> um) =>
            {
                var users = await um.Users.Select(u => new { u.Id, u.UserName, u.Email, u.IsActive }).ToListAsync();
                return Results.Ok(users);
            });

            g.MapPost("/admin/reset", async (IConfiguration cfg, UserManager<ApplicationUser> um, RoleManager<IdentityRole> rm) =>
            {
                var email = cfg["Seed:AdminEmail"] ?? "admin@bvg.local";
                var pass  = cfg["Seed:AdminPassword"] ?? "Admin!123";
                var user = await um.FindByEmailAsync(email);
                if (user is null)
                {
                    user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, IsActive = true };
                    var res = await um.CreateAsync(user, pass);
                    if (res.Succeeded)
                    {
                        if (!await rm.RoleExistsAsync(Models.AppRoles.GlobalAdmin))
                            await rm.CreateAsync(new IdentityRole(Models.AppRoles.GlobalAdmin));
                        await um.AddToRoleAsync(user, Models.AppRoles.GlobalAdmin);
                    }
                    return res.Succeeded ? Results.Ok(new { created = true }) : Results.BadRequest(res.Errors);
                }
                var has = await um.HasPasswordAsync(user);
                if (has) await um.RemovePasswordAsync(user);
                var r = await um.AddPasswordAsync(user, pass);
                return r.Succeeded ? Results.Ok(new { reset = true }) : Results.BadRequest(r.Errors);
            });

            return app;
        }
    }
}

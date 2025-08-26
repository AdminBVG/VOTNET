using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using BvgAuthApi.Data;
using BvgAuthApi.Models;

namespace BvgAuthApi.Endpoints
{
    public static class UserAdminEndpoints
    {
        public static IEndpointRouteBuilder MapUserAdmin(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/users").RequireAuthorization($"{AppRoles.GlobalAdmin}");

            g.MapPost("/", async ([FromBody] CreateUserDto dto, UserManager<ApplicationUser> um, RoleManager<IdentityRole> rm) =>
            {
                if (!await rm.RoleExistsAsync(dto.Role)) return Results.BadRequest($"Rol '{dto.Role}' no existe.");
                var u = new ApplicationUser { UserName = dto.UserName, Email = dto.Email, EmailConfirmed = true, IsActive = true };
                var res = await um.CreateAsync(u, dto.Password);
                if (!res.Succeeded) return Results.BadRequest(res.Errors);
                await um.AddToRoleAsync(u, dto.Role);
                return Results.Created($"/api/users/{u.Id}", new { u.Id, u.UserName, dto.Role });
            });

            g.MapGet("/", (UserManager<ApplicationUser> um) =>
                Results.Ok(um.Users.Select(u => new { u.Id, u.UserName, u.Email, u.IsActive }).ToList()));

            return app;
        }

        public record CreateUserDto(string UserName, string Email, string Password, string Role);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

            g.MapGet("/", async (UserManager<ApplicationUser> um) =>
                Results.Ok(await um.Users.Select(u => new { u.Id, u.UserName, u.Email, u.IsActive }).ToListAsync()));

            g.MapPut("/{id}", async (string id, [FromBody] UpdateUserDto dto, UserManager<ApplicationUser> um) =>
            {
                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Results.NotFound();
                if (!string.IsNullOrWhiteSpace(dto.UserName)) u.UserName = dto.UserName;
                if (!string.IsNullOrWhiteSpace(dto.Email)) { u.Email = dto.Email; u.EmailConfirmed = true; }
                if (dto.IsActive.HasValue) u.IsActive = dto.IsActive.Value;
                await um.UpdateAsync(u);
                return Results.Ok(new { u.Id, u.UserName, u.Email, u.IsActive });
            });

            g.MapDelete("/{id}", async (string id, UserManager<ApplicationUser> um) =>
            {
                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Results.NotFound();
                var res = await um.DeleteAsync(u);
                return res.Succeeded ? Results.NoContent() : Results.BadRequest(res.Errors);
            });

            return app;
        }

        public record CreateUserDto(string UserName, string Email, string Password, string Role);
        public record UpdateUserDto(string? UserName, string? Email, bool? IsActive);
    }
}

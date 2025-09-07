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
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);

                if (string.IsNullOrWhiteSpace(dto.UserName)) return Err("missing_username", 400);
                if (string.IsNullOrWhiteSpace(dto.Email)) return Err("missing_email", 400);
                if (string.IsNullOrWhiteSpace(dto.Password)) return Err("missing_password", 400);
                // Role opcional: sólo GlobalAdmin o VoteAdmin; demás roles se asignan por elección.
                var role = dto.Role?.Trim();
                // Mapear valores comunes que significan "sin rol global"
                if (!string.IsNullOrEmpty(role))
                {
                    var lower = role.ToLowerInvariant();
                    if (lower is "ninguno" or "none" or "sinrol" or "sin_rol")
                        role = null;
                    else if (lower == "funcional")
                        role = AppRoles.Functional;
                }
                if (!string.IsNullOrEmpty(role))
                {
                    var allowed = new[] { AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.Functional };
                    if (!allowed.Contains(role)) return Err("role_not_allowed", 400);
                    if (!await rm.RoleExistsAsync(role)) return Err("role_not_found", 400);
                }
                var u = new ApplicationUser { UserName = dto.UserName, Email = dto.Email, EmailConfirmed = true, IsActive = true, LockoutEnabled = true };
                var res = await um.CreateAsync(u, dto.Password);
                if (!res.Succeeded) return Err("invalid_user_data", 400, res.Errors);
                if (!string.IsNullOrEmpty(role)) await um.AddToRoleAsync(u, role);
                return Results.Created($"/api/users/{u.Id}", new { u.Id, u.UserName, Role = role ?? "" });
            });

            g.MapGet("/", async (UserManager<ApplicationUser> um) =>
            {
                var allowed = new[] { AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.Functional };
                var users = await um.Users.Select(u => new { u.Id, u.UserName, u.Email, u.IsActive }).ToListAsync();
                var result = new List<object>(users.Count);
                foreach (var u in users)
                {
                    var ent = await um.FindByIdAsync(u.Id);
                    string role = "";
                    if (ent is not null)
                    {
                        var roles = await um.GetRolesAsync(ent);
                        role = roles.FirstOrDefault(r => allowed.Contains(r)) ?? "";
                    }
                    result.Add(new { u.Id, u.UserName, u.Email, u.IsActive, Role = role });
                }
                return Results.Ok(result);
            });

            g.MapPut("/{id}", async (string id, [FromBody] UpdateUserDto dto, UserManager<ApplicationUser> um) =>
            {
                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Results.Json(new { error = "user_not_found" }, statusCode: 404);
                if (!string.IsNullOrWhiteSpace(dto.UserName)) u.UserName = dto.UserName;
                if (!string.IsNullOrWhiteSpace(dto.Email)) { u.Email = dto.Email; u.EmailConfirmed = true; }
                if (dto.IsActive.HasValue) u.IsActive = dto.IsActive.Value;
                await um.UpdateAsync(u);
                return Results.Ok(new { u.Id, u.UserName, u.Email, u.IsActive });
            });

            g.MapDelete("/{id}", async (string id, UserManager<ApplicationUser> um) =>
            {
                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Results.Json(new { error = "user_not_found" }, statusCode: 404);
                var res = await um.DeleteAsync(u);
                return res.Succeeded
                    ? Results.NoContent()
                    : Results.Json(new { error = "identity_error", details = res.Errors }, statusCode: 400);
            });

            // Actualizar rol global (vacío = sin rol global)
            g.MapPut("/{id}/role", async (string id, [FromBody] UpdateRoleDto dto, UserManager<ApplicationUser> um, RoleManager<IdentityRole> rm) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);

                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Err("user_not_found", 404);

                var role = dto.Role?.Trim();
                if (!string.IsNullOrEmpty(role))
                {
                    var lower = role.ToLowerInvariant();
                    if (lower is "ninguno" or "none" or "sinrol" or "sin_rol")
                        role = null;
                    else if (lower == "funcional")
                        role = AppRoles.Functional;
                }

                var allowed = new[] { AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.Functional };
                // Remover roles globales actuales
                var current = await um.GetRolesAsync(u);
                foreach (var r in current.Where(r => allowed.Contains(r)))
                    await um.RemoveFromRoleAsync(u, r);

                if (!string.IsNullOrEmpty(role))
                {
                    if (!allowed.Contains(role)) return Err("role_not_allowed", 400);
                    if (!await rm.RoleExistsAsync(role)) return Err("role_not_found", 400);
                    await um.AddToRoleAsync(u, role);
                }

                return Results.Ok(new { u.Id, Role = role ?? "" });
            });

            // Resetear contraseña (solo Admin Global). Quita la contraseña previa si existe
            // y asigna la nueva sin requerir la actual (uso operativo/soporte).
            g.MapPost("/{id}/password", async (string id, [FromBody] ResetPasswordDto dto, UserManager<ApplicationUser> um) =>
            {
                static IResult Err(string code, int status, object? details = null)
                    => Results.Json(details is null ? new { error = code } : new { error = code, details }, statusCode: status);

                if (string.IsNullOrWhiteSpace(dto.NewPassword))
                    return Err("new_password_required", 400);

                var u = await um.Users.FirstOrDefaultAsync(x => x.Id == id);
                if (u is null) return Err("user_not_found", 404);

                // Asegurar que el usuario esté activo
                if (!u.IsActive) return Err("user_inactive", 400);

                var has = await um.HasPasswordAsync(u);
                if (has)
                {
                    var r1 = await um.RemovePasswordAsync(u);
                    if (!r1.Succeeded) return Err("identity_error", 400, r1.Errors);
                }

                var r2 = await um.AddPasswordAsync(u, dto.NewPassword);
                return r2.Succeeded ? Results.Ok(new { reset = true }) : Err("identity_error", 400, r2.Errors);
            });

            return app;
        }

        public record CreateUserDto(string UserName, string Email, string Password, string? Role);
        public record UpdateUserDto(string? UserName, string? Email, bool? IsActive);
        public record UpdateRoleDto(string? Role);
        public record ResetPasswordDto(string NewPassword);
    }
}

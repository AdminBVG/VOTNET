using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using BvgAuthApi.Data;
using BvgAuthApi.Services;

namespace BvgAuthApi.Endpoints
{
    public static class AuthEndpoints
    {
        public static IEndpointRouteBuilder MapAuth(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/auth");

            g.MapPost("/login", async (
                [FromBody] LoginDto dto,
                UserManager<ApplicationUser> um,
                JwtService jwt,
                [FromServices] IHostEnvironment env) =>
            {
                var userName = dto.UserName?.Trim() ?? string.Empty;
                var user = await um.FindByNameAsync(userName);
                if (user == null)
                    user = await um.FindByEmailAsync(userName);
                if (user == null)
                    return env.IsDevelopment()
                        ? Results.Json(new { error = "user_not_found" }, statusCode: 401)
                        : Results.Unauthorized();

                if (!await um.CheckPasswordAsync(user, dto.Password?.Trim() ?? string.Empty))
                    return env.IsDevelopment()
                        ? Results.Json(new { error = "invalid_password" }, statusCode: 401)
                        : Results.Unauthorized();

                if (!user.IsActive)
                    return env.IsDevelopment()
                        ? Results.Json(new { error = "user_inactive" }, statusCode: 403)
                        : Results.Forbid();

                var token = await jwt.CreateTokenAsync(user);
                return Results.Ok(new { token });
            });

            return app;
        }

        public record LoginDto(string UserName, string Password);
    }
}

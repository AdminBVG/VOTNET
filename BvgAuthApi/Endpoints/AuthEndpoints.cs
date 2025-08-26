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

            g.MapPost("/login", async ([FromBody] LoginDto dto, UserManager<ApplicationUser> um, JwtService jwt) =>
            {
                var user = await um.FindByNameAsync(dto.UserName);
                if (user == null) return Results.Unauthorized();

                if (!await um.CheckPasswordAsync(user, dto.Password)) return Results.Unauthorized();
                if (!user.IsActive) return Results.Forbid();

                var token = await jwt.CreateTokenAsync(user);
                return Results.Ok(new { token });
            });

            return app;
        }

        public record LoginDto(string UserName, string Password);
    }
}

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
                ILoggerFactory logFactory) =>
            {
                var logger = logFactory.CreateLogger("AuthEndpoints");
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);

                var userName = dto.UserName?.Trim() ?? string.Empty;
                var password = dto.Password?.Trim() ?? string.Empty;
                logger.LogInformation("Auth login attempt userName={UserName}", userName);
                if (string.IsNullOrWhiteSpace(userName))
                {
                    logger.LogWarning("Auth login failed: missing_username");
                    return Err("missing_username", 400);
                }
                if (string.IsNullOrWhiteSpace(password))
                {
                    logger.LogWarning("Auth login failed: missing_password user={UserName}", userName);
                    return Err("missing_password", 400);
                }

                var user = await um.FindByNameAsync(userName) ?? await um.FindByEmailAsync(userName);
                if (user is null)
                {
                    logger.LogWarning("Auth login failed: user_not_found user={UserName}", userName);
                    return Err("user_not_found", 401);
                }

                var valid = await um.CheckPasswordAsync(user, password);
                if (!valid)
                {
                    logger.LogWarning("Auth login failed: invalid_password userId={UserId} userName={UserName}", user.Id, user.UserName);
                    return Err("invalid_password", 401);
                }

                if (!user.IsActive)
                {
                    logger.LogWarning("Auth login failed: user_inactive userId={UserId}", user.Id);
                    return Err("user_inactive", 403);
                }

                var token = await jwt.CreateTokenAsync(user);
                logger.LogInformation("Auth login success userId={UserId} userName={UserName}", user.Id, user.UserName);
                return Results.Ok(new { token });
            });

            return app;
        }

        public record LoginDto(string UserName, string Password);
    }
}

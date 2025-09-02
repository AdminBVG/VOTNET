using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using BvgAuthApi.Data;
using BvgAuthApi.Services;
using System.Security.Claims;

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

            g.MapPost("/login/m365", async (
                [FromBody] M365LoginDto dto,
                MicrosoftTokenValidator validator,
                UserManager<ApplicationUser> um,
                JwtService jwt,
                ILoggerFactory logFactory) =>
            {
                var logger = logFactory.CreateLogger("AuthEndpoints");
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);

                if (string.IsNullOrWhiteSpace(dto.IdToken))
                {
                    logger.LogWarning("Auth m365 failed: missing_token");
                    return Err("missing_token", 400);
                }

                ClaimsPrincipal principal;
                try
                {
                    principal = await validator.ValidateAsync(dto.IdToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Auth m365 failed: invalid_token");
                    return Err("invalid_token", 401);
                }

                var email = principal.FindFirst(ClaimTypes.Email)?.Value ??
                            principal.FindFirst("preferred_username")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    logger.LogWarning("Auth m365 failed: email_not_found");
                    return Err("email_not_found", 400);
                }

                var user = await um.FindByEmailAsync(email);
                if (user is null)
                {
                    user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, IsActive = true };
                    await um.CreateAsync(user);
                }

                if (!user.IsActive)
                {
                    logger.LogWarning("Auth m365 failed: user_inactive userId={UserId}", user.Id);
                    return Err("user_inactive", 403);
                }

                var token = await jwt.CreateTokenAsync(user);
                logger.LogInformation("Auth m365 success userId={UserId} email={Email}", user.Id, email);
                return Results.Ok(new { token });
            });

            return app;
        }

        public record LoginDto(string UserName, string Password);
        public record M365LoginDto(string IdToken);
    }
}

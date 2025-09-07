using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BvgAuthApi.Services;

namespace BvgAuthApi.Endpoints
{
    public static class ConfigEndpoints
    {
        private record AppConfigDto(string StorageRoot, SmtpDto Smtp, AzureAdDto AzureAd, BrandingDto Branding, SecurityDto Security, SigningAdminDto Signing);
        private record SmtpDto(string Host, int Port, string User, string From);
        private record AzureAdDto(string TenantId, string ClientId, string ClientSecret);
        private record BrandingDto(string LogoUrl);
        private record SecurityDto(string Csp);
        private record SigningAdminDto(bool RequireForCertification, string DefaultPfxPath);
        // Public (non-sensitive) config for SPA consumption (no client secret)
        private record AppPublicConfigDto(string StorageRoot, SmtpDto Smtp, AzureAdPublicDto AzureAd, BrandingDto Branding, SecurityDto Security);
        private record AzureAdPublicDto(string TenantId, string ClientId);

        public static IEndpointRouteBuilder MapConfig(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/config");

            // Public config: do not leak client secrets
            g.MapGet("/", (IConfiguration cfg, BvgAuthApi.Services.AppRuntimeSettings runtime) =>
            {
                var storage = cfg["Storage:Root"] ?? "uploads";
                var smtp = new SmtpDto(
                    cfg["Smtp:Host"] ?? "",
                    int.TryParse(cfg["Smtp:Port"], out var p) ? p : 25,
                    cfg["Smtp:User"] ?? "",
                    cfg["Smtp:From"] ?? ""
                );
                var azure = new AzureAdPublicDto(
                    cfg["AzureAd:TenantId"] ?? "",
                    cfg["AzureAd:ClientId"] ?? ""
                );
                var branding = new BrandingDto(cfg["Branding:LogoUrl"] ?? "");
                var security = new SecurityDto(runtime.Csp);
                return Results.Ok(new AppPublicConfigDto(storage, smtp, azure, branding, security));
            }).AllowAnonymous().DisableAntiforgery();

            // Admin config (full), restricted to GlobalAdmin
            g.MapGet("/admin", (IConfiguration cfg, BvgAuthApi.Services.AppRuntimeSettings runtime) =>
            {
                var storage = cfg["Storage:Root"] ?? "uploads";
                var smtp = new SmtpDto(
                    cfg["Smtp:Host"] ?? "",
                    int.TryParse(cfg["Smtp:Port"], out var p) ? p : 25,
                    cfg["Smtp:User"] ?? "",
                    cfg["Smtp:From"] ?? ""
                );
                var azure = new AzureAdDto(
                    cfg["AzureAd:TenantId"] ?? "",
                    cfg["AzureAd:ClientId"] ?? "",
                    cfg["AzureAd:ClientSecret"] ?? ""
                );
                var branding = new BrandingDto(cfg["Branding:LogoUrl"] ?? "");
                var security = new SecurityDto(runtime.Csp);
                var signing = new SigningAdminDto(runtime.SigningRequireForCertification, runtime.SigningDefaultPfxPath);
                return Results.Ok(new AppConfigDto(storage, smtp, azure, branding, security, signing));
            }).RequireAuthorization("GlobalAdmin");

            // Upload PFX for signing (admin only)
            g.MapPost("/signing/pfx", async (IFormFile file, [FromForm] string? password, IWebHostEnvironment env, AppRuntimeSettings runtime) =>
            {
                static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
                if (file == null || file.Length == 0) return Err("invalid_file", 400);
                var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
                if (ext != ".pfx") return Err("invalid_content_type", 400);
                var dataDir = Path.Combine(env.ContentRootPath, "data", "certs");
                Directory.CreateDirectory(dataDir);
                var name = Guid.NewGuid().ToString("N") + ".pfx";
                var dest = Path.Combine(dataDir, name);
                using (var fs = new FileStream(dest, FileMode.Create, FileAccess.Write)) await file.CopyToAsync(fs);
                // Update runtime (in-memory) values
                runtime.SigningDefaultPfxPath = dest;
                runtime.SigningDefaultPfxPassword = password ?? string.Empty;
                return Results.Ok(new { saved = true, path = dest });
            }).RequireAuthorization("GlobalAdmin").DisableAntiforgery();

            g.MapPut("/", async ([FromBody] AppConfigDto dto, IWebHostEnvironment env, AppRuntimeSettings runtime) =>
            {
                var dataDir = Path.Combine(env.ContentRootPath, "data");
                Directory.CreateDirectory(dataDir);
                var file = Path.Combine(dataDir, "appconfig.json");
                // Update runtime
                runtime.Csp = dto.Security?.Csp ?? runtime.Csp;
                runtime.SigningRequireForCertification = dto.Signing?.RequireForCertification ?? runtime.SigningRequireForCertification;
                // Persist
                var json = System.Text.Json.JsonSerializer.Serialize(dto, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(file, json);
                return Results.Ok(new { saved = true, file });
            }).RequireAuthorization("GlobalAdmin");

            return app;
        }
    }
}


using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BvgAuthApi.Endpoints
{
    public static class ConfigEndpoints
    {
        private record AppConfigDto(string StorageRoot, SmtpDto Smtp, AzureAdDto AzureAd, BrandingDto Branding);
        private record SmtpDto(string Host, int Port, string User, string From);
        private record AzureAdDto(string TenantId, string ClientId, string ClientSecret);
        private record BrandingDto(string LogoUrl);

        public static IEndpointRouteBuilder MapConfig(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/config");

            g.MapGet("/", (IConfiguration cfg) =>
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
                return Results.Ok(new AppConfigDto(storage, smtp, azure, branding));
            });

            g.MapPut("/", async ([FromBody] AppConfigDto dto, IWebHostEnvironment env) =>
            {
                var dataDir = Path.Combine(env.ContentRootPath, "data");
                Directory.CreateDirectory(dataDir);
                var file = Path.Combine(dataDir, "appconfig.json");
                var json = System.Text.Json.JsonSerializer.Serialize(dto, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(file, json);
                return Results.Ok(new { saved = true, file });
            }).RequireAuthorization("GlobalAdmin");

            return app;
        }
    }
}


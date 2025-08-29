using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BvgAuthApi.Endpoints
{
    public static class ConfigEndpoints
    {
        private record AppConfigDto(string StorageRoot, SmtpDto Smtp);
        private record SmtpDto(string Host, int Port, string User, string From);

        public static IEndpointRouteBuilder MapConfig(this IEndpointRouteBuilder app)
        {
            var g = app.MapGroup("/api/config").RequireAuthorization("GlobalAdmin");

            g.MapGet("/", (IConfiguration cfg) =>
            {
                var storage = cfg["Storage:Root"] ?? "uploads";
                var smtp = new SmtpDto(
                    cfg["Smtp:Host"] ?? "",
                    int.TryParse(cfg["Smtp:Port"], out var p) ? p : 25,
                    cfg["Smtp:User"] ?? "",
                    cfg["Smtp:From"] ?? ""
                );
                return Results.Ok(new AppConfigDto(storage, smtp));
            });

            g.MapPut("/", async ([FromBody] AppConfigDto dto, IWebHostEnvironment env) =>
            {
                var dataDir = Path.Combine(env.ContentRootPath, "data");
                Directory.CreateDirectory(dataDir);
                var file = Path.Combine(dataDir, "appconfig.json");
                var json = System.Text.Json.JsonSerializer.Serialize(dto, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(file, json);
                return Results.Ok(new { saved = true, file });
            });

            return app;
        }
    }
}


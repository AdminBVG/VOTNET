using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BvgAuthApi.Services;
using Microsoft.EntityFrameworkCore;

namespace BvgAuthApi.Endpoints;

public static class SigningEndpoints
{
    public static IEndpointRouteBuilder MapSigning(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/signing").RequireAuthorization("GlobalAdmin");

        g.MapGet("/profiles", (SigningStore store) => Results.Ok(store.List()));

        g.MapPost("/profiles", async ([FromForm] string alias, [FromForm] string? password, IFormFile file, SigningStore store) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
            if (string.IsNullOrWhiteSpace(alias)) return Err("alias_required", 400);
            if (file == null || file.Length == 0) return Err("invalid_file", 400);
            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            if (ext != ".pfx") return Err("invalid_content_type", 400);
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            ms.Position = 0;
            var path = store.StorePfxFile(ms);
            try
            {
                store.Add(alias.Trim(), path, password ?? string.Empty);
                return Results.Ok(new { alias });
            }
            catch (InvalidOperationException ex) when (ex.Message == "alias_exists")
            {
                return Err("alias_exists", 409);
            }
            catch
            {
                try { System.IO.File.Delete(path); } catch { }
                return Err("invalid_certificate", 400);
            }
        });

        g.MapDelete("/profiles/{alias}", async (string alias, SigningStore store, BvgAuthApi.Data.BvgDbContext db) =>
        {
            static IResult Err(string code, int status) => Results.Json(new { error = code }, statusCode: status);
            if (await db.Elections.AnyAsync(e => e.SigningProfile == alias)) return Err("profile_in_use", 409);
            store.Remove(alias);
            return Results.NoContent();
        });

        return app;
    }
}


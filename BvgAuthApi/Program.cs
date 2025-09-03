using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using BvgAuthApi.Data;
using BvgAuthApi.Endpoints;
using BvgAuthApi.Hubs;
using BvgAuthApi.Models;
using BvgAuthApi.Seed;
using BvgAuthApi.Services;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Antiforgery;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Keep JWT claim types as-is (preserve 'sub' and 'role')
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();

// Overlay persisted admin config (data/appconfig.json) if present
try
{
    var dataDir = Path.Combine(builder.Environment.ContentRootPath, "data");
    var cfgFile = Path.Combine(dataDir, "appconfig.json");
    if (File.Exists(cfgFile))
    {
        using var stream = File.OpenRead(cfgFile);
        var doc = JsonDocument.Parse(stream);
        if (doc.RootElement.TryGetProperty("StorageRoot", out var storage))
            builder.Configuration["Storage:Root"] = storage.GetString();
        if (doc.RootElement.TryGetProperty("Smtp", out var smtp))
        {
            if (smtp.TryGetProperty("Host", out var host)) builder.Configuration["Smtp:Host"] = host.GetString();
            if (smtp.TryGetProperty("Port", out var port)) builder.Configuration["Smtp:Port"] = port.GetInt32().ToString();
            if (smtp.TryGetProperty("User", out var user)) builder.Configuration["Smtp:User"] = user.GetString();
            if (smtp.TryGetProperty("From", out var from)) builder.Configuration["Smtp:From"] = from.GetString();
        }
        if (doc.RootElement.TryGetProperty("AzureAd", out var azure))
        {
            if (azure.TryGetProperty("TenantId", out var t)) builder.Configuration["AzureAd:TenantId"] = t.GetString();
            if (azure.TryGetProperty("ClientId", out var c)) builder.Configuration["AzureAd:ClientId"] = c.GetString();
            if (azure.TryGetProperty("ClientSecret", out var secret)) builder.Configuration["AzureAd:ClientSecret"] = secret.GetString();
        }
        if (doc.RootElement.TryGetProperty("Branding", out var branding))
        {
            if (branding.TryGetProperty("LogoUrl", out var logo)) builder.Configuration["Branding:LogoUrl"] = logo.GetString();
        }
        Console.WriteLine("[BOOT] Loaded admin config from data/appconfig.json");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[BOOT] Failed to load admin config: {ex.Message}");
}

// Replace placeholders with environment variables when available
builder.Configuration["ConnectionStrings:Default"] =
    Environment.GetEnvironmentVariable("DB_CONN") ?? builder.Configuration["ConnectionStrings:Default"];
builder.Configuration["Jwt:Key"] =
    Environment.GetEnvironmentVariable("JWT_KEY") ?? builder.Configuration["Jwt:Key"];
builder.Configuration["Seed:AdminEmail"] =
    Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? builder.Configuration["Seed:AdminEmail"];
builder.Configuration["Seed:AdminPassword"] =
    Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? builder.Configuration["Seed:AdminPassword"];
builder.Configuration["Seed:ResetPassword"] =
    Environment.GetEnvironmentVariable("ADMIN_RESET") ?? builder.Configuration["Seed:ResetPassword"];
builder.Configuration["AzureAd:TenantId"] =
    Environment.GetEnvironmentVariable("AZURE_AD_TENANT_ID") ?? builder.Configuration["AzureAd:TenantId"];
builder.Configuration["AzureAd:ClientId"] =
    Environment.GetEnvironmentVariable("AZURE_AD_CLIENT_ID") ?? builder.Configuration["AzureAd:ClientId"];
builder.Configuration["AzureAd:ClientSecret"] =
    Environment.GetEnvironmentVariable("AZURE_AD_CLIENT_SECRET") ?? builder.Configuration["AzureAd:ClientSecret"];
builder.Configuration["Branding:LogoUrl"] =
    Environment.GetEnvironmentVariable("BRANDING_LOGO_URL") ?? builder.Configuration["Branding:LogoUrl"];

// DbContext
builder.Services.AddDbContext<BvgDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Identity Core
builder.Services
    .AddIdentityCore<ApplicationUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 6;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireDigit = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<BvgDbContext>();
builder.Services.ConfigureHttpJsonOptions(o =>
    {
        o.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// JWT
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
var jwt = builder.Configuration.GetSection("Jwt");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new()
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = key,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization(opt =>
{
    opt.AddPolicy(AppRoles.GlobalAdmin, p => p.RequireRole(AppRoles.GlobalAdmin));
    opt.AddPolicy(AppRoles.VoteAdmin,   p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin));
    // Per-election roles (AttendanceRegistrar, VoteRegistrar, ElectionObserver) are handled via
    // election-specific assignments rather than global authorization policies.
});

builder.Services.AddSignalR();
builder.Services.AddScoped<JwtService>();
builder.Services.Configure<AzureAdOptions>(builder.Configuration.GetSection("AzureAd"));
builder.Services.AddSingleton<MicrosoftTokenValidator>();

// CORS
builder.Services.AddCors(o =>
{
    o.AddPolicy("spa", p => p
        .WithOrigins(builder.Configuration.GetSection("AllowOrigins").Get<string[]>() ?? new[] {"http://localhost:4200"})
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "BvgAuthApi API", Version = "v1" });
    var jwtScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme."
    };
    c.AddSecurityDefinition("Bearer", jwtScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [ jwtScheme ] = new List<string>()
    });
});

// Antiforgery (XSRF) for SPA
builder.Services.AddAntiforgery(o =>
{
    // Header usado por Angular para enviar el token de solicitud
    o.HeaderName = "X-XSRF-TOKEN";
    // Usar cookie antiforgery propia del framework (HttpOnly por defecto) para el cookie-token
    // NO renombrarla a XSRF-TOKEN para evitar confusión con la cookie visible del SPA.
});

var app = builder.Build();

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

app.UseCors("spa");
app.UseAuthentication();
app.UseAuthorization();
// Anti-forgery middleware to satisfy endpoints that require it
app.UseAntiforgery();

app.MapSwagger();
app.UseSwaggerUI();

// Static files for uploads (storage)
var uploadsRoot = Path.Combine(app.Environment.ContentRootPath, builder.Configuration["Storage:Root"] ?? "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads"
});

app.MapHub<LiveHub>("/hubs/live");

app.MapAuth();
app.MapUserAdmin();
app.MapElections();
app.MapConfig();
if (app.Environment.IsDevelopment()) app.MapDebug();

// Endpoint para emitir cookie/token XSRF para el SPA
app.MapGet("/api/antiforgery/token", (IAntiforgery af, HttpContext ctx) =>
{
    // Genera y almacena el cookie-token (cookie HttpOnly del framework)
    var tokens = af.GetAndStoreTokens(ctx);
    // Expone el request-token en una cookie accesible por JS para que Angular lo envíe en el header
    if (!string.IsNullOrEmpty(tokens.RequestToken))
    {
        ctx.Response.Cookies.Append(
            "XSRF-TOKEN",
            tokens.RequestToken!,
            new CookieOptions
            {
                HttpOnly = false,
                SameSite = SameSiteMode.Lax,
                Secure = ctx.Request.IsHttps,
                Path = "/"
            }
        );
    }
    return Results.Ok(new { token = tokens.RequestToken });
}).AllowAnonymous();

// Migraciones + Seed on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BvgDbContext>();
    db.Database.Migrate();
    await DataSeeder.SeedAsync(app.Services);
    await DataSeeder.EnsureRuntimeTablesAsync(app.Services);
}

app.Run();

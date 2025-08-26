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

var builder = WebApplication.CreateBuilder(args);

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
        o.Password.RequireDigit = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<BvgDbContext>();

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
    opt.AddPolicy(AppRoles.VoteOperator,p => p.RequireRole(AppRoles.GlobalAdmin, AppRoles.VoteAdmin, AppRoles.VoteOperator));
});

builder.Services.AddSignalR();
builder.Services.AddScoped<JwtService>();

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

var app = builder.Build();

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

app.UseCors("spa");
app.UseAuthentication();
app.UseAuthorization();

app.MapSwagger();
app.UseSwaggerUI();

app.MapHub<LiveHub>("/hubs/live");

app.MapAuth();
app.MapUserAdmin();
app.MapElections();

// Migraciones + Seed on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BvgDbContext>();
    db.Database.Migrate();
    await DataSeeder.SeedAsync(app.Services);
}

app.Run();

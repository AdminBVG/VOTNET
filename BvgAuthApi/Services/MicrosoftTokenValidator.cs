using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace BvgAuthApi.Services
{
    public class AzureAdOptions
    {
        public string TenantId { get; set; } = "";
        public string ClientId { get; set; } = "";
    }

    public class MicrosoftTokenValidator
    {
        private readonly AzureAdOptions _options;
        private readonly IConfigurationManager<OpenIdConnectConfiguration> _configManager;

        public MicrosoftTokenValidator(IOptions<AzureAdOptions> options)
        {
            _options = options.Value;
            var authority = $"https://login.microsoftonline.com/{_options.TenantId}/v2.0";
            _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                $"{authority}/.well-known/openid-configuration",
                new OpenIdConnectConfigurationRetriever());
        }

        public async Task<ClaimsPrincipal> ValidateAsync(string idToken)
        {
            var config = await _configManager.GetConfigurationAsync(CancellationToken.None);
            var validation = new TokenValidationParameters
            {
                ValidIssuer = config.Issuer,
                ValidAudience = _options.ClientId,
                IssuerSigningKeys = config.SigningKeys,
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true
            };
            var handler = new JwtSecurityTokenHandler();
            return handler.ValidateToken(idToken, validation, out _);
        }
    }
}

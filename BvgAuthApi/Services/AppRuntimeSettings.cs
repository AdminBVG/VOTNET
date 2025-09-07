namespace BvgAuthApi.Services;

public class AppRuntimeSettings
{
    public string Csp { get; set; } = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";
    public string SigningDefaultPfxPath { get; set; } = string.Empty;
    public string SigningDefaultPfxPassword { get; set; } = string.Empty;
    public bool SigningRequireForCertification { get; set; } = false;
    public string[] AllowedEmailDomains { get; set; } = Array.Empty<string>();
}

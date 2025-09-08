using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using System.Text.Json;

namespace BvgAuthApi.Services;

public class SigningProfile
{
    public string Alias { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Thumbprint { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public DateTimeOffset NotBefore { get; set; }
    public DateTimeOffset NotAfter { get; set; }
    public string ProtectedPassword { get; set; } = string.Empty;
}

public class SigningStore
{
    private readonly IWebHostEnvironment _env;
    private readonly IDataProtector _protector;
    private readonly string _dir;
    private readonly string _indexFile;
    private List<SigningProfile> _profiles = new();
    private readonly object _lock = new();

    public SigningStore(IWebHostEnvironment env, IDataProtectionProvider dp)
    {
        _env = env;
        _protector = dp.CreateProtector("SigningStore");
        _dir = Path.Combine(_env.ContentRootPath, "data", "certs");
        Directory.CreateDirectory(_dir);
        _indexFile = Path.Combine(_dir, "index.json");
        Load();
    }

    private void Load()
    {
        var legacyFile = Path.Combine(_dir, "profiles.json");
        var fileToRead = File.Exists(_indexFile) ? _indexFile : (File.Exists(legacyFile) ? legacyFile : _indexFile);
        if (File.Exists(fileToRead))
        {
            try
            {
                var json = File.ReadAllText(fileToRead);
                _profiles = JsonSerializer.Deserialize<List<SigningProfile>>(json) ?? new List<SigningProfile>();
            }
            catch { _profiles = new List<SigningProfile>(); }
        }
    }

    private void Save()
    {
        var json = JsonSerializer.Serialize(_profiles, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_indexFile, json);
        // keep legacy filename in sync for backward compatibility
        try { File.WriteAllText(Path.Combine(_dir, "profiles.json"), json); } catch { }
    }

    public IEnumerable<SigningProfile> List() => _profiles.Select(p => new SigningProfile
    {
        Alias = p.Alias,
        Path = p.Path,
        Thumbprint = p.Thumbprint,
        Subject = p.Subject,
        NotBefore = p.NotBefore,
        NotAfter = p.NotAfter,
        ProtectedPassword = string.Empty
    });

    public SigningProfile? Find(string alias) => _profiles.FirstOrDefault(p => p.Alias.Equals(alias, StringComparison.OrdinalIgnoreCase));

    public void Add(string alias, string pfxPath, string plainPassword)
    {
        lock (_lock)
        {
            if (_profiles.Any(p => p.Alias.Equals(alias, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("alias_exists");
            using var cert = new X509Certificate2(pfxPath, plainPassword, X509KeyStorageFlags.MachineKeySet);
            var prof = new SigningProfile
            {
                Alias = alias,
                Path = pfxPath,
                Thumbprint = cert.Thumbprint ?? string.Empty,
                Subject = cert.Subject ?? string.Empty,
                NotBefore = cert.NotBefore,
                NotAfter = cert.NotAfter,
                ProtectedPassword = _protector.Protect(plainPassword ?? string.Empty)
            };
            _profiles.Add(prof);
            Save();
        }
    }

    public void Remove(string alias)
    {
        lock (_lock)
        {
            var p = _profiles.FirstOrDefault(x => x.Alias.Equals(alias, StringComparison.OrdinalIgnoreCase));
            if (p is null) return;
            _profiles.Remove(p);
            try { if (File.Exists(p.Path)) File.Delete(p.Path); } catch { }
            Save();
        }
    }

    public X509Certificate2? GetCertificate(string alias)
    {
        var p = Find(alias);
        if (p is null) return null;
        try
        {
            var pwd = _protector.Unprotect(p.ProtectedPassword ?? string.Empty);
            return new X509Certificate2(p.Path, pwd, X509KeyStorageFlags.MachineKeySet);
        }
        catch { return null; }
    }

    public string StorePfxFile(Stream stream)
    {
        Directory.CreateDirectory(_dir);
        var name = Guid.NewGuid().ToString("N") + ".pfx";
        var dest = Path.Combine(_dir, name);
        using var fs = new FileStream(dest, FileMode.Create, FileAccess.Write);
        stream.CopyTo(fs);
        return dest;
    }
}

using System.Text;
using BvgAuthApi.Data;
using BvgAuthApi.Models;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;
using QRCoder;
using System.Security.Cryptography.X509Certificates;

namespace BvgAuthApi.Services;

public class ReportService
{
    private readonly BvgDbContext _db;
    private readonly IConfiguration _cfg;
    private readonly AppRuntimeSettings _runtime;
    private readonly SigningStore _signing;

    public ReportService(BvgDbContext db, IConfiguration cfg, AppRuntimeSettings runtime, SigningStore signing)
    {
        _db = db;
        _cfg = cfg;
        _runtime = runtime;
        _signing = signing;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<byte[]> BuildAttendancePdf(Guid electionId, bool onlyPresent = false, bool includeQr = false)
    {
        var election = await _db.Elections
            .Include(e => e.Padron)
            .FirstOrDefaultAsync(e => e.Id == electionId) ?? throw new InvalidOperationException("election_not_found");

        var logs = await _db.AttendanceLogs
            .Where(x => x.ElectionId == electionId)
            .GroupBy(x => x.PadronEntryId)
            .Select(g => g.OrderByDescending(x => x.Timestamp).First())
            .ToListAsync();
        var lastByPadron = logs.ToDictionary(x => x.PadronEntryId, x => x);

        var list = election.Padron
            .Where(p => !onlyPresent || p.Attendance != AttendanceType.None)
            .OrderBy(p => p.ShareholderId)
            .Select(p => new
            {
                p.Id,
                p.ShareholderId,
                p.ShareholderName,
                p.LegalRepresentative,
                p.Proxy,
                p.Shares,
                Attendance = p.Attendance.ToString(),
                Registrar = lastByPadron.TryGetValue(p.Id, out var lg) ? lg.UserId : "",
                Ingreso = lastByPadron.TryGetValue(p.Id, out var lg2) ? lg2.Timestamp.ToLocalTime().ToString("dd/MM/yyyy HH:mm") : ""
            })
            .ToList();

        var present = election.Padron.Count(p => p.Attendance != AttendanceType.None);
        var presentShares = election.Padron.Where(p => p.Attendance != AttendanceType.None).Sum(p => p.Shares);

        var logoUrl = _cfg["Branding:LogoUrl"] ?? string.Empty;

        var bytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(10));
                page.Header().Element(c => BuildHeader(c, "Informe de Asistencia", election.Name, logoUrl));
                page.Content().Element(c =>
                {
                    c.Column(col =>
                    {
                        col.Spacing(10);
                        col.Item().Text($"Total padrón: {election.Padron.Count} | Presentes: {present} | Acciones presentes: {presentShares}").SemiBold();
                        col.Item().Table(t =>
                        {
                            t.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(90); // ID
                                columns.RelativeColumn(2);  // Nombre
                                columns.RelativeColumn();   // Representante
                                columns.RelativeColumn();   // Apoderado
                                columns.ConstantColumn(70); // Acciones
                                columns.ConstantColumn(80); // Asistencia
                                columns.ConstantColumn(80); // Ingreso
                                columns.ConstantColumn(80); // Registrador
                                if (includeQr) columns.ConstantColumn(60); // QR
                            });

                            // Header row
                            t.Header(h =>
                            {
                                h.Cell().LabelCell("ID");
                                h.Cell().LabelCell("Nombre");
                                h.Cell().LabelCell("Representante");
                                h.Cell().LabelCell("Apoderado");
                                h.Cell().LabelCell("Acciones");
                                h.Cell().LabelCell("Asistencia");
                                h.Cell().LabelCell("Ingreso");
                                h.Cell().LabelCell("Registrador");
                                if (includeQr) h.Cell().LabelCell("QR");
                            });

                            foreach (var p in list)
                            {
                                t.Cell().Text(p.ShareholderId);
                                t.Cell().Text(p.ShareholderName);
                                t.Cell().Text(p.LegalRepresentative ?? "");
                                t.Cell().Text(p.Proxy ?? "");
                                t.Cell().Text(p.Shares.ToString());
                                t.Cell().Text(p.Attendance);
                                t.Cell().Text(p.Ingreso);
                                t.Cell().Text(p.Registrar);
                                if (includeQr)
                                {
                                    var payload = $"{election.Id}|{p.Id}";
                                    var qrPng = RenderQr(payload, 120);
                                    t.Cell().Element(e => e.AlignCenter().AlignMiddle()).Image(qrPng);
                                }
                            }
                        });
                        // Hash for quick verification of the attendance list
                        var listHash = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(list)));
                        col.Item().Text($"Attendance Hash (SHA-256): {Convert.ToHexString(listHash)}").FontSize(8);

                        col.Item().PaddingTop(20).Row(row =>
                        {
                            row.RelativeItem().Column(cc =>
                            {
                                cc.Item().LineHorizontal(1);
                                cc.Item().Text("Firma Presidente").AlignCenter();
                            });
                            row.RelativeItem().Column(cc =>
                            {
                                cc.Item().LineHorizontal(1);
                                cc.Item().Text("Firma Secretario").AlignCenter();
                            });
                        });
                    });
                });
                page.Footer().AlignRight().Text(x =>
                {
                    x.Span("Generado: ");
                    x.Span(DateTime.Now.ToString("dd/MM/yyyy HH:mm"));
                });
            });
        }).GeneratePdf();

        return bytes;
    }

    public async Task<byte[]> BuildResultsPdf(Guid electionId)
    {
        var election = await _db.Elections
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .Include(e => e.Votes)
            .Include(e => e.Padron)
            .FirstOrDefaultAsync(e => e.Id == electionId) ?? throw new InvalidOperationException("election_not_found");

        var presentPeople = election.Padron.Where(p => p.Attendance != AttendanceType.None).ToList();
        var presentShares = presentPeople.Sum(p => p.Shares);

        var qResults = new List<QuestionResult>();
        foreach (var q in election.Questions)
        {
            var votesForQ = election.Votes.Where(v => v.ElectionQuestionId == q.Id).ToList();
            var byOption = new Dictionary<Guid, (int Count, decimal Shares)>();
            foreach (var opt in q.Options)
            {
                var votesOpt = votesForQ.Where(v => v.ElectionOptionId == opt.Id).ToList();
                var shares = (from v in votesOpt join p in election.Padron on v.PadronEntryId equals p.Id select p.Shares).Sum();
                byOption[opt.Id] = (votesOpt.Count, shares);
            }
            var abstPeople = Math.Max(0, presentPeople.Count - votesForQ.Count);
            var votedShares = byOption.Values.Sum(x => x.Shares);
            var abstShares = Math.Max(0, presentShares - votedShares);

            qResults.Add(new QuestionResult
            {
                Question = q.Text,
                Options = q.Options.Select(o => new OptionResult
                {
                    Text = o.Text,
                    Count = byOption.TryGetValue(o.Id, out var v) ? v.Count : 0,
                    Shares = byOption.TryGetValue(o.Id, out var v2) ? v2.Shares : 0
                }).ToList(),
                AbstentionsCount = abstPeople,
                AbstentionsShares = abstShares
            });
        }

        var logoUrl = _cfg["Branding:LogoUrl"] ?? string.Empty;

        // Build a normalized summary to hash/sign
        var summaryObj = new {
            ElectionId = election.Id,
            Questions = qResults.Select(q => new { q.Question, Options = q.Options, q.AbstentionsCount, q.AbstentionsShares }),
            PresentShares = presentShares
        };
        var summaryJson = System.Text.Json.JsonSerializer.Serialize(summaryObj);
        var summaryHash = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(summaryJson));
        string? signatureB64 = null;
        try
        {
            // Prefer per-election SigningProfile when set
            X509Certificate2? cert = null;
            if (!string.IsNullOrWhiteSpace(election.SigningProfile))
                cert = _signing.GetCertificate(election.SigningProfile);
            if (cert is null)
            {
                var pfxPath = string.IsNullOrWhiteSpace(_runtime.SigningDefaultPfxPath) ? _cfg["Signing:DefaultPfxPath"] : _runtime.SigningDefaultPfxPath;
                var pfxPassword = string.IsNullOrWhiteSpace(_runtime.SigningDefaultPfxPassword) ? _cfg["Signing:DefaultPfxPassword"] : _runtime.SigningDefaultPfxPassword;
                if (!string.IsNullOrWhiteSpace(pfxPath) && System.IO.File.Exists(pfxPath))
                    cert = new System.Security.Cryptography.X509Certificates.X509Certificate2(pfxPath, pfxPassword, System.Security.Cryptography.X509Certificates.X509KeyStorageFlags.MachineKeySet);
            }
            if (cert is not null)
            {
                using var rsa = System.Security.Cryptography.X509Certificates.RSACertificateExtensions.GetRSAPrivateKey(cert!);
                if (rsa is not null)
                {
                    var sig = rsa.SignData(Encoding.UTF8.GetBytes(summaryJson), System.Security.Cryptography.HashAlgorithmName.SHA256, System.Security.Cryptography.RSASignaturePadding.Pkcs1);
                    signatureB64 = Convert.ToBase64String(sig);
                }
            }
        }
        catch { /* ignore signing errors; still include hash */ }

        var bytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(10));
                page.Header().Element(c => BuildHeader(c, "Acta de Resultados", election.Name, logoUrl));
                page.Content().Element(c =>
                {
                    c.Column(col =>
                    {
                        col.Spacing(15);
                        col.Item().Text($"Presentes: {presentPeople.Count} | Acciones presentes: {presentShares}").SemiBold();
                        foreach (var qr in qResults)
                        {
                            col.Item().Text(qr.Question).FontSize(12).SemiBold();
                            col.Item().Table(t =>
                            {
                                t.ColumnsDefinition(cd =>
                                {
                                    cd.RelativeColumn(3);
                                    cd.ConstantColumn(70);
                                    cd.ConstantColumn(90);
                                    cd.ConstantColumn(70);
                                    cd.ConstantColumn(90);
                                });
                                t.Header(h =>
                                {
                                    h.Cell().LabelCell("Opción");
                                    h.Cell().LabelCell("Votos");
                                    h.Cell().LabelCell("% Personas");
                                    h.Cell().LabelCell("Acciones");
                                    h.Cell().LabelCell("% Acciones");
                                });
                                var totalPeople = Math.Max(1, presentPeople.Count);
                                var totalShares = Math.Max(1, presentShares);
                                foreach (var o in qr.Options)
                                {
                                    var pctP = (double)o.Count / totalPeople * 100.0;
                                    var pctS = (double)o.Shares / (double)totalShares * 100.0;
                                    t.Cell().Text(o.Text);
                                    t.Cell().Text(o.Count.ToString());
                                    t.Cell().Text(pctP.ToString("0.0") + "%");
                                    t.Cell().Text(o.Shares.ToString());
                                    t.Cell().Text(pctS.ToString("0.0") + "%");
                                }
                                // Abstenciones row
                                var pctAbstP = (double)qr.AbstentionsCount / Math.Max(1, presentPeople.Count) * 100.0;
                                var pctAbstS = (double)qr.AbstentionsShares / (double)Math.Max(1, presentShares) * 100.0;
                                t.Cell().Text("Abstenciones").Italic();
                                t.Cell().Text(qr.AbstentionsCount.ToString()).Italic();
                                t.Cell().Text(pctAbstP.ToString("0.0") + "%").Italic();
                                t.Cell().Text(qr.AbstentionsShares.ToString()).Italic();
                                t.Cell().Text(pctAbstS.ToString("0.0") + "%").Italic();
                            });

                            // Charts: barras (personas) y pastel (acciones)
                            var barData = qr.Options.ToDictionary(x => x.Text, x => (double)x.Count);
                            var pieData = qr.Options.ToDictionary(x => x.Text, x => (double)x.Shares);
                            if (qr.AbstentionsCount > 0) barData.Add("Abstenciones", qr.AbstentionsCount);
                            if (qr.AbstentionsShares > 0) pieData.Add("Abstenciones", (double)qr.AbstentionsShares);

                            var barPng = RenderBarChart(barData, 700, 250, title: "Votos por opción (personas)");
                            var piePng = RenderPieChart(pieData, 300, 300, title: "Distribución por acciones");

                            col.Item().Row(r =>
                            {
                                r.RelativeItem(2).Image(barPng);
                                r.RelativeItem(1).Image(piePng);
                            });
                        }
                        // Audit footer with hash and optional signature
                        col.Item().PaddingTop(10).Text($"Results Hash (SHA-256): {Convert.ToHexString(summaryHash)}").FontSize(8);
                        if (!string.IsNullOrEmpty(signatureB64))
                            col.Item().Text($"Digital Signature (RSA/SHA256, Base64): {signatureB64}").FontSize(8);
                    });
                });
                page.Footer().AlignRight().Text(x =>
                {
                    x.Span("Generado: ");
                    x.Span(DateTime.Now.ToString("dd/MM/yyyy HH:mm"));
                });
            });
        }).GeneratePdf();

        return bytes;
    }

    private static void BuildHeader(IContainer container, string title, string electionName, string logoUrl)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(title).FontSize(16).SemiBold();
                col.Item().Text(electionName).FontSize(11).Light();
            });
            if (!string.IsNullOrWhiteSpace(logoUrl))
            {
                try
                {
                    using var wc = new HttpClient();
                    var data = wc.GetByteArrayAsync(logoUrl).GetAwaiter().GetResult();
                    row.ConstantItem(80).Image(data);
                }
                catch { /* ignore logo errors */ }
            }
        });
        container.PaddingTop(5).PaddingBottom(10).LineHorizontal(1);
    }

    private static byte[] RenderQr(string payload, int size)
    {
        using var gen = new QRCodeGenerator();
        using var data = gen.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data);
        return png.GetGraphic(6);
    }

    private static byte[] RenderBarChart(Dictionary<string, double> values, int width, int height, string? title = null)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);

        var margin = 40;
        var plotLeft = margin;
        var plotTop = title is null ? margin / 2 : margin + 20;
        var plotRight = width - margin;
        var plotBottom = height - margin;

        if (!string.IsNullOrEmpty(title))
        {
            using var paintTitle = new SKPaint { Color = SKColors.Black, TextSize = 16, IsAntialias = true };
            canvas.DrawText(title, margin, margin, paintTitle);
        }

        if (values.Count == 0)
            return Encode(bitmap);

        var max = values.Max(v => v.Value);
        if (max <= 0) max = 1;
        var barWidth = (plotRight - plotLeft) / Math.Max(1, values.Count);

        int i = 0;
        foreach (var kv in values)
        {
            var x = plotLeft + i * barWidth + 5;
            var barH = (float)((kv.Value / max) * (plotBottom - plotTop));
            var y = plotBottom - barH;
            var color = SKColor.FromHsv((i * 53) % 360, 200, 220);
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            canvas.DrawRect(new SKRect(x, y, x + barWidth - 10, plotBottom), paint);

            using var txt = new SKPaint { Color = SKColors.Black, TextSize = 10, IsAntialias = true };
            var label = kv.Key.Length > 12 ? kv.Key.Substring(0, 12) + "…" : kv.Key;
            canvas.DrawText(label, x, plotBottom + 12, txt);
            canvas.DrawText(kv.Value.ToString("0"), x, y - 2, txt);
            i++;
        }

        return Encode(bitmap);
    }

    private static byte[] RenderPieChart(Dictionary<string, double> values, int width, int height, string? title = null)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);

        if (!string.IsNullOrEmpty(title))
        {
            using var paintTitle = new SKPaint { Color = SKColors.Black, TextSize = 14, IsAntialias = true };
            canvas.DrawText(title, 10, 18, paintTitle);
        }

        var rect = new SKRect(10, 25, width - 10, height - 10);
        var total = values.Sum(v => v.Value);
        if (total <= 0) total = 1;
        float start = 0;
        int i = 0;
        foreach (var kv in values)
        {
            var sweep = (float)(kv.Value / total * 360.0);
            var color = SKColor.FromHsv((i * 53) % 360, 200, 220);
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            canvas.DrawArc(rect, start, sweep, true, paint);
            start += sweep;
            i++;
        }

        return Encode(bitmap);
    }

    private static byte[] Encode(SKBitmap bmp)
    {
        using var image = SKImage.FromBitmap(bmp);
        using var data = image.Encode(SKEncodedImageFormat.Png, 90);
        return data.ToArray();
    }

    private class QuestionResult
    {
        public string Question { get; set; } = string.Empty;
        public List<OptionResult> Options { get; set; } = new();
        public int AbstentionsCount { get; set; }
        public decimal AbstentionsShares { get; set; }
    }

    private class OptionResult
    {
        public string Text { get; set; } = string.Empty;
        public int Count { get; set; }
        public decimal Shares { get; set; }
    }
}

static class QuestPdfExtensions
{
    public static void LabelCell(this IContainer c, string text)
    {
        c.BorderBottom(1).PaddingBottom(4).Text(text).SemiBold();
    }
}

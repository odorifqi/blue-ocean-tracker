using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Cylinders.Api.Tests;

/// <summary>A fixed clock, so lastUpdated assertions are deterministic.</summary>
public class FixedClock(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = now;
    public override DateTimeOffset GetUtcNow() => Now;
}

/// <summary>
/// Boots the real API against its own SQLite file, seeded from cylinders.json.
/// One per test, so tests never see each other's writes.
/// </summary>
public sealed class TestApp : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"cylinders-test-{Guid.NewGuid():N}.db");
    public FixedClock Clock { get; } = new(new DateTimeOffset(2026, 10, 22, 8, 0, 0, TimeSpan.Zero));

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_dbPath};Pooling=False");
        builder.ConfigureServices(s => s.Replace(ServiceDescriptor.Singleton<TimeProvider>(Clock)));
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { File.Delete(_dbPath); } catch { /* best effort */ }
    }
}

public record CylinderBody(int Id, string SerialNumber, string GasType, string Status, string? CustomerName, DateTime LastUpdated, string[] AllowedNextStatuses);
public record PageBody(List<CylinderBody> Items, int Page, int PageSize, int TotalCount);
public record ProblemBody(int Status, string Title, string? Detail, Dictionary<string, string[]>? Errors);

public static class HttpExtensions
{
    public static async Task<T> Read<T>(this HttpResponseMessage res) =>
        (await res.Content.ReadFromJsonAsync<T>(TestApp.Json))!;
}

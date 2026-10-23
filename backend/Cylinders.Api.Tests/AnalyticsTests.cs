using System.Net.Http.Json;

namespace Cylinders.Api.Tests;

public class AnalyticsTests
{
    public record GasBody(string GasType, int Total, Dictionary<string, int> ByStatus);
    public record AgeBody(string Label, int MinDays, int? MaxDays, int Count);
    public record CustomerBody(string CustomerName, int Cylinders, int Idle, int OldestDays);
    public record AnalyticsBody(
        int IdleDays, int Total, int InService, int Idle, Dictionary<string, int> ByStatus,
        List<GasBody> ByGas, List<AgeBody> Aging, int CustomerCount, List<CustomerBody> TopCustomers);

    [Fact]
    public async Task Breakdowns_add_up_to_the_whole_fleet()
    {
        using var app = new TestApp();
        var a = await (await app.CreateClient().GetAsync("/api/cylinders/analytics")).Read<AnalyticsBody>();

        Assert.Equal(87, a.Total);
        Assert.Equal(a.Total - a.ByStatus["Retired"], a.InService);
        Assert.Equal(a.Total, a.ByStatus.Values.Sum());
        Assert.Equal(6, a.ByGas.Count);
        Assert.Equal(a.Total, a.ByGas.Sum(g => g.Total));
        Assert.All(a.ByGas, g => Assert.Equal(g.Total, g.ByStatus.Values.Sum()));
        Assert.Equal(a.InService, a.Aging.Sum(b => b.Count)); // retired cylinders are not aged
        Assert.True(a.TopCustomers.Count <= 8);
        Assert.True(a.Idle <= a.ByStatus["Delivered"]);
        Assert.True(a.TopCustomers.Sum(c => c.Idle) <= a.Idle);
        Assert.Equal(a.TopCustomers.OrderByDescending(c => c.Cylinders).Select(c => c.Cylinders), a.TopCustomers.Select(c => c.Cylinders));
    }

    [Fact]
    public async Task A_status_change_moves_the_cylinder_between_buckets()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var before = await (await client.GetAsync("/api/cylinders/analytics")).Read<AnalyticsBody>();

        // Cylinder 1 is Delivered in the seed data; returning it makes it Empty and "moved today".
        var res = await client.PostAsJsonAsync("/api/cylinders/1/status", new { status = "Empty" });
        res.EnsureSuccessStatusCode();
        var after = await (await client.GetAsync("/api/cylinders/analytics")).Read<AnalyticsBody>();

        Assert.Equal(before.ByStatus["Delivered"] - 1, after.ByStatus["Delivered"]);
        Assert.Equal(before.ByStatus["Empty"] + 1, after.ByStatus["Empty"]);
        Assert.Equal(before.Aging[0].Count + 1, after.Aging[0].Count);
    }
}

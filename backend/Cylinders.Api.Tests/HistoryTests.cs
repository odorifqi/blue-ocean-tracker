using System.Net;
using System.Net.Http.Json;
using Cylinders.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cylinders.Api.Tests;

public record ChangeBody(string Field, string From, string To);
public record EventBody(int Id, int CylinderId, string Type, DateTime At, string? FromStatus, string? ToStatus, string? CustomerName, List<ChangeBody> Changes, string ActionBy);
public record SummaryBody(DateTime? TrackedSince, int Deliveries, int Customers, DateTime? LastEdited);
public record HistoryBody(List<EventBody> Items, int Page, int PageSize, int TotalCount, SummaryBody Summary);

public class HistoryTests
{
    private static async Task<HistoryBody> History(HttpClient client, int id, string query = "") =>
        await (await client.GetAsync($"/api/cylinders/{id}/history{query}")).Read<HistoryBody>();

    [Fact]
    public async Task Every_write_is_recorded_with_the_server_time_and_the_server_side_actor()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        var c = await (await client.PostAsJsonAsync("/api/cylinders", new { serialNumber = "CYL-777777", gasType = "Argon", actionBy = "Someone else" })).Read<CylinderBody>();
        app.Clock.Now = app.Clock.Now.AddHours(1);
        await client.PutAsJsonAsync($"/api/cylinders/{c.Id}", new { serialNumber = "CYL-777778", gasType = "Argon" });
        await client.PutAsJsonAsync($"/api/cylinders/{c.Id}", new { serialNumber = "CYL-777778", gasType = "Argon" }); // no change, no entry
        app.Clock.Now = app.Clock.Now.AddHours(1);
        await client.PostAsJsonAsync($"/api/cylinders/{c.Id}/status", new { status = "Filled", actionBy = "Someone else" });
        app.Clock.Now = app.Clock.Now.AddHours(1);
        await client.PostAsJsonAsync($"/api/cylinders/{c.Id}/status", new { status = "Delivered", customerName = "PT Café O'Brien" });

        var h = await History(client, c.Id);
        Assert.Equal(["status", "status", "edited", "added"], h.Items.Select(e => e.Type));
        Assert.All(h.Items, e => Assert.Equal("Rina Wulandari", e.ActionBy));
        Assert.Equal(app.Clock.Now.UtcDateTime, h.Items[0].At);
        Assert.Equal(("Filled", "Delivered", "PT Café O'Brien"), (h.Items[0].FromStatus, h.Items[0].ToStatus, h.Items[0].CustomerName));
        Assert.Equal([new ChangeBody("serialNumber", "CYL-777777", "CYL-777778")], h.Items[2].Changes);
        Assert.Equal((1, 1), (h.Summary.Deliveries, h.Summary.Customers));

        // A return names the customer it came back from; it isn't another delivery or customer.
        app.Clock.Now = app.Clock.Now.AddHours(1);
        await client.PostAsJsonAsync($"/api/cylinders/{c.Id}/status", new { status = "Empty" });
        var back = await History(client, c.Id);
        Assert.Equal(("Delivered", "Empty", "PT Café O'Brien"), (back.Items[0].FromStatus, back.Items[0].ToStatus, back.Items[0].CustomerName));
        Assert.Equal((1, 1), (back.Summary.Deliveries, back.Summary.Customers));

        Assert.Equal(1, (await History(client, c.Id, "?type=edit")).TotalCount);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/cylinders/{c.Id}/history?type=nope")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/cylinders/9999/history")).StatusCode);
    }

    [Fact]
    public async Task Imported_cylinders_get_one_entry_each_and_nothing_invented()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        var h = await History(client, 1);
        var only = Assert.Single(h.Items);
        Assert.Equal(("imported", "System import", "Delivered"), (only.Type, only.ActionBy, only.ToStatus));
        Assert.Equal(0, h.Summary.Deliveries);

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(await db.Cylinders.CountAsync(), await db.Events.CountAsync());
    }

    [Fact]
    public async Task History_cannot_be_changed_or_deleted_even_with_direct_database_access()
    {
        using var app = new TestApp();
        app.CreateClient();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var update = await Record.ExceptionAsync(() => db.Database.ExecuteSqlRawAsync("UPDATE cylinder_events SET action_by = 'Someone else'"));
        var delete = await Record.ExceptionAsync(() => db.Database.ExecuteSqlRawAsync("DELETE FROM cylinder_events"));
        Assert.Contains("append-only", update?.Message);
        Assert.Contains("append-only", delete?.Message);
    }
}

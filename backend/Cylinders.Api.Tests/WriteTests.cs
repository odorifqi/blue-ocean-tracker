using System.Net;
using System.Net.Http.Json;

namespace Cylinders.Api.Tests;

public class CreateAndUpdateTests
{
    [Fact]
    public async Task Create_normalises_serial_starts_Empty_and_rejects_case_insensitive_duplicates()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        var res = await client.PostAsJsonAsync("/api/cylinders", new { serialNumber = " cyl-999999 ", gasType = "carbon dioxide" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var created = await res.Read<CylinderBody>();
        Assert.Equal("CYL-999999", created.SerialNumber);
        Assert.Equal("Carbon Dioxide", created.GasType);
        Assert.Equal("Empty", created.Status);
        Assert.Null(created.CustomerName);
        Assert.Equal(app.Clock.Now.UtcDateTime, created.LastUpdated);
        Assert.Equal($"/api/cylinders/{created.Id}", res.Headers.Location?.OriginalString);

        var dup = await client.PostAsJsonAsync("/api/cylinders", new { serialNumber = "CYL-999999", gasType = "Argon" });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
        Assert.Contains("serialNumber", (await dup.Read<ProblemBody>()).Errors!.Keys);
    }

    [Theory]
    [InlineData("CYL-12345", "Oxygen", "serialNumber")]
    [InlineData("ABC-123456", "Oxygen", "serialNumber")]
    [InlineData("", "Oxygen", "serialNumber")]
    [InlineData("CYL-123456", "Helium", "gasType")]
    public async Task Create_returns_400_with_field_errors(string serial, string gas, string field)
    {
        using var app = new TestApp();
        var res = await app.CreateClient().PostAsJsonAsync("/api/cylinders", new { serialNumber = serial, gasType = gas });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains(field, (await res.Read<ProblemBody>()).Errors!.Keys);
    }

    [Fact]
    public async Task Update_changes_serial_and_gas_but_never_status()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        var res = await client.PutAsJsonAsync("/api/cylinders/1", new { serialNumber = "cyl-111111", gasType = "Argon", status = "Retired" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var updated = await res.Read<CylinderBody>();
        Assert.Equal("CYL-111111", updated.SerialNumber);
        Assert.Equal("Argon", updated.GasType);
        Assert.Equal("Delivered", updated.Status); // unchanged

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("/api/cylinders/9999", new { serialNumber = "CYL-222222", gasType = "Argon" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/cylinders/2", new { serialNumber = "CYL-111111", gasType = "Argon" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/cylinders/9999")).StatusCode);
    }
}

public class StatusTests
{
    private static async Task<CylinderBody> Create(HttpClient client, string serial = "CYL-555555")
    {
        var res = await client.PostAsJsonAsync("/api/cylinders", new { serialNumber = serial, gasType = "Oxygen" });
        return await res.Read<CylinderBody>();
    }

    private static Task<HttpResponseMessage> Move(HttpClient client, int id, string status, string? customer = null) =>
        client.PostAsJsonAsync($"/api/cylinders/{id}/status", new { status, customerName = customer });

    [Fact]
    public async Task Follows_the_full_lifecycle_and_records_the_customer_only_while_delivered()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var c = await Create(client);

        Assert.Equal(HttpStatusCode.OK, (await Move(client, c.Id, "Filled")).StatusCode);

        app.Clock.Now = app.Clock.Now.AddHours(2);
        var delivered = await (await Move(client, c.Id, "Delivered", "  PT Sinar O'Brien Medika ")).Read<CylinderBody>();
        Assert.Equal("Delivered", delivered.Status);
        Assert.Equal("PT Sinar O'Brien Medika", delivered.CustomerName);
        Assert.Equal(app.Clock.Now.UtcDateTime, delivered.LastUpdated); // set by the server
        Assert.Equal(["Empty"], delivered.AllowedNextStatuses);

        var returned = await (await Move(client, c.Id, "Empty")).Read<CylinderBody>();
        Assert.Null(returned.CustomerName);

        await Move(client, c.Id, "Retired");
        var stuck = await Move(client, c.Id, "Empty");
        Assert.Equal(HttpStatusCode.BadRequest, stuck.StatusCode);
        Assert.Equal("Invalid status transition", (await stuck.Read<ProblemBody>()).Title);
    }

    [Theory]
    [InlineData("Empty", "Delivered")]
    [InlineData("Empty", "Empty")]
    [InlineData("Empty", "Unknown")]
    public async Task Rejects_moves_the_lifecycle_does_not_allow(string from, string to)
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var c = await Create(client);
        Assert.Equal(from, c.Status);

        var res = await Move(client, c.Id, to);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("status", (await res.Read<ProblemBody>()).Errors!.Keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    [InlineData(121)]
    public async Task Delivering_requires_a_customer_name_of_at_most_120_characters(object? customer)
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var c = await Create(client);
        await Move(client, c.Id, "Filled");

        var name = customer is int n ? new string('A', n) : (string?)customer;
        var res = await Move(client, c.Id, "Delivered", name);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("customerName", (await res.Read<ProblemBody>()).Errors!.Keys);

        Assert.Equal(HttpStatusCode.OK, (await Move(client, c.Id, "Delivered", new string('A', 120))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Move(client, 9999, "Filled")).StatusCode);
    }
}

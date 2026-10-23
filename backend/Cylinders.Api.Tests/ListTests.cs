using System.Net;

namespace Cylinders.Api.Tests;

public class ListTests
{
    [Fact]
    public async Task Seeds_87_cylinders_with_ids_in_file_order_and_pages_by_most_recent()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        var page = await (await client.GetAsync("/api/cylinders")).Read<PageBody>();

        Assert.Equal(87, page.TotalCount);
        Assert.Equal(1, page.Page);
        Assert.Equal(10, page.PageSize); // default
        Assert.Equal(10, page.Items.Count);
        Assert.Equal(page.Items.OrderByDescending(c => c.LastUpdated).ThenBy(c => c.Id).Select(c => c.Id), page.Items.Select(c => c.Id));

        var first = await (await client.GetAsync("/api/cylinders/1")).Read<CylinderBody>();
        Assert.Equal("CYL-703757", first.SerialNumber); // first record in cylinders.json
    }

    [Theory]
    [InlineData("o'brien", 3)]      // apostrophe
    [InlineData("ÖSTARA", 2)]       // non-ASCII, case-insensitive
    [InlineData("cyl-0123", 1)]     // partial serial, lower case
    [InlineData("nothing-here", 0)]
    public async Task Search_is_a_case_insensitive_partial_match_on_serial_or_customer(string search, int expected)
    {
        using var app = new TestApp();
        var page = await (await app.CreateClient().GetAsync($"/api/cylinders?search={Uri.EscapeDataString(search)}&pageSize=50")).Read<PageBody>();
        Assert.Equal(expected, page.TotalCount);
    }

    [Fact]
    public async Task Filters_by_exact_status()
    {
        using var app = new TestApp();
        var page = await (await app.CreateClient().GetAsync("/api/cylinders?status=Retired")).Read<PageBody>();
        Assert.Equal(2, page.TotalCount);
        Assert.All(page.Items, c => Assert.Equal("Retired", c.Status));
    }

    [Theory]
    [InlineData("page=0")]
    [InlineData("pageSize=51")]
    [InlineData("status=Lost")]
    public async Task Rejects_invalid_query_with_400(string query)
    {
        using var app = new TestApp();
        var res = await app.CreateClient().GetAsync($"/api/cylinders?{query}");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task A_page_past_the_end_is_empty_not_an_error()
    {
        using var app = new TestApp();
        var res = await app.CreateClient().GetAsync("/api/cylinders?page=99");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var page = await res.Read<PageBody>();
        Assert.Empty(page.Items);
        Assert.Equal(87, page.TotalCount);
    }
}

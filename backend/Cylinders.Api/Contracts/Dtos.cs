using Cylinders.Api.Domain;

namespace Cylinders.Api.Contracts;

public record CylinderDto(
    int Id,
    string SerialNumber,
    string GasType,
    string Status,
    string? CustomerName,
    DateTime LastUpdated,
    string[] AllowedNextStatuses)
{
    public static CylinderDto From(Cylinder c) => new(
        c.Id,
        c.SerialNumber,
        c.GasType,
        c.Status.ToString(),
        c.CustomerName,
        DateTime.SpecifyKind(c.LastUpdated, DateTimeKind.Utc),
        CylinderRules.Transitions[c.Status].Select(s => s.ToString()).ToArray());
}

public record HistoryChangeDto(string Field, string From, string To);

public record HistoryEventDto(
    int Id,
    int CylinderId,
    string Type,
    DateTime At,
    string? FromStatus,
    string? ToStatus,
    string? CustomerName,
    IReadOnlyList<HistoryChangeDto> Changes,
    string ActionBy)
{
    private static readonly System.Text.Json.JsonSerializerOptions Json = new(System.Text.Json.JsonSerializerDefaults.Web);

    public static HistoryEventDto From(CylinderEvent e) => new(
        e.Id,
        e.CylinderId,
        e.Type,
        DateTime.SpecifyKind(e.At, DateTimeKind.Utc),
        e.FromStatus?.ToString(),
        e.ToStatus?.ToString(),
        e.CustomerName,
        System.Text.Json.JsonSerializer.Deserialize<List<HistoryChangeDto>>(e.Changes, Json) ?? [],
        e.ActionBy);
}

public record HistorySummary(DateTime? TrackedSince, int Deliveries, int Customers, DateTime? LastEdited);

public record HistoryPage(IReadOnlyList<HistoryEventDto> Items, int Page, int PageSize, int TotalCount, HistorySummary Summary);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public record CylinderInput(string? SerialNumber, string? GasType);

public record StatusChangeInput(string? Status, string? CustomerName);

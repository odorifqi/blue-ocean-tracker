using Cylinders.Api.Domain;

namespace Cylinders.Api.Contracts;

public record CylinderDto(
    int Id,
    string SerialNumber,
    string GasType,
    string Status,
    string? CustomerName,
    DateTime LastUpdated)
{
    public static CylinderDto From(Cylinder c) => new(
        c.Id,
        c.SerialNumber,
        c.GasType,
        c.Status.ToString(),
        c.CustomerName,
        DateTime.SpecifyKind(c.LastUpdated, DateTimeKind.Utc));
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public record CylinderInput(string? SerialNumber, string? GasType);

public record StatusChangeInput(string? Status, string? CustomerName);

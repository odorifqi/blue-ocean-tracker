namespace Cylinders.Api.Domain;

public class Cylinder
{
    public int Id { get; set; }
    public string SerialNumber { get; set; } = "";
    public string GasType { get; set; } = "";
    public CylinderStatus Status { get; set; }
    public string? CustomerName { get; set; }
    public DateTime LastUpdated { get; set; }

    // Upper-cased "serial + customer" used for case-insensitive search.
    // SQLite's LIKE/lower() only fold ASCII, so names like "Östara" need this.
    public string SearchKey { get; set; } = "";

    public void RefreshSearchKey() =>
        SearchKey = $"{SerialNumber} {CustomerName}".ToUpperInvariant();
}

public enum CylinderStatus
{
    Empty,
    Filled,
    Delivered,
    InMaintenance,
    Retired,
}

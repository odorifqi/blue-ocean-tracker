using System.Text.RegularExpressions;

namespace Cylinders.Api.Domain;

public static partial class CylinderRules
{
    public const int CustomerNameMaxLength = 120;

    public static readonly string[] GasTypes =
        ["Oxygen", "Nitrogen", "Argon", "Carbon Dioxide", "Acetylene", "Hydrogen"];

    public static readonly IReadOnlyDictionary<CylinderStatus, CylinderStatus[]> Transitions =
        new Dictionary<CylinderStatus, CylinderStatus[]>
        {
            [CylinderStatus.Empty] = [CylinderStatus.Filled, CylinderStatus.InMaintenance, CylinderStatus.Retired],
            [CylinderStatus.Filled] = [CylinderStatus.Delivered, CylinderStatus.InMaintenance, CylinderStatus.Retired],
            [CylinderStatus.Delivered] = [CylinderStatus.Empty],
            [CylinderStatus.InMaintenance] = [CylinderStatus.Empty, CylinderStatus.Retired],
            [CylinderStatus.Retired] = [],
        };

    [GeneratedRegex(@"^CYL-\d{6}$")]
    private static partial Regex SerialPattern();

    public static string NormalizeSerial(string? serial) => (serial ?? "").Trim().ToUpperInvariant();

    public static bool IsValidSerial(string normalized) => SerialPattern().IsMatch(normalized);

    // Returns the canonical spelling, so "carbon dioxide" is stored as "Carbon Dioxide".
    public static string? MatchGasType(string? gasType) =>
        GasTypes.FirstOrDefault(g => string.Equals(g, gasType?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool CanTransition(CylinderStatus from, CylinderStatus to) => Transitions[from].Contains(to);
}

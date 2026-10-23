using System.Text.Json;
using System.Text.Json.Serialization;
using Cylinders.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cylinders.Api.Data;

public static class Seeder
{
    private record SeedRow(
        int? Id, string SerialNumber, string GasType, CylinderStatus Status, string? CustomerName, DateTime LastUpdated);

    // The JSON has no ids even though the brief says it does, so rows get 1..n in file order.
    public static async Task SeedAsync(AppDbContext db, string jsonPath)
    {
        if (await db.Cylinders.AnyAsync()) return;

        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        var rows = JsonSerializer.Deserialize<List<SeedRow>>(await File.ReadAllTextAsync(jsonPath), options) ?? [];

        var seen = new HashSet<string>();
        var index = 0;
        foreach (var row in rows)
        {
            index++;
            var serial = CylinderRules.NormalizeSerial(row.SerialNumber);
            if (!seen.Add(serial)) continue; // keep the first occurrence of a duplicate serial

            var cylinder = new Cylinder
            {
                Id = row.Id ?? index,
                SerialNumber = serial,
                GasType = CylinderRules.MatchGasType(row.GasType) ?? row.GasType.Trim(),
                Status = row.Status,
                CustomerName = row.Status == CylinderStatus.Delivered ? row.CustomerName?.Trim() : null,
                LastUpdated = row.LastUpdated.ToUniversalTime(),
            };
            cylinder.RefreshSearchKey();
            db.Cylinders.Add(cylinder);
            // The file has no history, so each cylinder gets one entry at the file's own timestamp. Nothing earlier is invented.
            db.Events.Add(new CylinderEvent
            {
                Cylinder = cylinder,
                Type = EventTypes.Imported,
                At = cylinder.LastUpdated,
                ToStatus = cylinder.Status,
                CustomerName = cylinder.CustomerName,
                ActionBy = CurrentUser.ImportActor,
            });
        }
        await db.SaveChangesAsync();
    }
}

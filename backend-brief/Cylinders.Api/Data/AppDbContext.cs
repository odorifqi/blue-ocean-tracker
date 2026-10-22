using Cylinders.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cylinders.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Cylinder> Cylinders => Set<Cylinder>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        var c = b.Entity<Cylinder>();
        c.Property(x => x.SerialNumber).HasMaxLength(10).IsRequired();
        c.HasIndex(x => x.SerialNumber).IsUnique();
        c.Property(x => x.GasType).HasMaxLength(32).IsRequired();
        c.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        c.Property(x => x.CustomerName).HasMaxLength(CylinderRules.CustomerNameMaxLength);
        c.HasIndex(x => new { x.LastUpdated, x.Id });
        c.HasIndex(x => x.Status);
    }

    /// <summary>Creates the schema on first run. There are no migrations; delete cylinders.db to reseed.</summary>
    public Task PrepareAsync() => Database.EnsureCreatedAsync();
}

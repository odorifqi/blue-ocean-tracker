using Cylinders.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cylinders.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Cylinder> Cylinders => Set<Cylinder>();
    public DbSet<CylinderEvent> Events => Set<CylinderEvent>();

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

        var e = b.Entity<CylinderEvent>();
        e.ToTable("cylinder_events");
        e.HasOne(x => x.Cylinder).WithMany().HasForeignKey(x => x.CylinderId).OnDelete(DeleteBehavior.Restrict);
        e.Property(x => x.Type).HasMaxLength(16).IsRequired();
        e.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(16);
        e.Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(16);
        e.Property(x => x.CustomerName).HasMaxLength(CylinderRules.CustomerNameMaxLength);
        e.Property(x => x.ActionBy).HasColumnName("action_by").HasMaxLength(120).IsRequired();
        e.HasIndex(x => new { x.CylinderId, x.At });
    }

    /// <summary>
    /// Creates the schema, rebuilding a database made before history existed (it only holds
    /// seed data), and makes the history table append-only at the database level.
    /// </summary>
    public async Task PrepareAsync()
    {
        await Database.EnsureCreatedAsync();
        var hasHistory = await Database
            .SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM sqlite_master WHERE type = 'table' AND name = 'cylinder_events'")
            .SingleAsync() > 0;
        if (!hasHistory)
        {
            await Database.EnsureDeletedAsync();
            await Database.EnsureCreatedAsync();
        }
        await Database.ExecuteSqlRawAsync("""
            CREATE TRIGGER IF NOT EXISTS cylinder_events_no_update
            BEFORE UPDATE ON cylinder_events
            BEGIN SELECT RAISE(ABORT, 'History is append-only.'); END;
            """);
        await Database.ExecuteSqlRawAsync("""
            CREATE TRIGGER IF NOT EXISTS cylinder_events_no_delete
            BEFORE DELETE ON cylinder_events
            BEGIN SELECT RAISE(ABORT, 'History is append-only.'); END;
            """);
    }
}

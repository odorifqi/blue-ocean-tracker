using Cylinders.Api.Contracts;
using Cylinders.Api.Data;
using Cylinders.Api.Domain;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Cylinders.Api.Endpoints;

public static class CylinderEndpoints
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 50;

    public static void MapCylinderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cylinders").WithTags("Cylinders");

        group.MapGet("/", List);
        group.MapGet("/{id:int}", Get);
        group.MapPost("/", Create);
        group.MapPut("/{id:int}", Update);
        group.MapPost("/{id:int}/status", ChangeStatus);
    }

    private static async Task<IResult> List(
        AppDbContext db, string? search, string? status, int page = 1, int pageSize = DefaultPageSize)
    {
        var errors = new Dictionary<string, string[]>();
        if (page < 1) errors["page"] = ["Page must be 1 or greater."];
        if (pageSize < 1 || pageSize > MaxPageSize) errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];

        CylinderStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<CylinderStatus>(status.Trim(), ignoreCase: true, out var parsed) && Enum.IsDefined(parsed))
                statusFilter = parsed;
            else
                errors["status"] = [$"Unknown status '{status}'."];
        }
        if (errors.Count > 0) return Results.ValidationProblem(errors);

        var query = db.Cylinders.AsNoTracking();
        if (statusFilter is { } s) query = query.Where(c => c.Status == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(c => c.SearchKey.Contains(term));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.LastUpdated).ThenBy(c => c.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        return Results.Ok(new PagedResult<CylinderDto>(items.Select(CylinderDto.From).ToList(), page, pageSize, total));
    }

    private static async Task<IResult> Get(int id, AppDbContext db) =>
        await db.Cylinders.FindAsync(id) is { } c ? Results.Ok(CylinderDto.From(c)) : NotFound(id);

    private static async Task<IResult> Create(CylinderInput input, AppDbContext db, TimeProvider clock)
    {
        var (serial, gas, errors) = Validate(input);
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        if (await SerialTaken(db, serial!, null)) return DuplicateSerial(serial!);

        var cylinder = new Cylinder
        {
            SerialNumber = serial!,
            GasType = gas!,
            Status = CylinderStatus.Empty,
            CustomerName = null,
            LastUpdated = clock.GetUtcNow().UtcDateTime,
        };
        cylinder.RefreshSearchKey();
        db.Cylinders.Add(cylinder);
        if (!await TrySave(db)) return DuplicateSerial(serial!);
        return Results.Created($"/api/cylinders/{cylinder.Id}", CylinderDto.From(cylinder));
    }

    private static async Task<IResult> Update(int id, CylinderInput input, AppDbContext db, TimeProvider clock)
    {
        var cylinder = await db.Cylinders.FindAsync(id);
        if (cylinder is null) return NotFound(id);

        var (serial, gas, errors) = Validate(input);
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        if (await SerialTaken(db, serial!, id)) return DuplicateSerial(serial!);

        if (cylinder.SerialNumber != serial || cylinder.GasType != gas)
        {
            cylinder.SerialNumber = serial!;
            cylinder.GasType = gas!;
            cylinder.LastUpdated = clock.GetUtcNow().UtcDateTime;
            cylinder.RefreshSearchKey();
            if (!await TrySave(db)) return DuplicateSerial(serial!);
        }
        return Results.Ok(CylinderDto.From(cylinder));
    }

    private static async Task<IResult> ChangeStatus(int id, StatusChangeInput input, AppDbContext db, TimeProvider clock)
    {
        var cylinder = await db.Cylinders.FindAsync(id);
        if (cylinder is null) return NotFound(id);

        if (string.IsNullOrWhiteSpace(input.Status)
            || !Enum.TryParse<CylinderStatus>(input.Status.Trim(), ignoreCase: true, out var next)
            || !Enum.IsDefined(next))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = [$"Status must be one of: {string.Join(", ", Enum.GetNames<CylinderStatus>())}."],
            });

        if (!CylinderRules.CanTransition(cylinder.Status, next))
        {
            var allowed = CylinderRules.Transitions[cylinder.Status];
            var hint = allowed.Length == 0 ? "Retired cylinders cannot change status." : $"Allowed: {string.Join(", ", allowed)}.";
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = [$"Cannot move from {cylinder.Status} to {next}. {hint}"],
            }, title: "Invalid status transition");
        }

        string? customer = null;
        if (next == CylinderStatus.Delivered)
        {
            customer = input.CustomerName?.Trim();
            if (string.IsNullOrEmpty(customer))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["customerName"] = ["Customer name is required when delivering a cylinder."],
                });
            if (customer.Length > CylinderRules.CustomerNameMaxLength)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["customerName"] = [$"Customer name must be at most {CylinderRules.CustomerNameMaxLength} characters."],
                });
        }

        cylinder.Status = next;
        cylinder.CustomerName = customer;
        cylinder.LastUpdated = clock.GetUtcNow().UtcDateTime;
        cylinder.RefreshSearchKey();
        await db.SaveChangesAsync();
        return Results.Ok(CylinderDto.From(cylinder));
    }

    private static (string? Serial, string? Gas, Dictionary<string, string[]> Errors) Validate(CylinderInput input)
    {
        var errors = new Dictionary<string, string[]>();
        var serial = CylinderRules.NormalizeSerial(input.SerialNumber);
        if (serial.Length == 0) errors["serialNumber"] = ["Serial number is required."];
        else if (!CylinderRules.IsValidSerial(serial)) errors["serialNumber"] = ["Serial number must be 'CYL-' followed by 6 digits, e.g. CYL-012345."];

        var gas = CylinderRules.MatchGasType(input.GasType);
        if (string.IsNullOrWhiteSpace(input.GasType)) errors["gasType"] = ["Gas type is required."];
        else if (gas is null) errors["gasType"] = [$"Gas type must be one of: {string.Join(", ", CylinderRules.GasTypes)}."];

        return (serial, gas, errors);
    }

    // The pre-check gives the friendly 409 in the normal case. Two requests racing for the same serial both pass it,
    // so the unique index is the backstop: its violation becomes the same 409 instead of a 500.
    private static async Task<bool> TrySave(AppDbContext db)
    {
        try
        {
            await db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            return false;
        }
    }

    private static Task<bool> SerialTaken(AppDbContext db, string serial, int? exceptId) =>
        db.Cylinders.AnyAsync(c => c.SerialNumber == serial && c.Id != exceptId);

    private static IResult DuplicateSerial(string serial) => Results.Problem(
        statusCode: StatusCodes.Status409Conflict,
        title: "Duplicate serial number",
        detail: $"A cylinder with serial number {serial} already exists.",
        extensions: new Dictionary<string, object?>
        {
            ["errors"] = new Dictionary<string, string[]> { ["serialNumber"] = [$"{serial} is already registered."] },
        });

    private static IResult NotFound(int id) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound, title: "Cylinder not found", detail: $"No cylinder with id {id}.");
}

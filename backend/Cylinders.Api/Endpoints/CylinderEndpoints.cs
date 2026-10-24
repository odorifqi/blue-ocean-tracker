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
    public const int IdleDays = 30;

    public static void MapCylinderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cylinders").WithTags("Cylinders");

        group.MapGet("/", List);
        group.MapGet("/summary", Summary);
        group.MapGet("/analytics", Analytics);
        group.MapGet("/{id:int}", Get);
        group.MapPost("/", Create);
        group.MapPut("/{id:int}", Update);
        group.MapPost("/{id:int}/status", ChangeStatus);
        group.MapGet("/{id:int}/history", History);
        app.MapGet("/api/meta", () => Results.Ok(new
        {
            gasTypes = CylinderRules.GasTypes,
            statuses = Enum.GetNames<CylinderStatus>(),
            transitions = CylinderRules.Transitions.ToDictionary(t => t.Key.ToString(), t => t.Value.Select(s => s.ToString())),
            // What each status means to the rules, so clients don't hard-code it by name.
            statusRules = Enum.GetValues<CylinderStatus>().Select(st => new
            {
                status = st.ToString(),
                isStart = st == CylinderStatus.Empty,
                requiresCustomer = st == CylinderStatus.Delivered,
                isFinal = CylinderRules.Transitions[st].Length == 0,
            }),
            customerNameMaxLength = CylinderRules.CustomerNameMaxLength,
        })).WithTags("Meta");
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

    // Counts per status for the overview strip, plus delivered cylinders that have been out for 30+ days.
    private static async Task<IResult> Summary(AppDbContext db, TimeProvider clock)
    {
        var counts = await db.Cylinders.GroupBy(c => c.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        var byStatus = Enum.GetValues<CylinderStatus>().ToDictionary(s => s.ToString(), s => counts.FirstOrDefault(c => c.Key == s)?.Count ?? 0);
        var idleBefore = clock.GetUtcNow().UtcDateTime.AddDays(-IdleDays);
        var idle = await db.Cylinders.CountAsync(c => c.Status == CylinderStatus.Delivered && c.LastUpdated <= idleBefore);
        return Results.Ok(new { total = byStatus.Values.Sum(), byStatus, idle });
    }

    // Age buckets for "time since last movement". Upper bound is inclusive; null means open-ended.
    private static readonly (string Label, int Min, int? Max)[] AgeBuckets =
        [("0–7 days", 0, 7), ("8–30 days", 8, 30), ("31–60 days", 31, 60), ("61–90 days", 61, 90), ("Over 90 days", 91, null)];

    public const int TopCustomers = 8;

    private static async Task<IResult> Analytics(AppDbContext db, TimeProvider clock)
    {
        // The fleet is small, so aggregate in memory. A large fleet would push these GROUP BYs into SQL.
        var rows = await db.Cylinders.AsNoTracking()
            .Select(c => new { c.GasType, c.Status, c.CustomerName, c.LastUpdated })
            .ToListAsync();
        var now = clock.GetUtcNow().UtcDateTime;
        int Days(DateTime t) => Math.Max(0, (int)Math.Floor((now - t).TotalDays));
        Dictionary<string, int> CountByStatus(IEnumerable<CylinderStatus> statuses)
        {
            var list = statuses.ToList();
            return Enum.GetValues<CylinderStatus>().ToDictionary(s => s.ToString(), s => list.Count(x => x == s));
        }

        var inService = rows.Where(r => r.Status != CylinderStatus.Retired).ToList();
        var delivered = rows.Where(r => r.Status == CylinderStatus.Delivered && !string.IsNullOrWhiteSpace(r.CustomerName))
            .GroupBy(r => r.CustomerName!.Trim())
            .Select(g => new
            {
                customerName = g.Key,
                cylinders = g.Count(),
                idle = g.Count(r => Days(r.LastUpdated) >= IdleDays),
                oldestDays = g.Max(r => Days(r.LastUpdated)),
            })
            .OrderByDescending(c => c.cylinders).ThenByDescending(c => c.oldestDays).ThenBy(c => c.customerName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Results.Ok(new
        {
            generatedAt = now,
            idleDays = IdleDays,
            total = rows.Count,
            inService = inService.Count,
            idle = rows.Count(r => r.Status == CylinderStatus.Delivered && Days(r.LastUpdated) >= IdleDays),
            byStatus = CountByStatus(rows.Select(r => r.Status)),
            byGas = CylinderRules.GasTypes.Select(g => new
            {
                gasType = g,
                total = rows.Count(r => r.GasType == g),
                byStatus = CountByStatus(rows.Where(r => r.GasType == g).Select(r => r.Status)),
            }),
            aging = AgeBuckets.Select(b => new
            {
                label = b.Label,
                minDays = b.Min,
                maxDays = b.Max,
                count = inService.Count(r => Days(r.LastUpdated) >= b.Min && (b.Max is null || Days(r.LastUpdated) <= b.Max)),
            }),
            customerCount = delivered.Count,
            topCustomers = delivered.Take(TopCustomers),
        });
    }

    private static async Task<IResult> Get(int id, AppDbContext db) =>
        await db.Cylinders.FindAsync(id) is { } c ? Results.Ok(CylinderDto.From(c)) : NotFound(id);

    private static async Task<IResult> Create(CylinderInput input, AppDbContext db, TimeProvider clock, CurrentUser user)
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
        Record(db, cylinder, user, EventTypes.Added, to: CylinderStatus.Empty);
        if (!await TrySave(db)) return DuplicateSerial(serial!);
        return Results.Created($"/api/cylinders/{cylinder.Id}", CylinderDto.From(cylinder));
    }

    private static async Task<IResult> Update(int id, CylinderInput input, AppDbContext db, TimeProvider clock, CurrentUser user)
    {
        var cylinder = await db.Cylinders.FindAsync(id);
        if (cylinder is null) return NotFound(id);

        var (serial, gas, errors) = Validate(input);
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        if (await SerialTaken(db, serial!, id)) return DuplicateSerial(serial!);

        if (cylinder.SerialNumber != serial || cylinder.GasType != gas)
        {
            var changes = new List<HistoryChangeDto>();
            if (cylinder.SerialNumber != serial) changes.Add(new("serialNumber", cylinder.SerialNumber, serial!));
            if (cylinder.GasType != gas) changes.Add(new("gasType", cylinder.GasType, gas!));
            cylinder.SerialNumber = serial!;
            cylinder.GasType = gas!;
            cylinder.LastUpdated = clock.GetUtcNow().UtcDateTime;
            cylinder.RefreshSearchKey();
            Record(db, cylinder, user, EventTypes.Edited, changes: changes);
            if (!await TrySave(db)) return DuplicateSerial(serial!);
        }
        return Results.Ok(CylinderDto.From(cylinder));
    }

    private static async Task<IResult> ChangeStatus(int id, StatusChangeInput input, AppDbContext db, TimeProvider clock, CurrentUser user)
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

        var from = cylinder.Status;
        // The entry names the customer on both ends of a delivery: who received it, and who it came back from.
        var eventCustomer = customer ?? (from == CylinderStatus.Delivered ? cylinder.CustomerName : null);
        cylinder.Status = next;
        cylinder.CustomerName = customer;
        cylinder.LastUpdated = clock.GetUtcNow().UtcDateTime;
        cylinder.RefreshSearchKey();
        Record(db, cylinder, user, EventTypes.Status, from, next, eventCustomer);
        await db.SaveChangesAsync();
        return Results.Ok(CylinderDto.From(cylinder));
    }

    private static readonly Dictionary<string, Func<CylinderEvent, bool>> HistoryFilters = new(StringComparer.OrdinalIgnoreCase)
    {
        ["all"] = _ => true,
        ["status"] = e => e.Type == EventTypes.Status,
        ["edit"] = e => e.Type == EventTypes.Edited,
    };

    private static async Task<IResult> History(int id, AppDbContext db, string? type, int page = 1, int pageSize = DefaultPageSize)
    {
        if (!await db.Cylinders.AnyAsync(c => c.Id == id)) return NotFound(id);

        var errors = new Dictionary<string, string[]>();
        if (page < 1) errors["page"] = ["Page must be 1 or greater."];
        if (pageSize < 1 || pageSize > MaxPageSize) errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];
        var key = string.IsNullOrWhiteSpace(type) ? "all" : type.Trim();
        if (!HistoryFilters.TryGetValue(key, out var filter)) errors["type"] = ["Type must be one of: all, status, edit."];
        if (errors.Count > 0) return Results.ValidationProblem(errors);

        // One cylinder's history is small, so filter and summarise in memory.
        var all = await db.Events.AsNoTracking().Where(e => e.CylinderId == id).ToListAsync();
        all = all.OrderByDescending(e => e.At).ThenByDescending(e => e.Id).ToList();
        var filtered = all.Where(filter!).ToList();

        var summary = new HistorySummary(
            all.Count == 0 ? null : DateTime.SpecifyKind(all[^1].At, DateTimeKind.Utc),
            all.Count(e => e.Type == EventTypes.Status && e.ToStatus == CylinderStatus.Delivered),
            all.Where(e => !string.IsNullOrWhiteSpace(e.CustomerName)).Select(e => e.CustomerName!.Trim().ToUpperInvariant()).Distinct().Count(),
            all.FirstOrDefault(e => e.Type == EventTypes.Edited) is { } edit ? DateTime.SpecifyKind(edit.At, DateTimeKind.Utc) : null);

        var items = filtered.Skip((page - 1) * pageSize).Take(pageSize).Select(HistoryEventDto.From).ToList();
        return Results.Ok(new HistoryPage(items, page, pageSize, filtered.Count, summary));
    }

    // Time and actor come from the server: the cylinder's new LastUpdated and the current user.
    private static void Record(
        AppDbContext db, Cylinder cylinder, CurrentUser user, string type,
        CylinderStatus? from = null, CylinderStatus? to = null, string? customer = null, List<HistoryChangeDto>? changes = null) =>
        db.Events.Add(new CylinderEvent
        {
            Cylinder = cylinder,
            Type = type,
            At = cylinder.LastUpdated,
            FromStatus = from,
            ToStatus = to,
            CustomerName = customer,
            Changes = System.Text.Json.JsonSerializer.Serialize(changes ?? [], HistoryJson),
            ActionBy = user.Name,
        });

    private static readonly System.Text.Json.JsonSerializerOptions HistoryJson = new(System.Text.Json.JsonSerializerDefaults.Web);

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

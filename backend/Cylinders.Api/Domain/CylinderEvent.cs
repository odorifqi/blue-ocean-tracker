namespace Cylinders.Api.Domain;

/// <summary>
/// One append-only entry in a cylinder's history. Written in the same SaveChanges call as the
/// change it describes, so a cylinder can never change without its entry. The time and the actor
/// come from the server, never from the request body.
/// </summary>
public class CylinderEvent
{
    public int Id { get; set; }
    public int CylinderId { get; set; }
    public Cylinder? Cylinder { get; set; }
    public string Type { get; set; } = "";
    public DateTime At { get; set; }
    public CylinderStatus? FromStatus { get; set; }
    public CylinderStatus? ToStatus { get; set; }
    public string? CustomerName { get; set; }
    /// <summary>JSON array of { field, from, to } for edits; "[]" otherwise.</summary>
    public string Changes { get; set; } = "[]";
    public string ActionBy { get; set; } = "";
}

public static class EventTypes
{
    public const string Added = "added";
    public const string Imported = "imported";
    public const string Status = "status";
    public const string Edited = "edited";
}

/// <summary>
/// Who is making the request. There is no sign-in yet, so this is a fixed demo account from
/// configuration (DemoUser). Real authentication would fill it from the signed-in principal.
/// </summary>
public record CurrentUser(string Name)
{
    public const string ImportActor = "System import";
}

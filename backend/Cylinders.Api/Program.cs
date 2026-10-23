using Cylinders.Api.Data;
using Cylinders.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=cylinders.db"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(new Cylinders.Api.Domain.CurrentUser(builder.Configuration["DemoUser"] ?? "Rina Wulandari"));
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173", "http://localhost:4173"];
    // Hosted frontends are added without editing appsettings, e.g. CORS_ORIGINS=https://my-app.vercel.app
    var extra = (builder.Configuration["CORS_ORIGINS"] ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(o => o.TrimEnd('/'));
    p.WithOrigins([.. origins, .. extra]).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.PrepareAsync();
    await Seeder.SeedAsync(db, Path.Combine(AppContext.BaseDirectory, "Data", "cylinders.json"));
}

app.MapCylinderEndpoints();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program;

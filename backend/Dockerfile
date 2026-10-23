# Build and run the API in a container, e.g. on Render's free tier.
# Build context is this backend/ folder.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Cylinders.Api/Cylinders.Api.csproj Cylinders.Api/
RUN dotnet restore Cylinders.Api/Cylinders.Api.csproj
COPY Cylinders.Api/ Cylinders.Api/
RUN dotnet publish Cylinders.Api/Cylinders.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
# The SQLite file lives in the container and is reseeded from cylinders.json on each fresh start.
ENV ConnectionStrings__Default="Data Source=/app/data/cylinders.db"
RUN mkdir -p /app/data && chown -R app:app /app/data
USER app
# Hosts like Render pass the port in $PORT; default to 8080 locally.
CMD ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet Cylinders.Api.dll"]

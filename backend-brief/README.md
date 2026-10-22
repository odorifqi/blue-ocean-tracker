# Blue Ocean Tracker API (brief version)

ASP.NET Core 8 minimal API with EF Core and SQLite, on exactly the five routes the brief recommends:

| Route | Behaviour |
| --- | --- |
| `GET /api/cylinders?search=&status=&page=1&pageSize=10` | `{ items, page, pageSize, totalCount }`, sorted by `lastUpdated` desc, then id. 400 on bad paging. |
| `GET /api/cylinders/{id}` | 200 or 404 |
| `POST /api/cylinders` | Creates as Empty with no customer. 201, 400, or 409 on a duplicate serial. |
| `PUT /api/cylinders/{id}` | Serial number and gas type only. 200, 400, 404 or 409. |
| `POST /api/cylinders/{id}/status` | Allowed transitions only; Delivered needs `customerName` (max 120). 200, 400 or 404. |

```bash
dotnet test                                   # 25 integration tests
cd Cylinders.Api
dotnet run --urls http://localhost:5080       # Swagger at /swagger
```

Test results: [`docs/test-results/backend-tests.png`](docs/test-results/backend-tests.png). Setup, design decisions and assumptions for both halves are in [`../frontend-brief/README.md`](../frontend-brief/README.md).

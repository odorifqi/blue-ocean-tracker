# Project Instructions — Blue Ocean Tracker

Gas-cylinder lifecycle tracker.
Two independent halves: `frontend/` (the main deliverable) and `backend/`.

## Tech Stack

- **Frontend**: React 19, TypeScript ~6.0, Vite 8, React Router 6, TanStack Query 5, MSW 2, lucide-react, clsx
- **Styling**: plain CSS with custom-property tokens. No UI kit, no CSS framework.
- **Tests**: Vitest + Testing Library (jsdom), MSW `setupServer` in Node
- **Lint**: oxlint (not ESLint)
- **Backend**: ASP.NET Core 8 minimal APIs, EF Core 8 + SQLite, Swashbuckle; xUnit + `WebApplicationFactory` tests

## Build & Run

All commands run from `frontend/`:

- Dev: `npm run dev` (http://localhost:5173)
- Test: `npm test` / `npm run test:watch`
- Typecheck: `npm run typecheck` (`tsc -b`)
- Lint: `npm run lint` (`oxlint`)
- Build: `npm run build` (`tsc -b && vite build`)

Backend: `cd backend && dotnet test` (29 integration tests), then `cd Cylinders.Api && dotnet run --urls http://localhost:5080`.
Point the frontend at it with `VITE_API_URL=http://localhost:5080`. The backend needs the .NET 8 SDK.

## Architecture

The frontend runs against an **in-browser mock API (MSW)** by default. `src/main.tsx` starts the service
worker when `VITE_API_URL` is unset, so the production build is a static site. The MSW handlers in
`src/mocks/handlers.ts` deliberately mirror the .NET contract: same routes, status codes, and RFC 7807
problem bodies. Treat them as a real API implementation, not a test fixture.

`src/lib/domain.ts` is the single source of business truth on the client (statuses, the transition table,
serial/customer validation, the 30-day idle rule). The UI, client validation, and the mock API all import
it. `backend/.../Domain/CylinderRules.cs` is its hand-mirrored C# twin — **change both together.**

## Project Structure

```
frontend/src/ds/                  Design-system primitives. Semantic tokens only; no feature logic.
frontend/src/features/cylinders/  All cylinder screens, dialogs, and the lifecycle diagram.
frontend/src/lib/                 domain rules, API client, TanStack Query hooks, formatters.
frontend/src/mocks/               MSW handlers + localStorage-backed in-browser DB.
frontend/src/styles/              tokens -> base -> components -> app (import order matters).
frontend/src/pages/               Standalone routes (/design-system, 404).
backend/Cylinders.Api/            Minimal API: Endpoints/, Domain/, Data/, Contracts/.
backend/Cylinders.Api.Tests/      xUnit integration tests; each test gets its own temp SQLite file and a fixed clock.
```

## Code Style

- Files: `PascalCase.tsx` for components, `camelCase.ts` for modules. Tests sit beside source as `*.test.tsx`.
- No semicolons, single quotes, 2-space indent, ~120 col. Match the surrounding file.
- Barrel export from `src/ds/index.ts`; import design-system pieces from `'../../ds'`, never deep paths.
- CSS: BEM-ish class names (`list__toolbar`, `stat--alert`). Components read **semantic** tokens
  (`--fg-muted`), never primitives (`--slate-600`). That one indirection is what makes dark mode work.
- Errors: throw `ApiError` (RFC 7807) from `src/lib/api.ts`. Field errors attach to form fields *and*
  surface in the `ServerErrorProvider` dialog. Don't swallow failures silently.
- Comments explain *why* a non-obvious choice was made, not what the line does. Keep that density.

## Conventions

- **List state lives in the URL** (`?q=&status=&page=&pageSize=`). Defaults are deleted from the query
  string, not written. Add new list state the same way.
- **Every data surface needs loading / empty / error states.** Empty states are specific (no results vs.
  page past the end vs. no data at all). Use `keepPreviousData` so pagination doesn't flash.
- **Prevent, then explain**: only offer transitions the state machine allows; confirm writes through a
  review step; then handle server rejection.
- Dialogs use the native `<dialog>` element for focus trapping and Esc. Don't hand-roll a modal.
- Accessibility is non-optional: labelled fields, `aria-describedby` for hints/errors, radiogroup
  semantics for filters, text alternatives for the diagram, `prefers-reduced-motion`.
- Commits: Conventional Commits with a ticket scope, e.g. `feat(OD-1): add the cylinder minimal API endpoints`.
- Remote: https://github.com/odorifqi/blue-ocean-tracker

## Known Gaps

- The backend returns `AllowedNextStatuses`; the frontend ignores it and derives transitions locally from
  `domain.ts`. Only the Status rules page reads `GET /api/meta`.
- History (`cylinder_events`) is append-only: write an entry in the same save as every cylinder change, with
  `actionBy` from the server-side `CurrentUser`, never from the request. SQLite triggers block UPDATE/DELETE.
- The schema is created with `EnsureCreated` (no migrations). Delete `cylinders.db` to reseed.
- There is no CI workflow.

# Cylinder Tracker

A web app that tracks gas cylinders through their lifecycle: filling, delivery, return, maintenance and retirement.

**What's in this repo**

| Folder | What it is |
| --- | --- |
| `frontend/` | React + TypeScript app. Includes the design library, shown as a living style guide at `/design-system`. |
| `backend/` | ASP.NET Core 8 Web API with EF Core and SQLite, seeded from `cylinders.json`, plus xUnit integration tests. The frontend can also run without it (see below). |


Example of screens are in [`docs/screenshots`](docs/screenshots). Test results are in [`docs/test-results`](docs/test-results): `backend-tests.png` (28 xUnit tests) and `frontend-tests.png` (42 Vitest tests).

## 1. Setup and running

Requirements: Node 20 or newer.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # frontend tests (Vitest + Testing Library)
npm run build      # production build in frontend/dist
```

By default the app runs against an **in-browser mock API** (Mock Service Worker). It's seeded from `cylinders.json` and saves changes to `localStorage`. No server is needed, so the build can be hosted as a static site.

**How to tell you're on the mock API:** when the frontend runs without `VITE_API_URL`, the app shows a **"Demo data"** badge under the app name in the sidebar. On phones, the same note sits at the bottom of the menu. It means every change is saved in this browser only: another browser or device won't see it, and clearing site data or "Reset data to the JSON seed" in the Miscellaneous panel brings back the original 87 cylinders. When the app runs against the .NET API, the badge disappears.

<p>
  <img src="docs/screenshots/demo-data-badge.png" alt="The Demo data badge under the Blue Ocean Tracker name in the sidebar" width="250">
  &nbsp;
  <img src="docs/screenshots/demo-data-phone.png" alt="The phone menu with the note: Demo data. Stored in this browser only." width="390">
</p>

### Backend

Requirements: .NET 8 SDK.

```bash
cd backend
dotnet test                                   # 28 integration tests (xUnit + WebApplicationFactory)
cd Cylinders.Api
dotnet run --urls http://localhost:5080       # creates cylinders.db and seeds the 87 records on first run
```

Swagger UI: http://localhost:5080/swagger. To reseed, stop the API and delete `cylinders.db`.

To point the frontend at the API, run this in another terminal:

```bash
cd frontend
VITE_API_URL=http://localhost:5080 npm run dev
```

CORS allows `http://localhost:5173` and `http://localhost:4173` by default. You can change this with `Cors:Origins` in `appsettings.json`.

## 2. Key design decisions

**Design library in code, not a separate file.** Tokens are CSS custom properties in three tiers: primitives, semantic roles, and component use (`src/styles/tokens.css`). The components in `src/ds/` use only semantic tokens. That's how dark mode works: it swaps one layer. The `/design-system` page renders the real components, so the docs can't drift from the product.

**Status first.** Each of the five statuses has one colour, one dot and one label everywhere: badges, filters, the overview bar and the lifecycle diagram.

**Tables keep fixed column widths.** Each table sets its columns as percentages that add up to 100% (list: serial 15, gas 15, status 15, customer 15, updated 10, actions 30), with a fixed table layout. Columns stay in the same place on every page, while loading and whatever the data contains. Long values truncate or wrap inside their cell. All three action labels show whenever they fit (from a ~1440px window). When they don't, all three drop to icons together, so a row never mixes words and icons. Detail keeps its blue tint, so it stays the main action, and every icon keeps its name in a tooltip and for screen readers. A date wider than the 10% Updated column runs into the empty left side of the Actions column rather than being cut off. On small laptops and tablets the table keeps a minimum width and scrolls sideways, so a serial or a status badge is never squeezed.

**Phones get a card, not a squeezed table.** At 760px and below each cylinder is a three-line card, read top to bottom: the serial, then status and gas, then "With <customer> · Updated <time>". The customer is cut with "…" so every card has the same height, even with the 102-character name in the data file. All three actions (Detail first, then Edit details and Change status) sit behind one ⋯ button next to the serial, in a menu with 44px rows. On a Retired cylinder, Change status is greyed out and says "Retired is final".

**Only Detail opens a cylinder.** List rows aren't clickable, so a stray click while reading, or while selecting a serial to copy, never navigates away. Detail is the one way in.

**Gas colours follow ISO 32.** Gas swatches use the standard cylinder shoulder colours (for example, white for oxygen and maroon for acetylene). The screen matches the paint on the physical cylinder.

**Prevent, then explain.**
- The status dialog only offers moves the lifecycle allows. The detail page shows the full state machine, with the allowed next steps highlighted and clickable. Its layout is fixed: the same regions and rows appear for every status (a dash marks an empty value), and every status change lives in one action bar under the diagram, with the usual move first and Retire always last.
- Retired cylinders have the status action disabled.
- Forms check input on the client using the same rules as the API (`src/lib/domain.ts`).
- Creating or editing goes through a **review step** that shows the changes (old → new) before anything is saved. This is the brief's "validation window".
- If the server still rejects a request, a **pop-up** shows its title, message and field errors with the HTTP code. The errors are also attached to the matching form fields.

**Every data screen has loading, empty and error states.**
- Loading shows skeleton rows.
- Changing pages or filters keeps the previous page visible, with a thin progress bar instead of a blank flash.
- Empty states are specific: no search results, a page past the end, or no data at all.
- Errors have a retry, with separate messages for offline and server errors.

**List state lives in the URL** (`?q=&status=&page=&pageSize=`). A filtered view survives a reload and can be shared. Search waits 300 ms after typing stops and highlights matches. Press `/` to focus the search box and `Esc` to clear it.

**Messy data.**
- Long customer names truncate, and the full name shows on hover.
- Serials use a monospaced font with tabular numbers, so look-alikes like `CYL-012300` and `CYL-012030` are easy to tell apart.
- Search is case-insensitive, including accented letters (`östara` finds "Östara").
- The serial field has a fixed `CYL-` prefix, accepts digits only, and normalises pasted text such as ` cyl-012345 `.

**Idle assets (problem 5 in the brief).** A cylinder that has been Delivered for 30 days or more gets an "Out Nd" badge. The overview counts these cylinders.

**Analytics page (`/analytics`).** A second menu entry for fleet insights:
- Key figures: cylinders in service, utilisation (filled or delivered, out of the fleet in service), cylinders out 30+ days, and cylinders in maintenance.
- Cylinders by status and by gas type, a status-by-gas heat table with the "in use" rate per gas, time since last movement, the customers holding the most cylinders, and short auto-written highlights.
- Status rows, customers and the warning tiles link to the matching filtered list.
- Charts are plain HTML/CSS components in the design library (`src/ds/Charts.tsx`), with no chart library. One series uses one colour, status colours appear only where the data is a status, and every value is printed next to its mark, so colour and hover are never the only way to read a number.
- The numbers come from one endpoint, `GET /api/cylinders/analytics`, implemented in both the .NET API and the mock (`src/lib/analytics.ts`). The bucket rules are the same in both.

**Cylinder history.** The detail page ends with a History card listing every change to that cylinder, newest first: when it was added, each status change (with the customer under the move: "To" on a delivery, "Back from" on a return), and each edit with the old and new value.
- Four fixed columns (Action At 15%, Event 15%, Change 50%, Action By 20%); times show as DD-MM-YYYY, HH:MM in 24-hour time and four fixed summary slots (tracked since, deliveries, customers, last edit). A dash fills anything that doesn't apply, so the card has the same shape for every cylinder.
- Filter by status changes or edits, 10 entries per page. Filter and page live in the URL (`?history=&historyPage=`), like the list.
- **Who made the change (`actionBy`)** is set by the server, never taken from the request, and saved with the entry. There is no sign-in yet, so every change is recorded as a fixed demo account ("Rina Wulandari", configurable with `DemoUser`). With real sign-in, the same field would come from the signed-in user.
- **Append-only.** Each entry is written in the same database save as the change itself, so a cylinder can't change without its entry. There is no endpoint to edit or delete history, and SQLite triggers reject `UPDATE` and `DELETE` on the history table even from direct database access. Saving an edit with no real change writes nothing.
- The 87 imported cylinders have no past, so each gets exactly one "Imported" entry at the file's own timestamp (recorded by "System import"). Nothing earlier is invented, and the card says so.
- API: `GET /api/cylinders/{id}/history?type=all|status|edit&page=&pageSize=` returns `{ items, page, pageSize, totalCount, summary }`, in both the .NET API and the mock.

**Status rules page (`/status-rules`).** A read-only view of the lifecycle as one table: each status with its meaning (including where new cylinders start and which status asks for the customer), the statuses it can move to, and how many cylinders are in it. Only allowed moves are listed; Retired says "None. Retired is final." An earlier from/to grid was dropped because its three cell types took more effort to read than the five short lists it encoded. The page is drawn from `GET /api/meta`, so it shows the rules the server enforces rather than a copy in the frontend.

**Demo controls (mock mode only).** A small panel can add network delay, fail the next request, fail every request, or simulate going offline. It also resets the data to the JSON seed. Reviewers can use it to see every UI state.

**Backend.**
- **Minimal API endpoints** follow the recommended routes exactly (`Endpoints/CylinderEndpoints.cs`). The lifecycle rules live in one place (`Domain/CylinderRules.cs`), and the frontend mirrors them in `src/lib/domain.ts`.
- **Errors** are RFC 7807 problem details with a field-keyed `errors` object. The frontend shows them in the pop-up and attaches them to the matching field.
- **Duplicate serials** are blocked twice. Serials are stored in upper case under a unique index, and the API checks for a clash first so it can return a clean 409 instead of a database exception.
- **Search with accents:** SQLite's `LIKE` and `lower()` only fold ASCII, so "östara" wouldn't match "Östara". Each row keeps an upper-cased `SearchKey` (serial + customer), and the search term is upper-cased in C# before matching.
- **Server-controlled fields:** `lastUpdated` is set only by the server, through an injected `TimeProvider`, which lets the tests freeze the clock. Status and customer can only change through the status endpoint.
- **Allowed next statuses:** each cylinder in a response includes `allowedNextStatuses`, so a client can build its UI from the server's rules.
- **Tests:** integration tests boot the real app against a throwaway SQLite file per test, so they exercise routing, validation, EF Core and SQLite together.
- **Schema:** the database is created with `EnsureCreated` instead of migrations, to keep setup to one command. A production version would use migrations.

**Stack:** React 19, TypeScript, Vite, React Router, TanStack Query for server state and caching, MSW for the mock API, lucide icons, and Inter / JetBrains Mono. Styling is plain CSS with tokens, with no UI kit, so every component is designed here.

**Accessibility.**
- Dialogs use the native `<dialog>` element, which gives focus trapping, `Esc` to close and the top layer.
- Every field has a label, and hints and errors are linked to it with `aria-describedby`.
- Filters use radio-group semantics.
- The lifecycle diagram has a text alternative.
- There is a skip link, visible focus rings, and `prefers-reduced-motion` support.

## 3. Assumptions

- **Ids:** the brief says ids are in the JSON, but `cylinders.json` has none. Records get ids 1–87 in file order.
- **Two data modes:** HR confirmed that a backend isn't required for this role, so the frontend is complete on its own, using the mock API. The `backend/` API follows the same contract, and one environment variable switches between them.
- **Search** matches serial number and customer name as a partial, case-insensitive match. Searching for a status is done with the filter, not the search box.
- **Editing** serial number and gas type is allowed in any status, including Retired, because the brief only restricts status changes. Editing with no changes is blocked in the UI.
- **Customer name** is trimmed and must be 1–120 characters when delivering. It's cleared when a cylinder goes back to Empty.
- **Extra endpoints:** `GET /api/cylinders/summary` returns counts per status for the overview, and `GET /api/cylinders/analytics` returns the aggregates for the Analytics page. Both are additions, not changes to the recommended routes.
- **Analytics and history:** the data file has no status history, only `lastUpdated`, so "time since last movement" uses that field. History is recorded from import onward, so trends over time become possible as it fills up.
- **Statuses are fixed:** the brief defines exactly five statuses and calls every other move invalid, so the Status rules page shows the rules but doesn't edit them.
- **Existing local databases** made before history existed only hold seed data, so the API rebuilds and reseeds them on start.
- **Times** are stored and sent as UTC. They're displayed in the user's local time zone (WIB for the ops team), and the UTC value is shown as a tooltip on the detail page's last-updated time.

## 4. With more time

- Editable status rules: add statuses and choose their moves in the Status rules grid. The brief's five statuses stay as protected defaults with a "Restore brief rules" action, and statuses carry behaviours (start, asks for customer, final) so the rules don't depend on names. Warnings catch dead ends and unreachable statuses, and a review step shows how many cylinders a change affects.
- Real sign-in, so `actionBy` in the history is the signed-in user instead of a demo account.
- Sortable columns, plus an "idle" filter on the server instead of only a badge.
- Bulk actions, such as marking a whole delivery run as returned, and scanning a cylinder's barcode or QR code from a phone camera.
- Customer records as their own entity, so the same company isn't typed several different ways.

## 5. Use of AI

I built this with Claude (Anthropic) as a pair. I made the product and design calls, and Claude did most of the typing. This section explains how that worked, so it's clear which parts are mine.

### How I set it up

- I used a Claude project with the brief PDF and `cylinders.json` as shared files, and gave Claude access to one folder on my Mac: this repo. Claude read and edited the files there directly. It also kept project notes (scope, decisions, my preferences), so a new conversation didn't start from zero.
- Each piece of work had its own thread (the Analytics page, the detail page redesign, the history card, the phone layout, the pre-submission review), so several could run at once while I reviewed the others.
- Claude ran the tests and took the screenshots in its own cloud container, because my Mac has no .NET SDK. The images in `docs/test-results` come from those runs.

### How each change went

1. **I set the direction.** I described what I wanted, usually with a screenshot of what bothered me.
2. **Claude proposed before building.** For anything visual, it first made a proposal page with options, mock-ups or before-and-after screenshots, a recommendation, and a reason for every suggestion. I set that rule early: a suggestion without a reason doesn't get built.
3. **I chose, and often changed the plan.** Some examples:
   - Phone row actions: Claude recommended keeping Detail visible next to a ⋯ menu. I put all three actions in the menu, so every card looks the same.
   - Paging on phones: Claude proposed landing on the first card. I changed it to land on the search box and filter pills, so the reader still sees which search and status they're paging through.
   - Column widths: I set the percentages for all three tables myself, with the rule that they add up to 100%. For the list, I also merged the Customer column into the Status cell and chose the one-line layout that stacks at 1280px and below.
   - The "Demo data" label: I approved the desktop badge and turned down the phone version as too crowded, which led to the phone menu.
4. **Claude built it in my folder**, with tests, and checked it in a real browser (Playwright) at desktop and phone sizes before reporting back.
5. **I reviewed it on my own screen and phone**, sent screenshots of anything wrong, and we went round again until I was happy.
6. **I committed and deployed it myself.** Claude never committed, pushed or deployed. I wrote the commits and set up Vercel and Render.

### What Claude did

- Turned the brief into a requirements checklist and flagged where the data didn't match it (the JSON has no ids).
- Wrote most of the code: the React components, the design tokens, the mock API, the .NET API and both test suites.
- Reviewed the app against the requirement before submission and found real bugs, such as a double Enter sending two status changes and a flaky Escape test. I picked which fixes to take.
- Debugged a crash on the Vercel preview. It couldn't open the live site from its container, so I sent screenshots of the browser's Network tab and it traced the cause from those.
- Drafted this README. I set the rules (first person, only what was chosen) and edited it.

### What I decided

The scope and order of the work, the name "Blue Ocean Tracker", every design option that shipped, which review findings to fix, and what went into each commit.

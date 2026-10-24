# Blue Ocean Tracker

A web app that tracks gas cylinders through their lifecycle: filling, delivery, return, maintenance and retirement.

- **Live app:** https://blue-ocean-tracker.vercel.app
- **Repository:** https://github.com/odorifqi/blue-ocean-tracker

**What's in this repo**

| Folder | What it is |
| --- | --- |
| `frontend/` | React + TypeScript app. Includes the design library, shown as a living style guide at `/design-system`. |
| `backend/` | ASP.NET Core 8 Web API with EF Core and SQLite, seeded from `cylinders.json`, plus xUnit integration tests. The frontend can also run without it (see below). |


Example of screens are in [`docs/screenshots`](docs/screenshots). Test results are in [`docs/test-results`](docs/test-results): `backend-tests.png` (29 xUnit tests) and `frontend-tests.png` (57 Vitest tests).

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
dotnet test                                   # 29 integration tests (xUnit + WebApplicationFactory)
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

## 2. Changes from the requirement

- **Ids 1–87 are assigned in file order.** The requirement says the JSON has ids, but `cylinders.json` has none.
- **Serial number and gas type can be edited in any status, including Retired.** The requirement only restricts status changes, and a Retired cylinder can still have a typo in its serial. Saving with no changes is blocked in the UI.
- **Stricter input checks.** An unknown status filter or a `pageSize` below 1 returns 400 instead of being ignored, so a bad link shows an error rather than a silently wrong list.
- **Extra endpoints, all additions.** The recommended routes are unchanged. I added `GET /api/cylinders/summary` (counts per status), `GET /api/cylinders/analytics` (the Analytics page), `GET /api/cylinders/{id}/history` and `GET /api/meta` (the lifecycle rules). Each cylinder in a response also carries `allowedNextStatuses`.
- **Cylinder history, including who made each change.** Not in the requirement. I added it because a lifecycle tracker that can't say what happened to a cylinder can't help with the requirement's lost-asset problem.
- **Extra pages: Analytics, Status rules and Design system.** Analytics answers "where are my cylinders" for the whole fleet. Status rules shows the lifecycle the server enforces. The design system page is the design library the role asks for.

## 3. Design decisions

### Across the app

- **The design library lives in code, as a living style guide.** Tokens are CSS custom properties in three tiers: primitives, semantic roles and component use (`src/styles/tokens.css`). Components in `src/ds/` use only semantic tokens, which is how dark mode works: it swaps one layer. The `/design-system` page renders the real components, so the docs can't drift from the product. It opens from the "Miscellaneous" panel in its own frame, apart from the ops screens.
- **Rigid layouts, with a dash for empty values.** Every screen keeps the same regions in the same place whatever the data, so people learn once where to look.
- **One colour, dot and label per status, everywhere.** Status is what people scan for, so it reads the same in badges, filters, charts and the lifecycle diagram.
- **Gas colours follow ISO 32.** Swatches use the standard cylinder shoulder colours (for example, white for oxygen and maroon for acetylene), so the screen matches the paint on the physical cylinder. Gas pickers lead with the name and show the formula underneath, because people say "oxygen", not "O₂".
- **A custom Select instead of the native dropdown.** The native menu can't show status dots or gas swatches, and it looks different on every OS.
- **Solid, high-contrast toasts that pause on hover.** A pale toast is easy to miss. Pausing while the pointer or focus is on a toast lets someone finish reading before it goes.
- **On phones, toasts drop in under the top bar instead of the bottom corner.** The bottom of a phone screen is already taken by the reviewer menu button, the iPhone home bar and Safari's moving toolbar, and phone users look to the top for notifications anyway. The card is compact, with the description cut to two lines (the full detail is on the page behind it) and a 44px close target. Only the newest toast shows, with older ones peeking out behind it; a tap fans them out, a swipe up dismisses one, and a touch pauses the timer since there's no hover.
- **Full-width pages with 32px padding on all sides** (16–20px on phones). The list is a wide table, and a max-width wasted the screen on large monitors.
- **The sidebar holds only the three pages.** Light, dark or system theme sits in the Miscellaneous panel next to the design system link, because it's a display setting, not a place to go. On phones it's also in the menu, where a phone user looks for settings.
- **A neutral "Demo data" badge under the app name** says the data lives in this browser. It's dashed and grey so it can't be read as a cylinder status.
- **Phones get a top bar and a drop-down menu.** The bar holds the logo, the app name and a menu button. The menu lists the pages with their labels, then Appearance and the full "Demo data" note, and closes when you pick a page, tap outside or press `Esc`. The Miscellaneous button hides while the menu is open so it doesn't float over it.
- **Restrained motion.** At most four entrance blocks per page, a scroll reveal only on Analytics, and none at all with `prefers-reduced-motion`. Motion should show structure, not slow down repeat work.
- **The name "Blue Ocean Tracker"** is "Samudera Biru" in English.

### Cylinders list

- **Filter pills only, with the "Out 30+ days" banner.** I moved the status count tiles to Analytics because they repeated the pills. The one alert that matters day to day stays on the list: a cylinder Delivered for 30 days or more gets an "Out Nd" badge, and the banner counts them (problem 5 in the requirement).
- **Row actions: Edit details and Change status as equal ghost buttons, and Detail as a soft blue tint with an info icon.** Detail is the main way in, so it has the most contrast in the row. It's a tint, not solid blue, because ten solid buttons on a page would outrank "New cylinder".
- **Rows aren't clickable.** A stray click while reading, or while selecting a serial to copy, never navigates away. Detail is the one way in.
- **Action labels are all or nothing.** All three labels show whenever they fit (from about a 1440px window). When they don't, all three become icons together, so a row never mixes words and icons. Every icon keeps its name in a tooltip and for screen readers.
- **The list fills the screen.** Search, filters, column names and pagination stay pinned and only the rows scroll, so paging and filtering stay in reach. The footer shows even at 0 results, so the layout doesn't jump.
- **A page change lands on the top of the list.** On a phone the pager sits under the last card, so after Next I jump the view back up to the list's search box and filter pills, just under the top bar, with the first card right below them. Landing on the first card alone would hide which search and status the reader is paging through, so the controls that say "where am I" stay in view. Focus moves to the results so the next Tab starts at row one. It only happens when the list's top is off-screen, so a view the reader can already see never moves. The jump is instant rather than smooth, because the rows are replaced anyway and their fade-in shows the change. The new "Showing 21–30 of 87" range is announced to screen readers. The History card pages the same way, landing on its filter pills.
- **Title Case column headers and an "Updated" column**, which tells ops how fresh a row is.
- **List state lives in the URL** (`?q=&status=&page=&pageSize=`), so a filtered view survives a reload and can be shared. Search waits 300 ms after typing stops and highlights matches. `/` focuses the search box and `Esc` clears it.
- **Phones get a card, not a squeezed table.** At 760px and below each cylinder is a card read top to bottom: the serial with a ⋯ button, then status and gas, then "With <customer>" with its "Out Nd" badge, then "Updated <time>". The customer line only appears when someone has the cylinder, so Filled, Empty and Retired cards are a line shorter. I gave up equal card heights for this: the customer gets the whole line, so most names now show in full (the 102-character one still ends in "…"), and the overdue warning sits next to the company that has to return the cylinder, which is who ops will call. The gas name can shorten too, so no status and gas pair can push the ⋯ button off the card. The actions sit behind the ⋯ button in a menu with 44px rows, Detail first. On a Retired cylinder, Change status is greyed out and says "Retired is final" instead of disappearing. Filter pills keep an 8px gap so they're easy to tap.

### Cylinder detail

- **The same layout for every status.** The same regions and rows appear whatever the status, with a dash for an empty value, so nothing has to be re-found from one cylinder to the next.
- **Header: the serial with a copy button, then status · updated time.** The serial is what people look up and paste elsewhere. The browser tab shows the serial too, so several open cylinders stay apart.
- **Details show one value per row:** Record ID, Serial number, Gas type, Chemical formula, Customer and Last updated (as an absolute time, with UTC in a tooltip). One value per row scans faster than values with small sub-labels. "Edit details" sits in the card's head, next to what it edits.
- **The lifecycle diagram shows the whole state machine.** Edges are routed by hand so none cross, and a legend explains the marks. The current status is the only solid pill, filled with its status colour, like a "you are here" dot. The allowed next steps have a dashed accent outline ("not yet") and are clickable; on hover or focus they turn solid. I separated the two by fill and line style rather than colour because Filled's sky blue and the accent blue are too close to tell apart, and it also keeps the diagram readable without colour.
- **One "Move to" bar under the diagram.** The usual next move comes first as the primary button, and Retire is always last, so the risky action is never where the hand expects the usual one. The bar lists only the moves the lifecycle allows; Retire stays in place but is disabled when it isn't allowed yet ("Mark it returned empty first"), and a Retired cylinder shows "None. Retired is final."

### Change status dialog

- **Two groups: a flat "Status change" preview row, then bordered "Choose the next status" cards.** Grouping separates what is being changed from what can be picked.
- **Visible radio buttons, a status dot instead of the full badge, and a "Usual next step" tag with nothing pre-selected.** The tag guides without deciding for the user, and with no pre-selection, Enter can't apply a move nobody chose. Retired is set apart from the other choices.
- **Only allowed moves are offered**, and Delivered asks for the customer.
- **Moves that lose something say so in one sentence.** Returning a cylinder to Empty names the customer it clears ("Returning clears the customer PT Maju Jaya Abadi from this cylinder."), so ops can check it's the right company before applying. Retiring shows a red warning that it's permanent.

### Create and edit

- **A review step before saving.** It shows the changes (old → new) before anything is saved; this is the requirement's "validation window". It lists only serial number and gas type, because that's all the request sends.
- **"No changes yet" in the footer** explains why Save is disabled, instead of leaving a dead button.
- **The serial field has a fixed `CYL-` prefix**, accepts digits only, and normalises pasted text such as ` cyl-012345 `.
- **Forms check input with the same rules as the API**, and if the server still rejects a request, a pop-up shows its title, message, field errors and HTTP code. The errors are also attached to the matching fields.

### History

- **Four fixed columns: Action At, Event, Change and Action By.** I dropped a Customer column because it only mattered on deliveries and returns, so it was mostly dashes. The customer now shows inside the Change cell: "To X" on a delivery, "Back from X" on a return. Edits show the old and new value.
- **Dates read DD-MM-YYYY, HH:MM in 24-hour time**, and four fixed summary slots (tracked since, deliveries, customers, last edit) give the card the same shape for every cylinder.
- **Filter by status changes or edits, 10 entries per page**, with filter and page in the URL (`?history=&historyPage=`), like the list. On narrow screens each entry stacks into a card.

### Status rules and Analytics

- **Status rules is one read-only table:** each status, its meaning in a plain sentence, a "Can move to" list and how many cylinders are in it. A from/to grid would need three kinds of cell to say what five short lists say. Retired says "None. Retired is final." The statuses are fixed because the requirement defines exactly five.
- **Analytics opens with a "Fleet by status" strip of link tiles** instead of a status bar chart, because five numbers read better as numbers and each tile opens the filtered list. Below it: key figures, cylinders by gas type, a status-by-gas table, time since last movement, the customers holding the most cylinders and short highlights. The grid rows fill completely (6+6, 12, 8+4), so there are no ragged gaps.
- **Charts never rely on colour alone.** One series uses one colour, status colours appear only where the data is a status, and every value is printed next to its mark.

### States, messy data and accessibility

- **Every data screen has loading, empty and error states.** Loading shows skeleton rows. Changing pages or filters keeps the previous page visible with a thin progress bar instead of a blank flash. Empty states are specific (no search results, a page past the end, no data at all), and errors have a retry, with separate messages for offline and server errors.
- **Messy data.** Long customer names truncate, with the full name on hover. Serials use a monospaced font with tabular numbers, so look-alikes like `CYL-012300` and `CYL-012030` are easy to tell apart. Search ignores case, including accented letters (`östara` finds "Östara").
- **Accessibility.** Dialogs use the native `<dialog>` element (focus trapping, `Esc` to close, the top layer). Every field has a label, with hints and errors linked by `aria-describedby`. Filters use radio-group semantics, the lifecycle diagram has a text alternative, and there's a skip link and visible focus rings.

## 4. Engineering decisions

### Frontend

- **Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, MSW, lucide icons, and Inter / JetBrains Mono. Styling is plain CSS with tokens. I used no UI kit and no chart library, so every component, charts included, is designed here and lives in the design library (`src/ds/`).
- **The mock API is a real implementation.** MSW answers real HTTP calls and saves to `localStorage`, so switching to the .NET API changes no UI code, and data survives a reload.
- **The API is chosen at build time, with no fallback to the mock.** A silent fallback would hide a broken API behind fake data.
- **One rules file with a C# twin.** The lifecycle and validation rules live in `src/lib/domain.ts` and are mirrored in `Domain/CylinderRules.cs`, so the client and server checks can't disagree.
- **Column widths are percentages that add up to 100%, with a fixed table layout.** List: serial 15, gas 15, status 15, customer 15, updated 10, actions 30. History: 15/15/50/20. Status rules: 20/35/35/10. Columns stay in the same place on every page, while loading and whatever the data holds. Long values truncate or wrap inside their cell, and a date wider than the Updated column runs into the empty left side of the Actions column instead of being cut.
- **Tables keep an 880px minimum width and scroll sideways from 761px up.** Below that width, a serial or an "In maintenance" badge would be squeezed.
- **Container queries, not window media queries, for the action labels and for stacking history below 960px.** They react to the card's own width, so the sidebar doesn't throw them off.
- **URL state is written with `replace`**, so a filtered view can be shared without filling Back with every keystroke.
- **Select and the ⋯ menu use the Popover API**, so the browser provides the top layer and light dismiss without a positioning library.
- **TanStack Query keeps the previous page while the next one loads, and retries once, only on network errors and 5xx.** A 400 or 409 is an answer, not a glitch, so retrying it is pointless.
- **The status dialog guards against double submit.** A double Enter used to send two requests, and the second one's error appeared after the success.
- **Each page names its browser tab**, for example "CYL-012345 · Blue Ocean Tracker".
- **A crashed page shows an error screen inside the app frame.** Each route has an error element inside the layout, so the sidebar stays and the page offers Reload and "Go to cylinders", instead of React Router's stack-trace screen.
- **A successful response that isn't JSON counts as an error.** Vercel answers unknown paths, `/api/*` included, with `index.html` and a 200, so a misrouted API call would otherwise "succeed" with HTML. The client turns that into an "Unexpected response" error, and checks that `/api/meta` has the shape the pages need before using it.

### Backend

- **Minimal API endpoints** follow the recommended routes exactly (`Endpoints/CylinderEndpoints.cs`).
- **Errors are RFC 7807 problem details** with a field-keyed `errors` object, which the frontend shows in the pop-up and on the matching field.
- **Duplicate serials are blocked twice.** Serials are stored in upper case under a unique index. The API checks for a clash first to return a clean 409, and if two requests race past that check, the unique index catches the second one, which also gets a 409, never a 500.
- **Search with accents.** SQLite's `LIKE` and `lower()` only fold ASCII, so each row keeps an upper-cased `SearchKey` (serial + customer), and the search term is upper-cased in C# before matching.
- **Server-controlled fields.** `lastUpdated` is set only by the server, through an injected `TimeProvider` so the tests can freeze the clock. Status and customer change only through the status endpoint. Times are stored and sent as UTC.
- **History is append-only.** Each entry is written in the same database save as the change, so a cylinder can't change without its entry. There is no endpoint to edit or delete history, and SQLite triggers reject `UPDATE` and `DELETE` on the history table even from direct database access (the mock freezes its entries). Saving an edit with no real change writes nothing. The 87 imported cylinders get exactly one "Imported" entry at the file's own timestamp, recorded by "System import"; nothing earlier is invented.
- **`actionBy` comes from the server, never the request**, so a client can't claim to be someone else. There's no sign-in yet, so every change is recorded as a demo account ("Rina Wulandari", configurable with `DemoUser`). With real sign-in, the same field would come from the signed-in user.
- **Schema:** `EnsureCreated` instead of migrations, to keep setup to one command. A production version would use migrations.
- **Integration tests** boot the real app against a throwaway SQLite file per test, so they exercise routing, validation, EF Core and SQLite together.

## 5. Assumptions

- **Search** matches serial number and customer name as a partial, case-insensitive match. Searching for a status is done with the filter, not the search box.
- **Customer name** is trimmed and must be 1–120 characters when delivering. It's cleared when a cylinder goes back to Empty.
- **Analytics and history:** the data file has no status history, only `lastUpdated`, so "time since last movement" uses that field. History is recorded from import onward, so trends over time become possible as it fills up.
- **Existing local databases** made before history existed only hold seed data, so the API rebuilds and reseeds them on start.
- **Times** are displayed in the user's local time zone (WIB for the ops team), with the UTC value as a tooltip on the detail page's last-updated time.

## 6. With more time

- Real sign-in, so `actionBy` in the history is the signed-in user instead of a demo account.
- Sortable columns, plus an "idle" filter on the server instead of only a badge.
- Bulk actions, such as marking a whole delivery run as returned, and scanning a cylinder's barcode or QR code from a phone camera.
- Customer records as their own entity, so the same company isn't typed several different ways.

## 7. Use of AI

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

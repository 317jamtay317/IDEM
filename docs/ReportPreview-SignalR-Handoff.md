# Handoff — Live Report Template Preview over SignalR

> **One line.** "Watch a report build in real time." A SiteAdmin edits a Report Template in the
> Report Builder; the editor pushes the template's RDL over a SignalR hub; the hub renders it to one
> PNG per page via the Report Engine and fans the images out to every watcher of that template's
> session, so a separate **Preview Screen** updates live as the report is built.

**Status:** ✅ **Phase A BUILT, green, COMMITTED** — `5ed268a` on branch `claude/hungry-sinoussi-200116`
(worktree `D:\Idem\.claude\worktrees\hungry-sinoussi-200116`). **Not pushed, no PR.** Built TDD
(tests first). Branch was fast-forwarded to `origin/main` `5d0bf66` (PR #21, the Report Engine) before
the feature commit, so this sits directly on top of the merged engine.

**Phase B (multi-user collaboration) is designed-for but NOT built** — see *Next steps*.

---

## Why / context

The Report Builder front end (Phases 0–12) was complete, and the **Report Engine** backend merged in
PR #21 (`RecordKeeping.Reporting`: RDL → layout → PDF via QuestPDF, plus a SiteAdmin-gated
`POST /api/report-templates/preview`). `docs/ReportEngine-Handoff.md` named **"SignalR live preview"**
as the next step. This slice delivers it.

---

## Architecture & data flow

```
 Editor tab (ReportBuilderScreen)                 Watcher tab(s) (ReportPreviewScreen)
   on edit ──(debounced 300ms)──┐                            ▲
        toRdl(template)          │   SignalR hub              │ ReceiveFrames(sessionId, pngPages[])
                                 ▼   group = sessionId         │
                       ┌──────────────────────────────────────┴──────────┐
                       │ ReportPreviewHub (Api)  [Authorize "SiteAdmin"]  │
                       │  PushRdl(sessionId, rdl):                        │
                       │    images = renderer.RenderPreviewImages(rdl,    │
                       │                       SampleReportData)          │
                       │    sessions.SetSnapshot(sessionId, images)       │
                       │    Clients.Group(sessionId).ReceiveFrames(...)   │
                       │  JoinSession(sessionId):                         │
                       │    add to group; replay latest snapshot to caller│
                       └───────────────┬──────────────────────────────────┘
                                       │ IReportRenderer (Application)
                                       ▼
                       QuestPdfReportRenderer (Reporting): RDL → layout → PNG[]
```

- **Session id = the Report Template's id** (`template.id`). Editor and all watchers join the same
  group. The "Live preview" button opens `#/report-preview/{template.id}` in a new tab.
- **Late join:** the in-memory snapshot store replays the latest frames to a watcher that opens
  mid-build, so it never shows a blank page.

---

## Decisions (defaults — the user did NOT explicitly pick these; easy to revisit)

| Decision | Choice | Why |
|---|---|---|
| Scope | Live preview first; collaboration is Phase B | Ships the visible payoff sooner, lower risk |
| Rendering | **Server-rendered** via the engine — PNG-per-page | Real fidelity, single renderer, reuses PR #21 |
| Sync model | **Relay + live snapshot** — editor is source of truth (reuses client `toRdl`); server keeps only the latest frames per session | No C# duplication of the client model |
| Persistence | **Deferred** — preview uses the engine's fixed sample data + the editor's live RDL | Template persistence is a separate concern |
| Collaboration model | Presence + advisory soft-locks (Phase B) | Best awareness/friction balance |

**Isolation:** Report Templates are **platform-global SiteAdmin artifacts**, not Org data, and the
preview binds to fixed sample data — so **I-D03 / Org-isolation does not apply** here. The hub reuses
the existing `"SiteAdmin"` policy (I-D13). When real Org-scoped report *runs* arrive later, I-D03
re-enters — out of scope for this slice.

---

## Files (28 changed in `5ed268a`)

### Backend (Clean Architecture; Domain untouched)
- `src/RecordKeeping.Application/Reporting/IReportRenderer.cs` — **added**
  `ErrorOr<IReadOnlyList<byte[]>> RenderPreviewImages(rdlXml, ReportDataContext)`.
- `src/RecordKeeping.Reporting/Rendering/QuestPdfReportRenderer.cs` — implements it.
- `src/RecordKeeping.Reporting/Rendering/ReportPdfPainter.cs` — `PaintImages(pages)` via QuestPDF
  `GenerateImages` (PNG, 144 DPI); extracted a shared `Compose(pages)` builder used by both the PDF
  and image paths.
- `src/RecordKeeping.Application/Reporting/IReportPreviewSessions.cs` + `ReportPreviewSnapshot.cs` —
  the snapshot-store port + record (`Pages`).
- `src/RecordKeeping.Infrastructure/Reporting/InMemoryReportPreviewSessions.cs` — singleton,
  `ConcurrentDictionary`, `SetSnapshot`/`GetSnapshot`.
- `src/RecordKeeping.Api/Realtime/ReportPreviewHub.cs` — `Hub`, `[Authorize("SiteAdmin")]`, at
  `/hubs/report-preview`. Methods `JoinSession(id)`, `PushRdl(id, rdl)`. Thin (orchestrates only).
  Client events: `ReceiveFrames(sessionId, byte[][])`, `ReceiveError(sessionId, message)`.
- `src/RecordKeeping.Api/Realtime/HubQueryStringAuthentication.cs` — **WS auth shim**: browsers can't
  set the `Authorization` header on a WebSocket handshake, so SignalR sends `?access_token=`; the
  middleware (registered before `UseAuthentication()`) copies it into the `Authorization` header for
  the hub path.
- `src/RecordKeeping.Api/Program.cs` — `AddSignalR()`, the singleton registration, the shim
  middleware, and `app.MapHub<ReportPreviewHub>("/hubs/report-preview").RequireAuthorization("SiteAdmin")`.

### Client (`src/client`)
- `package.json` / `package-lock.json` — added **`@microsoft/signalr` ^10**.
- `src/app/reportBuilder/previewHub.ts` — `createPreviewHub()` wrapper: `accessTokenFactory` from the
  OIDC token; `start/stop/join/pushRdl/onFrames/onError`; auto-reconnect. Frames arrive as base64 PNG
  strings → `data:image/png;base64,...`.
- `src/app/reportBuilder/usePreviewBroadcast.ts` — editor hook; debounced (300ms) `pushRdl`.
  **Inactive without an access token** (so existing no-token screen tests don't open a real connection).
- `src/app/screens/ReportPreviewScreen.tsx` — the new watcher screen; renders pushed PNG pages live +
  a live/connecting/error status. **Keyed by session id in AppShell** so state resets per session.
- `src/app/screens/ReportBuilderScreen.tsx` — new **"Live preview"** button (opens the watcher in a
  new tab) + `accessToken` prop + the broadcast hook.
- `src/app/useHashScreen.ts` + `src/app/AppShell.tsx` — `report-preview` route, SiteAdmin-gated like
  `report-builder`; reads `detailId` as the session id.
- `src/app/app.css` — `.rp-*` styles for the preview screen.

### Tests (TDD — written first)
- Reporting: `tests/RecordKeeping.Reporting.Tests/Rendering/QuestPdfReportRendererTests.cs` (image tests).
- Infrastructure: `tests/RecordKeeping.Infrastructure.Tests/Reporting/InMemoryReportPreviewSessionsTests.cs`.
- Api integration: `tests/RecordKeeping.Api.IntegrationTests/Realtime/ReportPreviewHubTests.cs`
  (push→broadcast, late-join replay, Org-user reject (I-D13), unauth reject — over `HubConnectionBuilder`
  + LongPolling against the test server) and `HubQueryStringAuthenticationTests.cs` (the shim, unit).
- Client (vitest): `previewHub.test.ts`, `usePreviewBroadcast.test.ts`, `ReportPreviewScreen.test.tsx`,
  plus a "Live preview" case in `ReportBuilderScreen.test.tsx`.

---

## How to run & test it

> **Stack is currently UP** on https://localhost:8443 (project `hungry-sinoussi-200116`). If it's down,
> bring it back: see the gotcha below.

**Run the stack.** `scripts/up.ps1` is the intended launcher (floats ports, names the stack, prints
URLs). ⚠ **Gotcha:** it sets `$ErrorActionPreference='Stop'`, and `docker compose` writes normal
progress to **stderr**, which PowerShell 5.1 turns into a terminating `NativeCommandError` — so the
script can abort before the build runs. If that happens, run compose directly (the `.env` already pins
`COMPOSE_PROJECT_NAME`; ports default to 8443/8444/14333):

```
docker compose up -d --build        # do NOT wrap with *>&1 / 2>&1
docker compose ps                   # confirm api/mcp/sql are (healthy)
```

**Logins** (seeded; printed in `docker compose logs api`):

| Role | Email | Password |
|---|---|---|
| **SiteAdmin** (use this) | `admin@recordkeeping.local` | `ChangeMe!OnFirstLogin1` |
| Org User (Dev only) | `user@recordkeeping.local` | `ChangeMe!OnFirstLogin1` |

The preview is **SiteAdmin-only**.

**Test steps:**
1. Open https://localhost:8443 (self-signed cert → click through, or `thisisunsafe` in Chrome). Sign
   in as the SiteAdmin.
2. **Reports** → open / create a Report Template → **Report Builder**.
3. Top bar → **Live preview** → a second tab opens showing the engine-rendered report.
4. Edit in the builder (move/add an element, change text, edit a binding) → the preview tab updates
   within ~300ms.
5. **Late-join:** edit a few times, then refresh the preview tab — it shows the current state at once.
6. **Multiple watchers:** open the same `#/report-preview/{id}` URL in a third tab — all update together.
   (Multiple *editors* with presence is Phase B.)

**Stop:** `scripts/down.ps1` (add `-v` to drop the SQL volume) or `docker compose down`.

---

## Verification done

- **456 backend tests** green (Domain 141, Application 103, Reporting 77, Mcp 3, Infrastructure 21, Api
  integration 111). **681 client tests** green. `tsc -b` + `vite build` clean.
- **Coverage 84.6%** merged backend overall (≥80% gate); new classes ~100% (`ReportPreviewHub`,
  `HubQueryStringAuthentication`, `InMemoryReportPreviewSessions`, `QuestPdfReportRenderer` 100%;
  `ReportPdfPainter` 98%).
- **Linux native risk RETIRED** — ran the Reporting suite (incl. `GenerateImages`) inside
  `mcr.microsoft.com/dotnet/sdk:10.0` + `libfontconfig1`/`fonts-dejavu-core` (the Dockerfile's deps):
  77/77 green. (Handoff for PR #21 had flagged the engine as never exercised on Linux.)
- **In running container:** `POST /hubs/report-preview/negotiate` (no auth) → **401** (mapped +
  SiteAdmin-gated); SPA root → 200; api/mcp/sql all healthy.
- **Not done:** a literal browser→WebSocket→browser round trip wasn't scripted as an automated test
  (the server round trip is covered by the hub integration tests; the client by vitest; the shim by
  unit tests). Manual browser confirmation via the running stack is the remaining human check.

---

## Next steps

### Phase B — multi-user collaboration ("who is editing what") — NOT built
Designed to layer onto the same hub + registry:
- **Presence:** hub `UpdateSelection(sessionId, elementIds[])`; the registry tracks each participant's
  identity + selection; broadcast `ParticipantsChanged`. The **editor canvas** (`ReportCanvas.tsx`)
  draws other users' selections as colored outlines + name labels; the Preview Screen shows
  watcher/editor avatars.
- **Soft locks:** `ClaimElement` / `ReleaseElement` (advisory) — others see "being edited by …",
  not hard-blocked.
- With relay+snapshot, the most recent `PushRdl` wins; presence + soft-locks keep two editors from
  silently clobbering the same element. **No CRDT/OT** (explicitly out of scope).
- The registry already has the snapshot half; add a `PreviewParticipant` map + the hub methods above.

### Other follow-ups
- **Persistence / real-data runs:** the preview uses the engine's fixed `SampleReportData`. An
  Org-scoped *run* against real Records would re-introduce I-D03 (build `ReportDataContext` from
  `IRecordRepository`, audit SiteAdmin cross-Org access per I-D13). Separate slice.
- **Push / PR:** nothing is pushed. Open a PR off `claude/hungry-sinoussi-200116` when ready.
- **Pre-existing lint debt (NOT introduced here):** `src/client/src/App.tsx:36` and
  `src/client/src/app/screens/RecordsScreen.tsx:137` trip `react-hooks/set-state-in-effect` (the new
  eslint-plugin-react-hooks v7). Untouched by this work; `npm run lint` is red only on those two.

---

## Quick reference

```
# Backend tests + coverage
dotnet test RecordKeeping.slnx --collect:"XPlat Code Coverage"

# A single backend project
dotnet test tests/RecordKeeping.Reporting.Tests/RecordKeeping.Reporting.Tests.csproj

# Client
npm test --prefix src/client            # vitest
npm run build --prefix src/client       # tsc -b + vite build
npm run lint  --prefix src/client       # red on 2 PRE-EXISTING files only

# Verify image rendering on Linux (retires the font-deps risk)
git archive HEAD | docker run --rm -i mcr.microsoft.com/dotnet/sdk:10.0 bash -lc '
  apt-get update >/dev/null 2>&1 && apt-get install -y --no-install-recommends libfontconfig1 fonts-dejavu-core >/dev/null 2>&1
  mkdir /work && cd /work && tar -x
  dotnet test tests/RecordKeeping.Reporting.Tests/RecordKeeping.Reporting.Tests.csproj --nologo'

# Stack
docker compose up -d --build   # (preferred over up.ps1 — see gotcha above)
docker compose ps
docker compose logs api
scripts/down.ps1               # or: docker compose down   (-v drops SQL volume)
```

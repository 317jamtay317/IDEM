# Handoff — Live Report Template Preview over SignalR

> **One line.** "Watch a report build in real time." A SiteAdmin edits a Report Template in the
> Report Builder; the editor pushes the template's RDL over a SignalR hub; the hub renders it to one
> PNG per page via the Report Engine and fans the images out to every watcher of that template's
> session, so a separate **Preview Screen** updates live as the report is built.

**Status:** ✅ **Phase A + Phase B BUILT, green, COMMITTED** on branch `claude/hungry-sinoussi-200116`
(worktree `D:\Idem\.claude\worktrees\hungry-sinoussi-200116`). **Not pushed, no PR.** Built TDD (tests first).
Key commits: Phase A `5ed268a` (live preview over SignalR), Phase B `1deb458` (presence + advisory soft-locks),
a dev-only second SiteAdmin `1f0df17`, and the merge **`82e6ff6` = `origin/main` (PR #22, Report Template
persistence) merged into this branch** — so the branch now carries Phase A + Phase B **and** PR #22's online
list/edit/save/PDF/delete. After the merge: **522 backend + 729 client tests green, 85.6% line coverage**.

The merge unioned two parallel features (see the merge commit): PR #22's online builder mode (api/onSaved,
load via `parseRdl`, Save create/update, Download PDF, editable name) coexists with Phase A/B's live preview +
presence in `ReportBuilderScreen`/`AppShell`; the single `accessToken` serves both the report-templates API and
the SignalR hub. One follow-on fix landed in the merge: `createPreviewHub` now resolves the hub URL to an
absolute same-origin URL (SignalR's relative-URL resolution throws under jsdom, which the online tests hit once
the hook activates on their `accessToken`).

> **Update — Phase C (partial): side-by-side live preview + live cursors BUILT, green, committed** on this same
> branch (TDD). The "Live preview" top-bar button no longer opens a new tab — it toggles an **inline, side-by-side
> preview pane** inside the Report Builder, rendering the engine's PNG frames live as anyone edits (the editor is
> already in the session group, so its own RDL pushes return as frames — no second connection). And participants
> now see each other's **live cursors** move on the design canvas, in each participant's presence colour. After this
> work: **523 backend + 753 client tests green, 85.6% backend line coverage**. Browser-verified: the side-by-side
> pane renders the real report and stays "● Live" while editing. See the **"Phase C (partial)"** section below.

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
| **SiteAdmin #2** (Phase B — Dev only) | `admin2@recordkeeping.local` | `ChangeMe!OnFirstLogin1` |
| Org User (Dev only) | `user@recordkeeping.local` | `ChangeMe!OnFirstLogin1` |

To test **two distinct participants** (Phase B presence/locks with different names + colours), sign in as
each SiteAdmin in **separate browser sessions** — a normal window and an incognito/private window (two tabs of
one window share the OIDC cookie = same user).

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
7. **Phase B presence/locks:** open the *same* Report Template in the builder as both SiteAdmins (separate
   browser sessions). Selecting an element as one shows a coloured outline + name and a "being edited by …"
   lock badge to the other; each Live preview tab shows both participants' avatars.

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

### Phase B — multi-user collaboration ("who is editing what") — ✅ BUILT
Layered onto the same hub. Built TDD; 486 backend + 706 client tests green, 85% line coverage. Design
locked via a 3-architect + judge workflow; implementation then adversarially reviewed (10 findings, all
addressed — 3 real fixes + 5 added tests). Architecture chosen to clone the `IReportPreviewSessions` seam.

- **New Application port** `IReportPreviewPresence` (+ records `PreviewParticipant`/`PreviewLock`/
  `PreviewLeaveResult`) with an in-memory singleton `InMemoryReportPreviewPresence` — a
  `ConcurrentDictionary` of sessions, each guarded by a **per-session monitor lock** so "claim-if-free" and
  "leave-releases-my-locks" are atomic, plus a `connectionId → sessionId` reverse index so disconnect is
  O(1). Empty sessions are GC'd under the gate; `Join` has a retry loop for the GC race.
- **Identity is server-derived** by `PreviewParticipantFactory.From(ClaimsPrincipal, connectionId)`: userId
  from `Claims.Subject` (NOT `Context.UserIdentifier` — no `IUserIdProvider` is registered), displayName
  from `Claims.Name`, deterministic palette colour from the userId hash. Never from client args (anti-spoof).
- **Hub** gained `UpdateSelection(elementIds)`, `ClaimElement(elementId) → PreviewLock?`,
  `ReleaseElement(elementId)`, an extended `JoinSession` (joins presence + replays roster/locks to the late
  joiner), and an `OnDisconnectedAsync` override → `Leave`. **Mutation methods take NO sessionId** (resolved
  from the connection, so you can't act on a session you never joined). Events `ParticipantsChanged` /
  `LocksChanged` carry the **full list** (idempotent, replay-safe). SignalR JSON set to camelCase to match TS.
- **Client:** `previewHub.ts` extended (methods/types/events + `connectionId()` + `onReconnected`); the
  editor's `usePreviewBroadcast` now also joins, publishes selection (debounced), claims on sole-selection,
  exposes participants/locks, and replays join+selection+held-lock on reconnect (one connection per editor
  tab). `ReportCanvas` draws other users' selections (coloured outline + name) and "being edited by …" lock
  badges (additive, decorative, pointer-events: none). `ReportPreviewScreen` shows a presence-avatar strip
  (`presenceColor.ts` `initialsFor`). Self is filtered by **connectionId** (two tabs share a userId).
- **Locks are advisory** — never hard-block, never steal; the only auto-release is disconnect→`Leave`. No
  TTLs/heartbeats: the SignalR connection lifecycle is the single source of liveness truth. I-D03 still N/A
  (platform-global templates + sample data); SiteAdmin-gated under I-D13; no audit, no new invariant.

### Phase C (partial) — Side-by-side live preview + live cursors — ✅ BUILT
Built TDD on this branch. **523 backend + 753 client tests green, 85.6% backend line coverage.** Diff
adversarially reviewed (11 findings → 1 real fix applied: reconnect resets `previewStatus` to `connecting`;
1 "confirmed" finding empirically refuted in a real browser — captured-pointer `pointermove` *does* bubble to
ancestors, so cursor tracking during drag/resize works via the page handler).

- **Side-by-side live preview pane.** The "Live preview" top-bar button is now a **toggle** (no more
  `window.open`); it shows an inline `<aside aria-label="Live preview">` beside the canvas in `.rb-canvas-wrap`.
  It reuses the existing `PushRdl`→render→`ReceiveFrames` path: the editor is in its own session group, so its
  debounced RDL pushes come back as frames on the **same** connection — `usePreviewBroadcast` now also exposes
  `frames` / `previewStatus` / `previewError` (subscribes to `onFrames`/`onError`). No second connection, no new
  backend. With two simultaneous editors the rendered preview is last-writer-wins (documented tradeoff; advisory
  locks already nudge against concurrent edits) — true co-editing of the *editable canvas* was deliberately left
  out of scope.
- **`LivePreviewPane`** (`src/client/src/app/reportBuilder/LivePreviewPane.tsx`) — extracted the watcher's
  presentational surface (header: close control, title, status, page count, presence avatars; body: pages /
  waiting / error). `ReportPreviewScreen` (the standalone tab route) now renders it too, so both the full-screen
  watcher and the embedded pane share one component (its DOM contract is unchanged — the screen's tests stayed
  green through the refactor).
- **Live cursors.** New hub method `ReportPreviewHub.UpdateCursor(double x, double y)` → resolves the session
  from the connection (no `sessionId` arg, same anti-spoof invariant as the other mutations) and broadcasts
  `CursorMoved(sessionId, connectionId, x, y)` to `Clients.OthersInGroup` (no self-echo); the moving
  connection's id is **server-stamped**. Ephemeral — never stored in presence. Client: `previewHub`
  gained `updateCursor`/`onCursorMoved`; `usePreviewBroadcast` throttles publishes (~50ms leading+trailing),
  tracks remote `cursors` (one per connection, pruned when a participant leaves the roster), and `publishCursor`
  is a no-op without a connection. `ReportCanvas` reports the page-absolute pointer position (inches) from
  `handlePagePointerMove` (covers hover, marquee, and — via captured-pointer bubbling — element drag/resize) and
  renders other participants' cursors as a coloured `.rb-remote-cursor` SVG sprite + name tag (z-index above
  every overlay, `pointer-events: none`). `ReportBuilderScreen` joins the throttled cursor positions with the
  roster (colour + name) and filters self by connection id. I-D03 still N/A (platform-global templates + sample
  data); SiteAdmin-gated under I-D13; no new invariant.
- **To exercise:** open the same template in the builder as both seeded SiteAdmins (separate browser sessions —
  a normal + an incognito window); each sees the other's cursor move, and the side-by-side pane updates live as
  either edits. Single-user side-by-side rendering was browser-verified; the two-user cursor round trip is
  covered by the hub integration test (real SignalR over LongPolling) + vitest.

### Phase C — still NOT built (future)
- **Persistence / real-data runs:** the preview uses the engine's fixed `SampleReportData`. An Org-scoped
  *run* against real Records would re-introduce I-D03 (build `ReportDataContext` from `IRecordRepository`,
  audit SiteAdmin cross-Org access per I-D13). Separate slice.
- **True co-editing of the canvas:** another editor's added element does not become a draggable object on *your*
  canvas (only the rendered preview reflects it). Real op/CRDT sync with conflict + undo reconciliation is a
  separate, larger slice.
- **Richer collaboration:** live cursors are now built (above); lock stealing/expiry policy, follow-mode, chat —
  still none (kept minimal).
- **Cursor perf:** remote cursor updates re-render the builder at up to ~20 Hz per other participant; fine for a
  handful of SiteAdmins, but a dedicated overlay layer would avoid re-rendering the whole canvas if it ever
  matters.

### Other follow-ups
- **Push / PR:** Phase A is committed (`5ed268a`); Phase B is committed on top. Nothing is pushed yet —
  open a PR off `claude/hungry-sinoussi-200116` when ready.
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

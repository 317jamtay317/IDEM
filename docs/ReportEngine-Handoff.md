# Report Engine + Preview — Session Handoff

**Date:** 2026-06-05 · **Branch:** `claude/elated-easley-ca3948` (off latest `main` = `538f6f5`)
**Status:** Report Engine (RDL→PDF) + SiteAdmin-gated live preview endpoint **BUILT, green, committed.**
**Not pushed, no PR.** Working tree clean. 5 commits ahead of `main`.

This is the **backend** half of Report Builder Phase 13. The front-end builder (Phases 0–12) was
already complete on `main`. This session built the engine that turns a template's RDL into a PDF and
exposed it for preview — the exact path the **SignalR live-preview hub (next session)** will call.

---

## Update 2026-06-05 (later) — Template persistence + list/edit UI + Download PDF ✅

Remaining item **#2 (Template persistence)** below is now **BUILT & green** (the engine merged to `main`
via PR #21 first). Mirrors the **ProductionField** vertical exactly, as the plan called for:

- **Domain** `ReportTemplate : AggregateRoot<Guid>` (`Name` + `Rdl` + `CreatedAtUtc`/`UpdatedAtUtc`;
  platform-owned, **no `OrgId`**) — `src/RecordKeeping.Domain/ReportTemplates/ReportTemplate.cs`.
- **Application** `IReportTemplateRepository` + `Create`/`Update`/`GetReportTemplates`/`GetReportTemplateById`
  handlers + `ReportTemplateResponse`/`ReportTemplateErrors` (all `ErrorOr<T>`).
- **Infrastructure** `ReportTemplateConfiguration` (RDL = `nvarchar(max)`, no `HasMaxLength`) +
  `ReportTemplateRepository`; `DbSet` + `ApplyConfiguration` + DI registration added. **No migrations** —
  `RecordKeepingDbInitializer` creates the table on a fresh DB.
- **Api** added to the existing SiteAdmin-gated `api/report-templates` group: `GET /`, `GET /{id}`,
  `POST /`, `PUT /{id}` (preview unchanged).
- **Client** new `reportTemplatesApi` (list/get/create/update/`renderPdf`). The **Reports screen** now
  lists saved templates for a SiteAdmin with **Edit** (opens the builder) and **PDF** (renders via the
  engine) per row. The **Report Builder** gained an injected `api`: it **loads** an existing template
  (`get` → `parseRdl`), **Save** now **persists** (create/update) instead of downloading, the doc title is
  an editable **name** field, and a top-bar **Download PDF** button exercises the engine. Offline (no
  `api`) behavior is unchanged, so all prior builder tests still pass.

New tests: Domain 12 · Application 11 · Api integration 8 · client `reportTemplatesApi` 8 · ReportsScreen
+ ReportBuilder + AppShell updates. **Full suite green** — backend 473, client 681. Merged line coverage
**96.6%**.

**⚠ Dev-DB caveat (same as MonthlyLimits):** the initializer only creates *all* tables when `Orgs` is
missing, so an **existing** dev DB won't get `ReportTemplates`. Reset it once to pick up the new table:
`scripts/down.ps1 -v` then `scripts/up.ps1` (Testcontainers integration tests use a fresh DB, so they're
unaffected). Then sign in as the seeded SiteAdmin and open **Reports**.

Still remaining: **#1 SignalR live preview**, **#3 Org-scoped report run**, **#4 SiteAdmin cross-Org audit**
(template CRUD touches no Org data, so no audit needed there), **#5 engine fidelity**.

---

## TL;DR — what works now

A SiteAdmin can `POST /api/report-templates/preview` with a Report Template's RDL and get back a
rendered **`application/pdf`**. Proven end-to-end by an integration test that renders a real PDF
in-process. Full backend suite **442 tests green**.

```
[front-end builder]  ->  toRdl()  ->  POST /api/report-templates/preview {rdl}
                                          │  (SiteAdmin policy, I-D13)
                                          ▼
   RdlReader.Parse ──▶ ReportLayoutEngine (binds ExpressionEvaluator vs ReportDataContext)
                                          ▼
                            ReportPdfPainter (QuestPDF) ──▶ PDF bytes
```

---

## Build / test / run (READ THIS — there are gotchas)

- **Backend tests:** run from the worktree root, and **always pass `-p:SkipClientBuild=true`** (the
  Api `.csproj` runs an `npm run build` `BeforeTargets=Build` otherwise — slow / can fail):
  ```
  dotnet test RecordKeeping.slnx -p:SkipClientBuild=true
  ```
  Fast inner loop on just the engine:
  ```
  dotnet test tests/RecordKeeping.Reporting.Tests/RecordKeeping.Reporting.Tests.csproj
  ```
- **Coverage** (CLAUDE.md §2, ≥80% gate): `dotnet test … --collect:"XPlat Code Coverage" --settings coverlet.runsettings`; the cobertura `<package name="RecordKeeping.Reporting" line-rate=…>` is the number to read. Reporting is at **96.1% line**.
- **Integration tests** spin up Testcontainers **SQL Server** (Docker Desktop must be running); ~10–15s.
- **Bash & PowerShell tools SHARE one cwd** — if `dotnet`/`docker -f` complains about missing files, the cwd drifted; use absolute paths or `cd` the worktree root first.
- **"Run it" = full Docker stack** (CLAUDE.md §11): `scripts/up.ps1` (floats host ports, prints URLs + seeded logins). Default app at https://localhost:8443. Seeded SiteAdmin: `admin@recordkeeping.local` / `ChangeMe!OnFirstLogin1`.

---

## What was built (file map)

**New project `RecordKeeping.Reporting`** (peer to `RecordKeeping.Mcp`; refs Application only;
`QuestPDF` 2026.5.0; engine internals are `internal` + `InternalsVisibleTo` the test project) and
**`RecordKeeping.Reporting.Tests`**, both added to `RecordKeeping.slnx`.

| Layer | File | Role |
|---|---|---|
| Application | `src/RecordKeeping.Application/Reporting/ReportDataContext.cs` | `ReportDataContext` / `ReportPageContext` (engine's data contract) |
| Application | `src/RecordKeeping.Application/Reporting/IReportRenderer.cs` | rendering interface: `ErrorOr<byte[]> RenderPdf(rdlXml, data)` |
| Application | `src/RecordKeeping.Application/Reporting/SampleReportData.cs` | server-side sample DataContext (Rieth-Riley Goshen, 3 detail rows) |
| Application | `src/RecordKeeping.Application/Reporting/PreviewReportTemplate.cs` | `PreviewReportTemplateQuery` + handler (sync, returns `ErrorOr<byte[]>`) |
| Reporting | `src/RecordKeeping.Reporting/Model/ReportDefinition.cs` | parsed model (`internal` records + enums) |
| Reporting | `src/RecordKeeping.Reporting/Rdl/RdlReader.cs` | RDL parse (C# port of `rdl.ts`) |
| Reporting | `src/RecordKeeping.Reporting/Expressions/{ExpressionParser,ExpressionEvaluator}.cs` | designer dialect (port of `expressions.ts`) |
| Reporting | `src/RecordKeeping.Reporting/Layout/{RenderPrimitive,ReportLayoutEngine,PageNumberFormatter}.cs` | definition+data → pages of primitives |
| Reporting | `src/RecordKeeping.Reporting/Rendering/{ReportPdfPainter,QuestPdfReportRenderer}.cs` | QuestPDF paint; `QuestPdfReportRenderer : IReportRenderer` |
| Reporting | `src/RecordKeeping.Reporting/ReportingServiceCollectionExtensions.cs` | `AddRecordKeepingReporting()` (DI) |
| Api | `src/RecordKeeping.Api/Endpoints/ReportTemplateEndpoints.{Endpoints,Methods}.cs` | `POST /api/report-templates/preview` |
| Api | `src/RecordKeeping.Api/Endpoints/ClaimsPrincipalExtensions.cs` | **new** `IsSiteAdmin()` + `SiteAdminClaimType` |
| Api | `src/RecordKeeping.Api/Program.cs` | **new `SiteAdmin` policy** + `AddRecordKeepingReporting()` |
| Api | `src/RecordKeeping.Api/Dockerfile` | copies Reporting project + installs `libfontconfig1` + `fonts-dejavu-core` |
| Tests | `tests/RecordKeeping.Reporting.Tests/**` (75) · `…Application.Tests/Reporting/**` · `…Api.IntegrationTests/Reporting/**` (4) | |

**Commits:** `251306a` E1–2 reader+expr · `ba09a0d` E3–4 formatter/sample/layout · `ae4e4bb` E5
QuestPDF · `fce53b6` E6–7 endpoint+SiteAdmin policy · `fadacef` E8 docker+docs.

---

## Locked decisions (owner-confirmed this session)

- **PDF library = QuestPDF.** Owner chose it over PdfSharp/MigraDoc. Its **Community License is free
  under $1M/yr revenue** (owner ~$150K → no purchase; revisit only past $1M). License type is set in
  `ReportPdfPainter`'s **static ctor** (`LicenseType.Community`) — **required or `GeneratePdf` throws.**
- **Scope = engine + preview first** (persistence deferred).
- **Preview renders against server-side sample data** (`SampleReportData`) — SiteAdmins have **no Org**
  (I-D13), so preview can't use caller data. The engine accepts *any* `ReportDataContext`, so a future
  Org-scoped run supplies real Records through the same path.

---

## How the engine mirrors the front-end (the contract it must honor)

The C# layers are faithful ports of the front-end (`src/client/src/app/reportBuilder/`):
`rdl.ts` → `RdlReader`, `expressions.ts` → `ExpressionParser`/`Evaluator`,
`pageNumbers.ts` → `PageNumberFormatter`, `preview.ts`/`ReportPreview.tsx` → `ReportLayoutEngine`,
`sampleData.ts` → `SampleReportData`. **Pagination is *logical*** (pageCount = 1 + explicit page
breaks; report-header/detail on page 1, sub-report on last, header/footer on every page; detail band
repeats once per detail row), **matching what the SiteAdmin sees in the in-browser Preview** — keep it
consistent so live-update looks the same. Bands stack from the page top and **margins are NOT applied
to element positions** (matches the builder canvas).

---

## QuestPDF gotchas (locked-in knowledge — don't re-discover)

- Set `QuestPDF.Settings.License = LicenseType.Community` **and** `CheckIfAllTextGlyphsAreAvailable = false`
  in a static ctor before generating.
- QuestPDF 2026.5.0 **removed the public SkiaSharp `Canvas` API** → ellipse/triangle currently draw as
  their **bounding outline** (follow-up: precise vector shapes). Sample templates use rect+lines (real).
- Colors take `QuestPDF.Infrastructure.Color` (use `Color.FromHex("#…")`), **not** strings.
- `TranslateX/TranslateY` need a `Unit` arg. The painter works in **points** (`Pt(inches)=inches*72`) and
  positions each primitive as its own overlay **Layer** to get absolute placement.
- **Linux:** QuestPDF/SkiaSharp need `libfontconfig1` + a font installed (done in the Dockerfile) or
  rendering **throws**. Authored fonts (e.g. "Inter") not present on the host fall back to DejaVu.
- `Document.Create(...).GenerateImages(...)` exists (saw it in the XML docs) → use it if you want **PNG**
  per page for live in-browser preview instead of PDF.

---

## Remaining Phase 13 (prioritized)

### 1. SignalR live preview — NEXT SESSION (the immediate goal)
Push a re-rendered preview to the builder as the SiteAdmin edits. Suggested shape:
- Add `Microsoft.AspNetCore.SignalR` is built into ASP.NET (no package needed; just `builder.Services.AddSignalR()` + `app.MapHub<ReportPreviewHub>("/hubs/report-preview")` in `Program.cs`). Gate the hub with the **`SiteAdmin`** policy (already exists).
- A `ReportPreviewHub` method takes the current RDL, calls `PreviewReportTemplateHandler.Handle(query, IReportRenderer)` (inject the renderer), and returns the bytes. For live in-browser display, **PNG per page (`GenerateImages`) is likely nicer than PDF** — consider a small `RenderPreviewImages` addition to `IReportRenderer`/the engine, or send the PDF and embed in an `<iframe>`.
- SPA: connect after opening `#/report-builder/{id}`; send **debounced** RDL (`toRdl(template)`) on edit; render the returned image(s)/PDF in a panel. The engine path is **stateless** — the hub just calls it.
- This is purely additive; the stateless preview endpoint already proves the render path.

### 2. Template persistence
Domain `ReportTemplate` **platform-owned (no `OrgId`)**, capturing `version` (I-D08); Application
create/update/get → `ErrorOr<T>`; Infrastructure EF persistence of the **RDL blob** (`nvarchar(max)`,
no `HasMaxLength`); client **`reportTemplatesApi`** replacing the Phase-12 download stub. Mirror the
**ProductionField** vertical (platform-owned, SiteAdmin-managed) exactly — it's the closest template:
`Domain/ProductionFields`, `Application/ProductionFields`, `Infrastructure/Persistence/ProductionField*`,
`Api/Endpoints/ProductionFieldEndpoints.*`. No EF migrations folder — schema is created at runtime by
`RecordKeepingDbInitializer` (add the `DbSet` + `IEntityTypeConfiguration` + repo).

### 3. Org-scoped report *run* (real data)
Produce a real Report for an Org from real Records — Org-isolated (I-D03/I-D10) via `IRecordRepository
.GetByOrgAsync(orgId, facilityId?, from?, to?)`. Build a `ReportDataContext` from `RecordResponse`
(unpack sparse `RecordValue`s keyed by `PropertyName`; scopes Org/Facility/Report; detail = Record rows).
The produced *Report* instance is Org-scoped; the template is not. Feeds I-D09 parity.

### 4. SiteAdmin cross-Org audit (I-D13)
No audit infra exists yet. Add it when a SiteAdmin first touches Org data (the preview uses sample data,
so it doesn't yet).

### 5. Engine fidelity follow-ups
Precise ellipse/triangle; real content-flow (data-driven) pagination; real image/barcode/table/chart
(placeholders today).

---

## Risks / caveats (be honest with the owner)

- The engine is verified **in-process on Windows** (integration test renders a real PDF). It has **not**
  been run inside the **Linux Docker container** this session — the `libfontconfig1`/font deps are added
  per QuestPDF's documented Linux requirement but unexercised. **Recommend a `scripts/up.ps1` build + one
  preview call before relying on it in the container.**
- Logical (not content-flow) pagination: a template with more detail rows than fit a page won't auto-flow
  to a new page yet — it relies on explicit page breaks (matches the front-end Preview by design).

---

## Pointers

- **Memory:** `report-builder.md` (Phase 13 section at the bottom has the same detail + per-decision notes).
- **Docs (updated):** `docs/Architecture.md` §In-house Reporting · `docs/ReportBuilder.md` Phase 13.
- **Project rules:** `CLAUDE.md` (TDD §1, coverage §2, Clean Arch §3, DDD/UL §4, invariants §5, ErrorOr §6, docs §7, Org isolation §8, git §9, run-the-stack §11).
- **Push/PR:** not done (CLAUDE.md §9 — only on request). To push: `git push -u origin claude/elated-easley-ca3948` then `gh pr create`.

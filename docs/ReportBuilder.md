# Report Builder — Implementation Plan

The phased roadmap for the **Report Builder**: a SiteAdmin-only, banded report-template *designer* that authors **Report Templates** and serializes them to **RDL/RDLC** XML. Living document — tick phases off as they land and revise as decisions change.

Companion docs: [Architecture.md](./Architecture.md) · [UbiquitousLanguage.md](./UbiquitousLanguage.md) · [Invariants.md](./Invariants.md). Figma: file `EwMw9WyfAV13CFS9bbaCEe` — desktop `47:461`, phone Edit `58:465`, phone Insert `61:466`.

> **Status legend**
> - ✅ Done
> - 🟡 In progress
> - ⬜ Not started

---

## What we're building

A banded report designer in the Crystal/RDLC tradition: a canvas of stacked **bands** (`REPORT HEADER · PAGE HEADER · DETAIL · SUB REPORT · PAGE FOOTER`) holding positioned elements (labels, data fields, formulas, shapes, images, barcodes, sub-reports, tables, charts, page breaks). The user picks an element, edits it in a Properties/Data panel, and saves. The saved artifact is a **Report Template** — its definition serialized to **RDL/RDLC** XML, suitable for storage in SQL Server.

- **Audience:** SiteAdmins only (platform operators — [I-D13](./Invariants.md)). RecordKeeping authors the v1 templates; Org Users do not edit them.
- **Mobile-first:** desktop/tablet get the full editing surface; phone is view + tap-to-select + bottom-sheet property editing + a `+ Insert` sheet. Precise drag/resize/alignment is desktop/tablet-primary.

---

## Decisions (locked 2026-06-03)

| Decision | Choice | Consequence |
|---|---|---|
| XML format (#6) | **RDL/RDLC** (Microsoft Report Definition Language), pragmatic subset | Designer model ⇄ RDL at the serialize boundary; expression dialect is RDL |
| Naming | UI = **Report Builder**; artifact = **Report Template** | Add "Report Builder" to [UbiquitousLanguage.md](./UbiquitousLanguage.md) as 🟡 before coding (CLAUDE.md §4) |
| Drag / resize / snap | **react-rnd** | Sanctioned in Architecture.md §In-house Reporting; grid-snap + smart guides layered on top |
| Scope (for now) | **Front-end only** (phases 0–12) | Save *produces* RDL (held in memory / downloadable); real persistence + server auth is Phase 13 |

> **Note on [I-D09](./Invariants.md) (visual fidelity):** choosing RDL governs the *template definition format*, not rendered-output fidelity. I-D09 (matching the legacy WPF reports) is satisfied later by the Report Engine that renders RDL → PDF, not by this format choice.

> **Update (2026-06-04) — react-rnd not yet adopted.** Phase 6 *move* shipped with **native pointer events** instead of react-rnd, to preserve the accessible-`<button>` canvas and its tested geometry and avoid a dependency. Whether *resize* + grid-snap (Phases 7–8) adopt react-rnd or continue native is **pending owner confirmation**. Palette→canvas insertion uses native HTML5 drag-and-drop (a separate mechanism from element move).

---

## Designer → RDL/RDLC mapping

The canvas stays band-friendly on screen; we map to RDL only when serializing.

| Designer concept | RDL/RDLC |
|---|---|
| Page Header / Page Footer bands | `<PageHeader>` / `<PageFooter>` |
| Report Header / Detail / Sub Report bands | `<Body>` items — Detail → a `<Tablix>` detail group; Sub Report → `<Subreport>` |
| Data field `{Record.Tons}` (#5) | `=Fields!Tons.Value` |
| Formula `SUM({Record.Tons})` (#5) | `=Sum(Fields!Tons.Value)` |
| Page numbers `Page {n} of {N}` (#2) | `=Globals!PageNumber & " of " & Globals!TotalPages` |
| Page setup + page break (#1) | `<Page>` (`PageHeight` / `PageWidth` / margins) + `PageBreak` |

We target an **RDLC-flavored subset**: no embedded data-source queries — bindings reference our domain `Fields` directly.

---

## Feature → phase map

| Requested feature | Phase(s) |
|---|---|
| 6. XML document | **1** (model ⇄ RDL) → **12** (Save, end-to-end) |
| 3. Snap to grid | **7** |
| 4. Line alignment across groups | **8** |
| 5. Functions & expressions | **9** |
| 1. Multiple pages | **10** |
| 2. Show page-numbers options | **11** |

Foundational phases (0, 2–6) make the designer usable enough to exercise the six.

---

## Conventions for every phase

- **TDD:** Red → Green → Refactor. Write the failing test first; commit only when green (CLAUDE.md §1).
- **Front-end stack:** `src/client`, Vitest + React Testing Library; pure logic (RDL serialize, snap math, alignment math, expression eval) tested in isolation.
- **Coverage:** ≥ 80%, verified before each commit (CLAUDE.md §2).
- **Mobile-first:** every UI phase delivers the phone variant (sheets/FAB) alongside desktop/tablet.

---

## Phases

### Milestone A — Skeleton & model

- [x] **Phase 0 — Builder route + SiteAdmin gate + static shell.** ✅
  New "Report Builder" screen, reached by opening a template from `src/client/src/app/screens/ReportsScreen.tsx`; hidden + redirected for non-SiteAdmins. Static three-region layout (toolbar / Insert palette / canvas / Properties) + top bar (Undo/Redo/Preview/Save). Extend `src/client/src/app/useHashScreen.ts` to carry a template id (`#/report-builder/{id}`). First step: add `Report Builder` to the UL (🟡).
  *Tests:* hash-with-id resolves to the builder and exposes the id; a non-SiteAdmin is redirected and the nav entry stays hidden; shell renders the named regions.

- [x] **Phase 1 — Template model + RDL round-trip (feature #6 backbone).** ✅
  Pure-TS `ReportTemplate` model (page setup, bands, elements, settings, **version**) with `toRdl()` / `parseRdl()`.
  *Tests:* model → RDL → model round-trips losslessly; stable XML snapshot for a known template; `version` present (supports [I-D08](./Invariants.md)); empty template valid.

### Milestone B — Core editing

- [x] **Phase 2 — Render banded canvas (read-only) + zoom.** ✅
  `reportBuilder/ReportCanvas.tsx` renders the bands (labelled tabs) and each element at X/Y/W/H; binding tokens shown as literal text; pure `reportBuilder/geometry.ts` (`inchesToPx`, `ZOOM_LEVELS`, `zoomIn`/`zoomOut`) drives the toolbar's `− 100% +` control. A stand-in `reportBuilder/sampleTemplate.ts` populates the canvas until the Insert palette (Phase 5) and backend (Phase 13) exist; band display names live in `reportBuilder/bandLabels.ts`.
  *Tests:* default template renders each band + element at expected text/position; zoom changes scale. ✅

- [x] **Phase 3 — Select element + Properties/Data panels (read) + status bar.** ✅
  Canvas elements are selectable buttons (`aria-pressed`, outline when selected); clicking the empty page deselects. `reportBuilder/PropertiesPanel.tsx` reflects the selection across **Properties** (type/text/X/Y/W/H, geometry in px) and **Data** (binding expression) tabs; `reportBuilder/StatusBar.tsx` shows `Zoom · Selected: … · X Y · Page 1 of N`. Pure helpers in `reportBuilder/elementDisplay.ts` (`ELEMENT_TYPE_LABELS`, `toDisplayPx`) and `findElement` in `model.ts`.
  *Tests:* click selects & populates panel + status bar; empty-canvas click deselects; tab switch; px conversion. ✅

- [x] **Phase 4 — Edit properties (write).** ✅
  Text + geometry (X/Y/W/H, px) **and** styling — Font, Size (pt), Weight, **B**/*I*/U, alignment, Fill — edit the selected element via the Properties panel and mutate the model (`reportBuilder/model.ts` `updateElement`); the canvas re-renders and RDL reflects the change. `ElementStyle` was added to `ReportElement` and serialized losslessly to a real RDL `<Style>` block (`toRdl`/`parseRdl`). Font size maps points→px on canvas (`reportBuilder/geometry.ts` `pointsToPx`), styling→CSS via `reportBuilder/elementStyleCss.ts`. The working `template` is held in `ReportBuilderScreen` state. (Styling terms are generic presentation vocabulary — no new UbiquitousLanguage entries needed. Alignment is L/C/R; RDL `TextAlign` has no Justify.)
  *Tests:* text/geometry/style edits reflect on the canvas; `updateElement` immutability; full + partial style RDL round-trip; px↔inches and pt→px conversions.

- [x] **Phase 5 — Insert palette adds elements** (desktop sidebar + mobile `+ Insert` sheet). ✅
  `ElementType` extended to the full palette — text (Label/Formula/Data Field), shapes (Line/Rectangle/Triangle/Ellipse), media (Image/Barcode) and advanced containers (Sub Report/Table/Chart/Page Break); advanced/media types render as labelled placeholder blocks on the canvas (`reportBuilder/ReportCanvas.tsx`), shapes draw via CSS, and all round-trip through RDL (their kind is carried by the `rk:Element` marker, so they serialize as `<Rectangle>`). Palette contents/order/grouping live in pure data (`reportBuilder/palette.ts`); the shared `reportBuilder/InsertPalette.tsx` renders the groups (with an optional label filter) for both the desktop sidebar and the mobile `reportBuilder/InsertSheet.tsx` (a bottom sheet with a "Search tools…" box). Model helpers `createElement`, `nextElementId`, `addElement`, `bandKindOf` (`reportBuilder/model.ts`) build, id and place an element immutably; `ReportBuilderScreen` inserts into the **active band** (the selection's band, else the first band) and selects the new element. Element labels come from `ELEMENT_TYPE_LABELS`; element-type names are generic designer vocabulary (no new UbiquitousLanguage entries, per the Phase 4b precedent). **Refinement:** the desktop sidebar is a slim **icon-only rail** (`InsertPalette compact` — labels become `title` tooltips, group headings drop, width 72px) while the mobile sheet keeps full labels + search; palette items are **draggable onto the canvas** — each carries its type via a custom drag MIME (`reportBuilder/dnd.ts` `ELEMENT_DRAG_MIME` + `isElementType` guard), and `ReportCanvas` bands are drop targets that compute the in-band position (`reportBuilder/geometry.ts` `pxToInches`) and call `onInsertAt(type, band, {x,y})`, which the screen places (clamped ≥0) and selects. Click-to-insert (active band) still works alongside drag-to-place.
  *Tests:* palette item adds a selected element of that type; insert lands in the active band (selection's band / first band when none); compact rail exposes tooltips; items are draggable and carry their type; dropping on a band inserts at the drop position (zoom-scaled) and selects it; unknown drop payloads are ignored; mobile sheet opens, search filters case-insensitively, insert selects + closes the sheet, backdrop dismisses; new types round-trip in RDL and render on the canvas. ✅

- [ ] **Phase 6 — Move & resize on canvas.** 🟡 (move done; resize pending)
  **Move done** — dragging a placed element repositions it live. Implemented with **native pointer events** (`pointerdown`/`move`/`up` + `setPointerCapture`) rather than react-rnd, to keep canvas elements as accessible `<button>`s with their tested geometry, get live drag feedback, and avoid a dependency. Pure `reportBuilder/geometry.ts` `draggedPosition(start, deltaPx, zoom)` (pixel delta → inches, clamped ≥0) drives it; `ReportCanvas` exposes `onMoveElement(id, {x,y})` → `ReportBuilderScreen.handleMove` → `updateElement`. **This deviates from the locked react-rnd decision (below); resize + grid-snap (Phases 7–8) may still adopt react-rnd — pending owner.**
  *Tests:* drag reports new X/Y (zoom-scaled); clamps at the band origin; a non-primary button doesn't drag; pointer-up with no drag is a no-op; screen-level drag moves + selects the element; `draggedPosition` unit-tested. ✅ *(move)* — **resize handles still to do.**

### Milestone C — The six headline features

- [ ] **Phase 7 — Snap to grid (#3).** ⬜
  Toggle + grid size (8px), grid overlay, move/resize snap; status bar `Snap: On · Grid 8px`.
  *Tests:* pure `snap(value, grid, enabled)`; dragging with snap on lands on grid; setting round-trips in RDL.

- [ ] **Phase 8 — Multi-select + alignment/distribution across groups (#4).** ⬜
  Shift-click/marquee select; align L/C/R/T/M/B + distribute; smart guides while dragging.
  *Tests:* pure align/distribute functions (alignLeft → shared min X; distribute → equal gaps); toolbar action moves all selected; guide appears within tolerance.

- [ ] **Phase 9 — Functions & expressions (#5).** ⬜
  Expression model + evaluator (`{Facility.Name}`, `SUM({Record.Tons})`, `Page {n} of {N}`); Formula editor + Data Field binding dropdown; invalid expressions flagged.
  *Tests:* pure parse+eval over a sample data context (field resolve, SUM over detail rows); unknown field → error marker; dropdown lists available fields.

- [ ] **Phase 10 — Multiple pages & page setup (#1).** ⬜
  Page size/orientation/margins, Page Break element, page boundaries, page navigator (`Page 1 of 2`).
  *Tests:* page break increases page count; navigator switches page; page count in status bar; persists in RDL.

- [ ] **Phase 11 — Page-number options (#2).** ⬜
  Page-number tokens + options UI (show/hide, format, start-at, footer position).
  *Tests:* footer renders tokens; toggle off removes them; format/start-at change output; options round-trip in RDL.

### Milestone D — Close the loop

- [ ] **Phase 12 — Undo/Redo + Save (emit RDL, #6 end-to-end) + Preview.** ⬜
  History over edits; Save serializes to RDL (in-memory + download/stub for now); Preview = read-only paginated render using Phase 9 eval + Phase 10 pagination.
  *Tests:* edit → undo → redo; Save emits expected RDL; Preview paginates and evaluates bindings.

---

## Deferred — Backend (Phase 13, not "just the UI")

Out of the current front-end scope; recorded so it isn't lost.

- **Domain `ReportTemplate`** — **platform-owned (no `OrgId`)**: templates are shared and SiteAdmin-authored. The produced *Report* instance is Org-scoped ([I-D10](./Invariants.md)); the template definition is not.
- **Application** — commands/queries (create / update / get) returning `ErrorOr<T>`.
- **Infrastructure** — EF persistence of the RDL blob + template `version` ([I-D08](./Invariants.md)).
- **Security** — a real `SiteAdmin` authorization policy + cross-Org audit ([I-D13](./Invariants.md)). The API currently only has a TODO for this; it is a launch blocker.
- **Client** — `reportTemplatesApi` wired to Save/Load (replacing the Phase 12 in-memory stub).
- **Later** — the Report Engine renders RDL → PDF for [I-D09](./Invariants.md) parity.

---

## Open questions

- **RDL subset boundary** — exactly which RDL elements we support v1 (Tablix vs. simple list for Detail; which chart/barcode types).
- **Page setup defaults** — default page size (US Letter vs A4) and margins.
- **Page-number defaults** — default format (`Page {n} of {N}`) and whether footer page numbers are on by default.
- **Pre-backend Save target** — does Phase 12 Save download a `.rdlc` file, hold it in memory, or POST to a stub endpoint?

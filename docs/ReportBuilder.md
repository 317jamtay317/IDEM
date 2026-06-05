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

> **Update (2026-06-05) — react-rnd not adopted (owner-confirmed).** Phases 6–8 shipped with **native pointer events** — move/resize (6), grid-snap (7), align/distribute (8a) and now marquee + smart guides (8b) — preserving the accessible-`<button>` canvas and its tested geometry and avoiding a dependency. The owner **confirmed native for Phase 8** (the smart-guides decision point); react-rnd is **not installed** and not planned. Snapping and guides are pure math layered on the existing move/resize; marquee is pure rect-intersection. Palette→canvas insertion uses native HTML5 drag-and-drop (a separate mechanism from element move).

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

- [x] **Phase 6 — Move & resize on canvas.** ✅
  Dragging a placed element repositions it live; the selected element shows four corner **resize handles** that resize it live. Implemented with **native pointer events** (`pointerdown`/`move`/`up` + `setPointerCapture`) rather than react-rnd, to keep canvas elements as accessible `<button>`s with their tested geometry, get live feedback, and avoid a dependency. Pure math in `reportBuilder/geometry.ts`: `draggedPosition(start, deltaPx, zoom)` (clamped ≥0) for move; `resizedRect(start, handle, deltaInches)` (moves only the dragged corner's two edges; clamps so the rect never inverts and stays on the page) for resize. `ReportCanvas` exposes `onMoveElement(id,{x,y})` and `onResize(id, rect)`; handles render only on the selected element. `ReportBuilderScreen.handleMove`/`handleResize` → `updateElement`. **Deviates from the locked react-rnd decision (below); grid-snap (Phase 7) may still adopt react-rnd — pending owner.** Phone stays select + property-edit.
  *Tests:* move reports new X/Y (zoom-scaled) + clamps at origin; resize from each corner (`resizedRect` unit-tested, incl. collapse + origin clamp); non-primary button doesn't drag/resize; pointer-up/move with no gesture is a no-op; handles show only when selected and swallow their click; screen-level drag moves+selects and a corner-handle drag widens the element. ✅

### Milestone C — The six headline features

- [x] **Phase 7 — Snap to grid (#3).** ✅
  A toolbar **Snap** toggle and a **Grid size** picker (6 / 12 / 24 px ⇒ 1/16″, 1/8″, 1/4″) drive `template.settings.snapToGrid` / `gridSize` (the model already carried them; the default is on at a 1/8″ = 12px grid). The canvas shows a hairline **grid overlay** when snapping is on (cell size tracks the zoom), and move/resize snap the dragged corner/edges to the grid — pure `reportBuilder/geometry.ts` `snap(value, grid, enabled)`, composed into `draggedPosition`/`resizedRect` (new optional `grid`/`snapEnabled` args, default off so prior callers are unchanged). The status bar reads `Snap: On · Grid 12px` / `Snap: Off`. Settings serialize losslessly in RDL (built in Phase 1; an explicit non-default round-trip test now guards it). Snap stayed on **native pointer events** (consistent with Phase 6; no react-rnd needed — snapping is pure math). `model.ts` gained `updateSettings(template, patch)` (immutable settings merge). Grid spacing is presented in display px (`elementDisplay` `toDisplayPx`/`fromDisplayPx`) to match the rest of the UI; the model stays in inches.
  *Tests:* pure `snap` (round to nearest cell, half-cell-up, disabled / zero-grid passthrough); `draggedPosition`/`resizedRect` snap the dragged position/edges when enabled and pass through when off; `updateSettings` merges immutably; canvas snaps move + resize when on and not when off; grid overlay shows/hides and is sized to the grid; status bar shows the snap readout; toolbar toggle flips snap and the grid-size picker changes the cell; a screen drag lands on the grid; snap settings round-trip in RDL. ✅

- [x] **Phase 8 — Multi-select + alignment/distribution across groups (#4).** ✅
  Shift-click/marquee select; align L/C/R/T/M/B + distribute; smart guides while dragging.
  *Tests:* pure align/distribute functions (alignLeft → shared min X; distribute → equal gaps); toolbar action moves all selected; guide appears within tolerance.
  - [x] **Phase 8a — Multi-select + align/distribute.** ✅
    The canvas selection is now a set of ids (`reportBuilder/ReportCanvas.tsx` `selectedIds`): a plain click/press replaces it, a modified press (Shift/Ctrl/Cmd) toggles an element in or out, and an empty-canvas click clears it; a modified press selects without starting a drag. Every selected element shows pressed; resize handles appear only on a lone selection. The `reportBuilder/StatusBar.tsx` and `reportBuilder/PropertiesPanel.tsx` summarise a multi-selection by count (`selectedCount`) and the single-element editor is shown only when exactly one is selected. Alignment and distribution are pure math in `reportBuilder/align.ts` — `alignRects(rects, edge)` (left/center/right = min X / max right / mid-X; top/middle/bottom the vertical analogues, over the selection's bounding box) and `distributeRects(rects, axis)` (equal gaps, extremes fixed, ≥3 items). A toolbar **Arrange** group (`role=group`) offers the six align actions (enabled with ≥2 selected) and two distribute actions (≥3), applied across bands in one immutable update via `model.ts` `updateElementRects`. Because every band shares the page's left x-origin, **horizontal** alignment/distribution is correct *across groups* (the headline column-alignment case); **vertical** alignment is band-relative (exact within a band — a documented limitation when a selection spans bands, since the model stores band-relative `y`). Native pointer events throughout (no react-rnd; align is button-driven). Each icon-only Arrange button carries a `title` tooltip matching its `aria-label`, so the glyphs are discoverable on hover (a disabled button shows none, as browsers suppress tooltips on disabled controls). 383 client tests green (was 349); `reportBuilder` dir 100% stmts/funcs/lines, overall 91.35% stmts / 86.7% branch / 92.61% lines (≥80% gate met); `tsc -b` + eslint clean on touched files.
  - [x] **Phase 8b — Marquee (rubber-band) select + smart guides.** ✅
    A pointer drag on the empty canvas rubber-bands a selection rectangle and selects every element it intersects, replacing the selection (a press-release in place clears it); while an element is dragged, thin alignment guides appear wherever one of its edges or centre lines comes within tolerance of another element's. Both reach **across bands**: the canvas lifts band-relative rects into page-absolute coordinates (`reportBuilder/geometry.ts` `bandTops`) before hit-testing. The math is pure and isolated — `reportBuilder/marquee.ts` (`marqueeRect` normalises a drag's two corners, `rectsIntersect`, `marqueeSelect` keeps document order) and `reportBuilder/guides.ts` (`alignmentGuides` compares the moving rect's left/centre/right and top/middle/bottom lines against the others within a pixel tolerance converted to inches, de-duplicating shared guides). `ReportCanvas` owns the live marquee rectangle and guide overlays (`.rb-marquee` / `.rb-guide`, `pointer-events: none` on a `position: relative` page) and gained an `onMarqueeSelect(ids)` callback the screen maps to the selection; the empty-canvas deselect moved from `onClick` to a no-drag pointer-up so a click still clears while a drag marquees. **react-rnd-vs-native call: native, confirmed by the owner** (consistent with Phases 6–8a; no dependency). Guides are visual only in v1 — they do not snap the element (grid-snap remains the snapping mechanism); guide rendering uses page-absolute coordinates, so a horizontal guide can sit a band-border pixel or two off the element it references (cosmetic, documented). 417 client tests green (was 383); `reportBuilder` dir 100% stmts/funcs/lines, 94.23% branch; overall 91.96% stmts / 87.27% branch / 93.14% lines (≥80% gate met); `tsc -b`, `eslint` and `vite build` all clean on touched files.

- [x] **Phase 9 — Functions & expressions (#5).** ✅
  The designer-side expression dialect and its editor. An expression is literal text interleaved with three token kinds — a field reference `{Scope.Field}` (`{Facility.Name}`, `{Record.Tons}`), a page-number token `{n}`/`{N}`, and an aggregate function over a detail field (`SUM`/`AVG`/`COUNT`/`MIN`/`MAX`, e.g. `SUM({Record.Tons})`). Pure `reportBuilder/expressions.ts` parses an expression into ordered segments (`parseExpression`), evaluates it against a `DataContext` (`evaluateExpression` — singular fields resolve from their scope, detail fields from the first detail row, page tokens substitute the page numbers, functions fold a detail field over every row), and validates it against the field catalog (`validateExpression` — unknown field/function, an aggregate over a non-detail field, or a malformed token, all reported in source order). `reportBuilder/sampleData.ts` supplies the sample field catalog (`SAMPLE_FIELDS`, grouped by scope) and a sample `DataContext` (`SAMPLE_DATA_CONTEXT`) mirroring the *Annual Emissions Inventory* template, so every expression that template authors both validates and previews cleanly. The Properties panel's **Data** tab is now a `reportBuilder/DataBindingEditor.tsx`: a `dataField` binds through a **Field dropdown** (grouped `<optgroup>` per scope, preselected to the bound field); a `formula` is written in a **formula editor** text input, with an aggregate-function hint and an **Insert field** dropdown that appends a token; both show a live **Preview** evaluated against the sample data, or flag the binding with an `role="alert"` error marker when the expression is invalid. A binding keeps the element's display token in sync with its expression (the common case); a richer display string remains authorable via the Properties **Text** field. The canvas still shows binding tokens verbatim — resolving them on the canvas is Preview's job (Phase 12). RDL is unchanged: the designer expression already round-trips losslessly via the `rk:Element@expression` attribute (Phase 1); mapping designer tokens to real RDL expressions (`=Fields!Tons.Value`, `=Sum(...)`, `=Globals!PageNumber`) stays a Save-boundary concern (Phase 12). Native, no new deps. 463 client tests green (was 417); `reportBuilder` dir 100% stmts/funcs/lines (94.62% branch), overall 92.71% stmts / 88.19% branch / 93.8% lines (≥80% gate met); `tsc -b` and `eslint` clean on touched files.
  *Tests:* pure parse+eval over a sample data context (field resolve, SUM over detail rows); unknown field → error marker; dropdown lists available fields. ✅

> **Editing affordances added alongside Phase 9 (user-requested, outside the phase plan).** Two gaps in the canvas editor were filled after Phase 9 landed:
> - **Delete element.** A toolbar **Delete** button (enabled with ≥1 selected) and the **Delete/Backspace** key remove the whole selection and clear it; `reportBuilder/model.ts` `removeElements(template, ids)` filters the named elements out of every band in one immutable update (no-op for empty/unknown ids). The key handler ignores Delete/Backspace while a form field (input/select/textarea/contentEditable) has focus, so those keys still edit text there.
> - **Inline text editing.** **Double-click** a text element (label / data field / formula) to edit its content in place on the canvas, as an alternative to the Properties **Text** field. `reportBuilder/ReportCanvas.tsx` swaps the element for an inline input (new `onEditText(id, text)` callback); edits commit live, Enter/blur close the editor, and Escape reverts to the text it held when editing began. Inline editing drives the element's **display text** (in sync with the Properties **Text** field); the **Data** tab still edits the binding **expression**.
>
> Both are native (no new deps) and fully tested. 485 client tests green; `reportBuilder` dir 100% stmts/funcs/lines; overall 92.87% stmts / 88.18% branch / 94% lines (≥80% gate met); `tsc -b` + eslint clean.

- [x] **Phase 10 — Multiple pages & page setup (#1).** ✅
  Page size, orientation and margins, plus a page navigator driven by Page Break elements. Pure `reportBuilder/pageSetup.ts` holds the page logic: the named size presets (`PAGE_SIZES` — Letter / Legal / A4 / Tabloid, dimensions in portrait), `orientationOf` (landscape when wider than tall), `pageSizeNameOf` (the matching preset within a small tolerance, else `'custom'`), `applyPageSize`/`applyOrientation` (which preserve orientation / re-order the two dimensions, keeping the margins), and `pageCount` (one, plus one per Page Break element across all bands). **Orientation is not a stored field** — it is implied by the page width vs. height (RDL's own convention), so it round-trips through the existing `<Page>` `PageWidth`/`PageHeight` with no change to `rdl.ts`. `model.ts` gained `updatePage(template, patch)` (immutable page merge, sharing bands/settings by reference). The Properties panel shows a new `reportBuilder/PageSetupEditor.tsx` whenever nothing is selected — a page-size dropdown, a Portrait/Landscape toggle, and four margin inputs (shown in **inches**, the conventional page-setup unit, rather than the pixels used for element geometry) — so the document's print geometry is always one click away; the screen swaps it for the element `PropertiesPanel` once something is selected. A toolbar **Pages** navigator (`role=group`, Previous/Next buttons + a `Page n / N` readout) steps the current page, disabled at the ends; `ReportBuilderScreen` owns `currentPage`, clamps it back into range when a Page Break is deleted (the "adjust state during render" form), and feeds `currentPage`/`pageCount` to the status bar (`Page n of N` — no longer fixed at 1 since Phase 3). **Page count is driven by explicit Page Breaks** rather than automatic content flow, since the designer has no data at design time; the produced Report paginates over real data at render time (Phase 13). At design time a Page Break renders as the page boundary it represents (the dashed `.rb-el-pageBreak` rule from Phase 5). Native, no new deps; `rdl.ts` unchanged (page setup and Page Break elements already round-tripped — guarded by new explicit round-trip tests). 526 client tests green (was 485); `reportBuilder` dir 100% stmts/funcs/lines (94.49% branch), overall 93.1% stmts / 88.58% branch / 94.16% lines (≥80% gate met); `tsc -b`, `eslint` and `vite build` all clean on touched files.
  *Tests:* pure `orientationOf`/`pageSizeNameOf`/`applyPageSize`/`applyOrientation`/`pageCount`; `updatePage` immutability; page setup + Page Break round-trip in RDL; status bar shows the current page of the count; `PageSetupEditor` preselects size/orientation/margins and reports size/orientation/margin edits; the navigator counts a Page Break as a page, switches the current page, disables at the ends, and clamps when a break is deleted; rotating to landscape widens the canvas. ✅

> **Drag-to-resize the page (added alongside Phase 10, user-requested).** Besides the Page Setup panel, the page can now be resized directly by dragging grips at its right edge (width), bottom edge (height) and bottom-right corner (both) — the natural "resize the canvas" gesture. Pure `reportBuilder/geometry.ts` `resizedPageSize(start, delta, handle, min)` does the math (only the dragged edge(s) move; each dimension clamps to a minimum so the page never collapses below its band content); `ReportCanvas` renders the grips and an `onResizePage` callback the screen maps to `updatePage`, and the page is now drawn at least as tall as its page setup (so the bottom grip is meaningful and the sheet reads as a real page). A custom drag shows the size as **Custom** in the Page Setup dropdown. Native pointer events, consistent with Phases 6–8. 539 client tests green; `reportBuilder` dir 100% stmts/funcs/lines.

- [x] **Phase 11 — Page-number options (#2).** ✅
  Footer page numbers are now a document-level option set on the template
  (`model.ts` `PageNumberOptions` + `DEFAULT_PAGE_NUMBER_OPTIONS`: shown, `Page {n} of {N}`,
  starting at 1, right-aligned) rather than a hand-placed element — so show/hide, format,
  start-at and footer position are configured in one place. Pure `reportBuilder/pageNumbers.ts`
  resolves a format to a concrete string for a given page (`formatPageNumber`, offsetting the
  `{n}`/`{N}` tokens by the start-at number) and lists the placements the editor offers
  (`PAGE_NUMBER_POSITIONS`). The options live on `ReportTemplate.pageNumbers`, are merged
  immutably by `model.ts` `updatePageNumbers`, and round-trip losslessly through a custom
  `rk:PageNumbers` RDL element (defaulting when absent, so older RDL still parses). The
  `PageSetupEditor` (shown when nothing is selected) gained a **Page Numbers** section — a
  show toggle, a format field, a start-at number and a position dropdown — and `ReportCanvas`
  renders the footer page number in the page-footer band when shown, at its position, with the
  `{n}`/`{N}` tokens left **verbatim** (consistent with every other binding token; Preview
  resolves them — Phase 12). The sample template dropped its hand-placed `page-number` formula
  in favour of the options and gained a `SUM({Record.Tons})` total-tons formula in the
  sub-report band (so the canvas still exercises an aggregate formula). Native, no new deps;
  `rdl.ts` round-trip guarded by new tests. 564 client tests green (was 539); `reportBuilder`
  dir 100% stmts/funcs/lines; `tsc -b`, `eslint` and `vite build` clean on touched files.
  *Tests:* `formatPageNumber` substitutes/offsets the tokens; canvas footer renders the format
  and hides when off; format/position edits reflect on the canvas; the editor reports each
  option edit; options round-trip in RDL (and default when the RDL omits them). ✅

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
- ~~**Page setup defaults** — default page size (US Letter vs A4) and margins.~~ **Resolved (Phase 10):** US Letter portrait with one-inch margins (`createEmptyTemplate`); the editor offers Letter / Legal / A4 / Tabloid and Portrait/Landscape. Pages are driven by explicit Page Breaks (no automatic content flow at design time).
- ~~**Page-number defaults** — default format (`Page {n} of {N}`) and whether footer page numbers are on by default.~~ **Resolved (Phase 11):** footer page numbers are **on by default**, `Page {n} of {N}`, starting at 1, right-aligned (`DEFAULT_PAGE_NUMBER_OPTIONS`); all four are editable in the Page Numbers section of the Page Setup panel.
- **Pre-backend Save target** — does Phase 12 Save download a `.rdlc` file, hold it in memory, or POST to a stub endpoint?

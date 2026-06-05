# Ubiquitous Language

The terms below are the shared vocabulary for **RecordKeeping**. Code, conversations, UI copy, tests, and documentation must use these exact terms. Do not introduce synonyms (e.g., do not call an Org a "Company" or a "Tenant" in code — "Tenant" has a different specific meaning, see below).

This document is a living source of truth. When a term is added, renamed, or clarified, update it here first, then update the code.

> **Status legend**
> - ✅ Confirmed with the product owner
> - 🟡 Tentative — used pending confirmation
> - ❓ Open question — not yet decided

---

## v1 Design Target

### Rieth-Riley Construction Co. ✅
The first Org the v1 build is designed to land. A multi-plant asphalt / paving contractor operating plants across Indiana and Michigan (public info: headquartered in Goshen, IN).

Canonical spelling: **Rieth-Riley** — hyphenated, R-I-E-T-H. Used everywhere: Org settings, contracts, emails, code, tests.

**Existing relationship:** the legacy WPF RecordKeeping app has been developed for and used by Rieth-Riley for ~12 years, with continuous feedback and support from them. The SaaS rewrite is, in effect, *the same tool they already know* — hosted, multi-Org, modernized. This reshapes v1 in important ways:

- Domain knowledge already exists — entities, workflows, and reports are encoded in the legacy app and in the developer's relationship with the customer. We don't need to invent the domain; we need to elicit and codify it.
- Parity matters — existing Reports must reproduce faithfully (see I-D09), because Rieth-Riley's compliance team is already trained on them.
- Migration is a first-class deliverable — Rieth-Riley's existing data and configuration come over to the SaaS at go-live, ideally with no perceived loss.
- The product can be **co-designed with the customer**, not pitched cold. "What's painful today?" is a question with a known person to ask.

**Forcing function for v1 scope:** the design test is *"would this make sense for Rieth-Riley?"* — not *"would this make sense for every possible asphalt company."* Multi-Org architecture is retained (more customers come later), but feature priority tracks Rieth-Riley's actual workflow.

---

## Customers & Identity

### Org ✅
The subscribed customer that owns the data within RecordKeeping. In the v1 target market, an Org is an **asphalt company**.

An Org has many Users and (🟡) one or more Facilities. Every Record and Report belongs to exactly one Org.

> Do not call this: "Company", "Account", "Customer", "Organization", or "Tenant" in code. **Org** is the canonical class name, table name, API path, and prose term. "Organization" may appear in user-facing UI copy where the full word reads better.

### Tenant 🟡
A reference to an external **Entra ID directory** that an Org has federated for single sign-on. Stored as a nullable GUID on the Org (`Org.TenantId`), set only when the Org configures Entra ID federation; null for Orgs that authenticate locally.

> "Tenant" here is **Microsoft's** vocabulary from Entra ID / Azure AD — it identifies a directory. Using it consistently means anyone with Entra ID experience can recognize what the field represents. Do not use "Tenant" to mean the customer entity; that is **Org**.

### User ✅
A person who authenticates against RecordKeeping. Identified by email.

A User is either:
- **Org User** — belongs to exactly one Org via `OrgId`. The day-to-day users who log Records and run Reports.
- **SiteAdmin** — platform operator with no `OrgId`, who administers Orgs across the system (create, suspend, support). Not a customer; an employee of the platform.

### Role 🟡
A User's permission set. For Org Users, scoped within their Org. For SiteAdmins, system-wide.

❓ — Concrete role list (e.g., Admin / Operator / Read-only) needs domain-owner input.

### Facility ✅
A physical location operated by an Org where regulated activity occurs. For asphalt customers, this is an asphalt plant.

An Org has **many** Facilities. (Rieth-Riley operates ~15–20 plants across IN and MI.)

Facilities may be **stationary** or **portable**. Portable plants are relocated to follow large paving jobs, so a Facility carries a location *history*, not just a single fixed-location attribute.

❓ — Lifecycle details still open: permit attachment, decommissioning, and cross-Org transfer. Cross-Org transfer is assumed out-of-scope for v1 (see I-D06).

### Permit ✅
A regulatory authorization a Facility holds in order to operate. For asphalt plants this is the **air-emission permit** issued by the Facility's Regulator (MDEQ / IDEM). A Permit has an **expiration date** and a **value** (the permit number / identifier).

A Facility may hold more than one Permit over time — typically a current Permit and its renewal. Two derived notions are used in code:

- **Active Permit** — the Permit with the latest expiration date (the one that keeps the Facility covered furthest into the future).
- **Permit in force on a date** — among the Permits still valid on that date (expiration on or after it, inclusive), the one expiring earliest.

> Do **not** call this a "License" in code, tests, or UL. The legacy app and the Regulators speak of **permits** (air permits, permit deviations, permit limits); **Permit** is the canonical term. The first implementation shipped under the name "License" and was renamed to match this vocabulary.

❓ — Open: (a) does a Facility require ≥ 1 Permit *at all times* (i.e. at creation), or only that its last Permit cannot be removed once it has one (see I-D18)? (b) Is the "expired on add" check (I-D17) compared against the server date or the Facility's local date? (c) Is `value` simply the permit number, or are issue-date / permit-type / Regulator fields needed for v1?

### Monthly Limit 🟡
A per-calendar-month cap, in **tons**, on a Facility's emission of a single `Emission Type`. A Facility may hold several Monthly Limits — **at most one per Emission Type** (I-D18 is for Permits; this rule is I-D19) — and the tons value of each is editable; the value must be positive (I-D20). A Monthly Limit is attached to its Facility (it is part of the Facility aggregate, like a Permit).

> The unit is **always tons per calendar month**. The legacy sketch's unit-like entries ("Tons", "FUEL") are *not* Emission Types and have been dropped. **Monthly Limit** is the canonical term in code, API, and UI.

❓ — Confirm the calendar-month vs. rolling-12-month basis, and the exact Emission Type set, with the domain owner.

### Emission Type 🟡
The pollutant a `Monthly Limit` constrains. The v1 set, carried over from the legacy app, is **VOC**, **HCl**, **SO2**, **NOx**, **CO2** (canonical casing). Modeled in code as the `EmissionType` enum.

❓ — Confirm this is the complete, correct pollutant set for asphalt plants — e.g. whether **PM / PM10 / CO** belong here, and whether **CO2** is genuinely tracked as a monthly air-emission limit (it is unusual for a minor air source).

---

## Regulators

### Regulator ✅
A state environmental agency that requires Orgs to file Reports. For v1, exactly two:

- **MDEQ** — Michigan Department of Environmental Quality.
  - ❓ Michigan renamed MDEQ → **EGLE** (Department of Environment, Great Lakes, and Energy) in 2019. Decide whether the canonical UL term is `MDEQ` (legacy, may still be on forms) or `EGLE` (current). Use one, not both.
- **IDEM** — Indiana Department of Environmental Management.

### MAERS 🟡
**M**ichigan **A**ir **E**missions **R**eporting **S**ystem. Annual emissions inventory submission required of permitted air sources in Michigan.

❓ — Is MAERS the dominant Report for Michigan Orgs, or are daily / monthly site logs the painful artifact customers will pay to stop doing on paper?

### (Indiana equivalent) ❓
IDEM's annual / periodic air emissions filing for asphalt sources — concrete name TBD with domain owner.

---

## Domain — Asphalt Operations 🟡

### Asphalt Plant 🟡
The regulated facility type for v1 customers. Produces hot mix asphalt (HMA). Subject to air emission permits and likely also stormwater, SPCC/AST, and other media regulations.

❓ — Confirm the full scope of regulated media: air only, or air + stormwater + SPCC + USTs?

### Production Field ✅
One entry in the platform-wide **catalog** of data points that can be captured on a Record — e.g. *Hot Mix*, *Waste Oil*, *Baghouse Pressure Drop*. The catalog is the source of truth for *which* fields exist; Record values (a later slice) are stored sparsely, keyed by a field's immutable `PropertyName`.

Each Production Field carries:
- **PropertyName** — the stable, machine-facing key (e.g. `HotMix`). Required, **immutable**, and unique (I-D21). Record values are stored against it, so it must never change.
- **FriendlyName** — the human-facing label shown wherever a user picks or searches for a field (e.g. "Hot Mix"). Editable; unique among active fields so a search result is unambiguous (I-D22).
- **Description** — optional help text explaining what the field captures.
- **DataType** — `Decimal`, `Integer`, `Boolean`, or `Date` (the value kinds carried over from the legacy plant-pollution record).
- **Category** — optional grouping for the field picker (e.g. *Mixes*, *Fuels & Burners*, *Oil Heaters*, *RAP*, *Baghouse*).
- **Summary** — whether the field appears in summary views and Reports by default (the legacy `IsSummaryProperty`).
- **Active** / **Display order** — whether the field is offered for new Records, and its position in the picker.

The catalog is **platform-global and SiteAdmin-managed**: the same fields are offered to every Org, and only a SiteAdmin may add, rename, or retire one. It is therefore *not* Org-scoped, and I-D03 does not apply to it. This is also the field vocabulary the Report Template designer binds to.

> **Naming note.** This supersedes the earlier tentative "Production Fields" entry. Many fields are production quantities (tons of mix, hours run), but the catalog also holds non-production points (sulfur %, BTU/gal, baghouse inlet temperature, pressure drop). The entity name **Production Field** is confirmed; the full field *set* stays 🟡 until the seeded catalog is reviewed with the domain owner.

Representative fields (tons unless noted):
- **Hot Mix** / **Cold Mix** — hot- and cold-mix asphalt produced.
- **Steel Slag** / **Blast Furnace** — slag aggregates. 🟡
- **Plant Ran** — hours the plant operated that day (0 when idle); "Plant" is customer-facing copy for the Facility's plant, not the `Facility` entity. 🟡

❓ — Confirm the seeded field set and, for **Plant Ran**, whether it is recorded as hours or a yes/no flag.

### Production Field Limit 🟡
An Org's configured acceptable range for the values recorded against a single **Production Field**, keyed by that field's immutable `PropertyName`. It carries a **low limit** and a **high limit** (a `decimal` range) and a **Limit Unit**. A recorded value below the low limit or above the high limit is an **Exceedance**.

Unlike the **Production Field** catalog (which is platform-global and SiteAdmin-managed), a Production Field Limit is **Org-scoped** (I-D03): each Org sets its own limits, and an Org holds at most one limit per field (I-D24, low ≤ high per I-D25). Editing a limit changes only its bounds and unit; the field it applies to is fixed.

> Authoring of limits is intended for the (not-yet-built) Org Admin area; the backend — Org-scoped set/read endpoints under `/me/org/production-field-limits` and persistence — exists ahead of that UI.
>
> ❓ — Confirm: may a bound be open-ended (only a high, or only a low)? Must bounds be non-negative? Is "percentage vs tons" the right unit set, or is a richer unit/dimension needed?

### Limit Unit 🟡
How a **Production Field Limit**'s bounds are expressed: **Percentage** or **Tons** (an absolute quantity). Tentative — the real unit set is pending domain-owner confirmation.

### Exceedance 🟡
A recorded value that falls outside its Production Field's configured range for the Org — below the **low limit** or above the **high limit** of the applicable **Production Field Limit**. The range is inclusive, so a value equal to a bound is not an exceedance. The records read model now carries each numeric value's status (`Within`/`Below`/`Above`, computed against the caller's own Org limits per I-D03; `null` when no limit is configured); surfacing it on the client records views and feeding it into Reports remain.

### (Record subtypes) ❓
Concrete Record types cannot be named until the dominant compliance burden is identified with the domain owner. Candidates that may apply (do not adopt until confirmed):

- Production Log (daily tons produced, fuel burned, AC used)
- Opacity Reading (Method 9 visible emissions)
- Baghouse Pressure Drop reading
- Fuel Consumption Entry
- Emissions Calculation
- Permit Deviation
- Stack Test record
- Stormwater Inspection

---

## Records & Reporting

### Record ✅
A persisted data entry made by a User on behalf of an Org, capturing a compliance-relevant fact. The concrete subtypes of Record are domain-specific and listed above (pending confirmation).

A Record is made *for a specific Facility on a specific date* and there is **at most one per Facility per date** (I-D23). Its owning Org (I-D01), Facility (I-D07), and date are fixed at creation. A Record holds its field values sparsely — see **Record Value**.

### Record Value ✅
A single field's value on a Record, keyed by a **Production Field**'s immutable `PropertyName` (I-D21). A Record stores its values **sparsely** — only the fields actually entered for that day, not a row per catalog field. Each Record Value carries exactly one typed value matching its field's **DataType**: a numeric value (`Decimal` / `Integer`), a boolean (`Boolean`), or a date (`Date`).

> **Persistence shape (decided).** One `RecordValue` child row per entered field — (`PropertyName`, `NumericValue?`, `BooleanValue?`, `DateValue?`) — with exactly the one value column its DataType dictates populated. Deliberately **not** a wide ~60-column table (the legacy `PlantPollution` shape); the sparse form fits the write-once/read-heavy direction and keeps the Production Field catalog the single source of truth for which fields exist. Numeric values stay in a numeric column so Report totals remain directly summable.

### Report ✅
A produced artifact (PDF, electronic submission file, etc.) derived from Records, intended either for filing with a Regulator or for the Org's internal audit file.

The visual fidelity of existing Reports produced by the legacy WPF app must be preserved in the rewrite (handoff decision).

❓ — Output destinations:
- Agency online portal (electronic submission)?
- Printed and mailed / handed to inspector?
- Kept on file for audit?
- All of the above?

### Report Template 🟡
The definition of a Report's layout, data bindings, and parameters. Authored by RecordKeeping for v1.

**v1 scope (✅):** the legacy app produces **24 distinct Reports** today, all of which must exist as Report Templates in the SaaS at go-live (per I-D09 parity).

❓ — Whether Org Admins can edit Report Templates (in-product report designer) is a v1-vs-v2 scope decision still open. With 24 known Reports and a known first customer, the lean read is *no designer in v1* — bake the 24 in, build the designer when a real customer asks for a specific edit. Not yet decided.

### Report Engine 🟡
The runtime that produces a Report from a Report Template and a set of source Records. Built in-house (handoff decision: no third-party commercial reporting vendor).

---

## Cross-cutting Concepts

### Compliance Period 🟡
A bounded interval — likely calendar year for annual filings, calendar month for monthly logs — over which Records are aggregated into a Report. Concrete periods TBD per Report type.

### Submission ❓
A Report instance that has been (or will be) transmitted to a Regulator, distinct from a Report kept only for the Org's internal records. Whether RecordKeeping models a distinct `Submission` concept depends on whether v1 produces electronic submissions or only printable artifacts.

---

## Integrations & AI Agents

### MCP (Model Context Protocol) ✅
The open protocol RecordKeeping exposes so external **AI Agents** can call into the product. The MCP server is embedded in `RecordKeeping.Api` and speaks the Streamable HTTP transport. See [Architecture.md](./Architecture.md) §MCP.

### Agent ✅
An external AI assistant that connects over MCP on behalf of a User — specifically **Claude**, **ChatGPT**, and **Copilot** for v1. An Agent is *not* a User and has no standing identity of its own: it acts only with an access token obtained when a User logs in. Org isolation (I-D03) applies to an Agent exactly as it does to the User it acts for.

### MCP Tool ✅
A single callable capability the MCP server advertises to an Agent (the MCP equivalent of an API endpoint). Tool names are `snake_case` (e.g., `hello_world`). The v1 slice ships only `hello_world`; domain tools are added per-aggregate as the domain is built.

### Dynamic Client Registration (DCR) ✅
The RFC 7591 flow by which an Agent obtains an OAuth `client_id` automatically on first connection, with no manual configuration. This is what makes Agent onboarding friction-free: a User pastes the MCP URL and logs in; the Agent self-registers. RecordKeeping hardens every dynamically-registered client (public, PKCE-required, auth-code/refresh only, HTTPS/loopback redirects).

### `mcp` scope ✅
The OAuth scope an access token must carry to call MCP Tools. Necessary but not sufficient — Org isolation still applies on top of it (see I-D16).

---

## Out of scope (for this vocabulary)

- **BillingAgent (BA)** — a sibling product owned by the same author. Not integrated with RecordKeeping in v1. Any future BA↔RK bridge will be a sync job, not a shared model. BA terms (`Subscription`, `Invoice`, `Customer` in the BA sense, etc.) are **not** part of the RecordKeeping ubiquitous language.
- Stripe, OpenIddict, and other infrastructure vendor names — these are implementation choices, not domain terms.

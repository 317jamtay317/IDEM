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

### Production Fields 🟡
The per-day quantities captured for an Asphalt Plant, shown in the Records production drill-down. Tentative pending domain-owner confirmation of the full Field set and units:

- **Hot Mix** — hot mix asphalt produced (tons).
- **Cold Mix** — cold mix asphalt produced (tons).
- **Steel Slag** — steel-slag aggregate consumed/produced (tons). 🟡
- **Blast Furnace** — blast-furnace slag aggregate (tons). 🟡
- **Plant Ran** — hours the plant operated that day (0 when idle). 🟡 "Plant" here is customer-facing copy for the Facility's plant, not the `Facility` entity.

❓ — Confirm the canonical Field list and units (tons vs. other), and whether "Plant Ran" is recorded as hours or a yes/no flag.

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

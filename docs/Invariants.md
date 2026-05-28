# Invariants

Business rules that must **always** hold true in **RecordKeeping**.

Each invariant has a stable ID of the form `I-D##`. IDs are referenced from:
- `FluentValidation` rules via `WithErrorCode("I-D##")` so validation failures trace back to a written rule.
- Domain entity / aggregate code as comments near the enforcement point.
- Tests (`[Trait("Invariant", "I-D##")]` or equivalent) so every invariant has at least one test proving it holds.

IDs are **append-only**. If an invariant is retired, mark it as such and keep the ID reserved; do not renumber.

> **Status legend**
> - ✅ Confirmed
> - 🟡 Tentative — used pending confirmation
> - ❓ Open — invariant text cannot yet be written; placeholder for a known gap

---

## Tenancy & Isolation

### I-D01 — Every Record belongs to exactly one Tenant ✅
A Record may not exist without a `TenantId`. A Record's `TenantId` may not change after creation. Cross-Tenant transfer of Records is not a supported operation.

### I-D02 — Every User belongs to exactly one Tenant 🟡
For v1, a User cannot span multiple Tenants. A person who operates two distinct companies needs two accounts (with the same email allowed across Tenants? — see I-D04).

❓ — Confirm this assumption holds for the asphalt market. If an operator commonly works for multiple companies, multi-Tenant Users become a v1 requirement, not a v2.

### I-D03 — Tenant data is never visible across Tenants ✅
No query, report, export, API call, background job, or admin operation may return data belonging to a Tenant other than the caller's. Enforced at the application layer at minimum; preferred to also enforce at the database layer (row-level security or query-level filter).

> Violations of I-D03 are security incidents, not bugs. Tests must cover the negative case (request data as Tenant A, assert no Tenant B data is returned) for every read endpoint.

### I-D04 — Email uniqueness scope 🟡
🟡 — Tentative: a User's email is unique **within a Tenant**, but the same email may appear under different Tenants.

❓ — Confirm with domain owner. The alternative (email globally unique) simplifies SSO/identity later but rules out the "same person, two companies" case.

### I-D05 — A Tenant has at least one active Admin User 🟡
At all times, the count of active Users with the Admin role within a Tenant is ≥ 1. Used to prevent administrative lock-out.

❓ — Depends on the concrete Role list being confirmed (see UbiquitousLanguage `Role`).

---

## Facilities

### I-D06 — Every Facility belongs to exactly one Tenant ✅
Facilities follow the same isolation guarantee as Records (I-D01): `TenantId` is required at creation, immutable, and never crosses Tenants.

A Tenant has **many** Facilities — confirmed by the v1 design target (Rieth-Riley) operating ~15–20 plants. Cross-Tenant transfer of a Facility is not a v1-supported operation; if a plant changes ownership in the real world, it is handled out-of-band by recreating the Facility under the new Tenant.

### I-D07 — Every Record is associated with a Facility ✅
A Record captures activity *at a specific Facility*, so it must reference one. Required because Tenants have many Facilities — without this, Records cannot be routed to the correct Report or attributed correctly on a regulator filing.

---

## Reporting

### I-D08 — A Report is reproducible from its source Records ✅
Given the same set of source Records and the same Report Template version, running the same Report twice produces the same artifact (byte-stable, or at minimum visually identical when minor non-semantic differences like generation timestamps are masked).

> Implications:
> - A Report must capture **which Records** and **which Template version** it derives from.
> - Records cannot be silently mutated after a Report is produced; either Records are immutable (event-sourced / append-only) or Reports snapshot the Record values they used.
> - Tests for any Report should be able to regenerate it and compare.

### I-D09 — Existing reports remain visually faithful in the rewrite 🟡
Reports produced for MDEQ and IDEM by the new system must match the layout of the equivalent Reports produced by the legacy WPF app, to a standard that the Regulator and the operator accept without retraining.

❓ — Define the acceptance test for "visually faithful":
- Pixel-diff with a tolerance?
- Structural diff (same fields in the same regions)?
- Manual side-by-side sign-off?

### I-D10 — Reports cannot read across Tenants ✅
Restatement of I-D03 specifically for the reporting path: a Report run by a User of Tenant A only sees Records of Tenant A as input, regardless of the Report Template's source query.

---

## Regulators (v1 scope)

### I-D11 — Supported regulators are MDEQ and IDEM only ✅
For v1, the only Regulators a Tenant may select or submit to are MDEQ (Michigan) and IDEM (Indiana). Adding another Regulator is a future-version change, not a configuration toggle.

> Code should still make Regulator a first-class concept (entity or strong-typed value) rather than hard-coding two booleans, so that adding a third Regulator is a contained change.

---

## Domain — Asphalt Operations

### I-D## (reserved — pending) ❓
Asphalt-specific invariants (production logging cadence, opacity reading frequency, baghouse pressure-drop thresholds, permit-deviation flagging windows, emissions calculation rules, MAERS submission contents, etc.) cannot be written until the dominant Record types and their business rules are confirmed with the domain owner.

> Each domain invariant must come from a concrete rule that the Regulator or the operating customer actually enforces — not invented from general knowledge of the industry. Candidates that *may* eventually apply (illustrative only, **do not encode**):
>
> - Daily opacity readings are required on every operating day during paving season.
> - An exceedance of a permit limit must be flagged within a defined window.
> - MAERS submission requires production totals for the calendar year, broken out by source.
>
> When these are confirmed, they become I-D12, I-D13, … and gain ✅ status.

---

## Retired

*(empty — nothing retired yet)*

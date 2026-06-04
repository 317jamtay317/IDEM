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

## Org Isolation

### I-D01 — Every Record belongs to exactly one Org ✅
A Record may not exist without an `OrgId`. A Record's `OrgId` may not change after creation. Cross-Org transfer of Records is not a supported operation.

### I-D02 — Every Org User belongs to exactly one Org 🟡
For v1, an Org User cannot span multiple Orgs. A person who operates two distinct companies needs two accounts (with the same email allowed across Orgs? — see I-D04).

This invariant does **not** apply to SiteAdmins (see I-D13), who are platform operators with no Org affiliation.

❓ — Confirm this assumption holds for the asphalt market. If an operator commonly works for multiple companies, multi-Org Users become a v1 requirement, not a v2.

### I-D03 — Org data is never visible across Orgs ✅
No query, report, export, API call, background job, or admin operation may return data belonging to an Org other than the caller's. Enforced at the application layer at minimum; preferred to also enforce at the database layer (row-level security or query-level filter).

> Violations of I-D03 are security incidents, not bugs. Tests must cover the negative case (request data as Org A, assert no Org B data is returned) for every read endpoint.
>
> **SiteAdmin exemption**: SiteAdmins legitimately access data across Orgs for support and billing. Every cross-Org access by a SiteAdmin must be audit-logged with actor, target Org, and operation (see I-D13).
>
> **Enforced (Org User facilities)**: the Org User self-service Facility endpoints (`/me/org/facilities`) scope every read and write to the caller's `org_id` claim, never to client input. Proven by `MyOrgFacilityEndpointsTests` — an Org A user cannot see, rename, or delete an Org B Facility, and a SiteAdmin (who has no Org) is rejected.

### I-D04 — Email uniqueness scope 🟡
Email uniqueness depends on the User type:
- An Org User's email is unique **within their Org**. The same email may appear in different Orgs (interpreted as different accounts for the same person at different employers).
- A SiteAdmin's email is unique across all SiteAdmins.
- A SiteAdmin and an Org User may share an email; they are separate accounts.

❓ — Confirm with domain owner. The alternative (email globally unique across everything) simplifies SSO/identity later but rules out the "same person, two companies" case.

### I-D05 — An Org has at least one active Admin User 🟡
At all times, the count of active Users with the Admin role within an Org is ≥ 1. Used to prevent administrative lock-out.

❓ — Depends on the concrete Role list being confirmed (see UbiquitousLanguage `Role`).

---

## Facilities

### I-D06 — Every Facility belongs to exactly one Org ✅
Facilities follow the same isolation guarantee as Records (I-D01): `OrgId` is required at creation, immutable, and never crosses Orgs.

An Org has **many** Facilities — confirmed by the v1 design target (Rieth-Riley) operating ~15–20 plants. Cross-Org transfer of a Facility is not a v1-supported operation; if a plant changes ownership in the real world, it is handled out-of-band by recreating the Facility under the new Org.

> Facility is its own **aggregate root**: it references its Org by `OrgId` (an id reference, not containment) and is loaded through `IFacilityRepository`. The Org aggregate does not hold its Facilities; Org read models compose them on the query side. `OrgId` is enforced (required + immutable) by the `Facility` aggregate itself.

### I-D07 — Every Record is associated with a Facility ✅
A Record captures activity *at a specific Facility*, so it must reference one. Required because Orgs have many Facilities — without this, Records cannot be routed to the correct Report or attributed correctly on a regulator filing.

### I-D17 — A Permit added to a Facility must not already be expired 🟡
When a Permit (see UbiquitousLanguage `Permit`) is added to a Facility, its expiration date must be on or after the current date; a Permit whose expiration date is already in the past is rejected. Enforced by `Facility.AddPermit`.

❓ — Confirm with the domain owner: is "reject if already expired on the day it is added" the intended rule, and should the comparison use the server's date or the Facility's local date? (Shipped initially as the "License" rule with a non-invariant error code; recorded here on the Permit rename.)

### I-D18 — A Facility's last remaining Permit cannot be removed 🟡
A Facility that holds Permits must retain at least one; an attempt to remove the only remaining Permit is rejected. Enforced by `Facility.RemovePermit`.

> Note the precise shape as implemented: this constrains **removal**, not creation. A newly-created Facility has zero Permits and is valid until its first Permit is added; the rule only forbids going from one Permit back to zero.

❓ — Confirm whether the stronger rule is wanted instead: a Facility must have ≥ 1 Permit *at all times*, which would also require a Permit at creation.

### I-D19 — A Facility holds at most one Monthly Limit per Emission Type 🟡
A Facility may hold many Monthly Limits (see UbiquitousLanguage `Monthly Limit`), but **at most one per `Emission Type`**. Adding a second limit for an Emission Type that already has one is rejected; the existing limit's tons value is changed via `Facility.UpdateLimit` instead. Enforced by `Facility.AddLimit`.

❓ — Confirm the v1 Emission Type set (currently VOC, HCl, SO2, NOx, CO2) with the domain owner.

### I-D20 — A Monthly Limit's value must be positive 🟡
A Monthly Limit's value is a number of **tons per calendar month** and must be **greater than zero**; a zero or negative value is rejected. Enforced by `MonthlyLimit.Create` (and therefore by `Facility.AddLimit` and `Facility.UpdateLimit`).

❓ — Confirm whether a zero cap ("no emissions permitted") should ever be allowed, or remain rejected.

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

### I-D10 — Reports cannot read across Orgs ✅
Restatement of I-D03 specifically for the reporting path: a Report run by a User of Org A only sees Records of Org A as input, regardless of the Report Template's source query.

---

## Regulators (v1 scope)

### I-D11 — Supported regulators are MDEQ and IDEM only ✅
For v1, the only Regulators an Org may select or submit to are MDEQ (Michigan) and IDEM (Indiana). Adding another Regulator is a future-version change, not a configuration toggle.

> Code should still make Regulator a first-class concept (entity or strong-typed value) rather than hard-coding two booleans, so that adding a third Regulator is a contained change.

---

## Identity & Authentication

### I-D12 — Org.TenantId is set only when Entra ID is configured 🟡
`Org.TenantId` (the Entra ID directory GUID) is nullable. It is set only when the Org has configured Entra ID federation for SSO; null for Orgs that authenticate locally. The field is populated during SSO onboarding and may be cleared if the Org disables federation.

> See UbiquitousLanguage `Tenant` — "Tenant" here is the Microsoft Entra ID vocabulary, not the customer entity.

### I-D13 — A User is either an Org User or a SiteAdmin, never both 🟡
Every User row satisfies exactly one of:
- `IsSiteAdmin = true` AND `OrgId IS NULL` (a SiteAdmin)
- `IsSiteAdmin = false` AND `OrgId IS NOT NULL` (an Org User)

A person who operates in both capacities (rare — e.g., a platform employee who also legitimately uses the product for their side business) requires two separate accounts.

### I-D14 — Passwords are stored only as hashes ✅
User passwords are never persisted in plaintext or in a reversibly-encrypted form. Hashing uses ASP.NET Core Identity's default (PBKDF2 with HMAC-SHA-512, configurable iteration count). Plaintext passwords appear only in transit during authentication and are never written to logs.

### I-D15 — Refresh tokens are rotated on use ✅
Each time a refresh token is redeemed at the token endpoint, a new refresh token is issued and the previous one is invalidated. A refresh token is never reusable. This limits the blast radius of a leaked refresh token and is required for public clients (SPA and MCP agents) per OAuth 2.1.

> Proven by `TokenEndpointTests.Token_WithRefreshToken_RotatesAndReturnsNewAccessToken`.

### I-D16 — MCP access requires the `mcp` scope and remains Org-isolated 🟡
Every MCP tool call must carry an access token that includes the **`mcp` scope**; the `/mcp` endpoint rejects tokens without it (`403`). The scope is **necessary but not sufficient**: an Agent acts only for the User whose token it holds, so once Org-scoped MCP tools exist they remain bound by **I-D03** (an Agent sees only that User's Org's data), and any SiteAdmin cross-Org access via MCP is audit-logged per **I-D13**.

> Enforced today by the `McpUser` authorization policy (Api `Program.cs`). The scope gate is covered by `McpUnauthenticatedTests` (negative: no scope → 403) and `McpHelloWorldFlowTests` (positive: with scope → tool call succeeds). 🟡 until the first Org-scoped MCP tool lands and the I-D03 negative test is added for the MCP path.

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
> When these are confirmed, they become I-D17, I-D18, … and gain ✅ status.

---

## Retired

*(empty — nothing retired yet)*

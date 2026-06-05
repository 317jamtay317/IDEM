# Architecture

Stack and architectural patterns for **RecordKeeping** SaaS. Living document — update as decisions are made or revised.

> **Status legend**
> - ✅ Confirmed
> - 🟡 Tentative
> - ❓ Open

---

## Stack ✅

| Layer        | Choice                                          |
| ------------ | ----------------------------------------------- |
| Backend      | **.NET 10**                                     |
| Database     | **SQL Server** via **EF Core**                  |
| Messaging    | **Wolverine** (with transactional outbox)       |
| Frontend     | **React**                                       |
| Hosting      | **Azure Container Apps**                        |
| Auth server  | **ASP.NET Core Identity + OpenIddict**          |
| SPA OIDC     | **react-oidc-context** (wraps `oidc-client-ts`) |

---

## Architectural Patterns ✅

### Clean Architecture
Layered, with dependencies pointing inward toward the domain:

```
Api ─── Application ─── Domain
  └─── Infrastructure ───┘
```

- **Domain** — entities, value objects, aggregates, domain events, invariants. No infrastructure dependencies.
- **Application** — commands, queries, handlers, DTOs, orchestration. No business logic.
- **Infrastructure** — EF Core, SQL Server, external services, repository implementations.
- **Api** — HTTP surface (Minimal API or controllers), OpenAPI metadata.

### CQRS via Wolverine
Commands change state and emit domain events; queries are read-only and may bypass the domain model for read-side performance where it pays.

### Domain-Driven Design
Ubiquitous language, aggregates as consistency boundaries, repositories per aggregate root, domain events for cross-aggregate effects. See [UbiquitousLanguage.md](./UbiquitousLanguage.md) and [Invariants.md](./Invariants.md).

Tactical building blocks live in `RecordKeeping.Domain/Common`:
- `ValueObject` — structural (component-based) equality for immutable concepts (e.g. `Email`).
- `Entity<TId>` — identity-based equality.
- `AggregateRoot<TId>` — an `Entity<TId>` plus a domain-event channel (`DomainEvents` / `RaiseDomainEvent` / `ClearDomainEvents`), backed by the `IDomainEvent` marker.

The aggregate roots are **Org**, **User**, and **Facility**, each with its own repository (`IOrgRepository`, `IFacilityRepository`). Aggregates reference one another **by id only** (e.g. `Facility.OrgId`, `User.OrgId`) — never by object containment — so each is loaded and persisted independently. Read models that need data from more than one aggregate (e.g. an Org with its Facilities) compose it on the query side rather than widening an aggregate boundary.

### Test-Driven Development
- Tests written **before** implementation.
- All public and protected code documented.
- **Minimum 80% code coverage**, enforced in CI. PRs failing the threshold do not merge.

---

## Patterns Borrowed from BillingAgent ✅

Copy as **templates, not as code** (per handoff decision — no wholesale fork of BillingAgent):

- Wolverine + transactional outbox wiring
- Integration test pattern: shared `*ApiFactory` per test assembly, `ResetForTest()` per test, Testcontainers SQL Server
- Postman collection + OpenAPI conventions for endpoint documentation
- `ErrorOr<T>` for business-outcome results; exceptions reserved for genuinely unexpected failures
- `FluentValidation` with `WithErrorCode("I-D##")` tying validation failures to specific invariant IDs in [Invariants.md](./Invariants.md)
- `CLAUDE.md` / `UbiquitousLanguage.md` / `Invariants.md` doc conventions

---

## Auth ✅

**ASP.NET Core Identity + OpenIddict**, embedded in `RecordKeeping.Api` (no separate auth service). OAuth 2.1 **Authorization Code + PKCE** flow for the React SPA. Refresh tokens delivered as `HttpOnly; Secure; SameSite=Strict` cookies; access tokens held in SPA memory only.

**Identity tables** live in a dedicated `auth` schema in the SQL Server database, separating them visually from domain tables. Passwords are stored using Identity's default PBKDF2 with HMAC-SHA-512 (see [I-D14](./Invariants.md)).

**Access-token claims.** Issued access tokens carry the subject, email, name, and an `is_site_admin` flag. Org Users additionally carry an `org_id` claim (the caller's Org); it is absent for SiteAdmins, who have no Org ([I-D13](./Invariants.md)). Org-scoped self-service endpoints (e.g. `/me/org/facilities`) derive the Org from `org_id` rather than from client input, enforcing Org isolation ([I-D03](./Invariants.md)) by construction.

**SPA OIDC client**: `react-oidc-context` wraps `oidc-client-ts` and provides the React hooks and route guards used by `src/client`. Silent refresh runs in an iframe.

**Entra ID federation** is a per-Org feature: an Org with `Org.TenantId` (the Entra directory GUID) set redirects to its Entra ID directory for login; OpenIddict consumes Entra ID via the standard `AddOpenIdConnect()` middleware, then issues local RecordKeeping tokens. Orgs without `Org.TenantId` use local username/password (see [I-D12](./Invariants.md)).

**MFA**: TOTP-based via Identity's built-in authenticator support. Deferred from the v1 auth slice; required before the first paying customer.

> **Decision history.** The original handoff lean was *plain ASP.NET Core Identity (cookies)* on the grounds that RecordKeeping is a single-product SaaS and not an OIDC server for third parties. Overridden in favor of OpenIddict to keep the SPA on a real OAuth flow — forward-compatible with future mobile clients, partner integrations, and federated SSO without later flow rewrites.

---

## MCP (Model Context Protocol) ✅

RecordKeeping exposes an **MCP server** so external AI agents — **Claude**, **ChatGPT**, and **GitHub Copilot** — can call into the product. It lives in the `RecordKeeping.Mcp` project and is **embedded in `RecordKeeping.Api`** (mounted at `/mcp` over the **Streamable HTTP** transport, stateless mode). Built on the official `ModelContextProtocol.AspNetCore` SDK.

**Effortless auth is the headline requirement.** It maps onto the MCP authorization spec, which is OAuth 2.1 with three discovery layers — so an agent needs only the one URL `https://<host>/mcp`:

1. **Protected Resource Metadata** (RFC 9728) at `/.well-known/oauth-protected-resource/mcp`, and a `WWW-Authenticate: Bearer resource_metadata="…"` header on every 401. This points the agent at the authorization server.
2. **Authorization Server Metadata** (RFC 8414) — served by OpenIddict at both `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server` (agents probe the latter).
3. **Dynamic Client Registration** (RFC 7591) at `/connect/register` — the agent self-registers a `client_id`, then runs Authorization Code + PKCE. No per-agent configuration, no shared secrets.

**Embedded topology (resource server == authorization server).** The MCP endpoint is an OAuth resource server that trusts tokens this same app issues. Co-hosting removes cross-service token-audience juggling and a second deployable. The MCP code stays in its own project (peer to `Api`) and ships its own `RecordKeeping.Mcp.slnx` view.

**Authorization wiring.** A dedicated `McpAuth` authentication scheme publishes the resource metadata and emits the discovery challenge, but **forwards token validation to the OpenIddict validation scheme** — so global auth defaults (and the SPA flow) are untouched. The `/mcp` endpoint is guarded by the **`McpUser`** policy: authenticated **and** the access token carries the **`mcp` scope**.

**Dynamic Client Registration is implemented in-house** (`DynamicClientRegistration` in Infrastructure) because OpenIddict has no registration endpoint. Open registration is the price of frictionless onboarding, so every dynamically-registered client is **hardened**: public (no secret), **PKCE required**, limited to **authorization-code + refresh-token**, with redirect URIs restricted to **HTTPS or loopback**.

**Resource validation is disabled** on the OpenIddict server. MCP clients (RFC 8707) always send a `resource` parameter equal to the MCP URL, which is host-dynamic and not pre-registered; without this, OpenIddict would reject those token requests with `invalid_target`. Because the resource server and authorization server are the same app, audience binding isn't load-bearing for security here — the **`mcp` scope** is the authorization gate. Tightening to explicit audience/resource binding is a future option.

> **Deferred before first external agent in production:** persistent signing/encryption keys (currently ephemeral), the existing TLS-edge `UseForwardedHeaders` hardening, and a consent screen (registration currently uses implicit consent to match the SPA). Tracked alongside the existing pre-prod auth TODOs.

---

## Multi-Org ❓

Org isolation strategy not yet decided. Three options on the table:

1. **Shared schema + `OrgId` column** — standard SaaS pattern, simplest to operate. Default unless we have a reason to deviate. Enforced via global EF query filters and the [I-D03](./Invariants.md) negative-test rule.
2. Schema-per-Org
3. Database-per-Org

Pick one before writing the first migration. Whichever strategy lands must satisfy [I-D03](./Invariants.md): no cross-Org data leakage at any layer.

---

## Legacy Migration 🟡

Legacy WPF app uses **SQL Server**, so migration is SQL→SQL — schema lift vs. fresh schema with ETL is still open. Decision rests on how clean the legacy schema is and whether DDD aggregates map cleanly onto it.

---

## In-house Reporting ✅

No third-party commercial reporting vendor (per handoff decision). Report Engine and Report Templates are built in-house. OSS primitives at the lowest level (PDF/graphics/spreadsheet libraries, e.g. QuestPDF, SkiaSharp/ScottPlot, ClosedXML, react-grid-layout/react-rnd) are in scope; commercial report *designers* requiring per-Org or per-seat licensing are not.

**Report Engine (`RecordKeeping.Reporting`).** The Report Engine is a peer project (like `RecordKeeping.Mcp`) that implements the Application interface **`IReportRenderer`** and is registered at the composition root via `AddRecordKeepingReporting`. It depends on Application only (never the reverse, never Infrastructure). The pipeline is: parse the Report Template's **RDL/RDLC** (`RdlReader`, the C# counterpart of the front-end `rdl.ts`) → resolve the designer expression dialect (`{Scope.Field}`, `{n}`/`{N}`, `SUM/AVG/COUNT/MIN/MAX`, ported from `expressions.ts`) against a **`ReportDataContext`** → lay the bands out across pages (`ReportLayoutEngine`, mirroring the front-end Preview's logical pagination) → render to **PDF**.

- **PDF library: QuestPDF.** Chosen over PdfSharp/MigraDoc for its ergonomics. QuestPDF's **Community License** is free under the project's revenue threshold (USD $1M/yr), above which a paid tier applies — revisit if revenue approaches that. The license type is set at the composition boundary (`ReportPdfPainter` static ctor). Absolute element positions are placed via QuestPDF overlay layers (the design canvas is absolute-positioned, not flow-based).
- **Linux runtime.** The container installs `libfontconfig1` + a base font (`fonts-dejavu-core`) so SkiaSharp can measure/draw text; authored fonts not present on the host fall back.
- **Preview vs. run.** The SiteAdmin-only builder renders a live preview against **server-side sample data** (`SampleReportData`) — SiteAdmins have no Org (I-D13). A future Org-scoped *report run* supplies a `ReportDataContext` built from real Records (Org-isolated per I-D03/I-D10) through the same engine.

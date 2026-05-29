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

**SPA OIDC client**: `react-oidc-context` wraps `oidc-client-ts` and provides the React hooks and route guards used by `src/client`. Silent refresh runs in an iframe.

**Entra ID federation** is a per-Org feature: an Org with `Org.TenantId` (the Entra directory GUID) set redirects to its Entra ID directory for login; OpenIddict consumes Entra ID via the standard `AddOpenIdConnect()` middleware, then issues local RecordKeeping tokens. Orgs without `Org.TenantId` use local username/password (see [I-D12](./Invariants.md)).

**MFA**: TOTP-based via Identity's built-in authenticator support. Deferred from the v1 auth slice; required before the first paying customer.

> **Decision history.** The original handoff lean was *plain ASP.NET Core Identity (cookies)* on the grounds that RecordKeeping is a single-product SaaS and not an OIDC server for third parties. Overridden in favor of OpenIddict to keep the SPA on a real OAuth flow — forward-compatible with future mobile clients, partner integrations, and federated SSO without later flow rewrites.

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

No third-party commercial reporting vendor (per handoff decision). Report Engine and Report Templates are built in-house. OSS primitives at the lowest level (PdfSharp/MigraDoc, SkiaSharp/ScottPlot, ClosedXML, react-grid-layout/react-rnd) are in scope; commercial report designers requiring per-Org or per-seat licensing are not.

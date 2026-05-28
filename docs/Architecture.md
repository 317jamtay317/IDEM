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

## Auth ❓
Not yet decided. Handoff leaning: plain **ASP.NET Core Identity** (cookies + JWT for the SPA) rather than OpenIddict — RecordKeeping is a single-product SaaS, not an identity provider for other apps. Revisit only if RecordKeeping ever needs to be an OIDC server.

---

## Multi-tenancy ❓
Strategy not yet decided. Three options on the table:

1. **Shared schema + `TenantId` column** — standard SaaS pattern, simplest to operate. Default unless we have a reason to deviate.
2. Schema-per-tenant
3. Database-per-tenant

Pick one before writing the first migration.

---

## Legacy Migration 🟡
Legacy WPF app uses **SQL Server**, so migration is SQL→SQL — schema lift vs. fresh schema with ETL is still open. Decision rests on how clean the legacy schema is and whether DDD aggregates map cleanly onto it.

---

## In-house Reporting ✅
No third-party commercial reporting vendor (per handoff decision). Report Engine and Report Templates are built in-house. OSS primitives at the lowest level (PdfSharp/MigraDoc, SkiaSharp/ScottPlot, ClosedXML, react-grid-layout/react-rnd) are in scope; commercial designers requiring per-tenant/per-seat licensing are not.

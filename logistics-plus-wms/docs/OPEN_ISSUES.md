# Open Architecture Issues and Release Gates

| ID | Priority | Decision / missing evidence | Owner | Release gate |
|---|---|---|---|---|
| O-001 | Critical | Obtain approved live schema dictionary; verify entity tables, types, nullability, PK/FK relations, category semantics and ambiguous table names. | Data owner / DBA | Block data-facing production use |
| O-002 | Critical | Configure enterprise SSO gateway, trusted header sanitation/injection, role provisioning, perimeter and audit sink. | Security / platform | Protected API must remain unavailable |
| O-003 | Critical | Approve real status lifecycle, cancellation invariant, transition permissions, and existing concurrency token/transaction design. | Operations / DBA | Status PATCH remains 501 |
| O-004 | High | Approve SQL network reachability, hosting design, rate limiting, pool settings, timeouts, query plans and load targets. | Platform / DBA | Block production launch |
| O-005 | High | Confirm currency, business timezone, pending labels, order amount authority, treatment of canceled/refunded orders and stock threshold semantics. | Operations / finance | Block KPI signoff |
| O-006 | Medium | Validate order-line, product, customer, shipment and timestamp relationships before enabling the remaining reports. | Data owner | Top product/customer/daily reports stay unconfigured |
| O-007 | Medium | Approve CSV export permissions, data classification, audit, row caps and whether exports are complete or paged. | Security / operations | Export stays disabled by default |
| O-008 | Medium | Supply isolated staging database, sanitized representative records, identity test tenant and acceptance reviewer. | QA / data owner | Integration tests blocked |
| O-009 | Medium | Determine whether the DB has an existing audit mechanism and its API integration contract. No audit table was created. | DBA / compliance | Audit requirement unresolved |

## Assumptions that must not become silent facts

- Candidate names such as Products, Stock, Orders, OrderItems and Shipments are hypotheses from the spec.
- Dashboard pending-state text matching and threshold 10 are provisional demonstrations of available-data behavior, not approved business definitions.
- UI currency displays as USD as a presentational default; confirm the database currency and localization before operational/financial use.
- `totalPages` and `COUNT_BIG` are computed from database queries; very large counts beyond JavaScript safe integer should be represented as strings in a future contract.
- Runtime candidate matching is useful for discovery but does not replace an owner-reviewed pinned mapping.

# Production Demo Runbook

## Preconditions

- An approved SQL Server environment, read-only app login, TLS, network path and reviewed query plan.
- Enterprise SSO gateway authenticates user identity and enforces/forwards approved roles.
- Schema candidate output has been reviewed and any ambiguous mapping has been pinned.
- Threshold, status meaning, currency, timezone and CSV permissions have been signed off.

## Script

1. Authenticate through the gateway. Confirm unauthenticated requests are rejected, user roles are mapped correctly, and spoofed identity headers are stripped.
2. Open the dashboard. Note refresh time and reconcile order count, status counts, amount and low-stock metric with the approved queries in `sql/analytics.sql`.
3. Search for a known SKU and name, combine a verified category filter, sort, page, reset; compare with a direct read-only SQL result.
4. Inspect a known product in at least two warehouses. Validate quantity precision and reserved/available values against source fields and business definitions.
5. Locate an order using status/customer/date filters. Open details and compare header amount to the line sum. Investigate any difference rather than rewriting a total.
6. Demonstrate the PATCH policy returns 501. Do not perform a status transition in the demo until operations, data and security owners approve the transition and concurrency design.
7. Review schema mapping and open issues. Test an export only after CSV is enabled for the specific audience and audit requirements are met.
8. Capture sanitized screenshots in staging only. Do not display customer data, credentials, internal hostnames, connection strings or secrets.

## Rollback

This app makes no schema changes and its API is read-only. Disable the deployment/gateway route, revoke its database principal, rotate the proxy and DB credentials if exposed, and preserve platform logs. There is no migration rollback because there are no migrations.

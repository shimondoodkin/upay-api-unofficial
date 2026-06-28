# upay-api-unofficial

Unofficial, reverse-engineered integration notes for the **Upay website payment flow**.

> **Status:** unofficial / community documentation. Not affiliated with or endorsed by Upay.
> Scoped to merchant website payments — checkout, verification, refunds, and receipts/invoices.

📖 **[View the rendered documentation (GitHub Pages)](https://shimondoodkin.github.io/upay-api-unofficial/)**

## Scope

**In scope**
- Website payment checkout (hosted-page redirect / on-the-fly form).
- `returnurl` and `ipnurl` handling.
- Payment lookup and server-side verification.
- Refund / cancellation by `cashierid`.
- Receipt / invoice creation and retrieval.

**Out of scope**
- Direct in-app payments, dashboards/reports, account & profile APIs, and back-office management.

## Contents

| File | Description |
|---|---|
| [`upay_website_payment_scoped_api_documentation.md`](upay_website_payment_scoped_api_documentation.md) | Full scoped API integration documentation. |
| [`upay_website_payment_scoped_flow.md`](upay_website_payment_scoped_flow.md) | Payment flow, IPN trust model, and verification chain (with Mermaid diagram). |
| [`upay_website_payment_scoped_documentation.html`](upay_website_payment_scoped_documentation.html) | HTML rendering — [view live](https://shimondoodkin.github.io/upay-api-unofficial/). |
| [`upay_website_payment_scoped_postman_collection.json`](upay_website_payment_scoped_postman_collection.json) | Postman collection for the scoped endpoints. |
| [`upay_observed_status_translations.md`](upay_observed_status_translations.md) | Observed transaction status codes and meanings. |
| [`upay_server_side_verification_rule.md`](upay_server_side_verification_rule.md) | Server-side verification rule for safe fulfillment. |

## Verification model (summary)

Treat `returnurl` / `ipnurl` callbacks only as triggers — never as proof of payment. Always
perform an authenticated server-to-server transaction lookup, match amount/currency/status/reference
against your local order, save the Upay transaction id, and mark the order paid exactly once.

## Disclaimer

This is community-maintained documentation based on observed behavior. It may be incomplete or
inaccurate and can change without notice. Use at your own risk.

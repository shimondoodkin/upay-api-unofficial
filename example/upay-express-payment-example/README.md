# Upay Express website payment example

This is a runnable Node.js + Express example for a scoped Upay website-payment integration.

It demonstrates:

- a mobile/desktop HTML configuration form
- hosted Upay payment form generated on the fly by your server
- split payment page: encouraging website panel + Upay payment iframe
- mobile layout: top website panel ~20%, bottom iframe ~80%, no unnecessary page scroll
- `returnurl` and `ipnurl` handlers
- checking/progress page that polls server validation status
- thank-you page only after server-side verification
- safe verification rule: callback is only a trigger; Upay server-side lookup is the proof

## Install

```bash
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

## Important production rule

Never mark an order paid directly from `returnurl` or `ipnurl` parameters.

Use the callback only as a trigger:

```text
returnurl/ipnurl received
→ load local pending order
→ call Upay GETTRANSACTIONS server-to-server
→ match transaction to local order reference
→ verify amount, currency, paid status, merchant/account, duplicate use
→ save Upay transactionid/cashierid
→ mark order paid exactly once
```

## Verification modes

### Local demo

`.env`:

```env
UPAY_VERIFY_MODE=mock
```

The app includes a local simulation link on the checking page.

### Real Upay API

`.env`:

```env
UPAY_VERIFY_MODE=api
UPAY_API_USERNAME=your-api-username
UPAY_API_KEY=your-api-key
UPAY_PAID_STATUSES=S
```

The file `server.js` contains `callUpayGetTransactions()`. You should adjust the exact filters and response parsing after confirming the real Upay response shape for your account.

## Upay hosted payment fields used

The payment iframe auto-submits a form to:

```text
https://app.upay.co.il/API6/clientsecure/redirectpage.php
```

With fields:

- `email`
- `amount`
- `returnurl`
- `ipnurl`
- `paymentdetails`
- `maxpayments`
- `livesystem`
- `commissionreduction`
- `createinvoiceandreceipt`
- `createinvoice`
- `createreceipt`
- `refername`
- `lang`
- `currency`

Hidden form fields are user-editable, so the server stores the expected amount/currency/reference before payment and verifies those later against Upay.

## Iframe note

Some payment providers block iframe embedding using security headers. If Upay blocks iframe rendering for your account/browser, the example includes an “Open Upay in new tab” fallback. The server-side verification flow remains the same.

## Browser return and IPN are alternatives

The order does **not** depend on the customer reaching the redirect/thank-you page.

There are two independent triggers:

```text
A. Browser returnurl
   Customer pays → browser returns → /payment/return/:orderId → server verifies.

B. Server IPN
   Customer pays → Upay calls /api/upay/ipn/:orderId → server verifies.
```

If the customer pays and closes the browser before returning, the IPN handler can still complete the purchase. If both arrive, the verification is idempotent: the first successful verification marks the order paid, and later triggers do not double-fulfill it.

Fulfillment should happen server-side after validation, for example: send email, unlock download, activate subscription, or create receipt/invoice. Do not put fulfillment only on the thank-you page.

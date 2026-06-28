# Upay Website Payment Gateway Integration — Scoped Documentation

**Status:** unofficial, reverse-engineered integration notes.  
**Scope:** merchant website payment, payment lookup/verification, refunds/cancellations, and receipt/invoice creation.

This document intentionally avoids broad Upay account/admin APIs, in-app payments, extensive reports, account detail updates, and unrelated back-office functions. It focuses on the integration a merchant website normally needs.

---

## 1. Confirmed / practical integration scope

### In scope

1. **Website payment checkout**
   - Merchant server/API creates a payment form or hosted-page redirect on the fly.
   - Customer is sent to Upay hosted payment page.
   - Upay returns the customer to `returnurl` and/or sends a server notification to `ipnurl`.

2. **Payment lookup / verification**
   - Read what was paid.
   - Verify amount, currency, status, transaction ID, and order/reference before fulfillment.

3. **Refund / cancellation**
   - Cancel/refund a credit-card deposit/payment by `cashierid` and amount.

4. **Receipt / invoice creation and retrieval**
   - Create receipt, invoice, invoice+receipt, refund document, or transaction document.
   - Retrieve/download receipt or invoice files.

### Out of scope

These exist or may exist in the Upay app/API, but are intentionally not documented here:

- direct in-app payment initiation unrelated to website checkout
- broad reports and dashboards
- bank/account details
- customer/account profile updates
- contacts management
- message/correspondence APIs
- user permissions, settings, passwords, regulation flows
- mass payment / bulk operational tools

---

## 2. Credential location

API credentials are available in the Upay website after login:

```text
Upay website → login → side menu → User Details
```

Observed credential names used by the payment gateway module:

| Credential | Meaning |
|---|---|
| `api_username` | Merchant/API username |
| `api_key` | Merchant/API key |

Keep these server-side only. Do not put `api_key` in browser HTML.

---

## 3. Main endpoints used in this scoped integration

| Purpose | Endpoint | Method | Notes |
|---|---|---:|---|
| Website payment button / hosted redirect page | `https://app.upay.co.il/API6/clientsecure/redirectpage.php` | `POST` | Browser form POST with hidden fields. No API key in form. |
| JSON API | `https://app.upay.co.il/API6/clientsecure/json.php` | `POST` | Used for login/session, transaction lookup, refund, receipt/invoice actions. |
| Public JSON API | `https://app.upay.co.il/API6/client/json.php` | `POST` | Used by Upay client JS for non-secure/public session flows. Usually not needed for merchant server verification if using secure API. |

---

## 4. JSON API transport format

JSON API calls are posted as `application/x-www-form-urlencoded` with one of these fields:

| Field | Type | Meaning |
|---|---|---|
| `msg` | string | JSON-encoded request object |
| `msgs` | string | JSON-encoded array of request objects for batch calls |

Request envelope:

```json
{
  "header": {
    "refername": "UPAY",
    "livesystem": 1,
    "language": "HE",
    "sessionid": "SESSION_ID_WHEN_REQUIRED"
  },
  "request": {
    "mainaction": "TRANSACTIONSINFO",
    "minoraction": "GETTRANSACTIONS",
    "encoding": "json",
    "parameters": {}
  }
}
```

Successful responses are commonly detected in the JS by:

```js
if (data.header.errorcode % 100 == 0) {
  // success-like response
}
```

Treat this as an observed UI convention, not a full official error-code contract.

---

## 5. Website payment flow

The simplest website checkout is a form POST to Upay’s hosted payment endpoint. The form can be generated dynamically by your own API/server for each order.

### 5.1 Flow

1. Customer clicks “Pay” on merchant website.
2. Merchant server creates an order in its own database.
3. Merchant server generates an Upay form or redirect payload with amount, currency, product description, return URL, and IPN URL.
4. Browser submits POST to Upay `redirectpage.php`.
5. Customer pays on Upay hosted page.
6. Upay redirects browser to `returnurl`.
7. Upay may call `ipnurl` separately if configured.
8. Merchant server verifies the transaction by calling the JSON API before fulfilling the order.

### 5.2 Payment-button POST endpoint

```http
POST https://app.upay.co.il/API6/clientsecure/redirectpage.php
Content-Type: application/x-www-form-urlencoded
```

### 5.3 Payment-button fields observed

Example from a generated Upay website button:

```html
<form name="upayform" action="https://app.upay.co.il/API6/clientsecure/redirectpage.php" method="post">
  <input type="hidden" name="email" value="merchant@example.com">
  <input type="hidden" name="amount" value="10">
  <input type="hidden" name="returnurl" value="https://example.com/thank-you">
  <input type="hidden" name="ipnurl" value="https://example.com/api/upay/ipn">
  <input type="hidden" name="paymentdetails" value="website">
  <input type="hidden" name="maxpayments" value="1">
  <input type="hidden" name="livesystem" value="1">
  <input type="hidden" name="commissionreduction" value="">
  <input type="hidden" name="createinvoiceandreceipt" value="0">
  <input type="hidden" name="createinvoice" value="0">
  <input type="hidden" name="createreceipt" value="1">
  <input type="hidden" name="refername" value="UPAY">
  <input type="hidden" name="lang" value="EN">
  <input type="hidden" name="currency" value="USD">
</form>
```

| Field | Example | Meaning / notes |
|---|---|---|
| `email` | `merchant@example.com` | Upay merchant/account email. |
| `amount` | `10` | Payment amount. Hidden field is editable by browser users, so verify server-side. |
| `returnurl` | `https://example.com/thank-you` | Browser return URL after payment. |
| `ipnurl` | `https://example.com/api/upay/ipn` | Server notification URL. You confirmed this can be separate from `returnurl`. |
| `paymentdetails` | `website` | Description shown/attached to payment. Use an order-specific description/reference where possible. |
| `maxpayments` | `1` | Maximum installments/payments. |
| `livesystem` | `1` | Live/test selector. Confirm exact test value with Upay. |
| `commissionreduction` | empty | Optional/merchant-specific commission reduction setting. |
| `createinvoiceandreceipt` | `0`/`1` | Document creation flag. |
| `createinvoice` | `0`/`1` | Document creation flag. |
| `createreceipt` | `0`/`1` | Document creation flag. Your example used receipt only. |
| `refername` | `UPAY` | Upay refer/provider name. |
| `lang` | `EN`, `HE` | Hosted page language. |
| `currency` | `USD`, `NIS`, etc. | Currency code. Confirm allowed currencies per account. |

### 5.4 Document flags from payment button

| Desired behavior | `createinvoiceandreceipt` | `createinvoice` | `createreceipt` |
|---|---:|---:|---:|
| No document | `0` | `0` | `0` |
| Receipt only | `0` | `0` | `1` |
| Invoice only | `0` | `1` | `0` |
| Invoice + receipt | `1` | `0` or ignored | `0` or ignored |

Your example:

```text
createinvoiceandreceipt = 0
createinvoice = 0
createreceipt = 1
```

means **create receipt only**.

### 5.5 Security note for website forms

The payment-button flow is convenient, but hidden inputs are not secure. A user can modify `amount`, `currency`, `paymentdetails`, or `returnurl` before submitting.

Therefore:

- create an internal order before redirecting to Upay;
- include an order/reference value if Upay supports it in your account/flow;
- use `ipnurl` for server-to-server notification;
- call Upay transaction lookup before delivering goods;
- compare Upay result against your own order total and expected currency;
- prevent duplicate fulfillment for the same `transactionid` / `cashierid`.

---

## 6. Recommended verification flow

Do not mark an order as paid only because the browser arrived at `returnurl`.

Verification checklist:

| Check | Required? | Why |
|---|---:|---|
| Transaction exists in Upay lookup | Yes | Return/IPN parameters can be spoofed. |
| `transactionid` or `cashierid` was not used before | Yes | Prevent replay/double fulfillment. |
| Amount equals your order amount | Yes | Hidden form amount can be changed. |
| Currency equals your order currency | Yes | Hidden form currency can be changed. |
| Status is successful/final enough | Yes | Avoid fulfilling pending/failed/refused/cancelled payments. |
| Merchant/account matches your account | Recommended | Prevent mismatched transaction references. |
| Product/order reference matches | Recommended | Prevent paying one order and fulfilling another. |
| Receipt/invoice state recorded | Recommended | Helps reconciliation and customer support. |


### 6.1 Callback/IPN trust model: notification is only a trigger

For this website-payment scope, `returnurl` and `ipnurl` do **not** need to be trusted as proof of payment. They should be treated only as a signal that says: "check this local order / Upay transaction now."

Recommended model:

```text
returnurl/ipnurl notification
→ extract your local order reference and/or Upay transaction hint
→ load your local pending order
→ call Upay server-to-server transaction lookup using server-side credentials
→ match the fetched Upay transaction to the local order
→ verify amount, currency, status, merchant/account, and duplicate use
→ save Upay transactionid/cashierid
→ mark paid exactly once
```

This means a missing callback signature/HMAC is not automatically a security problem, as long as the callback is **never** used directly to mark an order paid. A signed callback would still be useful for reducing fake callback noise, but the authoritative proof remains the authenticated server-side transaction lookup.

#### Recommended local database fields

| Field | Purpose |
|---|---|
| `order_id` | Your internal order ID. Include it in your own `returnurl` / `ipnurl` query string and, if possible, in `paymentdetails` or another Upay reference field. |
| `payment_reference` | Stable merchant-side reference, for example `UPAY-ORDER-12345`. |
| `expected_amount` | Amount your system expects. Do not rely on the hidden form amount. |
| `expected_currency` | Currency your system expects. |
| `upay_transaction_id` | Upay transaction ID, once known. Must be unique in your database. |
| `upay_cashierid` | Upay cashier/reference ID, once known. Must not be reused for another order. |
| `upay_status` | Last verified Upay status from server lookup. |
| `upay_verified_at` | Timestamp of the server-side verification. |
| `paid_at` | Set only after all verification checks pass. |

#### Matching rule

Use both sides of the match:

1. **Notification side:** use `order_id`, `transactionid`, `cashierid`, or other callback fields only to know what to search/check.
2. **Upay lookup side:** use the fetched Upay transaction as the source of truth.
3. **Local order side:** compare the fetched transaction to your own expected order amount/currency/reference.

Never fulfill only because a browser reached `returnurl`, and never fulfill only because someone called `ipnurl`.

### 6.2 Lookup by transaction/report API

Observed Upay JS uses:

```text
mainaction: TRANSACTIONSINFO
minoraction: GETTRANSACTIONS
```

with arbitrary filter parameters passed as `parameters`.

Observed helper:

```js
gettransactions(params, callback)
```

Request shape:

```json
{
  "header": {
    "sessionid": "SESSION_ID"
  },
  "request": {
    "mainaction": "TRANSACTIONSINFO",
    "minoraction": "GETTRANSACTIONS",
    "encoding": "json",
    "parameters": {
      "starttime": "2026-06-27T00:00:00.000z",
      "endtime": "2026-06-27T23:59:59.999z"
    }
  }
}
```

Possible useful filters observed in Upay UI for transaction/invoice search include dates, four digits, name, email, `cashierid`, `invoiceid`, and `clientinvoiceid`. Exact supported filters for `GETTRANSACTIONS` should be verified by test calls.

### 6.3 Verify-transactions API

Observed Upay JS also uses:

```text
mainaction: TRANSACTIONSINFO
minoraction: GETVERIFYTRANSACTIONS
```

This appears to retrieve transactions requiring verification/approval in the Upay UI. It may be useful for reconciliation, but for normal website fulfillment, `GETTRANSACTIONS` by ID/date/order reference is the better primary lookup.

---

## 7. Status values observed from Upay Hebrew UI

These status meanings are extracted from Upay client-side Hebrew UI translation keys. They are useful clues, but should be treated as observed UI behavior, not an official API status contract.

### 7.1 General transaction status letters

| Letter | Hebrew labels observed | Practical meaning |
|---|---|---|
| `S` | `הועבר לחשבוני`, `חויב בחשבוני`, `אושרה` | successful / settled / charged / approved, depending on direction |
| `A` | `אושר`, `אישרתי`, `פעיל` | approved / accepted / active |
| `P` | `בהמתנה`, `ממתין לאישור`, `ממתין לאישורי` | pending / waiting for approval |
| `W` | `ממתין לאישור`, `ממתין לאישורי` | waiting / pending approval |
| `T` | `ממתין למורשה חתימה`, `ממתין לחתימה שלי` | waiting for signer / authorized signature |
| `R` | `סורב`, `סירבתי` | refused / rejected |
| `C` | `בוטל`, `בוטלה` | cancelled |
| `N` | `עיסקה בוטלה` | transaction cancelled |
| `F` | `עיסקה נכשלה` | failed |
| `U` | `בוטלה` | cancelled in card-reader UI context |

### 7.2 Practical success rule

For automated website fulfillment:

- Treat `S` as the strongest success/final indicator observed.
- Treat `A` as approved/accepted, but verify with Upay whether it is final captured/settled for your payment type.
- Never fulfill on `P`, `W`, `T`, `R`, `C`, `N`, `F`, or `U`.

Recommended implementation:

```text
Default safe paid statuses: S only
Optional after Upay confirmation: S and A
```

---

## 8. Refund / cancellation

Observed Upay JS refund/cancellation call:

```text
mainaction: CASHIER
minoraction: CANCELDEPOSITCREDITCARDTRANSFER
```

Observed parameters:

```json
{
  "passwordmd5": "MD5_OF_USER_PASSWORD_OR_STORED_SESSION_PASSWORD",
  "cancellations": [
    {
      "cashierid": "123456",
      "amount": "10.00",
      "comment": "Customer refund"
    }
  ]
}
```

| Parameter | Meaning |
|---|---|
| `passwordmd5` | Upay UI uses the logged-in user password MD5. For a server API flow, confirm whether API credentials can replace this or whether an authenticated user session is required. |
| `cancellations` | Array of cancellation/refund items. |
| `cancellations[].cashierid` | Payment/cashier reference to cancel/refund. |
| `cancellations[].amount` | Refund/cancellation amount. May support partial refunds. Confirm limits with Upay. |
| `cancellations[].comment` | Internal/user-visible comment depending on Upay behavior. |
| `cancellations[].currency` | Present as commented-out JS, so possible but not confirmed. |

### Refund safety checks

Before calling refund:

1. Lookup original transaction.
2. Confirm original payment is paid/final.
3. Confirm `cashierid` belongs to your order.
4. Confirm refund amount does not exceed captured amount minus previous refunds.
5. Store refund request and response.
6. Re-query Upay after refund to confirm final refund/cancellation state.

---

## 9. Receipts and invoices

Upay supports both automatic document creation during payment-button checkout and separate document creation/retrieval through JSON APIs.

### 9.1 Get/download receipt for an existing transaction

Observed Upay JS call:

```text
mainaction: TRANSACTIONSINFO
minoraction: GETRECEIPT
```

Observed parameters:

```json
{
  "transactionid": "TRANSACTION_ID",
  "copy": 1,
  "filetype": "pdf"
}
```

| Parameter | Meaning |
|---|---|
| `transactionid` | Upay transaction ID. |
| `copy` | Optional. UI passes this when requesting a copy. |
| `filetype` | Optional. File type/output format. Exact values should be tested. |

If the response contains a `filename`, Upay JS downloads it with:

```text
mainaction: TRANSACTIONSINFO
minoraction: DOWNLOADFILE
parameters: { filename, filetype }
```

Observed download `filetype` values:

| File type | Observed use |
|---|---|
| `r` | receipt/report download |
| `i` | invoice download |
| `e` | document/email-related download |

### 9.2 Create client invoice / receipt document

Observed Upay JS call:

```text
mainaction: CUSTOMEROFFICE
minoraction: CREATECLIENTINVOICE
```

This API is used in two modes:

1. **Create a new standalone document** with contact, products, and payments.
2. **Create a document for an existing transaction** using `cashierid`.

Common observed parameters:

| Parameter | Meaning |
|---|---|
| `create` | `1` to create final document; `0` appears to preview/generate draft file. |
| `connectiontype` | Observed values: `1` for transaction-based document, `3` for manually generated receipt/invoice. |
| `invoicetypename` | Document type, e.g. `INVOICEANDRECEIPT`, `RECEIPT`, `INVOICE`. |
| `creationdate` | Date in `yyyy-mm-dd`. |
| `cashierid` | Existing payment reference, when creating document for a transaction. |
| `contactname` | Customer/contact name. |
| `contactemail` | Customer email. |
| `contactphonenumber` | Customer phone. |
| `contactaddress` | Customer address. |
| `contactcity` | Customer city. |
| `contactcompanyidentity` | Customer identity/company number. |
| `currency` | Currency. |
| `language` | Document language. |
| `comment` | Notes / document notes. |
| `invoiceforced` | Observed `0` normally, `1` after tax-authority confirmation override. |
| `products` | Product/service line items. |
| `payments` | Payment rows for receipt-type documents. |

### 9.3 Document types observed

| Value | Hebrew UI label | Meaning |
|---|---|---|
| `INVOICE` | `חשבונית מס` | Tax invoice |
| `INVOICEANDRECEIPT` | `חשבונית מס קבלה` | Tax invoice + receipt |
| `INVOICENEGATIVE` | `חשבונית מס זיכוי` | Credit tax invoice |
| `RECEIPT` | `חשבונית קבלה` | Receipt |
| `REFUNDTRANSACTION` | `חשבון זיכוי` | Credit/refund document |
| `TRANSACTION` | `חשבון עסקה` | Transaction/pro forma document |

### 9.4 Product line item fields observed

| Field | Meaning |
|---|---|
| `vat` | VAT obligation/selector. |
| `productdescription` | Item/service description. Required in several flows. |
| `quantity` | Quantity. |
| `amountbeforevat` | Amount before VAT. |
| `amountaftervat` | Amount after VAT. |
| `discountbeforevat` | Discount before VAT. |
| `totalamount` | Total line amount. |

Minimal product row used by transaction-based invoice helper:

```json
{
  "productdescription": "Website service",
  "quantity": "1"
}
```

### 9.5 Payment row fields observed for receipts

| Field | Meaning |
|---|---|
| `paymentdetails` | Payment comment/details. |
| `paymenttype` | Payment method/type. |
| `paymentdate` | Payment date. |
| `amountpayed` | Amount paid. |
| `currency` | Currency. |
| `creditcardcompanytype` | Credit-card company/type. |
| `fourdigits` | Last four card digits. |
| `numberpayments` | Number of installments/payments. |
| `iban` | IBAN for bank payment. |
| `bankcode` | Bank code. |
| `branchcode` | Bank branch. |
| `accountnumber` | Bank account number. |
| `checknumber` | Check number. |

### 9.6 Create invoice+receipt for existing transaction

Observed transaction-document helper sends:

```json
{
  "create": 1,
  "cashierid": "CASHIER_ID",
  "creationdate": "2026-06-27",
  "invoicetypename": "INVOICEANDRECEIPT",
  "connectiontype": 1
}
```

Optional fields when missing product/customer data is required:

```json
{
  "contactphonenumber": "0500000000",
  "products": [
    {
      "productdescription": "Website service",
      "quantity": "1"
    }
  ]
}
```

Observed error hints:

| Error key | Meaning |
|---|---|
| `CREATECLIENTINVOICE_PRODUCTDESCRIPTION_EMPTY` | Product description is required. |
| `CREATECLIENTINVOICE_TOTALAMOUNTS_NOT_IDENTICAL` | Product totals and payment totals do not match. |
| `CREATECLIENTINVOICE_TAXESAUTHORITYNUMBER_REQUIRED_APPROVAL` | Tax Authority number/approval required before creation, with possible forced retry after confirmation. |

### 9.7 Search created invoices/receipts

Observed Upay JS uses:

```text
mainaction: TRANSACTIONSINFO
minoraction: GETSENDINVOICESREPORT
```

Useful filters observed:

```json
{
  "starttime": "2026-06-01T00:00:00.000z",
  "endtime": "2026-06-27T23:59:59.999z",
  "fourdigits": "1234",
  "name": "Customer Name",
  "email": "customer@example.com",
  "cashierid": "CASHIER_ID",
  "invoiceid": "INVOICE_ID",
  "clientinvoiceid": "CLIENT_INVOICE_ID",
  "filetype": "pdf"
}
```

---

## 10. Minimal server implementation recommendation

### 10.1 Database fields to store

For each order:

| Field | Purpose |
|---|---|
| `order_id` | Your internal ID. |
| `expected_amount` | Expected amount. |
| `expected_currency` | Expected currency. |
| `upay_transactionid` | Upay transaction ID from callback/lookup. |
| `upay_cashierid` | Upay cashier/reference ID when available. |
| `upay_status` | Last observed Upay status. |
| `paid_at` | Fulfillment/payment timestamp. |
| `receipt_filename` / `invoice_filename` | Document download reference when created. |
| `raw_return_params` | Debug/audit. |
| `raw_ipn_params` | Debug/audit. |
| `raw_lookup_response` | Debug/audit. |

### 10.2 Safe paid-state algorithm

```pseudo
on returnurl or ipnurl:
  read Upay parameters
  find local order by reference/order id if available
  call GETTRANSACTIONS or equivalent lookup
  locate exact Upay transaction

  if transaction already used for another order:
      reject

  if amount != expected_amount:
      reject

  if currency != expected_currency:
      reject

  if status not in confirmed_paid_statuses:
      mark pending/manual review
      do not fulfill

  mark order paid once
  store transactionid/cashierid/raw response
  create or fetch receipt/invoice if needed
  fulfill order
```

Recommended `confirmed_paid_statuses` until Upay confirms otherwise:

```json
["S"]
```

---

## 11. Remaining questions to verify with Upay

| Question | Current state |
|---|---|
| Where are API credentials issued? | Solved: Upay website → login → side menu → User Details. |
| Are API6 endpoints current? | Confirmed by you as current. |
| Can `returnurl` and `ipnurl` be separated? | Confirmed by you as yes. |
| Does Upay retry `ipnurl` if merchant server is down? | Still unknown. |
| Are callbacks signed, or can HMAC/signature be enabled? | Still unknown. |
| Is `S` final captured/settled for website card payments? | Very likely from UI labels, but should be confirmed. |
| What exactly does `A` mean for website card payments? | Observed approved/accepted; finality should be confirmed. |
| Can refund API be used with API credentials, or only with logged-in UI session/password MD5? | Needs verification. |
| Exact allowed `GETTRANSACTIONS` filters by transaction/order/cashier reference | Needs test/verification. |

---

## 12. Suggested questions to send Upay

```text
We are implementing only a merchant website payment integration.
We generate the Upay website payment form/page from our server, redirect the customer to Upay, then verify payment server-side.

Please confirm these points:

1. For website card payments, which transaction status values mean the payment is final and safe to fulfill?
   Specifically: is status S final captured/paid? What exactly does A mean?

2. Are returnurl and ipnurl both sent for website payments?
   If ipnurl fails, does Upay retry? If yes, what retry schedule?

3. Can callbacks/IPN be signed with HMAC or another signature?
   If yes, what fields are signed and how is the secret configured?

4. For transaction lookup, which parameters can GETTRANSACTIONS filter by?
   transactionid, cashierid, providerrequestid, date range, email, amount, currency, paymentdetails/order reference?

5. For refunds/cancellations, can CASHIER / CANCELDEPOSITCREDITCARDTRANSFER be called using API credentials/server session,
   or does it require an interactive logged-in user passwordmd5?

6. For receipts/invoices, which invoicetypename values are officially supported?
   INVOICE, RECEIPT, INVOICEANDRECEIPT, INVOICENEGATIVE, REFUNDTRANSACTION, TRANSACTION?
```

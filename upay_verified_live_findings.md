# Verified live findings (2026-09-02)

These findings were confirmed against the **production** Upay API
(`https://app.upay.co.il/API6/clientsecure/json.php`) with real API
credentials and a real charged ₪1 transaction, while debugging server-side
payment verification for a live store. They resolve several open questions in
`upay_website_payment_scoped_api_documentation.md`. The batch login pattern
matches Upay's own official WooCommerce gateway plugin
(`woocommerce-gateway-upay` 1.2.7, `class-wc-gateway-upay-api-handler.php`).

## 1. Authentication: LOGIN is an action, not header fields

Putting `api_username` / `api_key` in the request **header does nothing** —
every action then answers:

```json
{"header": {"errorcode": "130", "errormessage": "PERMISSION_DENIED"}}
```

(This is misleading: it is not an account-permission problem, it means "not
logged in".)

The working pattern is a **`msgs` batch**: one POST carrying a JSON array of
two requests — `CONNECTION/LOGIN` first, the real action second. The login's
credentials go in **`parameters`**, named `email` and `key`:

```json
[
  {
    "header": { "refername": "UPAY", "livesystem": 1, "language": "HE" },
    "request": {
      "mainaction": "CONNECTION",
      "minoraction": "LOGIN",
      "encoding": "json",
      "parameters": { "email": "API_USERNAME", "key": "API_KEY" }
    }
  },
  {
    "header": { "refername": "UPAY", "livesystem": 1, "language": "HE" },
    "request": {
      "mainaction": "TRANSACTIONSINFO",
      "minoraction": "GETTRANSACTIONS",
      "encoding": "json",
      "parameters": { "paymentdetails": "YOUR-ORDER-REFERENCE" }
    }
  }
]
```

POST body: `msgs=<urlencoded JSON of the array>` with
`Content-Type: application/x-www-form-urlencoded`. The session created by the
LOGIN item carries over to the following items **within the same batch** — no
separate `sessionid` bookkeeping is needed for this flow.

Successful login answers `"errorcode": "20001000", "errormessage": "LOGIN_OK"`.

## 2. Batch response shape

```json
{
  "results": [
    { "header": { "errorcode": "20001000", "errormessage": "LOGIN_OK" }, "result": { } },
    {
      "header": { "errorcode": "31000000", "errormessage": "GETTRANSACTIONS_OK" },
      "result": {
        "mainaction": "TRANSACTIONSINFO",
        "minoraction": "GETTRANSACTIONS",
        "sendertransactions": [ { } ]
      }
    }
  ]
}
```

The transactions array is at **`results[1].result.sendertransactions`** (not
`response.transactions` / `data` as previously guessed).

## 3. The `errorcode % 100 == 0` success convention is confirmed

- `20001000 LOGIN_OK` — success
- `31000000 GETTRANSACTIONS_OK` — success (also returned with an **empty /
  absent** result set when a filter matches nothing — a success code does not
  imply results)
- `130 PERMISSION_DENIED` — not logged in (see §1)
- `1030` — bad/unsupported parameters (observed for ISO-8601
  `starttime`/`endtime` values)

## 4. GETTRANSACTIONS filters — what actually works

| Filter | Result |
|---|---|
| `paymentdetails: "<substring of the payment details>"` | **Works.** Returns the matching transaction(s). Best primary lookup when you embed an order reference in `paymentdetails` at checkout time. |
| `cashierids: ["<id>"]` (array) | **Works.** This is what the WooCommerce plugin uses. |
| `fromdate: "YYYY-MM-DD", todate: "YYYY-MM-DD"` | **Works.** |
| `starttime`/`endtime` as ISO-8601 timestamps | **Fails** with errorcode `1030`. |
| `transactionid: "<id>"` (as a hint alongside a working filter) | Ignored/harmless. |

## 5. Field quirks in the returned transaction

- The transaction is identified by **`cashierid`** — and its value equals what
  the hosted page's browser redirect calls **`transactionid`** (the redirect's
  `depositcashierid` is a *different*, smaller id and does NOT match
  `cashierids` lookups). When fulfilling, key your replay guard on this value.
- `currency` can come back **`null`** for plain shekel charges — do not hard-fail
  a currency comparison on a missing field; rely on amount + reference +
  status.
- `amount` is in major units (`"1"` = ₪1). `transferstatus` `"S"` = success
  (the WooCommerce plugin also accepts `"A"`).
- `productdescription` carries the `paymentdetails` string you sent at
  checkout — embedding a unique order reference there is what makes
  server-side matching trivial.

## 6. Recommended verification flow (unchanged, now fully concrete)

Per `upay_server_side_verification_rule.md`: treat `returnurl`/`ipnurl` only
as triggers, then do the authenticated batch above, match
`sendertransactions[]` by your embedded order reference + paid status +
amount (±ε) + currency-when-present, enforce a UNIQUE constraint on the
stored `cashierid`, and mark the order paid exactly once.

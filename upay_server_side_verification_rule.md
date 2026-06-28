# Upay server-side verification rule

For the website payment flow, do not trust `returnurl` or `ipnurl` as proof of payment.

Use them only as triggers:

```text
returnurl/ipnurl notification
→ extract order_id / transactionid / cashierid hint
→ load local pending order
→ fetch Upay transaction server-to-server
→ match fetched transaction to local order
→ verify amount, currency, final status, merchant/account, and duplicate use
→ save Upay transactionid/cashierid
→ mark local order paid exactly once
```

## Why callback signing is not mandatory here

A callback signature/HMAC is useful, but not strictly required if your server always performs authenticated transaction lookup before fulfillment.

A fake callback can only cause your server to check Upay. It cannot create a matching successful transaction in Upay.

## Required local checks

| Check | Reason |
|---|---|
| Upay transaction exists | Prevent spoofed callbacks. |
| Amount equals local order amount | Hidden payment form fields can be modified. |
| Currency equals local order currency | Hidden payment form fields can be modified. |
| Status is final success | Do not fulfill pending/failed/cancelled/refused payments. |
| Upay transaction ID / cashier ID not already used | Prevent replay or double fulfillment. |
| Reference/order matches | Prevent paying one order and fulfilling another. |

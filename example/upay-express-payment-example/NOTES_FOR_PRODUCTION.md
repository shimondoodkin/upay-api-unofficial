# Production notes

## Return URL and IPN

Treat `returnurl` and `ipnurl` as two alternatives.

- `returnurl` is useful for customer experience.
- `ipnurl` is useful for reliable server completion.
- Either one may arrive first.
- The customer may close the page after payment, so `ipnurl` must be able to complete the order without browser redirect.
- Both triggers must be idempotent.

## Never trust browser/payment-form fields

The generated Upay form contains hidden fields such as `amount`, `currency`, `paymentdetails`, `returnurl`, and `ipnurl`. These are editable by the browser user.

Store your expected order data before redirecting to Upay:

- local order ID
- expected amount
- expected currency
- expected product/reference
- expected merchant/account

After any notification, fetch the transaction from Upay server-to-server and compare it to your local order.

## Fulfillment

Fulfillment must happen after server-side validation, not only on the thank-you page.

Good place in the example:

```js
verifyOrder() → validateTransactionAgainstOrder() → updateOrder(status: 'paid')
```

At that point you can safely:

- send an email
- unlock a download
- activate a subscription
- create/download receipt or invoice
- notify another internal system

## Idempotency

Use a unique constraint or equivalent logic in production:

```text
unique(upay_transaction_id)
unique(local_order_id)
```

This prevents double fulfillment if both `returnurl` and `ipnurl` arrive.

## IPN retry behavior

Upay retry behavior was not confirmed. Because of that, your system should be able to recover by polling/lookup as well, for example from an admin page or scheduled retry for orders stuck in `pending`.

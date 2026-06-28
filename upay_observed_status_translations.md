# Upay Observed Status and Document Translation Reference

Source type: observed Upay Hebrew client HTML/JavaScript translation table.  
Use as reverse-engineered reference, not official API documentation.

## Transaction status letters

| Letter | Hebrew labels observed | Practical meaning |
|---|---|---|
| `S` | `הועבר לחשבוני`, `חויב בחשבוני`, `אושרה` | successful / settled / charged / approved, depending on direction |
| `A` | `אושר`, `אישרתי`, `פעיל` | approved / accepted / active |
| `P` | `בהמתנה`, `ממתין לאישור`, `ממתין לאישורי` | pending / waiting for approval |
| `W` | `ממתין לאישור`, `ממתין לאישורי` | waiting / pending approval |
| `T` | `ממתין למורשה חתימה`, `ממתין לחתימה שלי` | waiting for authorized signer |
| `R` | `סורב`, `סירבתי` | refused / rejected |
| `C` | `בוטל`, `בוטלה` | cancelled |
| `N` | `עיסקה בוטלה` | transaction cancelled |
| `F` | `עיסקה נכשלה` | failed |
| `U` | `בוטלה` | cancelled in card-reader context |

## Bank deposit status

| Code | Hebrew | Meaning |
|---|---|---|
| `bankdepositstatus_F` | `עסקה שנפלה` | transaction failed/fell |
| `bankdepositstatus_L` | `גביה נכשלה` | collection failed |
| `bankdepositstatus_N` | `עסקה בוטלה` | transaction cancelled |
| `bankdepositstatus_O` | `נגבה מהיתרה` | collected from balance |
| `bankdepositstatus_P` | `ממתין לגביה מחשבון הבנק` | pending bank-account collection |
| `bankdepositstatus_S` | `נגבה מחשבון הבנק` | collected from bank account |

## Card reader transfer status

| Code | Hebrew | Meaning |
|---|---|---|
| `cardreadertransferstatus_A` | `אושרה` | approved |
| `cardreadertransferstatus_S` | `אושרה` | approved |
| `cardreadertransferstatus_N` | `בוטלה` | cancelled |
| `cardreadertransferstatus_U` | `בוטלה` | cancelled |

## Document types

| Value | Hebrew | Meaning |
|---|---|---|
| `INVOICE` | `חשבונית מס` | Tax invoice |
| `INVOICEANDRECEIPT` | `חשבונית מס קבלה` | Tax invoice + receipt |
| `INVOICENEGATIVE` | `חשבונית מס זיכוי` | Credit tax invoice |
| `RECEIPT` | `חשבונית קבלה` | Receipt |
| `REFUNDTRANSACTION` | `חשבון זיכוי` | Credit/refund document |
| `TRANSACTION` | `חשבון עסקה` | Transaction/pro forma document |

## Payment action type values

| Value | Hebrew | Meaning |
|---|---|---|
| `0` | `אתר` | Website |
| `1` | `דוא״ל` | Email |
| `2` | `הו״ק` | Standing order / direct debit |
| `3` | `מקדמה` | Advance |
| `4` | `עסקה ללא אובליגו` | Transaction without obligo/credit exposure |

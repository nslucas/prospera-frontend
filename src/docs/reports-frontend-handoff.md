# Reports Frontend Handoff

The Reports screen should consume the authenticated `/summary/*` endpoints. All endpoints below require the same bearer token used by the rest of the finance API.

Responses are returned as plain JSON, without a wrapper envelope. Money values are JSON numbers backed by `BigDecimal`.

## Common Params

- `month`: integer `1..12`.
- `year`: integer `>= 1900`.
- Date params such as `from` and `to`: ISO date string, `YYYY-MM-DD`.
- Invalid month/year/date ranges return `400` with the standard error body.

```json
{
  "timestamp": 1782160000000,
  "status": 400,
  "error": "Bad request",
  "message": "Month must be between 1 and 12",
  "path": "/summary/monthly"
}
```

## Monthly Overview

`GET /summary/monthly?month=6&year=2026`

Use this for the top-level monthly report cards.

```json
{
  "month": 6,
  "year": 2026,
  "incomeTotal": 5000,
  "accountExpenseTotal": 1200,
  "cardPaymentsTotal": 900,
  "netCashFlow": 2900,
  "totalAccountBalance": 7500,
  "cardBillsTotal": 1400,
  "cardBillsRemaining": 500,
  "categoryBreakdown": [
    {
      "categoryId": 1,
      "categoryName": "Food",
      "categoryType": "EXPENSE",
      "amount": 650
    }
  ],
  "budgetProgress": []
}
```

Notes:

- `netCashFlow = incomeTotal - accountExpenseTotal - cardPaymentsTotal`.
- `cardBillsTotal` and `cardBillsRemaining` are statement values for the selected due month, not purchase-date totals.
- `categoryBreakdown` includes account expenses plus card statement installments for the selected month.

## Category Breakdown

`GET /summary/categories?month=6&year=2026`

Use this when the Reports screen needs only category totals, for example charts or rankings.

```json
[
  {
    "categoryId": 1,
    "categoryName": "Food",
    "categoryType": "EXPENSE",
    "amount": 650
  },
  {
    "categoryId": null,
    "categoryName": "Uncategorized",
    "categoryType": "EXPENSE",
    "amount": 120
  }
]
```

Notes:

- Results are sorted by category name, with uncategorized or unknown categories last.
- Totals combine account expenses and card statement installments.

## Monthly Trends

`GET /summary/trends?fromMonth=1&fromYear=2026&toMonth=6&toYear=2026`

Use this for period charts. The response is chronological and inclusive of both endpoints.

```json
[
  {
    "month": 1,
    "year": 2026,
    "incomeTotal": 5000,
    "accountExpenseTotal": 1100,
    "cardStatementExpenseTotal": 900,
    "netTotal": 3000
  }
]
```

Notes:

- `netTotal = incomeTotal - accountExpenseTotal - cardStatementExpenseTotal`.
- If the start month is after the end month, the API returns `400`.

## Yearly Summary

`GET /summary/yearly?year=2026`

Use this for annual dashboards or a yearly report tab.

```json
{
  "year": 2026,
  "months": [
    {
      "month": 1,
      "year": 2026,
      "incomeTotal": 5000,
      "accountExpenseTotal": 1100,
      "cardStatementExpenseTotal": 900,
      "netTotal": 3000
    }
  ],
  "incomeTotal": 60000,
  "accountExpenseTotal": 13200,
  "cardStatementExpenseTotal": 10800,
  "netTotal": 36000
}
```

## Card Statements Summary

`GET /summary/cards?month=6&year=2026`

Use this for card report cards by statement month.

```json
[
  {
    "cardId": 1,
    "cardName": "Purple",
    "month": 6,
    "year": 2026,
    "totalAmount": 1400,
    "paidAmount": 900,
    "remainingAmount": 500,
    "status": "PARTIALLY_PAID"
  }
]
```

Possible `status` values:

- `OPEN`
- `PARTIALLY_PAID`
- `PAID`
- `OVERPAID`

Notes:

- The month/year filter is the card bill due month.
- Only active cards owned by the authenticated user are returned.

## Fixed vs Variable

`GET /summary/fixed-variable?month=6&year=2026`

Use this for fixed/variable expense composition.

```json
{
  "month": 6,
  "year": 2026,
  "fixedAmount": 1800,
  "variableAmount": 350,
  "unclassifiedAmount": 900
}
```

Notes:

- `fixedAmount` and `variableAmount` come from materialized recurrence records.
- Manual account/card expenses without recurrence classification are counted as `unclassifiedAmount`.

## Upcoming

`GET /summary/upcoming?from=2026-06-01&to=2026-06-30`

Use this for upcoming bills and recurrence previews.

```json
{
  "from": "2026-06-01",
  "to": "2026-06-30",
  "recurrenceOccurrences": [
    {
      "id": null,
      "recurrenceId": 10,
      "recurrenceName": "Rent",
      "occurrenceDate": "2026-06-05",
      "amount": 1800,
      "targetType": "ACCOUNT_TRANSACTION",
      "transactionType": "EXPENSE",
      "accountId": 1,
      "cardId": null,
      "categoryId": 3,
      "classification": "FIXED",
      "status": "PENDING",
      "transactionId": null,
      "expenseId": null
    }
  ],
  "cardStatements": [
    {
      "cardId": 1,
      "cardName": "Purple",
      "month": 6,
      "year": 2026,
      "dueDate": "2026-06-15",
      "closingDate": "2026-06-07",
      "totalAmount": 1400,
      "paidAmount": 900,
      "remainingAmount": 500,
      "status": "PARTIALLY_PAID"
    }
  ]
}
```

Notes:

- Recurrence occurrences are previews plus any existing occurrence state.
- `cardStatements` are included only when the due date falls inside `[from, to]`.
- If `from` is after `to`, the API returns `400`.

## Forecast

`GET /summary/forecast?months=12`

Use this for projection charts. `months` is optional, defaults to `12`, and accepts `1..24`.

```json
{
  "months": 12,
  "forecast": [
    {
      "month": 6,
      "year": 2026,
      "incomeTotal": 5000,
      "accountExpenseTotal": 1200,
      "cardStatementExpenseTotal": 1400,
      "cardPaymentsTotal": 900,
      "recurringIncomeTotal": 0,
      "recurringAccountExpenseTotal": 1800,
      "recurringCardExpenseTotal": 0,
      "projectedNetCashFlow": 1100,
      "projectedAccountBalance": 8600
    }
  ]
}
```

Notes:

- Forecast starts at the server's current month.
- The endpoint does not create transactions or expenses.
- Realized account/card data is combined with pending recurrence projections.
- Card statement spending and card payments are separate: statement values support spending projections, while card payments affect cash flow.

## Suggested Frontend Usage

- Initial Reports load: call `/summary/monthly`, `/summary/trends`, `/summary/categories`, and `/summary/cards` for the selected month/period.
- Use `/summary/yearly` for yearly mode instead of stitching 12 separate monthly calls.
- Use `/summary/forecast` only for projection views; do not mix it into realized totals.
- Treat `/summary/cards` and card statement fields as billing-cycle data. Do not replace them with `/expenses?month=&year=&cardId=` for Reports totals.

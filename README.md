# Household Ledger v2

Google Apps Script web app for Sejeong and Ankit's household spending. Each person signs in with their own Google account, uploads statements (CSV, Excel, PDF, screenshots), reviews the suggested categories and saves rows to the `transactions` tab of the **Spending & Cards DB** sheet.

- Spec: [Household Ledger v2 — 구축 명세서](https://claude.ai/artifact/HkyL2hFkj4z1tJ9eMmXozE)
- Web app: https://script.google.com/macros/s/AKfycbxzml1d4HcprFCxCOYdDtVCXEhHJezdwJKj23svu8Wmf6iuKRo-StrZ7RKF8Pm0jYQJ2Q/exec
- Apps Script project: https://script.google.com/home/projects/1b810t0Ochg-FGeU5PTb19L1Gp64cfs_CJRhw8MIlVu7AazGmM9aI9-0Z/edit

## Files

| File | What it is |
|---|---|
| `src/Code.gs` | Server: sheet reads and writes, the only Claude API call (`callClaude`), usage log, monthly cap, exchange-rate trigger |
| `src/Engine.html` | Pure functions cut from the original Household Ledger (classification, parsing, fees, duplicates, settlement) |
| `src/App.html` | Screen logic for Upload, Review, Month, Settings |
| `src/Index.html` | Page shell and styles |

## Deploying a change

1. In the Apps Script project, replace the changed files with the ones in `src/` and save.
2. Deploy → Manage deployments → pencil → Version: **New version** → Deploy. The URL stays the same.

The API key lives in Script Properties as `ANTHROPIC_API_KEY`. Never commit it.

## Tests

The tests run the real `src/` files. `test/mock.js` stands in for `google.script.run` with made-up data, and `test/gas.js` runs `Code.gs` against fake Apps Script services. No sheet is touched and no API is called.

```
cd test
npm install            # xlsx, pdfjs-dist (Playwright with Chromium must also be available)
npm test
```

| Suite | Covers |
|---|---|
| `gas.js` | Access check, monthly cap blocks before calling the API, usage log and cost, rule upsert and preset protection, saveRows, reprice on a month-end rate, daily FX job |
| `t4.js` | Upload → Review → Save: one Haiku call per upload, classification order, 20-column rows, learned rule |
| `t6.js` | Month totals and 60/40 settlement, Settings, rule delete, duplicate detection on re-upload |
| `t8.js` | FX: missing rate blocks saving, month-end rate is final, current month is provisional |

## Change log (26 Oct 2026)

- `Code.gs`: stop at the monthly cap before calling the API; show Anthropic's own error text and HTTP code.
- `Engine.html`: skip rows flagged Cancelled/취소; a memo carries over from history only when most past rows had it; keep the opened PDF for the image fallback.
- `App.html`: image-only PDFs (for example HSBC statements) are drawn as page images and read in one Haiku call with the same total check; the statement month comes from the transaction dates unless picked by hand.
- Checked against the real 2026-10-01 HSBC statement: 23 of 23 rows matched, total check passed.

# Isracard Excel File Format Reference

## File Details
- Format: .xlsx (Excel)
- Sheet name: "פירוט עסקאות"
- Encoding: Standard xlsx (UTF-8 internally)
- File naming: `{card_last_4}_{MM}_{YYYY}.xlsx` (e.g., 6208_01_2026.xlsx)

## File Structure

The file has metadata rows at the top, then transaction sections:

### Rows 1-8: Metadata (SKIP)
- Row 2: Title "פירוט עסקאות" + month/year (e.g., "ינואר 2026")
- Row 5: Card info + total charge amount
- Row 6: Cardholder name + charge date

### Row 9: Section header — "עסקאות למועד חיוב"
### Row 10: Column headers for main transactions
```
תאריך רכישה | שם בית עסק | סכום עסקה | מטבע עסקה | סכום חיוב | מטבע חיוב | מס' שובר | פירוט נוסף
```

### Rows 11-81: Transaction data
Each row:
- Column A: תאריך רכישה (Purchase date) — format: DD.MM.YY (e.g., "12.01.26")
- Column B: שם בית עסק (Merchant name) — Hebrew text
- Column C: סכום עסקה (Transaction amount) — number
- Column D: מטבע עסקה (Transaction currency) — "₪" or other
- Column E: סכום חיוב (Charge amount) — the actual charged amount in ₪
- Column F: מטבע חיוב (Charge currency) — usually "₪"
- Column G: מס' שובר (Voucher number) — numeric ID
- Column H: פירוט נוסף (Additional details) — "הוראת קבע" for standing orders, "תשלום X מתוך Y" for installments, or empty

### Row 82: Monthly total
```
| | סה"כ לחיוב החודש בכרטיס בש"ח | | | {total} | ₪ | | | |
```

### Row 85: Section header — "עסקאות בחיוב מחוץ למועד" (Off-cycle charges)
### Row 86: Column headers (same structure as row 10, with additional column 9: "חיוב בחשבון הבנק")
### Rows 87+: More transactions (same format)

### Row 109: Section header — "עסקאות בחיוב עתידי" (Future charges)
### Row 110: Summary text about future charges

### Rows 112-114: Legal disclaimers (SKIP)

## Parsing Rules

1. **Find the header row**: Look for a row where column A = "תאריך רכישה" — that's the header
2. **Read transactions below each header**: Continue reading rows until you hit an empty row, a summary row (column B contains "סה"כ"), or another section header
3. **There can be MULTIPLE transaction sections** in one file (main charges + off-cycle charges)
4. **Parse ALL sections** — combine all transactions into one list
5. **Date format**: DD.MM.YY → parse as DD.MM.20YY (e.g., 12.01.26 → 12/01/2026)
6. **Use column E (סכום חיוב)** as the amount — this is what was actually charged in ₪
7. **Column H (פירוט נוסף)** contains useful metadata:
   - "הוראת קבע" = recurring/standing order
   - "תשלום X מתוך Y" = installment payment
   - Empty = regular purchase
8. **Skip rows** where column A doesn't look like a date (DD.MM.YY pattern)
9. **Isracard does NOT provide categories** — the app needs to handle categorization itself

## Important: No Built-in Categories
Unlike what we assumed earlier, Isracard's export does NOT include a category column. 
The app will need to:
- Initially show all transactions as uncategorized
- Let the user assign categories manually
- Remember assignments for future uploads (by merchant name matching)

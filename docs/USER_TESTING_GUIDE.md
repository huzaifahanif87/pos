# Nexus POS — User Testing Guide (UAT)

**Version:** 1.0  **Build under test:** Nexus POS 1.0.0
**Tester name:** ______________________  **Date:** ____________
**Machine / OS:** ______________________

---

## 1. Purpose

This document walks you through **every feature** of Nexus POS so we can confirm the app
works correctly before release. Please go through each test in order. For every test:

1. Follow the **Steps**.
2. Compare what happens with the **Expected result**.
3. Record **Pass / Fail** and any notes in the accompanying **`TEST_CHECKLIST.csv`**
   (open it in Excel). Use the **Comments** column to describe anything that looks wrong,
   confusing, or could be improved.

> If something **crashes, freezes, shows an error, or looks broken**, mark it **Fail** and
> describe exactly what you did and what happened. A screenshot helps a lot.

---

## 2. Before you start (setup)

1. Launch **Nexus POS** (run the installer / `Nexus POS` shortcut, or `npm run dev` for the dev build).
2. The app should open to a **PIN login screen** within a couple of seconds.
3. The app starts as a **clean shop** — no products, customers, or sales yet. You will create
   them during testing.

**Default logins** (shown at the bottom of the login screen):

| Role | Username shown | PIN |
| --- | --- | --- |
| Store Owner (full access) | Store Owner | `1234` |
| Cashier (limited access) | Cashier | `1111` |

**Things to know while testing**

- **Receipts / Exports** open a **"Save As" dialog** — choose a folder and the file (PDF/Excel/CSV)
  is saved there. Open the saved file to confirm it looks correct. (There is no direct-to-printer
  integration yet — printing is via the saved PDF.)
- The **Dashboard, Reports and Forecast will be mostly empty until you record some sales** — so do
  the **Register / sales tests first**, then revisit those screens.
- The app is **offline-first**: it works with no internet. Cloud backup is optional.

---

## 3. Test sections

Legend for priority: **P1 = critical**, **P2 = important**, **P3 = minor/cosmetic**.

### A. Login, roles & access control

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-A1 | Open the app. Select **Store Owner**, type PIN `1234`. | Logs in; lands on **Dashboard**; full sidebar (Dashboard, Register, Inventory, Sales, Purchases, Customers, Vendors, Expenses, Reports, Forecasting, Settings). |
| TC-A2 | Log out (top of sidebar, bottom-left logout icon). Select **Store Owner**, type a wrong PIN `0000`. | Shows **"Incorrect PIN"**; does not log in. |
| TC-A3 | Log in as **Cashier** (PIN `1111`). | Logs in; lands on **Sell / Register**. Sidebar shows **only** Register, Sales History, Customers. No Dashboard, Inventory, Reports, Settings, etc. |
| TC-A4 | As Cashier, look at **Sales History** page. | Page opens; there is **no "Profit" figure** and **no Refund button** (cashier cannot see margins or reverse sales). |
| TC-A5 | As Owner, go to **Settings → Manage Users**, add a **Manager** (name, username, role = Manager, PIN). Log out, log in as that manager. | Manager sees everything **except Settings**. Can open Reports, Inventory, Purchases, etc. |
| TC-A6 | Log back in as **Owner**. | Full access restored. |

### B. Inventory — Categories & Products

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-B1 | Inventory → **Categories** → add 3 categories (e.g. Grocery, Drinks, Snacks). | Each appears in the list immediately. |
| TC-B2 | Delete one category. | It disappears from the list. |
| TC-B3 | **Add Product**: fill Name, SKU, Cost Price, Sale Price, Category, Opening Stock (e.g. 50), Low-stock alert (e.g. 10). Save. | Product appears in the table with correct price and stock; **Margin %** shows. |
| TC-B4 | Add 4–5 more products (include at least one with **stock = 0**, and one with stock **below** its low-stock threshold). | All save correctly. Low-stock item shows an **amber "low" badge**; zero-stock shows a red **"Out"** badge. |
| TC-B5 | The stat cards at top (Products, Stock Value, Low Stock, Out of Stock). | Numbers match what you entered. |
| TC-B6 | **Edit** a product, change its price, Save. | Updated price shows in the table. |
| TC-B7 | Click the **stock adjust** icon on a product, set a new count + reason, Save. | Stock updates to the new number. |
| TC-B8 | Search for a product by name and by SKU. | List filters to matching products. |
| TC-B9 | Try to add a product with a **duplicate SKU** (same as an existing one). | App **prevents it / shows an error** and does **not** crash. |
| TC-B10 | **Delete** a product (confirm the prompt). | Product removed from the list. |
| TC-B11 | Export inventory: click **PDF**, then **Excel**, then **CSV**. Open each saved file. | Three files save; each lists your products with cost, price, stock, stock value, and a total. |

### C. Register / Checkout (the core)

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-C1 | Open **Sell / Register**. | Product cards show (your in-stock products). Out-of-stock products appear **disabled** (greyed, not clickable). |
| TC-C2 | Click a product card. | It's added to the cart on the right; quantity 1; line total correct. |
| TC-C3 | Type part of a product name in the search box. | Product grid filters live. |
| TC-C4 | Type a product's **barcode** (if set) and press **Enter**. | That product is added to the cart. |
| TC-C5 | Use category chips (All / your categories). | Grid filters to that category. |
| TC-C6 | In the cart, use **+ / −** and type a quantity directly. | Quantity and line total update; setting qty to 0 removes the line. |
| TC-C7 | Add several items; set an **order Discount** value. | The Total drops by the discount; never goes below 0. |
| TC-C8 | Click **Hold**. | Cart clears; toast "Sale held". |
| TC-C9 | Click **Held (n)**, then a held sale to **recall** it. | The held cart loads back; you can continue. |
| TC-C10 | Click **Pay**. Choose **Cash**. Use a quick-amount button (e.g. round up). | Modal shows Total, Paid, and **Change** correctly. |
| TC-C11 | Click **Complete & Print**. | A **Save dialog** appears for the receipt PDF; after saving, a success toast shows the invoice number; cart clears. Open the PDF — shop name, items, totals, paid, change all correct. |
| TC-C12 | Do another sale with **Card**, then one with **Mobile**. | Both complete the same way. |
| TC-C13 | Make a few more varied sales (different products/quantities) — you'll need these for charts later. | All complete; invoice numbers increase (INV-00001, 00002, …). |

### D. Customers, Credit Sales & Receivables

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-D1 | **Customers → Add Customer**: name, phone, and an **Opening Balance** (e.g. 100). Save. | Customer appears; balance shows **100** under "Receivable". |
| TC-D2 | Add a second customer with **0** opening balance. | Appears as "Settled". |
| TC-D3 | Go to **Register**, add items, click **Pay**, choose **Credit**. | A **"Customer account (required)"** dropdown appears; **Complete is disabled** until you pick a customer. |
| TC-D4 | Pick a customer, click **Complete & Print**. | Sale completes; receipt shows the amount as **Due**. |
| TC-D5 | Go to **Customers**; check that customer's balance. | Balance **increased** by the unpaid amount. |
| TC-D6 | Open that customer's **Ledger** (book icon). | Shows the opening balance and the new invoice as a debit, with a running balance. |
| TC-D7 | Click **Record Payment** (hand-coins icon) for that customer, enter an amount, Save. | Balance **decreases** by the payment; a "payment-in" line appears in the ledger. |
| TC-D8 | In the Register, choose a payment method (e.g. Cash) but enter an amount **less than the total**, with a customer selected. | The remaining amount goes "on account" (Due) and is added to the customer's balance. |
| TC-D9 | Export a customer's **ledger** (Excel) and the **customer list**. | Files save and open correctly with the right figures. |

### E. Vendors & Payables

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-E1 | **Vendors → Add Vendor** with an **Opening Balance** (amount you owe them, e.g. 200). | Vendor shows balance **200** under "Payable". |
| TC-E2 | Open the vendor **Ledger**. | Shows opening balance entry. |
| TC-E3 | **Record Payment** to the vendor. | Payable balance decreases; "payment-out" line in ledger. |

### F. Purchases (buying stock)

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-F1 | **Purchases → New Purchase**. Select a vendor. Search and add 2 products. Set quantities and cost prices. Enter **Amount Paid Now = 0**. Save. | Purchase saves; appears in the list with a **Due** amount. |
| TC-F2 | Go to **Inventory**; check those products' stock. | Stock **increased** by the purchased quantities. |
| TC-F3 | Go to **Vendors**; check that vendor's balance. | Payable **increased** by the unpaid purchase amount. |
| TC-F4 | Create a second purchase with full payment (Paid = total). | No Due is added to the vendor. |
| TC-F5 | Click the **view** icon on a purchase. | Shows the items, quantities, costs and totals. |
| TC-F6 | Export purchases (PDF). | File saves with the purchase list and totals. |

### G. Expenses

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-G1 | **Expenses → Add Expense**: category, amount, note. Save. | Appears in the list; "This Month" and "Total" stat cards update. |
| TC-G2 | Add 2–3 more expenses in different categories. | All save. |
| TC-G3 | Delete one expense. | Removed; totals update. |
| TC-G4 | Export expenses (Excel). | File saves with all expenses and a total. |

### H. Sales History & Refunds

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-H1 | **Sales History**. Switch ranges (Today / 7 Days / 30 Days / This Month / All). | List updates; stat cards (Transactions, Revenue, Profit, Outstanding Due) recalculate. |
| TC-H2 | Search by invoice number and by customer name. | List filters. |
| TC-H3 | Click the **eye** icon on a sale. | Invoice detail opens with line items and totals. |
| TC-H4 | Click **Print** (printer icon) on a sale. | Receipt PDF save dialog appears; saved PDF is correct. |
| TC-H5 | Click **Refund** (circular arrow) on a completed sale, confirm. | Sale marked **Refunded**; go to Inventory and confirm the **stock was returned**; if it was a credit sale, the customer's **due is reversed**. |
| TC-H6 | Export sales (PDF and Excel). | Files save with sales rows and summary totals. |

### I. Dashboard

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-I1 | Open **Dashboard** (after recording several sales). | KPI cards show today's sales, profit, transactions, month figures, receivable, payable, inventory value, low stock, customers. |
| TC-I2 | Look at the charts. | **Sales & Profit Trend** (line/area), **Sales by Category** (donut), **Hourly pattern** (bars), **Top Products**, **Payment Methods** all render with your data. |
| TC-I3 | Check **Recent Sales** and **Low Stock Alerts** panels. | Recent sales list your latest invoices; low-stock panel lists items at/under threshold. |

### J. Forecasting

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-J1 | Open **Forecasting**. Switch 7 / 14 / 30 days. | A chart shows actual (solid) vs forecast (dashed) and projected next-7 / next-30 figures. (With only a little data the forecast will be small/flat — that's expected.) |

### K. Reports & Exports

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-K1 | **Reports → Profit & Loss**. Try different date ranges. | Shows Gross Sales, Discounts, Net Sales, COGS, Gross Profit, Expenses, **Net Profit**. Numbers look consistent. |
| TC-K2 | Export P&L as **PDF** and **Excel**. | Files save and match the on-screen figures. |
| TC-K3 | **Reports → Balance Sheet**. | Shows Assets (Cash, Inventory, Receivable), Liabilities (Payable), **Owner's Equity**. Assets = Liabilities + Equity. |
| TC-K4 | Export Balance Sheet (PDF / Excel). | Files save correctly. |
| TC-K5 | **Reports → Daily Sales**. | Bar chart + a table with per-day Txns, Gross, Discount, Tax, Net, Profit, and a totals row. |
| TC-K6 | Export Daily Sales as **PDF, Excel, and CSV**. | All three save correctly. |

### L. Settings

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-L1 | **Settings → Shop Profile**: change Shop Name, phone, address, **Currency Symbol** (e.g. to £ or Rs). Click **Save Settings**. | Toast confirms; the currency symbol now shows throughout the app (prices, totals). Shop name shows in the sidebar and on receipts. |
| TC-L2 | Change **Invoice Prefix** and **Next Invoice #**, Save. Make a sale. | Next invoice uses the new prefix/number. |
| TC-L3 | Change **Receipt Width** (58mm / 80mm), make a sale, open the receipt. | Receipt PDF matches the chosen width. |
| TC-L4 | **Manage Users**: add a user, edit a user's role, then try to **delete the only Owner**. | Add/edit work; deleting the only owner is **blocked** with a message. |

### M. Backup & Sync

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-M1 | Top bar: click **Back up now**. | Toast confirms a local snapshot was saved; "Last backup" updates. |
| TC-M2 | **Settings → Backup Plan**: choose **Local / Network Backup**, click **Browse**, pick a folder. Then **Back up now**. | A `NexusPOS-Backups` folder with snapshot(s) appears in the chosen folder. |
| TC-M3 | Choose **Cloud Backup (MongoDB Atlas)**. (If you have an Atlas connection string) paste it, set DB name, click **Test Connection**. | Without a string: a clear error. With a valid string: **"Connected … successfully"**. (Skip if you don't have Atlas — mark N/A.) |
| TC-M4 | Switch back to **Offline Only**. | Saved; sync pill in the top bar shows "Offline". |
| TC-M5 | **Settings → Restore latest backup** (confirm). | Message says it restored and to restart. (Optional — only if you want to test restore.) |

### N. Persistence & stability

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-N1 | **Fully close** the app, then reopen and log in. | All your products, customers, vendors, sales and settings are **still there**. |
| TC-N2 | Use the app for ~10–15 minutes across all screens. | No crashes, freezes, or blank screens. Navigation stays responsive. |
| TC-N3 | Resize the window / maximize. | Layout adapts; nothing overlaps or gets cut off badly. |

### O. Look & feel (cosmetic)

| ID | Steps | Expected result |
| --- | --- | --- |
| TC-O1 | Glance across all screens. | Clean **white background, black text, minimalist** style; consistent throughout; text is readable (good contrast). |
| TC-O2 | Check buttons, tables, and modals on each page. | Aligned and consistent; no overlapping or cut-off text; icons render. |

---

## 4. How to report results

1. Open **`TEST_CHECKLIST.csv`** in Excel.
2. For each row, put **Pass**, **Fail**, **Blocked**, or **N/A** in the **Result** column.
3. Add details in **Comments** — especially for any Fail (what you did, what happened, screenshot name).
4. Save the file and send it back, along with any screenshots.

**Summary to fill at the end:**

- Total tests: ______  Passed: ______  Failed: ______  Blocked/NA: ______
- Overall impression (1–5): ______
- Top 3 problems found:
  1. ___________________________________________
  2. ___________________________________________
  3. ___________________________________________
- Anything missing you'd expect a POS to have? ___________________________________________

---

## 5. Resetting to a clean shop (optional)

If you want to start over with empty data during testing, close the app and delete the data folder:

- **Windows:** `%APPDATA%\nexus-pos\data`  (or `…\Nexus POS\data`)
- **Linux:** `~/.config/nexus-pos/data`

Re-open the app — it recreates the two default logins and an empty shop. (This does **not** affect the installed app, only its data.)

Thank you for testing! 🙏

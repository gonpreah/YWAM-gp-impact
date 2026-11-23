# Finances draft — how it all fits together

The reference for `docs/drafts/finance-redesign.html` (the preview of the Finances section on
My Ministry). **Read this before changing a rule in the draft, and change this file in the same
commit** when a rule changes. Every number on the page comes from one of the parts below, and
most parts move another — that is where mistakes hide.

Plain words first; the code names are in brackets for whoever edits the draft.

---

## 1. The two things the page keeps track of

There are two separate pictures of the money, and they must never be mixed up:

| | **Where the money is** | **What the money is for** |
|---|---|---|
| What | ABA bank, US bank, Cash on hand | The six categories and their sub-categories (Admin, Funds, Ministry, Savings, War relief, Designated…) |
| Typed in at | 🏦 Balances | 📊 Allocations |
| Code | `BAL_DAYS`, `BAL.accts` | `ALLOC` (each category's `items`) |
| Total | **Total liquid assets** | **Allocated** |

The two totals should be equal ("✓ Every dollar is allocated"). When they aren't, the page says
how much is not allocated, or over-allocated.

An internal transfer between **accounts** (ABA → Cash) changes only the left side. A transfer
between **funds** (Kitchen → Hospitality) changes only the right side. **An account can never
move to or from a fund** — the page refuses it; money gets into a fund through Allocations or
Income.

---

## 2. Each part, what it changes

### 🏦 Balances
- One entry per day: ABA, US bank, Cash, for the **Reports as of** day. Saving the same day again
  replaces it (`BAL_DAYS`, newest first; `at` = when it was saved).
- The newest day is the starting point for every account estimate in Live (section 4).
- Changes nothing else.

### 📊 Allocations
- Every sub-fund's amount, typed for the Reports as of day. Saving **overwrites** the fund
  amounts with what was typed and keeps a copy for that day (`ALLOC_HIST`).
- The form opens on the funds as they stand now — i.e. including every income, expense and
  transfer already entered — so saving without changing a box keeps those.

### 💵 Income
- Each income has a kind, an amount, a bank account (ABA / US / Cash) and a date.
- **Funds:** the amount is shared out by the kind's formula (e.g. Team contributions → 40%
  Office/General, 25% Kitchen …). A kind with no formula asks which one fund it goes to.
  The funds go up **at once, when it is saved** (`flApply_` → `fundMove_`).
- **Accounts:** adds to the chosen account in the Live estimate (section 4).
- Can come one at a time, or from a QuickBooks import / bulk import (same result per line).

### 🧾 Expenses
- Each expense has a kind (the QuickBooks account list, plus Honorarium 54000 and Not sure),
  the category it is paid from (picked by hand, or from its QuickBooks class), a bank account,
  an amount and a date. No formulas.
- **Funds:** that one fund goes down at once.
- **Accounts:** takes off the chosen account in the Live estimate.

### 🔁 Internal transfers (`TRANSFERS`)
- **Fund → fund:** one fund down, the other up, at once. Accounts and the totals don't change.
- **Account → account:** one account down, the other up, in the Live estimate. Funds and the
  totals don't change.
- Every transfer shows in the transfer history.

### 🛠 Financial tools (`TOOL_XFERS`) — fixing a mistake
- "Add income" → a fund or account goes **up** with no real income behind it.
  "Remove income" → a fund or account goes **down** with no real expense.
- A fund adjustment moves that fund at once. An account adjustment moves that account in the
  Live estimate — and so the total liquid assets.
- Shown in the transfer history and in Income → History → Financial tools, nowhere else.

### 🤝 Advances
- **Given out:** who, date, fund, account, amount, pre-budgeted or not. The account goes down in
  the Live estimate. **The fund does not move yet** — nothing has been spent.
- **Settled:** day, spent, returned, QuickBooks reference.
  - *Spent* becomes an expense on the advance's fund (kind "Not sure", marked as from the
    advance). That fund goes down by what was spent. The account does **not** go down again —
    it already did when the money was given out.
  - *Returned* goes back into the account picked, in the Live estimate. No fund moves.
  - Spent + returned don't have to equal the advance; over 20% or $50 apart, it warns first.
- On the Dashboard advances are **always as they are now** — no day to pick. More than a month
  out (schools not counted) is flagged.
- Unsettling takes the spent-expense back off the fund.

### 💳 Staff debt
- Its own world: attach the A/R Ageing spreadsheet; it carries its own "as of" day from the
  file. It goes straight onto the Dashboard — **not** through Update and approve, and it moves
  no account or fund.

### 🗂 Category list
- The list of categories and sub-categories everything else uses. A sub-category's key is
  `category|name` (e.g. `adm|Kitchen`).
- **Rename / move:** the key changes, and everything that pointed at it follows — formulas,
  incomes, expenses, transfers, Financial tools, advances, remembered import answers, the
  saved allocation days and the approved days (`catRekey_`).
- **Add:** starts at $0. In an approved day from before, it shows as $0.
- **Delete:** only when it holds $0 and no formula uses it. It goes to History (Bring back
  restores it at $0). In an approved day that had it, it keeps its amount, marked "(deleted)"
  (`mergeSnap_`). A whole deleted category shows the same way (`ghostGroups_`).
- Up to 8 categories (the bar's colours).

### 📒 Detailed breakdown
- Where every transaction is kept, one line each. Columns: **Date · Account · Transaction type ·
  Name · Memo · Amount · Category · Category amount · Approved** (`LEDGER_COLS`,
  `inLedgerHtml_`, `ledgerLines_`).
- **Two money columns:**
  - **Amount** is real money — what is in, or moves through, a bank account or the cash box.
  - **Category amount** is money being given its *home* (a category). It is not income; it moves
    money, so it never touches Amount.
  - The two are signed so that **real money + category amounts = $0 when every dollar has a
    home**: real money is +, a category getting its home is −.
- **Approved** says which approved report a line is in (✅ and that day), or "Not yet".
- The lines are built from what has been entered — nothing is typed into the breakdown itself.
  Newest day first; within a day, balance entries first.
- **Balance entry** (from 🏦 Balances) — the **gold standard**: straight from the bank and the cash
  box. Each balances day gives three lines (ABA bank, US bank, Cash on hand) with the Amount
  typed; Name, Memo, Category blank. Approved: the approved day whose frozen balances are that
  same day with the same three amounts.
- **Manual allocation** (from saving 📊 Allocations by hand, `MANUAL_ALLOCS`) — one line per
  sub-category the save changed, in **Category amount**: −(what it changed by). The first manual
  allocation starts from nothing, so its lines are the whole amounts. A later one only has the
  sub-categories whose amount was changed (moving $100 Kitchen → Hospitality by re-typing =
  Kitchen +$100, Hospitality −$100). Account, Name, Memo, Amount blank. Approved: the first
  approved day on or after it that was approved after it was saved.
  - Data saved before manual allocations were kept gets one from the first approved day's
    allocations (else the first saved allocations day) when it is opened.
  - Category renames and moves carry into them (`catRekey_`).
- **The check above the table** (`ledgerCheck_`): real money = the newest balances day's total
  (balances are levels, not movements, so only the newest counts) + every Category amount.
  $0 → "✓ Every dollar has a home"; otherwise how much has no home, or how much more is given a
  home than there is.
- Not in it yet: income, expenses, transfers, Financial tools, advances. Until they are, the check
  is only right when nothing of those has happened since the newest balances. Still to decide:
  how each fills the columns (a transfer has two accounts or two categories; an income split by
  a formula touches several categories).

---

## 3. Approved and Live

The Dashboard has two views.

### ✅ Approved
- Only days someone approved with **Update and approve** (`PUBLISHED`). Nothing approved →
  "Nothing approved yet".
- Approving day D freezes, for that day:
  - the balances of D (or the latest day before it);
  - the funds as they stood on D (the saved allocation day on or before D);
  - the list of incomes, expenses, transfers and adjustments dated on or before D, by id.
- Later entries never change an approved day by themselves. **The one exception:** an entry
  dated on or before the approved day asks "add it to the approved report?" — tick yes and it
  is added to that day's funds and list (`addToApproved_`, marked "Added to the … approval
  later").
- The ticks beside each part (Balances, Allocations, Income, Expenses, Transfers) are only ever
  ticked by hand. Approving with some unticked asks first. Staff debt is never part of it.

### 📡 Live
- "Up to today": the newest balances plus everything entered since (section 4), and the funds
  as they stand now.
- Every figure that isn't typed directly is labelled **Estimated**.

---

## 4. The estimates in Live — how each account is worked out

For each account (ABA, US bank, Cash):

```
estimate = the newest balances entry for that account
         + incomes into it              − expenses out of it
         + transfers into it            − transfers out of it
         + Financial tools adding to it − Financial tools removing from it
         − advances given out of it     + advance money returned into it
```

…counting **only entries that came after the balances** (`afterBal_`). An entry came after the
balances when:

1. **It is dated after the balances day** — always, whenever it was typed. (It can't be in those
   balances.) *Added 23 Nov 2026: before this, re-saving the balances for an earlier day dropped
   a transfer dated after it from the estimate.*
2. Otherwise (dated on or before the balances day), **it was typed after the balances were
   saved** — e.g. an expense paid in the afternoon after the morning's balances, or a late
   entry for an earlier day. Typed before the balances were saved → it is taken to be in them
   already, and not counted again.
3. Entries from before times were kept fall back to their date (the balances day included).

**Total liquid assets (Live)** = the three account estimates added up. An account → account
transfer cancels out, so it never changes the total.

Expenses that came from settling an advance are left out of the account side (the advance
already took the money off when it was given) — see Advances.

The **funds** need no estimate: income, expenses, fund transfers, fund adjustments and settled
advances already moved them when they were saved. Live shows the funds as they are now.

### Worked example
Balances for 20 Nov saved: ABA $10,000 · US $0 · Cash $1,000 → total $11,000.

| Then | ABA | Cash | Total | Funds |
|---|---|---|---|---|
| Transfer ABA → Cash $500, dated 22 Nov | 9,500 | 1,500 | 11,000 | no change |
| Income $300 into Cash, kind Staff contributions, 22 Nov | 9,500 | 1,800 | 11,300 | Office/General +300 |
| Expense $100 out of ABA, from Kitchen, 22 Nov | 9,400 | 1,800 | 11,200 | Kitchen −100 |
| Advance $200 to Sam out of Cash, from DTS, 22 Nov | 9,400 | 1,600 | 11,000 | no change yet |
| Settled: $150 spent, $50 returned to Cash | 9,400 | 1,650 | 11,050 | DTS −150 |
| Balances for 20 Nov saved again, same numbers | 9,400 | 1,650 | 11,050 | (still counted — all dated after the 20th) |

---

## 5. Undo and History (the sticky bar on Input)

- **↩ Undo** takes back the last input (asks for a second tap).
- **🕘 History** lists the last 40 inputs on this device, newest first. Any one can be undone **on
  its own**: only what that input changed is taken back — amounts by the difference, entries by
  their id — and everything done since stays (`merge3_`).
- If something entered later changed the very same thing (e.g. a sub-category was added and
  then money moved into it), it can't be pulled apart; it offers **Go back to before it**, which
  also undoes the inputs after it, and says how many.
- An undo made from History is itself in History, so it can be cancelled.
- Each section's own 🕘 History link (Balances, Allocations, Transfers, Advances, Staff debt,
  Category list) is the record of that part — not the same thing as this undo list.

---

## 6. Where it is kept (the draft only)

Everything is kept in this browser (`localStorage`: `gp-fin-draft-v1` for the data,
`gp-fin-draft-undo` for History). The real app will keep it on the server. The amounts in the
draft are sample numbers; real reports and names never go in the repository.

---

## 7. Before changing a rule — checklist

1. Which part is it, and which other parts does it move (section 2)?
2. Does it change Approved, Live, or both (section 3)?
3. Does it change when an entry counts in an estimate (section 4)? Re-check the worked example.
4. Does it rename or move a category key? Then everything in the Category list bullet must
   follow.
5. Can it still be undone on its own from History?
6. Update this file in the same commit.

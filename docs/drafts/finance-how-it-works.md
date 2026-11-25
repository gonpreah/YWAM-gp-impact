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

### 📥 Bulk import — describing what is imported (25 Nov 2026)
- Under "These lines are from" there is **Describe what you're importing** (optional, `S.bulkNote`), e.g. "This
  import is the ABA expenses from the class Admin in QBO — this corresponds to Office/General in our system".
- The page reads three things out of the words (`bulkNoteRead_`) and says what it found under the box as you type:
  an **account** (ABA / US bank / Cash — "us" on its own is not the US bank), **what the lines are** (expenses,
  income or transfers — only when the words name one kind) and a **category** — the sub-category named *last*, so
  "class Admin … corresponds to Office/General" gives Office/General (a one-item category like Savings by its own
  name too).
- When a file is read, what it found goes on **every line** (`bulkNoteApply_`), over the guess from that line's own
  words: the kind (not against the line's direction — an "expenses" description never turns money-in into an
  expense), the account for income and expenses, the category for expenses (and for income of a kind with no
  formula), marked "suggested — from your description". Changing the words after the file is read: **Put it on
  every line**. Lines are still ticked by hand before they're added.
- The words are kept on every entry added from that file (`impNote`) and show at the end of its memo in the
  Detailed breakdown ("Import: …"). Once every line is added, the box empties for the next file.

### 📥 Bulk import — lines already in an approved total (25 Nov 2026)
- A month imported in one go can hold lines already counted in an approved report (e.g. everything on or before
  the 16th). Tick **Some of these lines are already in an approved total** (shown once something is approved) and
  pick the approved day; each line dated on or before it is tagged "✅ in the … approved report", and when added
  it goes into that day's approved report (`bulkPre_` → `addToApproved_(x, kind, day, noFunds)`, `x.preApproved`).
- So it **doesn't move the bank or cash** (approved and on or before the balances → inside them, section 4) but it
  **does count in the income and expenses** (the profit and loss, the Ministries tab, the Approved view).
- **The allocations — asked every time** ("Had the 16 Nov allocations already taken them off?"; Add waits for an
  answer): **Yes** → that day's approved category balances are left as they are; **No** → the lines come off them
  too (as the single-entry "Add it to the approved report as well" tick always does).
- **After Yes, a second question** — the lines would take the money off the categories a second time (the live
  category amounts move, as for any income or expense). **Write a fix line** (`bulkFix_`): for each sub-category
  the marked lines moved, one Financial tools adjustment ("Add income" to it for expenses, "Remove income" for
  income), dated the approved day, in its approved report (funds left as they were), memo "Fix line — the …
  allocations already had these taken off (imported from …)", `src:'bulkfix'`. The expenses still show in the
  income and expenses; the category balances stay as approved; the breakdown's check doesn't move. **Let them go
  down**: no fix line — the categories go down in Live and the check shows the difference. Add waits for this
  answer too. Lines after the approved day are never fixed — they are new spending.

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

### 🤝 Advances — their own report
- **Advances never move an account or a category, and are not in Live or the Detailed
  breakdown** (23 Nov 2026 — they belong to a different report). The real spending comes in
  with the expenses, like any other.
- **Given out:** who, date, fund, account, amount, pre-budgeted or not — recorded in the
  Advances list only.
- **Settled:** day, spent, returned, QuickBooks reference — recorded on the advance only. It no
  longer makes an expense.
  - Spent + returned don't have to equal the advance; over 20% or $50 apart, it warns first.
- On the Dashboard advances are **always as they are now** — no day to pick. More than a month
  out (schools not counted) is flagged.
- Data from before this: an expense a settled advance made (`src:'advance'`) is taken back out
  of the expenses, and off its fund, the first time the page is opened (`loadState_`).

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
  Name · Memo · Amount · Category amount · Category · Approved** (`LEDGER_COLS`,
  `inLedgerHtml_`, `ledgerLines_`).
- **Two money columns:**
  - **Amount** is real money — what is in, or moves through, a bank account or the cash box.
  - **Category amount** is money being given its *home* (a category). It is not income; it moves
    money, so it never touches Amount.
  - Both are + when they go up: real money coming in, a category's balance growing. So
    **real money − category amounts = $0 when every dollar has a home**.
- **Approved** says which approved report a line is in (✅ and that day), or "Not yet".
- The lines are built from what has been entered — nothing is typed into the breakdown itself.
  Newest day first (the ↓ / ↑ on the Date heading flips it to oldest first, `S.ledAsc`); within a
  day, balance entries, then manual allocations, then income, expenses, internal transfers and
  adjustments. Memos are cut short to one line;
  tapping one shows it whole.
- **💧 Estimated liquid assets — from the breakdown** (a drop-down, `ledgerLiquid_`,
  `ledLiquidHtml_`): for a day picked (today to start), each account worked out from the breakdown
  alone: its latest Balance entry on or before the day, then the Amount of every line after it up
  to the day, and of every line on or before it that isn't approved yet. Under each account,
  where it was worked out from. **For today these are the Dashboard's Live figures** (section 4).
  Folded, it shows the day and the total.
- **📊 Estimated allocation breakdown — from the breakdown** (a drop-down, `ledgerCats_`,
  `ledCatsHtml_`): for the same day, every Category amount up to it added up for each
  sub-category, grouped by category, with the total allocated. A category no longer on the list
  shows "(deleted)". No resets — allocations already hold only what changed. For today it comes
  to the same as the Dashboard's categories (which move as entries are saved).
- Both share one day picker value (`S.ledLiqDay`).
- **Filters** (`LED_FILTERS`, `S.ledF`): tap Account, Transaction type, Category or Approved to
  pick which values to show — All, or any number of them (blank values are "(blank)"). Only lines
  matching every column's picks show, with "Showing n of N lines" and Clear filters. The check
  above the table always uses every line, whatever is filtered.
- **Total row** at the bottom (stuck to the foot of the table box): the Amount and the Category
  amount of every line that can be seen, added up — with a filter on, only the lines it shows,
  and it says "n lines shown". It is a plain sum: with more than one balances day the Amount
  total adds the balance entries together (the 💧 box is the one that resets at each).
- The table scrolls inside its own box (up to 70% of the screen high) with the headings stuck at
  the top, so it can be swiped sideways wherever you are in it.
- **Balance entry** (from 🏦 Balances) — the **gold standard**: straight from the bank and the cash
  box. Each balances day gives three lines (ABA bank, US bank, Cash on hand) with the Amount
  typed; Name, Memo, Category blank. Approved: the approved day whose frozen balances are that
  same day with the same three amounts.
- **Manual allocation** (from saving 📊 Allocations by hand, `MANUAL_ALLOCS`) — one line per
  sub-category the save changed, in **Category amount**: what it changed by (+ when the
  category's balance goes up). The first manual
  allocation starts from nothing, so its lines are the whole amounts. A later one only has the
  sub-categories whose amount was changed (moving $100 Kitchen → Hospitality by re-typing =
  Kitchen −$100, Hospitality +$100). Account, Name, Memo, Amount blank. Approved: the first
  approved day on or after it that was approved after it was saved.
  - Data saved before manual allocations were kept gets one from the first approved day's
    allocations (else the first saved allocations day) when it is opened.
  - Category renames and moves carry into them (`catRekey_`).
- **Expense** (from 🧾 Expenses, one entry or imported) — Date, Account (the bank account it came
  out of), Name (who was paid), Memo (the kind of expense, then the memo), and the same amount
  **negative in both Amount and Category amount**: it lowers our real balance and the category's
  "virtual bank account" alike. One line per category it was paid from. Approved: the approved day whose frozen list holds it
  (`PUBLISHED[day].ids.exp`), else "Not yet".
- **Income** (from 💵 Income, one entry or imported) — Date, Account (the bank account it came
  into), Name (who it came from), Memo (the kind of income, then the memo), and the same amount
  **positive in both Amount and Category amount**. One line per category its formula shares it
  out to; each line's Amount is that share, so the lines add up to the whole income. Approved:
  the approved day whose frozen list holds it (`PUBLISHED[day].ids.inc`), else "Not yet".
- **Internal transfer** (from 🔁 Internal transfers) — two lines: the side it left (−) and the side
  it reached (+), the memo starting "→ where it went" / "← where it came from". Category to
  category: only **Category amount** moves (no Account, no Amount). Account to account: only
  **Amount** moves (no Category). Approved: `PUBLISHED[day].ids.xf`.
- **Adjustment (Financial tools)** — one line on the side it fixes: an account (Amount) or a
  category (Category amount); + for "Add income", − for "Remove income", memo saying which.
  It has no other side, so it moves the check: adding to an account leaves that much with no
  home until it is allocated; adding to a category gives a home to money that isn't there.
  Approved: `PUBLISHED[day].ids.tool`.
- **The check above the table** (`ledgerCheck_`): real money = the newest balances day's total
  (balances are levels, not movements, so only the newest counts) + the Amount of every line
  that came after those balances (the same rule as the Live estimates, `afterBal_`) − every
  Category amount. An expense from before the newest balances is already in them; its
  Category amount still counts, which is right because the allocations saved since already
  start from the funds after it.
  $0 → "✓ Every dollar has a home"; otherwise how much has no home, or how much more is given a
  home than there is.
- Everything that moves money is in it (advances are their own report and move nothing).

### 🏛 Ministries (a tab of its own, 25 Nov 2026 — in the demo only, not in Impact yet)
- One allocation's own report — mostly the ministries, but any sub-category can be picked (`minsHtml_`, `S.mn`).
  **Everything on it is the 📒 Detailed breakdown added up** for the sub-categories picked (matched by `cat`
  = `fundLabel_`).
- **✅ Approved / 📡 Live** on top — the Dashboard's own switch (one setting, `S.dashMode`, so changing it on either
  tab changes both). **Approved** counts only lines that are in an approved report (`appr` set) — the fully
  checked picture; it says which approved day is the latest and that anything after it isn't counted yet, and with
  nothing approved it says so and points to Live. **Live** counts every line, approved or not — the newest picture,
  marked estimated. The balance, its share of the total liquid assets (`ledgerLiquid_` on the same lines), the
  profit and loss and the comparison all follow the switch.
- **Time filter** on top (`MN_PERIODS`, `mnPeriod_`): This week (Monday to today) · This month · Last week ·
  Last month · Year to date · All time · Custom (from / to). Each is compared with the period before it: this
  week / this month / year to date with the **same days** of last week / last month / last year (so a part
  period isn't set against a whole one); last week and last month with the one before; custom with the same
  number of days just before; all time with nothing.
- **Picker** (`mnPickerHtml_`): Ministry budgets first, then "Other allocations". Tap to add or take one away;
  "All n" — or tapping the category's name — picks a whole category (tapped again: just its first one). **Clear all** (shown when two or more are picked) empties the picks, back to
  "Nothing selected yet" and N/A; taking away the last one does the same. Several picked are added together, with an "Each one" table under the report.
  **Opens on Office/General.** Taking every pick away (Clear all, or untapping the last) leaves nothing selected:
  "Showing" says "Nothing selected yet" and every figure reads **N/A** (the total liquid assets still shows — it is
  the base's, not a ministry's) until one is picked.
- **💰 Balance**: every Category amount of those sub-categories up to the period's last day (as `ledgerCats_`),
  how it moved since the period's first day, and its share of the total liquid assets that day
  (`ledgerLiquid_`).
- **📈 Profit and loss**: Income = their Income lines' Category amounts in the period; Expenses = their Expense
  lines' (shown as a positive number); Net = income − expenses; each with ▲ / ▼ against the period before (green
  when income rises or spending falls). Then where the income came from and where the money went, by kind
  of income / expense, and the transactions themselves (folded).
- **Not income or expenses**: manual allocations, internal transfers and Financial tools move the balance only;
  their total for the period is one line under the profit and loss.

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

**Since 23 Nov 2026 the Dashboard reads these from the 📒 Detailed breakdown** (`liveLiquid_` →
`ledgerLiquid_` for today; `acctAmt_`, `liveNet_` and `total()` in Live all go through it, as do
the transfer form's "more than the account holds" checks and the breakdown's check). Each
account = its latest Balance entry + the Amount of every line after it, or not approved yet. The
sum below is what that comes to.

For each account (ABA, US bank, Cash):

```
estimate = the newest balances entry for that account
         + incomes into it              − expenses out of it
         + transfers into it            − transfers out of it
         + Financial tools adding to it − Financial tools removing from it
```

…counting **only entries that came after the balances** (`afterBal_`). An entry counts on top of
the newest balances when:

1. **It is dated after the balances day**, or
2. **it isn't approved yet** — whatever its date and whenever it was typed. Only an entry that is
   in an approved report is taken to be inside the balances. *(23 Nov 2026, the rule from the
   office: "we only don't count stuff if it's approved". It replaced "typed after the balances
   were saved", which left out a $1,272.80 Financial tools adjustment on Cash typed before the
   23rd's balances were saved, though nothing was approved.)*

So in Live an unapproved entry can be counted on top of a balance that already holds it (e.g.
an expense paid, then the cash counted and typed, neither approved). That is accepted: Live may
not line up; approving is when real money and category amounts must match.

**Total liquid assets (Live)** = the three account estimates added up. An account → account
transfer cancels out, so it never changes the total.

Advances move nothing — see Advances.

The **funds** need no estimate: income, expenses, fund transfers and fund adjustments already
moved them when they were saved. Live shows the funds as they are now.

### Worked example
Balances for 20 Nov saved: ABA $10,000 · US $0 · Cash $1,000 → total $11,000.

| Then | ABA | Cash | Total | Funds |
|---|---|---|---|---|
| Transfer ABA → Cash $500, dated 22 Nov | 9,500 | 1,500 | 11,000 | no change |
| Income $300 into Cash, kind Staff contributions, 22 Nov | 9,500 | 1,800 | 11,300 | Office/General +300 |
| Expense $100 out of ABA, from Kitchen, 22 Nov | 9,400 | 1,800 | 11,200 | Kitchen −100 |
| Advance $200 to Sam out of Cash, from DTS, 22 Nov | 9,400 | 1,800 | 11,200 | no change (advances move nothing) |
| Settled: $150 spent, $50 returned to Cash | 9,400 | 1,800 | 11,200 | no change |
| Balances for 20 Nov saved again, same numbers | 9,400 | 1,800 | 11,200 | (still counted — all dated after the 20th) |

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

## 6. Where it is kept

- **The demo** (this draft, published as an artifact): in that browser (`localStorage`: `gp-fin-draft-v1` for the
  data, `gp-fin-draft-undo` for History), with sample numbers to start from. Its top bar has
  **📤 Copy my entries for Impact**.
- **Impact** (`public/finance.html`, built from this file by `scripts/build-finance-page.mjs` with
  `window.GP_FIN_APP`): on the server, one document per campus (`fin2:<campus>`, `fin2Get` / `fin2Save`), saved a
  moment after each change ("Saving…" / "✓ Saved" bottom left; "⚠️ Not saved — tap to try again" when it
  couldn't). If someone else saved first, the newer copy is shown and the last change has to be entered again.
  No sample numbers. The Finances office edits; Campus Leadership sees the Dashboard only. History (undo) stays
  on each device. **📥 Bring in entries from the demo** on Input replaces this campus's document with the
  pasted copy (Undo puts it back).
- **Inside My Ministry it is one page with the app**: the frame is as tall as the page, so the app's tabs and
  the finance page scroll together; the "Reports as of" bar still sticks to the top of the screen and pop-ups open
  on screen.
  - **Phone and computer alike** (25 Nov 2026): on a computer the app's bar is a rail down the left, so it covers
    none of the bottom — the app only counts a bar that sits along the bottom (`fin2NavH_`). The app also sends the
    screen's height (`sh` → `--sh`), which sizes the breakdown and grid boxes (not the part of the page showing,
    which changes as you scroll). A pop-up open: the app dims the rest of its screen too (`{gpFin:'sheet'}` →
    `#fin2Dim`; a tap there closes it), raising the frame and cutting it to the part on screen so it never covers the
    phone's bottom bar. From 780px wide the page is 800px wide instead of phone width. "✓ Saved" shows for 2½ s.
- Real reports and names never go in the repository.

## 7. Agreed, not built yet (23 Nov 2026)

The direction: **every input builds the 📒 Detailed breakdown, and every report is the breakdown
added up** — e.g. Account = ABA bank and Approved up to the 16th gives ABA in the 16th's approved
report; every line gives Live.

1. **A balance entry resets its account.** Adding up an account starts from its latest Balance
   entry (the whole amount, as typed — nothing before it counts) and adds only the lines after
   it. A balance entry exists only where one was typed under 🏦 Balances; a day without one has
   just the *expected* balance (the last entry + lines since). Balance entry lines stay as they
   are now — the rule is in how they're added up.
   - Agreed: a line dated on or before the balance entry is inside it only if it is approved;
     otherwise it is added on top (the same rule as the Live estimate, section 4).
2. **Categories are added up as they are**: every Category amount, no resets (manual allocations
   already hold only what changed).
3. **Real money and category amounts only have to match to approve.** In Live they may differ —
   the check above the breakdown is information then, not a warning. To approve day D:
   real money (each account by rule 1, up to D) − category amounts (rule 2, up to D) must be
   **$0**; otherwise Update and approve says how far apart they are and doesn't approve.
4. **"Approved up to D"**: a report for D is every line approved on D or earlier, not only the
   lines first approved on D.
5. **Order to build in**: rule 1 in the adding up (the 💧 box in the breakdown already uses it); then approving by rule 3; then the Dashboard read from the
   breakdown, checked figure by figure against what it shows today.

Example (made up): balances 16 Nov ABA 50,000 · US 20,000 · Cash 1,671.15, allocations, approved;
17th ABA → Cash 500 and Office/General → Kitchen 300; 18th income 1,000 into ABA (Team
contributions) and food 120 from Cash; 19th advance 200 from Cash for DTS, settled 150 spent,
50 back (moves nothing). Breakdown added up, no balance entry after the 16th: ABA 50,500 · US
20,000 · Cash 2,051.15 = 72,551.15, the same as the Dashboard's Live · categories 72,551.15 ·
real − category $0. With a balance entry on the 20th (ABA 50,400 · Cash 2,051.15), the accounts reset to
those and match the Dashboard's Live figures today.

## 8. Before changing a rule — checklist

1. Which part is it, and which other parts does it move (section 2)?
2. Does it change Approved, Live, or both (section 3)?
3. Does it change when an entry counts in an estimate (section 4)? Re-check the worked example.
4. Does it rename or move a category key? Then everything in the Category list bullet must
   follow.
5. Can it still be undone on its own from History?
6. Update this file in the same commit.

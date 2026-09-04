# UI/UX — what was measured, what was fixed, what is left

2026-09-03. The brief's UI sections (§14, §21, §24, §25, §35, §36) are written as direction
rather than as a list of defects, so this is the audit that turns them into one: every claim
below was counted in the code, not eyeballed.

---

## Fixed

### §21 — Global search

There was none. `services/search/globalSearch.js` now covers customers, invoices, credit
notes, estimates, receipts, products and brands, on Alt+S and a control in both headers.

Three matching rules, each earned by how people type rather than by how the data is stored:

- **Numbers are matched bare.** Nobody says "INV-8475"; they say "8475". A query that is
  entirely digits matches the numeric tail of a document id as well as the whole id — and
  "b12" does not, or it would match every id containing 12. Zero padding is on the paper and
  not in anyone's head, so `REC-12` finds `REC-0012`.
- **Phone numbers are compared as digits**, so `0300-1234567`, `03001234567` and
  `+92 300 1234567` are one number. Under three digits is a coincidence and scores nothing.
- **Words match at word boundaries first.** "shah" finds Al Shaheer ahead of Bakhshah.

Two faults its own tests caught: `8475` scored as a middling partial match, because the
hyphen in `INV-8475` is a word boundary, which filed a dead-on invoice number under the
wrong group; and two bills on one day tied on date and fell back to alphabetical order, so
`INV-8475` sorted above `INV-8476` in a list meant to be newest-first. That second one is the
same fault the printed Previous Balance had, on a different screen.

### §14 — The customer card

Asked for: name, outstanding, **last invoice, last payment, last transaction**, and actions
**[Ledger] [New Invoice] [Receive Payment] [WhatsApp]**. The card had the first two and one
action. Everything else meant opening the ledger to answer "have they bought lately" and
"when did they last pay" — the two questions asked before ringing someone.

`services/customers/customerCard.js` supplies the three facts, with the judgement the
Collections view needed: **cash taken at the counter is a payment.** It lives on the invoice
as `receivedAmount`, so a card built from the payments collection alone would say a customer
who settled Rs 136,000 yesterday had not paid in a month.

The card now separates three states that used to look identical to "up to date": never
traded, traded but never paid, and quiet for more than thirty days.

### §25 — Keyboard focus

**Counted: 46 controls carry Tailwind's `outline-none` with nothing put back**, out of 111
uses of it. The browser's focus ring is removed and a keyboard user has no idea where they
are. Most are inputs where the ring was dropped for looks and a `focus:border` added instead
— reasonable for a text field, useless for a button.

Fixed with one rule in `src/index.css` rather than 46 edits. `:focus-visible` is what makes
that safe: it fires for keyboard focus and not for a mouse click, so nothing changes for a
pointer user. `!important` is required because `outline-none` is a utility in the same
stylesheet and wins on source order otherwise.

### §25 — Navigation state, and §36 tap targets

Both navs showed the current tab by colour and announced it to nobody: `aria-current="page"`
now. The bottom nav's buttons had no minimum height and were as tall as their contents made
them; `min-h-[48px]` puts them over the usual thumb guideline by construction rather than by
coincidence. The roving tabindex and arrow-key handling were already correct.

### §35 — The animation that never existed

`ModalWrapper` has always applied `animate-slide-up`, and **nothing has ever defined it**, so
every modal in the app simply appeared. The same shape of fault as a Settings field that
nothing reads: it round-trips perfectly and does nothing. Defined at 160ms, with
`prefers-reduced-motion` honoured.

---

## Measured and NOT fixed

### §25 — Form labels

**Counted: 149 inputs, selects and textareas. `aria-label`: 0. `htmlFor`: 0. Wrapped by
their label: 2.** The 101 `<label>` elements in the codebase are visual text sitting above
their field with no programmatic association, so a screen reader announces most fields with
no name at all — or reads the placeholder, which is unreliable and disappears the moment
somebody types.

This is the largest remaining accessibility gap and it is deliberately left open, because
the fix is a 149-site mechanical edit across roughly thirty files and this codebase has been
broken twice by exactly that kind of sweep. If it is wanted, the safe order is:

1. `BillingTab` and the payment, customer and credit-note modals — the forms used daily.
2. Admin forms.
3. Filter controls, which are the least valuable and the most numerous.

Each step is its own commit with the render tests re-run, not one sweep.

### §20 — Mobile-first billing

Not audited. The section asks for recently-used products, duplicate invoice, repeat previous
order and keyboard navigation, which are features rather than fixes, and it explicitly warns
"do not complicate the UI to add features". It should be asked for deliberately.

### §35/§36 — Visual identity and responsive layout

Both read as "do not break what works", and nothing was found broken. The app is already
mobile-first: the layout is a bottom-nav phone app that becomes a sidebar at `lg`, rather
than a desktop layout squeezed down.

### §24 — Modal system

Audited and left alone, as the brief asks. `ModalWrapper` already has Escape handling, a
focus trap, initial focus, body scroll locking and a background-click close. The only thing
missing was the animation it was asking for.

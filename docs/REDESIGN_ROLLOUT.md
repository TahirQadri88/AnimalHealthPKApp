# Redesign rollout: backup and rollback plan

The Khyber Traders look (unslop trial, branch `claude/unslop-billing-trial`) changes how
screens look. It changes no stored data, no rules and no calculations. The one behaviour
change is a display fix: the payment label on an invoice card reads the derived payment
status, the same one the card's colour already used.

So the risk is a screen that looks wrong or does not load, never lost data. A backup is
still taken first, because "nothing touches data" is a claim and a backup is a fact.

## Before going live

1. **Data backup (owner, 1 minute).** Admin → Settings → Backup & Data Safety →
   **Full Backup (JSON)**. Save the file somewhere outside this computer (Google Drive).
   Check the Firebase Auto-Backup on the same page shows a recent date.
2. **Code restore point (Claude).** Done 2026-11-04: branch `backup/before-redesign` on
   GitHub points at `eae2d17`, the version that was live. A tag was the first plan, but
   this session's connection to GitHub refuses tag pushes; a branch outside `main` and
   `claude/**` does the same job and does not deploy.
3. **Checks on the branch (Claude).** `npm run verify` (lint, 998+ tests, build) and
   `node tools/ui-preview/contrast.mjs <palette>` (every text colour at WCAG AA).

## Going live

One merge commit onto `main`, so the whole redesign can be undone in one step. GitHub
Actions deploys in about 3 minutes.

Then, on a real device, after a full refresh:

- Billing list loads, filters and search work, totals in the summary band look right.
- New invoice: pick a customer, add two products, save as estimate, then issue an invoice.
- Print that invoice on the thermal printer. Print layouts are not part of the redesign
  and must come out exactly as before.
- Sign in as a staff member and do the same.

## Rolling back

If anything is wrong, say so and Claude runs:

```
git revert -m 1 <merge commit>     # a new commit that undoes the redesign
git push origin main               # redeploys the previous look in ~3 minutes
```

Nothing to restore in Firestore: the redesign wrote nothing there. If a refresh still
shows the new look, wait for the deploy to finish; the service worker fetches pages
network-first, so the old build returns on the next load after it lands.

The data backup from step 1 is for the unexpected only. Restoring it overwrites current
data, so it is the last resort, not part of a normal rollback.

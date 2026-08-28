# Security cutover — plaintext passwords → Firebase Auth

Moving login from "compare a plaintext password stored in Firestore" to Firebase
Authentication, then closing the database with real rules.

**The database is currently world-readable and world-writable.** Anyone with the API key —
which is in the JavaScript of the deployed site, as it is for every Firebase web app — can
read and change everything. Until step 4 is done, that remains true.

This is staged deliberately. Do the stages in order and verify between them: publishing the
new rules before every account is migrated locks the whole business out of a live system.

---

## Where things stand

- **Stage A — shipped.** The app can authenticate with Firebase Auth, an admin can migrate
  accounts, and the old login still works for anyone not yet migrated. Nothing has changed
  for users yet.
- **Stage B — you.** Enable the provider, run the migration, check everyone can log in.
- **Stage C — after B is verified.** Switch login to Auth-only and publish the strict rules.

---

## Stage B — migrate the accounts

**1. Take a backup first.** Admin → Settings → backup. If anything goes wrong this is what
you restore from.

**2. Enable the sign-in provider.** Firebase console → **Authentication** → **Sign-in
method** → **Email/Password** → Enable → Save. Leave *Email link* off.

**3. Run the migration.** In the app: **Admin → Users → Login Security** → *Move N
account(s) to Firebase Auth*.

For each account this creates a Firebase Auth login using the password already on file,
stores the resulting UID on the user record, writes a `userRoles/{uid}` entry that the
security rules read, and deletes the stored password. Nobody is signed out and **no
password changes** — everyone logs in exactly as before.

**4. Read the result.** The panel reports what moved and what did not. Two failures are
expected and are not bugs:

- *"Password is under 6 characters."* Firebase enforces a 6-character minimum. Set that
  user a longer password in Admin → Users, then run the migration again.
- *"Email/Password sign-in is not enabled."* Step 2 was missed, or the console change has
  not propagated yet. Wait a minute and retry.

**5. Verify before going further.** Have **every** person log in on their own device. The
panel must read *"All N account(s) use Firebase Authentication"* with none left. Do not
start Stage C while even one account is unmigrated.

---

## Stage C — close the database

Only once Stage B is verified.

**1. Keep the current rules where you can find them.** Copy what is in the console today
into a scratch file. That is the rollback.

**2. Publish the new rules.** Firebase console → **Firestore Database** → **Rules**. Paste
the contents of `firestore.rules.strict`, then **Publish**.

**3. Test immediately, in this order:**

- An admin can log in, open invoices, save one.
- A staff user can log in and save an invoice.
- A staff user is refused something admin-only.
- A signed-out browser sees no data at all.

**4. If anything is broken:** paste the old rules back and publish. Access returns within
seconds. Then report what failed.

**5. Once confirmed,** copy `firestore.rules.strict` over `firestore.rules` in the repo so
the file matches what is actually live.

### What still needs doing in code at Stage C

The app is not finished for Auth-only operation. Before the strict rules can stay up:

- **Login must stop reading `app_users` before authenticating.** It currently finds the
  user by name to get their email. Under the new rules that read is denied while signed
  out. Sign in first using the address derived from the typed name, then load the profile.
- **Creating or editing a user must maintain `userRoles/{uid}`**, including creating the
  Auth account. Right now only the migration writes that mirror, so a user added afterwards
  will have no role document and the rules will refuse them everything.
- **Renaming a user does not move their login.** The Auth address is fixed when the account
  is created, which is why `loginName` is stored separately. Either keep the login name
  fixed or update the Auth email too — silently breaking someone's login on a rename is the
  failure mode to avoid.

---

## Rollback

| Stage | To undo | Effect |
|---|---|---|
| B | Nothing to undo — migrated users log in normally; the old path still exists for the rest. | None |
| C | Republish the previous rules from the console. | Access restored in seconds |

The migration deletes the stored password only after Firebase confirms the account exists,
so a failure part-way leaves that person still able to log in the old way. The only true
one-way step is the deletion of stored passwords — recoverable from the Stage B backup, and
the whole point of the exercise.

---

## What this does not fix

Firebase Auth and rules address *who may read and write what*. They do not address:

- Document numbers still coming from a client-side `max + 1`, so two people billing at once
  can take the same number.
- `paymentStatus` stored on the invoice rather than derived from payments.
- Financial deletes being physical, with no audit trail.

Those are in `docs/IMPROVEMENT_BRIEF.md`.

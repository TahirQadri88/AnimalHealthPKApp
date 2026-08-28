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

**5. Rebuild the login lookup.** In the same panel, click **Rebuild login lookup**. This
writes the username→address entries the login screen needs once it can no longer read the
user list. Accounts migrated before this button existed have no entry yet.

**6. Verify before going further.** Have **every** person log in on their own device. The
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

### Code changes for Auth-only operation — done

All shipped. For reference, what had to change and why:

- **Login no longer reads `app_users` before authenticating.** It resolves the username
  through the public `loginIndex`, signs in, then reads the role mirror. The old flow read
  the user table to find credentials, which is denied to a signed-out visitor.
- **Firestore listeners re-subscribe when the session changes.** A listener refused
  permission is terminated and never retried, so every collection would have died on the
  login screen and stayed dead — a logged-in user would have seen an empty app.
- **First-run bootstrap no longer gates on `appUsers` being empty.** That list is
  unreadable from the login screen under the new rules, so the check would have been true
  for everyone and diverted every sign-in into bootstrap. It now runs only when Firebase
  confirms no such account exists and the setup secret matches.
- **Creating, editing and deleting users maintains all three records** — profile, role
  mirror, login index. Deleting only the profile would leave the Auth account working with
  its rights intact, since a browser cannot delete an Auth user.
- **Forgotten passwords are recoverable.** Admins set a new password from the user modal;
  it issues a fresh Auth account under a new alias and repoints the index.

Still true and worth knowing: **renaming a user does not move their login.** The Auth
address is fixed at creation, which is why `loginName` is stored separately.

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

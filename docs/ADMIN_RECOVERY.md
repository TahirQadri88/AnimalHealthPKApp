# Locked out? Admin recovery

Since the Firestore rules were closed, the app's own permissions decide who can do what.
Authorisation is read from `userRoles/{uid}`, and only an admin may write that collection.
So if no working admin remains, **the app cannot repair itself** — it has to be done from
the Firebase console, which bypasses security rules.

Nothing here is a backdoor. It requires ownership of the Firebase project.

---

## The app tries to prevent this

Two guards exist:

- The only admin cannot be demoted to staff.
- The only admin cannot be deleted.

They can still be defeated — promote a second admin, delete the first, then demote the
second — and they do nothing about an account whose `userRoles` document is wrong or
missing. Hence this document.

---

## Symptoms and what they mean

| What you see | Cause |
|---|---|
| Login works, but the app is empty and nothing saves | `userRoles/{uid}` missing, or `active` is not `true` |
| Login works, but Admin tab is gone | `role` on the role document is not `admin` |
| "Invalid Credentials" on a password you know is right | `loginIndex` entry missing or wrong — try **Rebuild login lookup** first, from another admin's account |
| Nobody can administer anything | No document in `userRoles` has `role: "admin"` and `active: true` |

---

## Recovery

**1. Find the account's UID.** Firebase console → **Authentication** → **Users**. Find the
person by email address and copy the **User UID**.

Your accounts use their real email addresses as usernames, so the address shown here is the
one they type to log in.

**2. Open the role document.** Firebase console → **Firestore Database** → **Data** →
`userRoles` collection → the document whose ID is that UID.

**3. Fix the fields.** For a working admin it must read:

```
uid         (string)  the same UID as the document ID
appUserId   (string)  the id of their document in app_users
name        (string)  their display name
role        (string)  admin
permissions (map)     empty is fine for an admin
active      (boolean) true
```

`role` and `active` are the two that matter. `active` must be the boolean `true`, not the
string `"true"` — the rules compare against a boolean and a string will fail.

**4. If the document does not exist**, create it with the UID as the document ID and the
fields above. Copy `appUserId` from the matching `app_users` document, matched on
`authEmail` or `name`.

**5. Reload the app and sign in.** Access returns immediately; rules are evaluated per
request, nothing is cached.

---

## If the login itself will not work

The above assumes the person can authenticate. If sign-in fails:

- **Password forgotten:** another admin sets a new one from Admin → Users → Edit.
- **No admin available:** Firebase console → Authentication → Users → the row's ⋮ menu →
  **Reset password**. This emails a reset link, which works because the usernames are real
  addresses.
- **Username not resolving:** check `loginIndex` in Firestore. The document ID is the
  username lowercased with every run of non-alphanumeric characters replaced by a dot —
  `owais797@icloud.com` becomes `owais797.icloud.com`. It needs one field, `authEmail`,
  holding the address on the Auth account.

---

## Worst case: reopen the rules

If nothing above works and the business is stopped, temporarily restore access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

Publish that, fix the data through the app, then **immediately republish the real rules
from `firestore.rules`**. While those temporary rules are live the entire database is
public — treat it as minutes, not hours, and do not leave it overnight.

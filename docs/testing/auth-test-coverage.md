# Auth Test Coverage — Technical Summary

## How tests are structured

All auth tests are Playwright E2E tests in `tests/e2e/auth/`. They rely on three layers:

1. **Supabase Admin API** (`tests/utils/supabase-test-client.ts`) — creates/deletes real users directly in the database using the `service_role` key, bypassing RLS
2. **Playwright fixtures** (`tests/e2e/fixtures/auth.ts`) — wraps test setup/teardown to provision users before each test
3. **Session helpers** (`tests/e2e/utils/session-helpers.ts`) — inspects `localStorage` in the browser to check auth state

---

## Sign Up (`signup.spec.ts`)

**What it does:** Calls the real sign-up form with generated credentials (`generateTestCredentials()` produces a unique timestamped email). No Supabase mock — it hits the actual Supabase Auth API.

**How it verifies:** After submitting the form, it checks:
- URL redirects to `/auth/verify-email` (Supabase's "email not yet confirmed" state)
- The verify-email page renders a "Check your email" heading
- A "Return to Sign In" link is present and navigable

**What it does NOT verify:** That a real confirmation email was sent or that clicking the link in the email works end-to-end (there's no email inbox integration).

---

## Sign In / Session (`login.spec.ts`)

**How users are provisioned:** The `testUser` fixture calls `supabase.auth.admin.createUser({ email_confirm: true })` — creates a real Supabase user with email pre-confirmed, so no email verification step is needed. It also inserts a row into `user_roles` with `role: 'admin'`.

**How authentication is verified:** After signing in, `isAuthenticated()` inspects `localStorage` in the browser for a key matching the pattern `sb-*-auth-token`. This is the JWT session token Supabase's JS client stores. It polls every 100ms up to 30s.

| Test | Verification method |
|---|---|
| Valid sign-in | `localStorage` has `sb-*-auth-token` + URL no longer contains `/auth` |
| Invalid credentials | Error toast (`AUTH_SIGNIN_ERROR`) appears; URL stays at `/auth` |
| Session persists after refresh | `isAuthenticated()` returns `true` after `page.reload()` |
| Sign out | `AUTH_SIGNOUT_SUCCESS` toast + `localStorage` token absent |

---

## Sign Out (`login.spec.ts`)

Clicks the user menu trigger (`USER_MENU_TRIGGER`), then the sign-out button (`SIGNOUT_BUTTON`). Verification is:
1. `AUTH_SIGNOUT_SUCCESS` toast visible
2. `waitForSessionClear()` polls `localStorage` until `sb-*-auth-token` is gone

---

## Email Verification / Unverified User (`unverified-email.spec.ts`)

**How the unverified user is created:** `createTestUser('test', false)` passes `email_confirm: false` to the Supabase Admin API. The user exists in auth but `email_confirmed_at` is `null`.

**How it verifies:** Signing in as this user should trigger either:
- An `AUTH_EMAIL_UNVERIFIED` error toast, OR
- A redirect to `/auth/verify-email`
- Optionally: `sessionStorage.getItem('verifyEmail')` contains the user's email (used by the resend logic)

The test uses `||` assertions because the app can handle this two ways (toast vs. redirect). Full end-to-end email link clicking is **not tested** — it would require a real email inbox or Supabase's test email feature.

---

## Password Reset (`password-reset.spec.ts`)

**What is actually tested end-to-end:**
- The forgot password form is reachable (click `FORGOT_PASSWORD_LINK`)
- HTML5 `validity.valid` is `false` for malformed emails
- Submitting a valid email shows `PASSWORD_RESET_SENT_SUCCESS` toast (Supabase sends the email; the test just verifies the UI confirmed success)

**What is NOT tested end-to-end:** The actual reset link from the email — opening it, entering a new password, and signing in again. The test file explicitly notes this requires email inbox integration and marks those test bodies as "covered in manual testing procedures." The `after reset, can sign in` test just re-tests normal sign-in to confirm the sign-in flow works.

---

## Key technical mechanics

### `createTestUser` / `deleteTestUser`

Uses `supabase.auth.admin.createUser` / `deleteUser` (service role key). Cleanup is comprehensive: deletes from 14+ tables (collaboration, project, audit fields) before calling `deleteUser` to avoid FK constraint failures.

### Session detection

```ts
// localStorage key pattern: sb-<project-ref>-auth-token
const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
```

This is checked directly in the browser's `localStorage` — not via any app-level cookie or UI element. It's a direct inspection of what Supabase's JS client stores.

### Two Supabase clients in tests

- `createServiceRoleClient()` — for test setup/teardown (bypasses RLS, creates/deletes users)
- `createAnonClient()` / `createAuthenticatedClient()` — for testing what a real user can actually access under RLS

---

## Gaps / limitations

- **Email link verification:** No inbox API integration. Confirming an email or using a password reset link can only be tested manually or by directly calling `supabase.auth.admin.updateUserById({ email_confirm: true })`.
- **Password reset token flow:** The "set new password" and "sign in after reset" tests are effectively placeholders — they test the UI exists and that normal sign-in works, not the actual reset token redemption.
- **Magic links / OAuth:** Not tested at all in the current suite.

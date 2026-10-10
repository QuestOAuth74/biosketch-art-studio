# Testing Guide - Science Canvas Creator

## Overview

This directory contains automated tests to verify that Milestone 1 (Database & Authentication) requirements are fully implemented and working correctly.

## Test Structure

```
tests/
├── utils/
│   ├── supabase-test-client.ts      # Test utilities for Supabase connections
│   └── mock-resend.ts               # Mock Resend API for edge function tests
├── database/
│   ├── seed-verification.test.ts    # Database seeding verification tests
│   └── rls-policies.test.ts         # RLS policy verification tests
├── e2e/
│   ├── auth/
│   │   ├── signup.spec.ts           # Signup E2E tests (5 tests)
│   │   ├── login.spec.ts            # Login E2E tests (5 tests)
│   │   ├── unverified-email.spec.ts # Unverified email E2E tests (5 tests)
│   │   └── password-reset.spec.ts   # Password reset E2E tests (7 tests)
│   ├── fixtures/
│   │   ├── auth.ts                  # Authentication fixtures
│   │   └── test-data.ts             # Test data generators
│   └── utils/
│       ├── page-objects/
│       │   ├── AuthPage.ts          # Auth page object model
│       │   └── VerifyEmailPage.ts   # Verify email page object model
│       └── session-helpers.ts       # Browser session utilities
├── edge-functions/
│   └── send-email/
│       ├── send-email.test.ts       # Send email edge function tests (5 tests)
│       ├── fixtures.ts              # Email payload generators
│       └── helpers.ts               # Email validation utilities
└── README.md                         # This file
```

## Test Categories

Tests are organized into three categories:

### Core Tests (Always Run)
Run with `npm test` - included in all regular test runs and CI/CD pipelines.

- **Database Tests**: RLS policies, seed verification, performance optimizations
- **Edge Function Tests**: Email sending functionality
- **E2E Tests**: Authentication flows, admin features

### Optional Tests (On-Demand)
Run with `npm run test:all` or specific commands.

- **Stress Tests**: Performance and load testing (6+ minute runtime)
  - Run with: `npm run test:e2e:stress`
  - Included in: `npm run test:all`
  - Purpose: Validate system under load, concurrent user scenarios

### Diagnostic Tests (Troubleshooting)
Run with `npm run test:e2e:diagnostics` - for environment verification only.

- **Environment Verification**: Database connection, environment variable checks
- Purpose: Troubleshoot configuration issues, not functional validation
- Not included in regular test runs or reports

## Prerequisites

### Environment Variables

Tests load environment variables with the following priority:
1. `.env.local` (preferred - checked first)
2. `.env` (fallback)

Required variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

**Recommendation:** Use `.env.local` for local development to avoid accidentally committing secrets.

### Database State

Tests assume:
1. ✅ All migrations have been applied (`supabase db push`)
2. ✅ Database has been seeded (`npm run seed`)

## Running Tests

### Quick Start

```bash
# Run all core tests + generate report (recommended)
npm test

# Run all tests including stress tests + generate report
npm run test:all

# Run specific test suites
npm run test:unit              # Database tests only
npm run test:edge-functions    # Edge function tests only
npm run test:e2e              # E2E tests only (no stress/diagnostics)
npm run test:e2e:stress       # Stress tests only
npm run test:e2e:diagnostics  # Diagnostic tests only

# Generate report from existing test results
npm run test:report
```

### Test Reports

After running tests, comprehensive reports are automatically generated:
```
test-results/test-report.md   # Markdown report
test-results/test-report.pdf  # PDF report
```

The reports include:
- Overall pass/fail status
- Summary metrics (total, passed, failed, pass rate)
- Per-suite breakdown with individual test results
- Test execution details and available commands

**Note**: Reports are generated automatically when using `npm test` or `npm run test:all`.

### Prerequisites for Running Tests
- Development server running at `http://localhost:8080` (for E2E tests)

### Database & Unit Tests (Vitest)

**Run only database tests:**
```bash
npm run test:unit
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run with UI:**
```bash
npm run test:ui
```

**Run only Milestone 1 database tests:**
```bash
npm run test:milestone1
```

**Run with coverage:**
```bash
npm run test:coverage
```

**Run edge function tests:**
```bash
npm run test:edge-functions
```

**Run specific edge function tests:**
```bash
npm run test:edge-functions:send-email
```

### E2E Tests (Playwright)

**Prerequisites:**
1. Start development server: `npm run dev` (must be running at `http://localhost:8080`)
2. Tests will connect to the already-running server

**Run all E2E tests:**
```bash
npm run test:e2e
```

**Run E2E tests with UI mode:**
```bash
npm run test:e2e:ui
```

**Run E2E tests in headed mode (see browser):**
```bash
npm run test:e2e:headed
```

**Debug E2E tests:**
```bash
npm run test:e2e:debug
```

**Run only auth E2E tests:**
```bash
npm run test:e2e:auth
```

### Test Output Files

Tests generate JSON output files for report aggregation:

- `test-results/vitest-database.json` - Database test results
- `test-results/vitest-edge-functions.json` - Edge function test results
- `test-results/results.json` - E2E test results (chromium project)
- `test-results/results-stress.json` - Stress test results (optional)
- `test-results/test-report.md` - Consolidated markdown report
- `test-results/test-report.pdf` - Consolidated PDF report

## Test Suites

### Database Seeding Verification (`seed-verification.test.ts`)

Verifies that the seed script successfully populated the database:

- ✅ 12 icon categories exist
- ✅ Each category has at least one sample icon
- ✅ Blog categories (5+) and tags (10+) exist
- ✅ Site settings exist with correct structure
- ✅ Testimonials are seeded
- ✅ Admin role assignment (if user exists)
- ✅ At least 20 sample icons distributed across categories

### RLS Policy Verification (`rls-policies.test.ts`)

Verifies Row Level Security policies work correctly:

#### Icons & Categories
- ✅ Unauthenticated users can read icons
- ✅ Unauthenticated users can read icon_categories
- ✅ Authenticated users can read icons
- ✅ Authenticated users can read icon_categories
- ✅ Non-admin users cannot insert/update/delete icons

#### Profiles
- ✅ User can SELECT their own profile
- ✅ User can UPDATE their own profile
- ✅ User cannot SELECT another user's profile
- ✅ User cannot UPDATE another user's profile
- ✅ Unauthenticated users cannot INSERT profiles
- ✅ Profile created automatically via trigger on signup

#### Canvas Projects
- ✅ User can view their own projects
- ✅ User can view public approved projects
- ✅ User cannot access another user's private project
- ✅ Admin can access all projects (if admin exists)

#### Login Attempts
- ✅ Service role can insert login attempts
- ✅ Regular users cannot access login_attempts table

### E2E Tests (`tests/e2e/auth/`)

End-to-end browser tests for authentication flows using Playwright.

#### Signup Tests (`signup.spec.ts`) - 5 tests
- ✅ User can sign up with email and password
- ✅ Sign-up redirects to `/auth/verify-email`
- ✅ Verify email page displays "Check your email" heading
- ✅ Page shows "Return to Sign In" link
- ✅ Link navigates back to auth page

#### Login Tests (`login.spec.ts`) - 5 tests
- ✅ User can sign in with valid credentials
- ✅ Invalid credentials display error
- ✅ Session persists across page refresh
- ✅ User can sign out successfully
- ✅ After sign out, session is cleared

#### Unverified Email Tests (`unverified-email.spec.ts`) - 5 tests
- ✅ Sign-in with unverified email detects error
- ✅ Triggers automatic verification email resend
- ✅ Redirects to `/auth/verify-email?resent=true`
- ✅ Page displays resent confirmation
- ✅ "Return to Sign In" link works

#### Password Reset Tests (`password-reset.spec.ts`) - 7 tests
- ✅ Forgot password form is accessible
- ✅ Form validates email format
- ✅ Submitting valid email shows confirmation
- ✅ "Back to Sign In" link exists
- ✅ Password reset page validates requirements
- ✅ User can set new password via reset link
- ✅ After reset, can sign in with new password

**Total E2E Tests: 22**

### Edge Function Tests (`tests/edge-functions/send-email/`)

Unit tests for the `send-email` edge function with mocked Resend API.

#### Send Email Tests (`send-email.test.ts`) - 5 tests
- ✅ Handles signup event with valid payload
- ✅ Handles recovery event with valid payload
- ✅ Returns success response for valid requests
- ✅ Returns error for missing required fields
- ✅ Correctly formats email templates with user data

**Additional Coverage:**
- All 5 email types (signup, recovery, invite, magiclink, email_change)
- CORS header validation
- HTML template structure validation
- Confirmation URL format verification
- Email branding (logo, styling, content)

**Total Edge Function Tests: 5**

## Manual Testing Procedures

Comprehensive manual testing procedures are documented in [`docs/manual-testing-milestone1.md`](../docs/manual-testing-milestone1.md).

### Manual Test Coverage (7 tests)

**Database Tests (2):**
- Database seed verification
- Idempotency verification

**Email Delivery Tests (5):**
- Signup verification email
- Verification link functionality
- Password reset email
- Password reset link functionality
- Unverified email sign-in flow

### Quick Manual Testing Checklist

#### Seed Script Idempotency
- [ ] Run `npm run seed` multiple times
- [ ] Verify no errors occur
- [ ] Verify data is not duplicated (uses upsert/count checks)

#### Email Delivery
- [ ] Signup sends verification email with branding
- [ ] Verification link confirms account
- [ ] Password reset sends branded email
- [ ] Reset link allows password change
- [ ] Unverified email triggers auto-resend

For detailed step-by-step manual testing procedures, see [Manual Testing Documentation](../docs/manual-testing-milestone1.md).

## Test Utilities

### Database Test Utilities (`tests/utils/`)

#### `supabase-test-client.ts`
Provides helper functions for database and auth tests:

- **`createServiceRoleClient()`** - Creates client with service role (bypasses RLS)
- **`createAnonClient()`** - Creates anonymous client (subject to RLS)
- **`createAuthenticatedClient(email, password)`** - Signs in and returns authenticated client
- **`createTestUser(prefix)`** - Creates a test user account
- **`deleteTestUser(userId)`** - Deletes a test user account
- **`cleanupTestData(table, condition)`** - Helper to clean up test data

#### `mock-resend.ts`
Mock Resend API for edge function tests:

- **`MockResend`** - Mock class mimicking Resend API
- **`emails.send(params)`** - Mock email sending (records calls, doesn't send)
- **`setFailure(error)`** - Simulate API failures
- **`getAllCalls()`** - Get all recorded email send calls
- **`getLastCall()`** - Get most recent email send call
- **`wasSentTo(email)`** - Check if email was sent to address
- **`wasSentWithSubject(subject)`** - Check if email with subject was sent

### E2E Test Utilities (`tests/e2e/`)

#### Fixtures (`tests/e2e/fixtures/`)

**`auth.ts`** - Authentication fixtures for Playwright:
- **`testUser`** - Verified user fixture with auto-cleanup
- **`unverifiedUser`** - Unverified user fixture
- **`authenticatedPage`** - Pre-authenticated browser page

**`test-data.ts`** - Test data generators:
- **`generateTestEmail()`** - Unique test email addresses
- **`generateTestPassword()`** - Valid test passwords
- **`generateTestCredentials()`** - Complete user credentials
- **`INVALID_CREDENTIALS`** - Invalid credential constants
- **`INVALID_EMAILS`** - Invalid email formats

#### Page Object Models (`tests/e2e/utils/page-objects/`)

**`AuthPage.ts`** - Auth page interactions:
- **`signUp(email, password)`** - Perform signup
- **`signIn(email, password)`** - Perform signin
- **`clickForgotPassword()`** - Navigate to password reset
- **`submitPasswordReset(email)`** - Submit reset request

**`VerifyEmailPage.ts`** - Verify email page interactions:
- **`hasHeading()`** - Check heading visibility
- **`clickReturnToSignIn()`** - Navigate back to auth
- **`clickResend()`** - Resend verification email
- **`hasResentConfirmation()`** - Check resent message

#### Session Helpers (`tests/e2e/utils/session-helpers.ts`)

Browser storage and session utilities:
- **`getSessionStorage(page, key)`** - Get session storage item
- **`getLocalStorage(page, key)`** - Get local storage item
- **`isAuthenticated(page)`** - Check if user is authenticated
- **`clearAllStorage(page)`** - Clear all browser storage
- **`waitForAuthentication(page)`** - Wait for auth completion
- **`waitForSessionClear(page)`** - Wait for session clearance

### Edge Function Test Utilities (`tests/edge-functions/send-email/`)

#### `fixtures.ts`
Email payload generators:
- **`createSignupPayload(email)`** - Signup email payload
- **`createRecoveryPayload(email)`** - Password reset payload
- **`createInvitePayload(email)`** - Invite email payload
- **`createMagicLinkPayload(email)`** - Magic link payload
- **`createEmailChangePayload(email)`** - Email change payload
- **`createInvalidPayload()`** - Invalid payload for error testing

#### `helpers.ts`
Email validation utilities:
- **`extractConfirmationUrl(html)`** - Extract URL from email HTML
- **`parseConfirmationUrl(url)`** - Parse token and parameters
- **`validateEmailHtml(html, expected)`** - Verify email content
- **`hasValidEmailStructure(html)`** - Check HTML structure
- **`hasProperBranding(html, brand)`** - Verify branding elements
- **`isValidConfirmationUrl(url)`** - Validate confirmation URL format

## Troubleshooting

### Tests Fail with "Missing environment variables"
- Ensure `.env.local` exists with required variables
- Run from project root directory

### Tests Fail with "Permission denied"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct (not anon key)
- Check migrations have been applied

### Tests Fail with "Table not found"
- Run migrations: `supabase db push`
- Run seed script: `npm run seed`

### RLS Tests Fail Intermittently
- Tests run sequentially to avoid race conditions
- If issues persist, check for concurrent database connections

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm run test:run
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.PUBLISHABLE_KEY }}
```

## Test Coverage Summary

### Milestone 1: Database & Authentication (COMPLETE)

**Automated Tests:**
- ✅ Database seeding verification (7 tests)
- ✅ RLS policy verification (15 tests)
- ✅ E2E authentication flows (22 tests)
- ✅ Edge function unit tests (5 tests)
- **Total Automated: 49 tests**

**Manual Tests:**
- ✅ Database seed tests (2 tests)
- ✅ Email delivery tests (5 tests)
- **Total Manual: 7 tests**

**Grand Total: 56 tests covering Milestone 1**

### Test Type Breakdown

| Test Type | Tool | Tests | Status |
|-----------|------|-------|--------|
| Database RLS | Vitest | 15 | ✅ |
| Database Seed | Vitest | 7 | ✅ |
| E2E Signup | Playwright | 5 | ✅ |
| E2E Login | Playwright | 5 | ✅ |
| E2E Unverified Email | Playwright | 5 | ✅ |
| E2E Password Reset | Playwright | 7 | ✅ |
| Edge Function | Vitest | 5 | ✅ |
| Manual Database | Manual | 2 | ✅ |
| Manual Email | Manual | 5 | ✅ |
| **TOTAL** | | **56** | ✅ |

### Future Test Areas (Milestone 2+)
- [ ] Canvas editor functionality
- [ ] Blog post CRUD operations
- [ ] Community features
- [ ] Icon library operations
- [ ] Export functionality
- [ ] AI-powered features

## Contributing

When adding new tests:
1. Place tests in appropriate subdirectory (`database/`, `api/`, `ui/`, etc.)
2. Follow naming convention: `feature-name.test.ts`
3. Use descriptive test names
4. Clean up test data in `afterAll()` hooks
5. Update this README with new test suites

## Related Documentation

### Project Documentation
- [Milestone 1 Requirements](../docs/milestones/milestones_12-Dec-25.md#1-database)
- [Manual Testing Procedures](../docs/milestones/manual-testing-milestone1.md)
- [Playwright Configuration](../playwright.config.ts)

### External Documentation
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [Resend API Documentation](https://resend.com/docs)

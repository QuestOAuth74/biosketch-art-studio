# Manual Testing Procedures - Milestone 1

Complete step-by-step guide for manually testing Database & Authentication features.

## Table of Contents

1. [Database Seed Tests](#database-seed-tests) (2 tests)
2. [Email Delivery Tests](#email-delivery-tests) (5 tests)

---

## Prerequisites

### Required Access

- Supabase Dashboard access
- Resend account access (for email verification)
- Local development environment running

### Environment Setup

Ensure `.env.local` contains:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
CONTACT_ADMIN_EMAIL=noreply@biosketch.art
```

### Start Development Server

```bash
npm run dev
```

Server should be running at `http://localhost:8080`

---

## Database Seed Tests

### Test DB-1: Fresh Database Seed

**Objective**: Verify seed script successfully populates database with initial data

**Prerequisites**:

- Fresh Supabase project or cleared database tables

**Steps**:

1. Open terminal in project root directory

2. Run seed script:

   ```bash
   npm run seed
   ```

3. **Verify Console Output**:
   - Should see success messages for:
     - Icon categories created/updated
     - Sample icons created
     - Blog data seeded
     - Testimonials created
     - Admin role assigned
   - No error messages should appear

**Expected Result**: All tables populated correctly, no errors in console

**Pass Criteria**:

- ✅ Seed script completes without errors

## Email Delivery Tests

### Test EM-1: Signup Verification Email

**Objective**: Verify signup verification email is sent with correct branding and content

**Prerequisites**:

- Development server running at `http://localhost:8080`
- Access to email inbox (use your personal email or test email service)

**Steps**:

1. Navigate to `http://localhost:8080/auth`

2. Click "Sign Up" tab (if not already selected)

3. Enter test credentials:

   - Email: `your-email@example.com`
   - Password: `TestPassword123!`
   - Confirm Password: `TestPassword123!`

4. Click "Sign Up" button

5. Verify immediate redirect to `/auth/verify-email`

6. **Check Email Inbox** (within 30 seconds):

   a. **Email Received**:

   - From: `BioSketch <noreply@biosketch.art>`
   - To: Your email address
   - Subject: `Confirm your BioSketch account`

   b. **Email Content**:

   - ✅ BioSketch logo visible at top
   - ✅ Heading: "Welcome to BioSketch!"
   - ✅ Body text: "Thanks for signing up! Please confirm your email address to get started."
   - ✅ Green "Confirm Email Address" button
   - ✅ Footer with support email: support@biosketch.art
   - ✅ Professional styling (centered, proper spacing, readable fonts)

   c. **Email Formatting**:

   - ✅ HTML email (not plain text)
   - ✅ Responsive design
   - ✅ Logo loads correctly
   - ✅ Button is clickable

7. **Take Screenshots**:
   - Full email in inbox
   - Email content with logo and button visible
   - Save for test results

**Expected Result**: Professional branded email received within 30 seconds

**Pass Criteria**:

- ✅ Email received within 30 seconds
- ✅ Correct sender and subject
- ✅ Logo displays correctly
- ✅ All content elements present
- ✅ Professional appearance

---

### Test EM-2: Verification Link Functionality

**Objective**: Verify email verification link works and confirms account

**Prerequisites**:

- Completed Test EM-1
- Verification email received

**Steps**:

1. Open verification email from Test EM-1

2. Click "Confirm Email Address" button

3. **Verify Redirect**:

   - Should redirect to application
   - URL should not show error page
   - Should land on projects page or home page

4. **Verify in Supabase Dashboard**:

   - Navigate to: Authentication → Users
   - Find your test user
   - Check `email_confirmed_at` field
   - Should have a timestamp (not null)

5. **Test Sign-In**:
   - Navigate to `http://localhost:8080/auth`
   - Sign in with test credentials
   - Should successfully authenticate
   - Should NOT redirect to verify-email page

**Expected Result**: Account confirmed, user can sign in successfully

**Pass Criteria**:

- ✅ Verification link redirects correctly
- ✅ `email_confirmed_at` timestamp set in database
- ✅ User can sign in without verification prompt

---

### Test EM-3: Password Reset Email

**Objective**: Verify password reset email is sent with correct branding and content

**Prerequisites**:

- Development server running
- Existing verified user account (from EM-2)

**Steps**:

1. Navigate to `http://localhost:8080/auth`

2. Click "Forgot password?" link

3. Enter email address of verified test user

4. Click "Send Reset Link" button

5. Verify confirmation message appears

6. **Check Email Inbox** (within 30 seconds):

   a. **Email Received**:

   - From: `BioSketch <noreply@biosketch.art>`
   - Subject: `Reset your BioSketch password`

   b. **Email Content**:

   - ✅ BioSketch logo visible at top
   - ✅ Heading: "Reset Your Password"
   - ✅ Body text: "We received a request to reset your password..."
   - ✅ Green "Reset Password" button
   - ✅ Expiration notice: "This link will expire in 24 hours"
   - ✅ Footer with support email
   - ✅ Security notice: "If you didn't request this..."

   c. **Email Styling**:

   - ✅ Matches signup email style
   - ✅ Professional appearance
   - ✅ Logo and button render correctly

**Expected Result**: Professional password reset email received within 30 seconds

**Pass Criteria**:

- ✅ Email received within 30 seconds
- ✅ Correct sender and subject
- ✅ All content elements present
- ✅ Expiration notice included
- ✅ Consistent branding with signup email

---

### Test EM-4: Password Reset Link Functionality

**Objective**: Verify password reset link works and allows password change

**Prerequisites**:

- Completed Test EM-3
- Password reset email received

**Steps**:

1. Open password reset email from Test EM-3

2. Click "Reset Password" button

3. **Verify Password Reset Form**:

   - Should display password reset page
   - Form should have password field(s)
   - Should show password requirements

4. **Set New Password**:

   - Enter new password: `NewTestPassword456!`
   - Confirm new password: `NewTestPassword456!`
   - Submit form

5. **Verify Success**:

   - Should show success message or redirect
   - Should be able to sign in with new password

6. **Test Old Password Rejected**:

   - Sign out
   - Try to sign in with old password (`TestPassword123!`)
   - Should fail with error message

7. **Test New Password Works**:
   - Sign in with new password (`NewTestPassword456!`)
   - Should successfully authenticate

**Expected Result**: Password successfully changed, old password no longer works

**Pass Criteria**:

- ✅ Reset link opens password form
- ✅ New password can be set
- ✅ Old password no longer works
- ✅ New password works for sign-in

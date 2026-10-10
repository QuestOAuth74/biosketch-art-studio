# Milestone 3: Collaboration — Manual Testing Guide

**Prerequisite:** Two separate browser sessions logged into two different accounts.
Throughout this guide: **User A = owner/admin**, **User B = collaborator/invitee**.
Use a real email inbox for User B to verify email delivery.

---

## 1. Groups

### 1.1 Create a group
1. Log in as User A → navigate to `/groups`
2. Click **Create Group** → enter a name and optional description → confirm
3. **Expected:** Group detail page at `/groups/:id` loads with four tabs: Members, Projects, Pages, Settings

### 1.2 Invite a member
1. On the **Members** tab → click **Invite Member** → enter User B's email → send
2. **Expected:** A pending invitation row appears immediately with User B's email
3. Click **Copy Link** on the pending row → a `/invite/group/:token` URL is copied to clipboard

### 1.3 Accept an invitation (existing user)
1. Log in as User B in the second browser
2. Open the copied invite link
3. Click **Accept**
4. **Expected:** User B appears in User A's Members tab with role "member"; pending row is gone

### 1.4 Resend an invitation
1. As User A, click **Resend** on a pending invitation row
2. **Expected:** Row remains listed; User B's inbox receives a new invitation email

### 1.5 Remove a member
1. As User A, click the remove (×) button next to User B in the Members tab → confirm
2. **Expected:** User B's row disappears from the list
3. If a project was shared with the group (see §3.3), verify User B can no longer open it

### 1.6 Settings tab (owner only)
1. As User A, go to the **Settings** tab → rename the group → save
2. **Expected:** Group name updates across the UI
3. Click **Delete Group** → confirm
4. **Expected:** Group disappears from the `/groups` list

---

## 2. Project Sharing — Individual Collaborators

### 2.1 Share with edit permission
1. As User A, open any project → click the share/collaborate icon in the canvas header
2. Enter User B's email, select **Edit** → send invitation
3. Log in as User B → navigate to `/projects`
4. **Expected:** The shared project appears in User B's project list
5. User B opens the project — can drag objects, draw shapes, and save

### 2.2 View-only enforcement
1. Repeat §2.1 but select **View** permission
2. User B opens the project
3. **Expected:** Canvas is non-interactive — objects cannot be dragged, toolbar actions are disabled, no shapes can be added

### 2.3 Revoke access
1. As User A, open the collaborate dialog → click **Remove** next to User B → confirm
2. **Expected:** User B refreshes or navigates away — the project no longer appears in their list

### 2.4 Email-only invitation (non-existing user)
1. In the collaborate dialog, enter an email address that has no account
2. **Expected:** A pending row appears; an invitation email is sent to that address
3. Visit the invitation link while signed out
4. **Expected:** A sign-in/sign-up prompt renders; after creating an account and verifying email, the app redirects back to the invitation and grants access

---

## 3. Project Sharing — Group Access

### 3.1 Add a project to a group
1. As User A on the group detail page → **Projects** tab → click **Add Project**
2. Select a project from the picker, set permission to **Edit** → confirm
3. **Expected:** Project appears in the group's Projects tab

### 3.2 Group member inherits access
1. Log in as User B (a group member)
2. **Expected:** The shared project appears in User B's project list at the permission level set

### 3.3 Revoking group access
1. As User A, remove User B from the group (§1.5)
2. **Expected:** User B immediately loses access — the project disappears from their list and RLS blocks any direct API access

### 3.4 Permission dropdown
1. As User A, in the Add Project picker, change the permission to **Edit** before selecting a project
2. **Expected:** Collaborator receives edit-level access (can modify, not just view)

---

## 4. Page Sharing

### 4.1 Create a page and add a project
1. Navigate to `/pages` → click **New Page** → enter a name → confirm
2. On the page detail view → **Add Project** → select a project
3. **Expected:** Project appears on the page

### 4.2 Share a page individually
1. On the page detail view → share icon → enter User B's email → send
2. Log in as User B → navigate to `/pages`
3. **Expected:** The shared page appears in User B's list

### 4.3 Share a page with a group
1. As User A on the page detail view → share icon → share with the group
2. **Expected:** All current group members gain access to the page

### 4.4 Unauthenticated invitation link
1. Open a page invitation link (`/invite/page/:token`) while signed out
2. **Expected:** Sign-in/sign-up prompt renders with the invitation context intact; after login, access is granted

---

## 5. Real-time Presence & Cursors

Both users open the **same project** in separate browsers before starting.

### 5.1 Presence avatars
1. User A and User B each navigate to the same canvas URL
2. Wait ~2 seconds
3. **Expected:** User B's avatar (with their initials or photo and a deterministic color) appears in User A's canvas header strip, and vice versa

### 5.2 Live cursor tracking
1. User B moves the mouse over the canvas area
2. **Expected:** A labeled cursor with User B's name appears in User A's canvas in near-real time (~50ms throttle)
3. When User B stops moving, the cursor label remains at the last position

### 5.3 User leaves
1. User B navigates away from the project (e.g., to `/projects`)
2. Wait ~3 seconds
3. **Expected:** User B's avatar disappears from User A's presence strip

---

## 6. Real-time Object Sync

Both users on the same project canvas.

### 6.1 Move an object
1. User A drags an existing shape to a new position
2. **Expected:** The shape moves to the same position in User B's canvas within ~1 second

### 6.2 Add an object
1. User A draws a new rectangle or other shape
2. **Expected:** The shape appears in User B's canvas

### 6.3 Delete an object
1. User A selects and deletes an object
2. **Expected:** The object disappears from User B's canvas

---

## 7. Project Locking

### 7.1 Lock as owner
1. As User A (owner or admin), click the **lock icon** in the canvas header
2. **Expected:** A red banner appears reading "This project is locked by [User A's name]. Edits are disabled." with an **Unlock** button

### 7.2 Collaborator sees edit-disabled state
1. User B (collaborator) opens the same project (or refreshes)
2. **Expected:**
   - Same red banner appears
   - "Edit disabled" badge is shown instead of an Unlock button
   - Canvas is non-interactive: objects cannot be dragged, no shapes can be added, toolbar is disabled

### 7.3 Unlock
1. User A clicks **Unlock**
2. **Expected:** Banner disappears for both users; both can edit again

---

## 8. Canvas Comments

### 8.1 Enter comment mode
1. Press `C` on the keyboard, or click the comment-bubble icon in the toolbar
2. **Expected:** Toast notification: "Comment mode — click on canvas to add a comment"

### 8.2 Add a comment pin
1. While in comment mode, click anywhere on the canvas
2. **Expected:** A `window.prompt` dialog appears asking for comment text
3. Enter text → confirm
4. **Expected:** A pin icon appears at that canvas position; the comment is saved to the database

### 8.3 View and interact with a thread
1. Click an existing comment pin
2. **Expected:** A `CommentThread` popover opens showing: comment text, author name, timestamp, and resolve/delete controls

### 8.4 Reply to a comment
1. With the thread popover open, type a reply in the reply field → press **Enter** or click **Send**
2. **Expected:** Reply appears in the thread under the original comment with the replier's name and timestamp

### 8.5 Resolve a comment
1. In the thread popover, click the **resolve** (checkmark) button
2. **Expected:** Comment visually changes state (greyed out or checkmark shown); refreshing the page confirms it remains resolved

### 8.6 Delete a comment
1. As the comment author or project owner, click **Delete** in the thread
2. **Expected:** Pin disappears from canvas; comment row is removed from DB

### 8.7 Comment sidebar
1. Click the comment/chat icon in the canvas header
2. **Expected:** Sidebar opens on the right listing all project comments
3. Switch between **All**, **Unresolved**, and **Resolved** tabs
4. **Expected:** Each tab shows the correct filtered set of comments
5. Click a comment in the sidebar
6. **Expected:** Canvas scrolls to / highlights the corresponding pin

### 8.8 Real-time comment sync
1. User A adds a comment pin
2. **Expected:** Pin appears in User B's canvas without a page refresh

---

## 9. Email Notifications

Trigger each event and confirm the email arrives at the expected inbox with correct content.

| Event | Recipient | Expected subject / content |
|---|---|---|
| Group invitation | Invitee (User B) | Group name, inviter name, working accept link |
| Project collaboration invitation | Invitee | Project name, inviter name, working accept link |
| Page invitation | Invitee | Page name, inviter name, working accept link |
| New comment on project | Project owner | "New comment on your project "[name]"" |
| Reply to a comment | Original commenter | "[Author] replied to your comment on "[project]"" |

For each: verify the sender address matches the configured `FROM_EMAIL` domain.

---

## 10. Notification Preferences

1. Navigate to `/profile` → **Notifications** tab
2. **Expected:** Six event types listed, each with In-App and Email toggles: Group Invitation, Project Invitation, Page Invitation, New Comment, Comment Reply, Project Locked

### 10.1 Disable email for a type
1. Toggle off **Email** for "New Comment" → click **Save**
2. Have another user add a comment on a project you own
3. **Expected:** No email arrives; in-app notification (bell icon) still appears

### 10.2 Disable in-app for a type
1. Toggle off **In-App** for any type → click **Save**
2. Trigger the corresponding event
3. **Expected:** No in-app notification appears; email still arrives (if email is still enabled)

### 10.3 Re-enable and verify
1. Toggle both channels back on → click **Save**
2. Trigger the event again
3. **Expected:** Both in-app and email notifications resume

### 10.4 Save button state
1. Toggle any setting → **Expected:** Save button becomes active
2. Click **Save** → **Expected:** Save button returns to disabled/inactive state

---

## 11. New-user Invitation Flow

This path cannot be automated and must be tested end-to-end with a real email address.

1. Log out of all browser sessions
2. As User A, send a group/project/page invitation to an email address that has **no existing account**
3. Open the invitation email → click the accept link
4. **Expected:** The app renders a sign-in/sign-up prompt (not a 404 or error page)
5. Create a new account using the invited email address
6. Complete Supabase email confirmation (check inbox for confirmation link)
7. After login, **Expected:** The app redirects back to the invitation URL and accepts automatically — group membership or project/page access is granted without a second manual step

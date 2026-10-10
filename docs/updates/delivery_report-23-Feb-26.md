# Milestone 3: Collaboration Features — Delivery Report

**Date:** 23 February 2026

**Preview URL:** https://science-canvas-creator.vercel.app

---

### 1. Group Account System

**Create and manage shared team workspaces with role-based access**

- Groups have three roles: owner, admin, and member
- Owners and admins can invite, remove, and promote members; members can view the group and leave
- Group pages include tabs for members (with pending invitations), projects, pages, and settings (rename/delete, owner only)

---

### 2. Lab Member Invitation System

**Email-based invitations with secure, expiring links**

- Invitation emails sent via Resend with a unique link that expires in 7 days
- Works for both existing users and new users who haven't created an account yet — new users are directed to sign up and then are redirected to the invitation page. Existing users can follow a link in the app or email notification to accept the invitation.
- Owners can resend or cancel pending invitations; membership is granted immediately on acceptance

---

### 3. Project and Page Sharing

**Share projects and pages with specific people or entire groups**

- Individual projects can be shared direcly via email or with groups, at View Only or Edit Access permission level
- When shared with a group, all members have the same access, new members will gain access and removed members will lose access
- Project pages (multi-project boards) can also be shared individually or with a group - the view/edit access is set for the page and effects all projects in the page

---

### 4. Real-time Collaborative Editing

**Multiple users can view and edit the same canvas simultaneously**

- Active users appear as avatars in the canvas header with deterministic color coding
- Each user's cursor position is visible in real-time with a name label
- Canvas changes (moving, resizing, editing objects) sync to all connected users
- Conflict resolution: if two users edit the same property simultaneously, the most recent change wins — no user intervention needed
- Project owners can manually lock a project to prevent changes while working; the project owner can unlock it; locked users see a banner while the project is locked

---

### 5. Canvas Comment System

**Leave and discuss comments directly on the canvas**

- Click anywhere on the canvas in comment mode to place a pinned comment
- Comments support threaded replies with timestamps and author avatars
- Comment authors and project owners can resolve, edit, or delete comments
- A comment section in the properties panel shows all project comments with All / Unresolved / Resolved filter
- Comment changes appear in real-time for all collaborators
- Comment pins can be respositioned

---

### 6. Notifications

**Per-user control over which notifications are received**

- Users can independently enable or disable in-app and email notifications for six event types: group invitations, project invitations, page invitations, new comments, comment replies, and project locked/unlocked
- Settings accessible from the Profile page under the Notifications tab
- Invitation emails are currently mandatory to ensure access is provided
- In app notifications include a link to the relevant project

---

### 7. Permission Enforcement

**All access control is enforced at the database level**

- Collaborators cannot exceed their assigned permission level — view-only users cannot modify projects even with direct access
- Group-based access is dynamic: adding or removing a group member immediately grants or revokes their access to all shared resources
- Project owners retain full control at all times

---

## Tests

### Unit Tests (88 passing)

**Group and invitation logic (33 tests)**
- Invitation tokens expire correctly after 7 days
- Only owners and admins can invite or remove members; members cannot
- Role hierarchy is enforced — a member cannot promote themselves or others
- Project and page access rules reflect the correct permission level per collaborator type

**Notification preferences (11 tests)**
- Correct result returned for each event type and delivery channel (in-app / email)
- Missing or unknown preference keys default to enabled

**Real-time logic (26 tests)**
- Presence color assignment is deterministic (same user always gets the same color)
- Last-write-wins conflict resolution uses timestamps correctly
- Lock permission checks correctly identify who can edit vs. who is blocked
- Comment resolve and delete helpers enforce author/owner rules
- Canvas operation batching correctly merges duplicate property changes before broadcast

**Comment notification logic (18 tests)**
- New comment → project owner notified; self-comment → no notification sent
- Reply → parent comment author notified; self-reply → no notification sent
- Email subject and message content formatted correctly; long messages truncated at 200 characters
- Per-type email preferences respected; missing keys default to enabled

---

### Database Permission Tests

All access control rules verified across every collaboration-related table. Each test confirms both that permitted access works and that unauthorized access is blocked.

**Groups**
- Members can view their group; non-members cannot
- Only owners and admins can modify group membership
- Only the owner can delete the group
- Admins cannot escalate their own role

**Invitations**
- Only owners and admins can send or cancel invitations
- Invitation records are visible to managers and the invited email address only

**Project access**
- Collaborators with Edit access can modify the project; View-only collaborators cannot
- Group members inherit the permission level set for their group
- Non-collaborators cannot view or modify the project
- Removing a group's access immediately blocks all group members

**Project pages**
- Invitees with Edit access can modify projects within the page; View-only invitees cannot
- Group members with page access inherit the correct permission level
- Non-invitees cannot view page content

**Comments**
- Collaborators can add and view comments; non-collaborators cannot
- Comment authors and project owners can edit and delete comments; others cannot

**Project locks**
- Collaborators with Edit access can lock and unlock projects; View-only collaborators cannot

**In-app notifications**
- Notifications are created when in-app delivery is enabled; suppressed when disabled
- Notification records store the correct event type and link

---

### End-to-end Tests (61 tests across 7 spec files)

**Groups (14 tests)**
- Create group → user becomes owner
- Invite member → pending invitation appears; copy invite link works
- Accept invitation (two-user flow) → membership confirmed
- Remove member → row disappears from UI and member loses access to shared projects
- Promote member to admin → admin can invite others
- Owner updates group name → persists in UI and database
- Owner deletes group → former members lose access
- Member self-leave → removed from group, loses project access

**Project sharing (11 tests)**
- Share project via email → collaborator appears in list
- Remove collaborator → access revoked
- Two-user edit access flow → collaborator can modify project
- Group sharing → all group members gain access; revoking group removes all members
- View-only enforcement → view collaborator cannot modify project
- Upgrade permission view → edit → edit access now works
- Downgrade permission edit → view → edit access now blocked

**Pages (14 tests)**
- Create page, add projects, share with group
- Two-user invite → accept → access flow
- Owner updates page name → persists in database
- Owner deletes page → invitees lose access
- Edit-permission invitee can modify a project in the page
- View-permission invitee cannot modify a project in the page
- Revoke group page access → group members lose access

**Real-time (8 tests)**
- Two users open same project → both see each other's avatars
- Owner locks project → lock banner visible to all users
- Owner unlocks project → lock banner clears
- Collaborator sees lock banner but not the unlock button
- Edit collaborator can lock and unlock the project

**Comments (11 tests)**
- Click canvas in comment mode → pin placed and saved
- Reply via UI → reply saved with correct thread reference
- Resolve via UI → resolved flag updated
- Sidebar filter tabs show correct counts for All / Unresolved / Resolved
- Collaborator can add a comment; non-collaborator cannot
- Owner resolves and deletes a collaborator's comment
- Author edits their own comment → content updated
- Non-author/non-owner does not see the edit button

**Notification preference enforcement (14 tests)**
- For all six event types: in-app enabled → notification record created; in-app disabled → no record created
- Notification record stores the correct event type and link
- Notification bell renders correctly after a notification is created

**Notification delivery integration (13 tests)**

These tests call the notification edge functions directly and verify records are created in the database, covering all three ways a user can have access to a project:

- Collaborator comments → project owner receives notification; owner does not notify themselves
- Owner comments → collaborator receives notification
- Owner comments on a project with no collaborators → no notification sent
- Collaborator replies to owner's comment → owner is notified
- User replies to their own comment → no notification sent
- Owner locks/unlocks project → all collaborators notified; owner does not notify themselves
- In-app disabled for an event type → no record created, for both comment and lock events
- Group members receive comment and lock notifications for projects shared with their group
- Page members receive comment and lock notifications for projects accessible via their page

**Notification settings (3 tests)**
- Settings card visible on the Profile page
- Toggling a setting saves to the database
- Save button re-enables after saving

---

### Manual Testing

1. **Email delivery** — Confirm invitation and comment notification emails arrive with correct content (inviter name, resource name) and working accept links, for all three invitation types (group, project, page)
2. **New user invite flow** — A new user arrives via an invitation link before creating an account, creates their account, and is redirected back to accept
3. **Live real-time** — Open two browser windows on the same project and verify that object movements, cursor labels, and lock state sync correctly between windows

---

## Summary

✅ **Group Account System** — Team workspaces with owner/admin/member roles and full membership management

✅ **Lab Member Invitation System** — Email invitations with 7-day expiry, works for new and existing users

✅ **Project and Page Sharing** — Individual and group sharing with View/Edit permissions; dynamic group access

✅ **Real-time Collaborative Editing** — Live presence, cursor tracking, canvas sync with last-write-wins conflict resolution

✅ **Project Locking** — Manual lock/unlock with banner visibility for all users

✅ **Canvas Comment System** — Pinned comments, threaded replies, resolve/filter sidebar, real-time sync

✅ **Notifications** — In-app and email notifications for invitations, comments, and project lock events, with per-user preference controls for all six event types

✅ **Permission Enforcement** — All access control enforced at the database level across all collaboration features

✅ **Comprehensive Testing** — 88 unit tests, full database permission coverage, 74+ end-to-end tests

---

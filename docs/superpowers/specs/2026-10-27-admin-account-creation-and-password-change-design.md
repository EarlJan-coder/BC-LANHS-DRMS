# Admin Account Creation + Forced Password Change — Design

**Status:** Approved 2026-10-27
**Problem:** There is no supported way to create a staff account. Public signup is
student-only and roster-matched by LRN; `auth:bootstrap-admin` is first-admin-only. A
registrar cannot be added to the system at all.

## Why now

The portal cannot be operated without registrar accounts. Every workaround today
requires manual SQL against production.

## Goals

- An admin creates staff accounts (alumni / registrar / admin) with a placeholder password.
- An admin resets an existing user's password the same way.
- Anyone whose password was set by an admin must change it before using the portal.
- Users change their own password from inside the portal.

## Non-goals

- Student account creation. Students already have a complete path: bulk import (keyed by
  LRN) creates `students` rows, then self-registration at `/sign-up` matches on LRN.
- Email invites or forgot-password links. The admin hands the placeholder over out-of-band.
- Changing the existing signup roster-matching rules.

## Constraints

- The `students.userId` foreign key is the join key for profile, document requests, and
  every dashboard query. Every `student`-role account must have a linked student record.
  Therefore **staff account creation must never accept the `student` role.**
- Passwords: bcryptjs at cost 12, 8–72 characters / bytes.
- `SESSION_SECRET` (≥32 UTF-8 bytes) is required by every password path.

## The flow

1. **Admin → Users → Add account** — email, first/last name, role, placeholder password.
2. Account is created with `mustChangePassword = true`.
3. They sign in at `/sign-in`. Because the flag is set, `proxy.ts` routes them to
   `/change-password` and every other protected page redirects back there.
4. They enter the placeholder and a new password. The flag clears. Normal portal access.
5. **Reset password** on any user behaves identically: new placeholder, flag re-set.

## Rule

**A password the admin set is always temporary.** Both create and reset set
`mustChangePassword = true`. There is one rule, not two.

## Decisions

| Decision | Choice |
|---|---|
| Flag on create *and* reset | Yes — one rule governs both |
| Change-password screen | `/change-password`, outside the role groups, shared by all four roles |
| Change requires current password | Yes |
| Audit | Account create, reset, and change all recorded via `recordAuditedAction` |
| Session revocation | Create/reset bump `users.tokenVersion`; change bumps it and re-issues the caller's session so they stay signed in |
| Placeholder visibility | Shown once in the confirmation panel with a copy affordance |
| Rate limiting | Create and reset go through `checkAuthRateLimit` under a new `admin-account` action |
| Reset endpoint shape | `POST /api/users/[id]/reset-password` — an explicit action route, matching `api/students/import/commit` and `api/notifications/read-all` |

## Out of scope follow-ups

- Emailing credentials instead of out-of-band handoff.
- Forgot-password / self-service reset.
- Expiring stale placeholder passwords if never changed.

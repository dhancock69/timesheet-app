# BeardONE Timesheet Platform — Technical Specification

**Document:** BIS-VDC-SPEC-001  
**Version:** 1.9  
**Date:** September 21, 2026  
**Prepared By:** Daniel Hancock — VDC/BIM Manager, Beard Integrated Systems  
**Status:** Production

---

## 1.0 Overview

The BeardONE Timesheet Platform is a custom-built, cloud-deployed internal timesheet and daily reporting application developed for Beard Integrated Systems (BIS). It replaces manual timesheet processes with a real-time, browser-based platform accessible to all VDC/BIM department staff. The application supports hour entry (REG/OT/DT), daily field reports, manager review and approval, PTO requests, administrative team and project management, and multi-tab Excel export in BIS payroll format.

---

## 2.0 Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Frontend Framework | React | 18.2.0 |
| Backend / Database | Supabase | PostgreSQL + Auth + RLS |
| Deployment | Vercel | Hobby plan, auto-deploy from GitHub |
| Source Control | GitHub | `dhancock69/timesheet-app` |
| Excel Export | ExcelJS | 4.4.0 via CDN |
| Font | DM Sans | Google Fonts (400, 500, 700, 900) |
| Supabase Client | @supabase/supabase-js | ^2.39.0 |

---

## 3.0 Repository Structure

```
timesheet-app/
├── public/
│   ├── index.html              # App shell, Google Fonts, ExcelJS CDN
│   ├── bim-bg.png              # BIM slideshow background 1
│   ├── bim-bg-2.png            # BIM slideshow background 2
│   ├── bim-bg-3.png            # BIM slideshow background 3
│   ├── bim-bg-4.png            # BIM slideshow background 4
│   ├── bim-bg-5.png            # BIM slideshow background 5
│   ├── bim-bg-6.png            # BIM slideshow background 6
│   └── bim-bg-7.png            # BIM slideshow background 7
├── src/
│   ├── App.js                  # Single-file React application (~1,326 lines)
│   ├── index.js                # React root mount
│   └── supabase.js             # Supabase client initialization
├── package.json                # Dependencies and build scripts
└── vercel.json                 # Vercel build configuration
```

---

## 4.0 Environment Variables

Set in Vercel project settings under Environment Variables:

| Variable | Description |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anonymous public key |

---

## 5.0 Supabase Database Schema

### 5.1 Table: `profiles`

Extends Supabase `auth.users`. Created automatically on first sign-up via trigger or manually via Admin Console.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `name` | text | Full name |
| `emp_no` | text | BIS employee number (e.g. HAN4127) |
| `role` | text | `employee` or `admin` |
| `is_manager` | boolean | Grants Manager Review + Admin tab access |
| `email` | text | Login email |
| `default_location` | text | Default location pre-selected on timesheet |
| `timesheet_file_location` | text | Network path/link to this employee's archived timesheet files (admin-entered, reference only) |
| `created_at` | timestamptz | Auto-set on insert |

---

### 5.2 Table: `projects`

Stores all billable projects and overhead codes.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `project_num` | text | BIS project number (e.g. 25-201-240) |
| `task_num` | text | Task/cost code (e.g. 90) |
| `expense_type` | text | Expense type code (e.g. 436) |
| `project_name` | text | Project description |
| `description` | text | Additional notes |
| `active` | boolean | Whether project is selectable |

---

### 5.3 Table: `employee_projects`

Junction table — controls which projects appear on each employee's timesheet.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `employee_id` | uuid (FK) | References `profiles.id` |
| `project_id` | uuid (FK) | References `projects.id` |

---

### 5.4 Table: `timesheets`

One record per employee per week. Week identified by `week_start` date string.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `employee_id` | uuid (FK) | References `profiles.id` |
| `week_start` | text | ISO date string `YYYY-MM-DD` (local timezone) |
| `week_end` | text | ISO date string of Saturday |
| `status` | text | `draft`, `submitted`, `approved`, `rejected` |
| `submitted_at` | timestamptz | Timestamp of submission |
| `rejection_note` | text | Manager rejection reason |

---

### 5.5 Table: `timesheet_entries`

Individual hour entries per project per day.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `timesheet_id` | uuid (FK) | References `timesheets.id` |
| `project_id` | uuid (FK) | References `projects.id` |
| `day_name` | text | `Monday` through `Sunday` |
| `reg_hours` | numeric | Regular hours |
| `ot_hours` | numeric | Overtime hours |
| `dt_hours` | numeric | Double-time hours |

---

### 5.6 Table: `daily_reports`

One record per day per timesheet. Stores location, notes, and daily report text.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `timesheet_id` | uuid (FK) | References `timesheets.id` |
| `day_name` | text | `Monday` through `Sunday` |
| `location` | text | Selected location for the day |
| `notes` | text | Overtime reason / absence codes |
| `report_text` | text | Daily accomplishment report |

---

### 5.7 Table: `pto_requests`

Employee PTO requests reviewed by managers.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `employee_id` | uuid (FK) | References `profiles.id` |
| `start_date` | text | Requested start date |
| `end_date` | text | Requested end date |
| `hours` | numeric | Hours requested |
| `note` | text | Employee note |
| `status` | text | `pending`, `approved`, `rejected` |
| `created_at` | timestamptz | Request timestamp |

---

### 5.8 Table: `app_settings`

Key-value store for global application settings.

| Column | Type | Notes |
|---|---|---|
| `key` | text (PK) | Setting name |
| `value` | text | Setting value |

**Known keys:** `supervisor`, `company_name`, `locations`, `manager_email`, `payroll_email`, `daily_report_file_location` (Storage folder for the weekly all-employee daily report archive — see 5.9), `reminder_last_sent_date` (dedup marker for the daily reminder cron — see 5.10). `reminder_time`/`reminder_days` were originally listed here but are vestigial — nothing in `App.js` ever reads or writes them (the in-app "🔔 Reminders" extra-reminder dropdown only holds local component state and isn't persisted); the real schedule is now hardcoded in 5.10 instead.

---

### 5.9 Supabase Storage: `timesheet-records` bucket

Holds archived record copies of weekly exports, written by `exportTimesheets()` in `ManagerView` on every export.

| Object path | Contents |
|---|---|
| `{profiles.timesheet_file_location}/BIS_VDC_Timesheet_{emp_no}_{weekEndDate}.xlsx` | One employee's single-tab weekly timesheet |
| `{app_settings.daily_report_file_location}/BIS_VDC_DailyReports_{weekEndDate}.xlsx` | All-employee daily report file for that week |

Each employee's `timesheet_file_location` (profiles column, admin-editable) is the destination *subfolder* inside this bucket — not a real network path. If an employee's field is empty, their record is skipped on archive (reported in the export status message). Same for `daily_report_file_location` — if unset in Settings, the daily report archive step is skipped.

**Manual setup complete:** the `timesheet-records` bucket exists with 3 `storage.objects` policies (INSERT/UPDATE/SELECT) granting access to users where `profiles.role='admin'` or `profiles.is_manager=true` — confirmed in Supabase dashboard 2026-09-01.

---

### 5.10 Daily Reminder Cron (`api/daily-reminder.js`)

A Vercel Cron job (`vercel.json` → `crons`) hits `/api/daily-reminder`, weekdays only. The function itself decides whether to actually send — it checks the current time in `America/Chicago` against a per-weekday target (`REMINDER_TARGETS` in `api/daily-reminder.js`) and no-ops (200, not an error) if it's before that weekday's target local time or a reminder already went out today (tracked via the `reminder_last_sent_date` app_settings key).

**Per-weekday targets (2026-09-21):** Mon–Thu target 12:30 PM America/Chicago; Friday targets 10:00 AM (payroll needs Friday's earlier). Previously all weekdays shared a single 1:30 PM target, but the effective send time had drifted to ~2:18 PM in practice (Vercel Hobby cron execution isn't guaranteed to the minute) and Friday had never actually been distinguished from the rest of the week — both corrected here at Daniel's request.

**Cron schedule (2026-09-21):** `vercel.json` has **2** entries — one fixed UTC time per weekday group, no DST auto-adjustment (Daniel chose this over a 4-entry DST-safe schedule, since Hobby's 2-cron-job cap can't fit both a weekday split and DST offset pairing — see ⚠ below):
- Mon–Thu (12:30 PM target): `30 17 * * 1-4`
- Friday (10:00 AM target): `0 15 * * 5`

These UTC hours are correct for **CDT** (current DST state as of 2026-09-21). Also supports a `?dryRun=1` query param (still requires the `CRON_SECRET` bearer auth) that computes and returns the would-be recipient list without sending anything or touching the gates/dedup flag — safe to run anytime against real data to sanity-check the filtering logic.

**⚠ Manual DST maintenance required:** with only 2 cron entries there's no CDT/CST offset pairing, so `vercel.json` must be hand-edited by 1 hour at each DST transition — **before** the transition, not after (see CAUTION comment in `api/daily-reminder.js`): going *into* CST (fixed CDT-based UTC now maps 1hr earlier locally) makes the run land *before* that day's target, which the gate silently skips with no same-day retry — the reminder just won't send at all that day until fixed. Going into CDT the other direction just sends 1hr late, not silently. **Next transition: Sunday, November 1, 2026** (CDT→CST) — add 1 hour to both UTC schedule values (`30 18 * * 1-4` and `0 16 * * 5`) before that date. Then subtract 1 hour again at the following spring-forward (CST→CDT, second Sunday of March 2027).

**Eligibility (who gets emailed):** every `profiles` row with an email, for the current weekday, *excluding* anyone whose timesheet for the current week is already `submitted`/`approved`, who already logged hours (`timesheet_entries` for today's `day_name` with reg/ot/dt > 0), or who has an `approved` `pto_requests` row covering today. Note: there's no employment-status field on `profiles`, so a terminated employee's row would still get reminders unless removed.

**Required env vars (Vercel → Settings → Environment Variables, server-side only):**
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS so the function can read across all employees (reuses `REACT_APP_SUPABASE_URL` for the project URL)
- `RESEND_API_KEY` — Resend account API key
- `REMINDER_FROM_EMAIL` — sender address; **must be on a domain verified in Resend via DNS**, or emails to real employees will fail (Resend's sandbox domain only delivers to the account owner's own address). Set to `noreply@notify.beardint.com` (2026-09-11) — `notify.beardint.com` is verified in Resend (DKIM + SPF) specifically to avoid touching the apex `beardint.com` domain's existing M365 mail records
- `CRON_SECRET` — random string; Vercel auto-attaches it as `Authorization: Bearer <value>` on cron-triggered requests, and the function rejects anything else

**Send-outcome tracking (2026-09-11):** `reminder_last_sent_date` is only set if at least one recipient's send actually succeeds (`results.some(r => r.ok)`), not merely attempted. With only one cron fire per weekday group (no DST-offset pairing as of 2026-09-21), a total Resend outage just leaves the flag unset — there's no same-day retry, only tomorrow's run is unaffected by a phantom "already sent."

**Status as of 2026-09-21:** working — env vars configured, `notify.beardint.com` verified in Resend, per-weekday-target cron schedule (2 entries, CDT-correct, no DST auto-adjustment) live in `vercel.json`. **Needs a manual +1hr schedule edit before November 1, 2026** (see ⚠ above) or the reminder will silently stop sending after that date. Verify with `curl -H "Authorization: Bearer <CRON_SECRET>" "https://<deployed-url>/api/daily-reminder?dryRun=1"` and check the JSON response, or the Resend dashboard for real sends.

---

## 6.0 Row Level Security (RLS) Policies

RLS is enabled on all tables. The following policies are required:

### 6.1 `profiles`
| Policy | Operation | Rule |
|---|---|---|
| Users can read own profile | SELECT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` |
| Managers can update profiles | UPDATE | Caller has `role='admin'` or `is_manager=true` |
| Users can claim their own pre-created profile | UPDATE | `email = auth.email()` (using), `id = auth.uid()` (with check) — added 2026-09-01, see 16.1 profile re-keying fix |

**Note:** in practice every logged-in user (not just managers) successfully loads the *entire* `profiles` table (`App.js` `handleLogin`, unfiltered `select("*")`) — the actual deployed SELECT policy is evidently broader than "own profile only" as documented above. Not yet reconciled; if you're touching `profiles` RLS, check the live policy list in Supabase rather than trusting this table blindly.

### 6.2 `timesheets`
| Policy | Operation | Rule |
|---|---|---|
| Users can manage own timesheets | ALL | `auth.uid() = employee_id` |
| Managers can view all timesheets | SELECT | Caller has `role='admin'` or `is_manager=true` |
| Managers can update all timesheets | UPDATE | Caller has `role='admin'` or `is_manager=true` |

### 6.3 `timesheet_entries`
| Policy | Operation | Rule |
|---|---|---|
| Users can manage own entries | ALL | Entry's timesheet belongs to `auth.uid()` |
| Managers can read all entries | SELECT | Caller has `role='admin'` or `is_manager=true` |

### 6.4 `daily_reports`
| Policy | Operation | Rule |
|---|---|---|
| Users can manage own reports | ALL | Report's timesheet belongs to `auth.uid()` |
| Managers can read all reports | SELECT | Caller has `role='admin'` or `is_manager=true` |

### 6.5 `projects` / `employee_projects` / `pto_requests` / `app_settings`
Standard read/write policies scoped to authenticated users, with manager-level write access where applicable.

---

## 7.0 Application Architecture

### 7.1 Single-File React Application

The entire application is contained in `src/App.js` (~1,326 lines). It is organized into the following sections:

```
Brand Constants & Utilities
BIM Slideshow Component (BeardCanvas)
UI Primitives (Badge, Btn, Input, Textarea, Select, Card, SectionHead)
LoginScreen
PTOModal
EmployeeView
ManagerView
AdminConsole
Root App (App)
```

### 7.2 Routing Model

There is no React Router. Navigation is state-driven via a `view` state variable in the root `App` component:

```
view = "timesheet" → <EmployeeView />
view = "manager"   → <ManagerView />   (is_manager = true only)
view = "admin"     → <AdminConsole />  (is_manager = true only)
```

### 7.3 Authentication Flow

1. App loads → `supabase.auth.getSession()` checks for existing session
2. If session exists → `handleLogin(user)` loads profile and project data
3. If no session → `LoginScreen` rendered
4. `onAuthStateChange` listener handles session changes (sign in/out)
5. On sign-out → state cleared, `LoginScreen` rendered

---

## 8.0 Component Reference

### 8.1 `BeardCanvas`

Full-viewport animated background. Cycles through 7 BIM project photos with cross-fade transitions. Overlays: diagonal watermark pattern ("BEARD ONE" / "1% BETTER EVERY DAY"), dark overlay, and radial vignette.

**Key constants:**
- `FADE_MS = 2000` — cross-fade duration (ms)
- `HOLD_MS = 7000` — time each image displays (ms)
- `BIM_IMAGES` — array of 7 background image paths

---

### 8.2 `LoginScreen`

Three modes: `login`, `signup`, `reset`.

**Login:** Email + password → `supabase.auth.signInWithPassword()`  
**Sign Up:** Name + email + password → `supabase.auth.signUp()` → profile auto-created  
**Reset:** Email → `supabase.auth.resetPasswordForEmail()`

Connection errors display a user-friendly "Database Sleeping" message with recovery instructions.

---

### 8.3 `EmployeeView`

Props: `{ profile, projects, settings }`

**State:**
- `days` — array of 7 day objects, each containing `entries` (keyed by project ID), `location`, `notes`, `report`
- `saving`, `savedMsg`, `submitted` — UI feedback states
- `myPTO` — employee's PTO request history
- `showPTO`, `showReminderPanel` — modal visibility flags
- `viewWS` — currently viewed week start date (defaults to current week, `WS`)
- `viewWeekKey` — `toDateStr(viewWS)` used as Supabase query parameter; `isCurrentWeek` — `viewWeekKey===WEEK_KEY`

**Week navigation (added 2026-09-21):** `‹` / `›` buttons next to the week label in the sticky header shift `viewWS` by ±7 days via `shiftWeek(dir)`, letting an employee go back and fill out/submit a past week's timesheet (e.g. one missed last pay period). Forward navigation is capped at the current week (`shiftWeek` no-ops if the target date is after `WS`) — employees can't pre-fill future weeks. A "This Week" button appears whenever `viewWeekKey!==WEEK_KEY` to jump back to today. Changing weeks resets `days` to blank (dates recalculated from `viewWS`) and re-fetches via `loadTimesheet()`, keyed off `viewWeekKey` in a `useEffect`. The "Today" highlight/badge on a day card is gated on `isCurrentWeek` so a past week's matching weekday isn't mislabeled. Each week is its own `timesheets` row (unique on `employee_id,week_start`), and the existing per-timesheet `submitted` lock (disables inputs once status is `submitted`/`approved`) already applies per week with no code change needed — RLS (`auth.uid()=employee_id`, no date restriction) already permitted this; it was purely a front-end gap.

**Key functions:**

| Function | Description |
|---|---|
| `loadTimesheet()` | Fetches existing timesheet + entries + reports for `viewWeekKey` (the currently viewed week, not always the current week). Fires on mount and whenever `viewWeekKey` changes. |
| `shiftWeek(dir)` | Shifts `viewWS` by `dir*7` days; ignores forward shifts past the current week. |
| `handleSave(submit)` | Deletes existing entries then re-inserts all current data, keyed to `viewWeekKey`/`viewWS`. Sets status to `draft` or `submitted`. |
| `updateEntry(dayIdx, projId, field, val)` | Updates a single hour field in local state |
| `updateDay(i, field, val)` | Updates location/notes/report for a day |

**Sticky action bar (top of view):**
- Row 1: Employee name, ‹ week range › + "This Week" jump button, emp_no, hours summary (REG/OT/DT/Total), saved/submitted badge
- Row 2: Request Time Off · Reminders · 💾 Save Draft · Submit ✓

**Day cards:** One per day (Mon–Sun). Contains location selector, project/hour grid, notes field, daily report field. Transparent background (`rgba(6,4,4,0.22)`) to show BIM background images.

**Save behavior:** Delete-then-insert pattern (avoids `onConflict` constraint requirement). Reloads timesheet from Supabase after save to confirm persistence.

---

### 8.4 `PTOModal`

Props: `{ profile, onClose, onSubmit }`

Allows employees to submit PTO requests with start date, end date, hours, and optional note. Inserts into `pto_requests` table.

---

### 8.5 `ManagerView`

Props: `{ employees, projects, settings }`

**State:**
- `timesheets` — all timesheets for the selected review week
- `selected` — currently selected employee ID
- `detail` — `{ empId, tsId, entries[], reports[] }` for the open detail panel
- `reviewWS` — currently viewed week start date (defaults to current week)
- `reviewWeekKey` — `toDateStr(reviewWS)` used as Supabase query parameter

**Week navigation:** `‹` / `›` arrows shift `reviewWS` by ±7 days. "Today" button resets to current week. Changing week clears selection and reloads timesheets.

**Employee card states:**
- `Pending` — no timesheet submitted
- `● Submitted` (red accent) — submitted, awaiting review. Shows "Click to review →"
- `✓ Approved` (green) — approved. Shows "Click to view →"
- `✗ Rejected` (red) — rejected

**Detail panel:** Opens below cards on click. Shows all days with hours, project/task/expense/description labels, location, notes (labeled NOTES: in amber), and daily report. Approve ✓ / Reject ✗ buttons appear when status = `submitted`.

**Approve flow:** Updates timesheet status to `approved`. Reloads data but preserves open detail panel.

**Reject flow:** Opens rejection note input. Updates status to `rejected` with note stored in `rejection_note` column.

**Excel Export** (`exportTimesheets()`, triggered by the "↓ Export & Email Timesheets" button):
- Uses `window.ExcelJS` (ExcelJS 4.4.0 loaded via CDN in `index.html`) — switched from SheetJS community edition (2026-09-02) because SheetJS's free build cannot write cell borders, fonts, or number formats, and matching the real company timesheet template exactly requires all three
- Per-employee tabs are built by `buildTimesheetSheet()` in `src/timesheetTemplate.js`, a cell-for-cell reproduction (merges, fonts, borders, number formats, formulas, page setup/print header) of the actual BIS company timesheet template, reverse-engineered from a completed sample workbook. **Visually verified (2026-09-11)** against the reference sample (`VDC-Timesheets-DHancock-WE 08-30-2026.xlsx`) by exporting both to PDF and comparing directly — one defect found and fixed: a stray partial-border artifact in the blank footer area below the closing double-rule (leftover "footer spacer rows" code drew partial left/right corner borders that don't exist in the real form); the block was removed and the fix confirmed gone in the regenerated PDF
- Operates on all submitted + approved timesheets for the currently-reviewed week (`reviewWS`, navigable via ‹/› — export dates are anchored to this, not to "today")
- Produces two downloaded files plus per-record archive copies in Supabase Storage (see 5.9):
  1. **`BIS_VDC_Timesheets_{weekEndDate}.xlsx`** — one tab per employee, named by `emp_no`. Matches the company template: Employee No./Name, Week-Ending date, Employee/Supervisor signature (typed name in Lucida Handwriting font) and Site/Foreman (left blank — no data source yet) header block; PROJECT #, TASK #, EXPENSE TYPE, PROJECT DESCRIPTION columns; 7 day columns (Mon–Sun) × REG/OT/DT; live SUM formulas for row and column totals. Fixed 8 project rows to match the template; if an employee has more than 8 projects in a week, extra rows are appended below row 20 and the totals-row SUM range widens automatically to cover them. Confirmed correct with 3 real employees in one workbook (2026-09-11): distinct, correctly-labeled tabs (`BAR9939`/`PUG1723`/`HAN4127`), no cross-employee data contamination, identical formula/border structure across tabs
  2. **`BIS_VDC_DailyReports_{weekEndDate}.xlsx`** — single tab, all employees for the week, one row per employee per day that has a location, notes, or report entry.
- Also uploads: one single-tab timesheet workbook per employee to `{profiles.timesheet_file_location}/...` in the `timesheet-records` bucket, and one copy of the daily-report workbook to `{app_settings.daily_report_file_location}/...`. Employees/settings with no folder configured are skipped and listed in the status message. That same per-employee buffer (byte-identical) is also what gets emailed to the employee — see below.
- Also emails via `api/send-export-email.js` (2026-09-11, tested end-to-end against real Supabase/Resend credentials on a Vercel preview deployment):
  1. Timesheets workbook → `payroll_email`; daily report workbook → `manager_email` (Admin → Settings, both `;`-split for multiple recipients).
  2. **Each employee is CC'd their own single-tab timesheet** — added 2026-09-11. The client sends `{employeeId, base64}` per employee (the same buffer used for the Storage archive copy); the server re-looks-up each employee's real email from `profiles` by id rather than trusting the client, then sends. Response includes `employees: [{employeeId, email, ok/skipped/error}]`, surfaced in the export status message as `Employee copies: N/M sent`.
  - Authorization: verifies the caller's Supabase session server-side and requires `profiles.is_manager === true` — **not** a `role === "manager"/"admin"` string check (fixed 2026-09-11; `role` is a free-text job-title field, e.g. "VDC/BIM Manager", and was never going to match a literal enum value, which 403'd every real manager). `is_manager` is the same boolean every other authorization check in the app already uses.
  - Sender domain: uses `REMINDER_FROM_EMAIL` (`noreply@notify.beardint.com`, verified in Resend — see 5.10). No longer blocked on domain verification.

---

### 8.6 `AdminConsole`

Props: `{ employees, setEmployees, projects, setProjects, settings, setSettings, currentUser }`

Five sub-tabs: **Team · Projects · Locations · PTO History · Settings**

#### Team Tab
- Lists all employees with role, emp_no, manager status
- Edit: name, emp_no, role, is_manager, default_location
- Project assignment: toggle checkboxes per project per employee
- Add new team member (creates profile record, does not create auth user)
- Remove employee

**`saveEmpEdit` fix note:** Uses `.select().single()` after update to confirm row was actually written. Returns error if RLS blocks the update.

#### Projects Tab
- Lists all projects
- Edit: project_num, task_num, expense_type, project_name, description, active
- Add new project
- Remove project

**`saveProjEdit` fix note:** Destructures only DB columns before sending to Supabase to avoid passing React-side fields that cause rejection.

#### Locations Tab
- Manages the list of location options shown on employee timesheets
- Stored as JSON string in `app_settings` under key `locations`

#### PTO History Tab
- Lists all PTO requests across all employees
- Manager can approve or reject with notes

#### Settings Tab
- Company name, supervisor name, reminder time, reminder days

---

## 9.0 UI Design System

### 9.1 Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `accent` | `#c0392b` | Primary red — buttons, active states, today highlight |
| `gold` | `#c9a84c` | Project numbers, emp_no |
| `amber` | `#f5a623` | Save Draft button, warnings, labels |
| `green` | `#2dd4a0` | Approve, submitted total hours |
| `text` | `#ffffff` | Primary text |
| `muted` | `#b0a8a4` | Secondary text, labels |
| `border` | `#3a2525` | Card borders |

### 9.2 Transparency System

| Element | Opacity | Notes |
|---|---|---|
| Employee day cards | `rgba(6,4,4,0.22)` | Highly transparent — BIM images show through |
| Employee sticky header | `rgba(6,4,4,0.22)` | Matches day cards |
| Manager/Admin cards | `rgba(8,4,4,0.88)` | Near-opaque — data readability priority |
| Manager/Admin headers | `rgba(8,4,4,0.88)` | Matches cards |

### 9.3 Layout

- **Max content width:** 780px, centered
- **Sticky header offset:** `top: 113px` (accounts for main nav + tab bar height)
- **Font:** DM Sans (Google Fonts)
- **No external CSS framework** — all styles are inline React style objects

### 9.4 Background System

- 7 rotating BIM project photos (piping, mechanical, electrical)
- Cross-fade transition: 2s fade, 7s hold per image
- Overlays (bottom to top): image → dark overlay (38% opacity) → diagonal watermark → radial vignette
- Watermark: "BEARD ONE" / "1% BETTER EVERY DAY" at three depth layers

---

## 10.0 Key Utility Functions

| Function | Description |
|---|---|
| `weekStart()` | Returns Monday 00:00:00 local time for the current week |
| `toDateStr(d)` | Converts Date to `YYYY-MM-DD` using **local timezone** (not UTC) |
| `weekLabel(s)` | Returns `"Jun 22 – Jun 28, 2026"` formatted label |
| `dateOfDay(ws,i)` | Returns `"Mon Jun 23"` for day i of week starting ws |
| `excelDate(ws,i)` | Returns `"06/23/2026"` for Excel column headers |
| `isConnectionError(msg)` | Detects Supabase pause / network failure from error message |
| `fmt12(t)` | Converts `"14:30"` to `"2:30 PM"` |
| `uid()` | Generates a random 7-character ID |
| `todayName()` | Returns current day name e.g. `"Wednesday"` |
| `isWeekday()` | Returns true Monday–Friday |

---

## 11.0 Error Handling

### 11.1 Supabase Connection / Database Sleep

When Supabase free tier pauses after 7 days of inactivity, the app detects the connection failure and displays a branded error screen:

- 😴 **"Database Sleeping"** heading
- Step-by-step recovery instructions (go to supabase.com → restore project → wait 60s → refresh)
- ↻ Refresh Page button
- ← Back to Login button
- Tip to upgrade to Supabase Pro ($25/mo) to prevent recurrence

Detection covers: `failed to fetch`, `networkerror`, `load failed`, `connection`, `timeout`, `unavailable`, `502`, `503`, `504`.

### 11.2 Login Errors

Login is wrapped in try/catch. Connection errors show the sleeping database message. Auth errors (wrong password, etc.) show the Supabase error message directly.

### 11.3 Save Errors

`handleSave` and `saveEmpEdit` capture Supabase errors and flash them to the user. `saveProjEdit` confirms the row was updated via `.select().single()` and alerts if no rows were affected (RLS block indicator).

---

## 12.0 Known Limitations & Phase 3 Items

| Item | Status | Notes |
|---|---|---|
| PTO balance tracking | Removed | Managed externally by company HR platform |
| Excel export formatting | Functional | Column widths pre-set; no cell formatting/color |
| Demo / read-only mode | Planned (Phase 3) | `is_demo` flag to restrict editing for external viewers |
| Reporting date range export | Planned (Phase 3) | Currently exports current week only |
| OH code management tab | Deferred | OH codes managed as regular projects |
| Employee self-edit profile | Not implemented | Emp# and settings set by admin only |
| Supabase Pro upgrade | Recommended | Prevents free-tier database pause |

---

## 13.0 Deployment

### 13.1 Vercel

- **Project:** `timesheet-app` (Hobby plan)
- **Production URL:** `timesheet-app-snowy.vercel.app`
- **Build command:** `npm run build`
- **Output directory:** `build`
- **Framework:** Create React App
- **Auto-deploy:** Every commit to `main` branch triggers a new production deployment (~60 seconds)

### 13.2 Deployment Workflow

1. Make changes to `src/App.js` (or other files) locally or in Claude
2. Open `github.com/dhancock69/timesheet-app/blob/main/src/App.js`
3. Click pencil icon → Ctrl+A → paste new content → Commit changes
4. Vercel auto-deploys within ~60 seconds
5. Verify at Vercel dashboard → Deployments → check for green "Ready" status

### 13.3 GitHub Repository

- **URL:** `github.com/dhancock69/timesheet-app`
- **Branch:** `main` (single branch)
- **Primary files changed during development:** `src/App.js`, `public/index.html`

---

## 14.0 Supabase Project

- **Organization:** Beard Integrated Systems
- **Project name:** beard-timesheet
- **Plan:** Free (subject to 7-day inactivity pause)
- **Region:** (as configured at project creation)
- **Auth provider:** Email/Password only
- **Password reset redirect:** `https://timesheet-app-snowy.vercel.app`

---

## 15.0 Demo Account

A shared demonstration account is maintained for upper management presentations and onboarding:

| Field | Value |
|---|---|
| Email | `demo@beardint.com` |
| Role | employee (or manager as needed for demos) |
| Purpose | Pre-populated with sample timesheet data for demonstrations |

---

## 16.0 Current Status (as of September 21, 2026)

### 16.1 Shipped / In Production

- Full React + Supabase app deployed on Vercel, auto-deploying from `main`
- Auth with role-based access (employee, manager, admin)
- Time entry with REG/OT/DT per project code per day
- Manager Review workflow with week navigation (‹/› arrows) and approval/rejection
- PTO request and tracking system (accrual math removed — accrual is tracked externally by BIS HR)
- Excel export via SheetJS, multi-tab, matching the BIS payroll template
- Admin Console: Team, Projects, Locations, PTO History, Settings tabs
- Beard-branded UI with rotating BIM background images and diagonal watermark
- Supabase "Database Sleeping" detection/recovery screen
- TDZ black-screen crash, save/race-condition, timezone, and Card `onClick` forwarding bugs all resolved
- Demo account strategy (`demo@beardint.com`) established for the upper-management presentation
- Jose Barron and James Pugh actively using the platform day-to-day
- Excel export bug fixed: per-employee sheets were listing every company project as a row (mostly blank); now only lists projects the employee actually logged hours against (`empProjs`) — found while starting Excel-export testing with Daniel's own submitted entries (low team testing participation so far)
- Excel export date bug fixed: date row and "week/period ending" header were computed from the app-load week instead of the reviewed week (`reviewWS`), so exporting a past/future week (via ‹/›) showed the wrong dates — now anchored correctly
- Added `timesheet_file_location` field to employee profiles (Admin Console → Team → edit) — Supabase Storage subfolder where that employee's weekly timesheet record archives to. Schema change applied (`ALTER TABLE profiles ADD COLUMN timesheet_file_location text;` — run 2026-08-31)
- Added `daily_report_file_location` global setting (Admin Console → Settings) — Storage subfolder for the weekly all-employee daily report archive. No schema change needed (generic `app_settings` key)
- Excel export now produces two downloaded files: `BIS_VDC_Timesheets_{weekEndDate}.xlsx` (one tab per employee, hours) and `BIS_VDC_DailyReports_{weekEndDate}.xlsx` (single tab, all employees, location/notes/report text) — daily report content was previously fetched but silently discarded
- Export also archives a record copy per employee (single-tab timesheet) plus one daily-report copy to the `timesheet-records` Supabase Storage bucket, using the folder fields above. Employees/settings left blank are skipped and reported in the export status message
- `timesheet-records` Storage bucket + INSERT/UPDATE/SELECT policies for managers/admins confirmed present in Supabase (see 5.9) — Storage archiving is unblocked

- Folder fields filled in: employee `timesheet_file_location` values set (Admin → Team) and `daily_report_file_location` set (Admin → Settings) — Storage archiving is no longer skipped
- `manager_email` and `payroll_email` (Admin → Settings) filled in; `payroll_email` holds two recipients separated by `;` — note for whenever "email submission directly to payroll" (16.3) is built: split on `;` for multiple recipients. Neither field is consumed by any code yet, so this is safe as-is
- Excel export tested end-to-end (2026-09-01): submitted a real timesheet, approved it, ran export as manager. Both downloaded files were correct and both Storage archive copies landed in `timesheet-records`. One issue found and fixed along the way: `timesheet_file_location` had been set to a real Windows/OneDrive filesystem path instead of a short Storage folder name, so the archive silently "succeeded" (200 from Supabase) but nested the file under an unusable path built from that literal string. `storagePath()` in `src/App.js` now sanitizes the folder value (backslashes → forward slashes, strips a leading drive letter) as a safety net, and the Team-edit and Settings forms show an inline warning (`looksLikeLocalPath()`) when the typed value looks like a local path rather than a Storage folder name
- Confirmed (2026-09-01): Jose Barron and James Pugh each show up as a single, correct `profiles` row (role `employee`, correct `emp_no`, no manager badge — expected, since Daniel is the only manager reviewing/approving). Both were added directly by Claude during initial app setup (not through the `inviteEmployee` admin flow, which generates a placeholder id that can mismatch the real Supabase Auth id on self-registration). `timesheet_file_location` now filled in for both (set to their employee numbers)
- Fixed the `inviteEmployee` id-mismatch bug proactively (2026-09-01, not yet needed live but would have bitten the next team member added via Admin → Team → Add Team Member): that flow creates a `profiles` row with a client-generated placeholder id (`uid()`, not a real UUID), which never matched the real Supabase Auth id once the person actually signed up — resulting in a blank duplicate profile (default role/no emp_no/no folder location) instead of using the admin-configured row. `handleSignup` and `handleLogin` in `src/App.js` now look up an existing profile by email and re-key (`UPDATE ... SET id=<real auth id>`) it instead of inserting a new blank one. Requires a new RLS policy — "Users can claim their own pre-created profile" (UPDATE, `email = auth.email()` / `id = auth.uid()`) — added to `profiles` (see 6.1); confirm it's been run in Supabase before the next new-employee signup
- Upper-management demo delivered (2026-09-01): `demo@beardint.com` populated with sample data and shared with several executives
- Daily reminder system built (2026-09-01): the old "designed but not confirmed implemented" notification UI was actually just decorative (see 5.8 note) — replaced with a real Vercel Cron + `api/daily-reminder.js` + Resend email flow, see 5.10 for full design/rationale. Fires weekdays at 1:30 PM America/Chicago, emails anyone who hasn't logged hours for the day (excluding approved PTO and already-submitted weeks)
- Email submission directly to payroll built (2026-09-02): `exportTimesheets()` (`ManagerView`, `src/App.js`) now emails both exported workbooks automatically on every click of "Export & Email Timesheets" — the timesheets workbook (per-employee tabs) to `payroll_email`, the daily report workbook to `manager_email`, both split on `;` for multiple recipients. New endpoint `api/send-export-email.js` sends both via Resend with the workbook as a base64 attachment. Export panel copy and button ("↓ Export & Email Timesheets") updated so it's clear emails go out, addressing prior confusion where the button gave no indication anything would be emailed.
- Per-employee timesheet export rebuilt to match the real BIS company template exactly (2026-09-02): Daniel uploaded a completed sample (`VDC-Timesheets-DHancock-WE 08-30-2026.xlsx`); the raw OOXML was reverse-engineered cell-by-cell (fonts, borders, merges, number formats, formulas, page setup) since the previous export only loosely resembled the real form. This required switching the export library from SheetJS community edition (can't write borders/fonts/number formats) to **ExcelJS** (`public/index.html` CDN swap, `xlsx` → `exceljs` 4.4.0) — new module `src/timesheetTemplate.js` (`buildTimesheetSheet()`) now reproduces the template's header block (Employee No./Name, Week-Ending, signatures in Lucida Handwriting font, Site/Foreman left blank), 7-day REG/OT/DT grid with live SUM formulas, and print header/page setup. Decisions made with Daniel: Supervisor's Signature always shows the real supervisor (`settings.supervisor`), not a self-signed value; Site/Foreman stays blank (no data source); the template's fixed 8 project rows expand automatically (with widened SUM range) if an employee logs more than 8 projects in a week.
- **Resend domain verified (2026-09-11):** `notify.beardint.com` verified in Resend (DKIM + SPF) rather than the apex `beardint.com`, avoiding conflict with M365's existing mail records there. `REMINDER_FROM_EMAIL` corrected to `noreply@notify.beardint.com` in both Production and Preview. This was the actual remaining blocker on both the daily reminder and export emails ever sending for real — resolved.
- **Daily reminder made DST-safe (2026-09-11):** `vercel.json` now fires the cron at both `30 18 * * 1-5` and `30 19 * * 1-5` (18:30/19:30 UTC) instead of one fixed UTC time, so it lands at 1:30 PM America/Chicago year-round without a manual schedule change each DST transition. Added a `reminder_last_sent_date` guard refinement: the flag is only set if at least one recipient's send actually succeeds, so a total Resend outage lets the later cron entry retry rather than silently marking the day "done." Added `?dryRun=1` (still requires `CRON_SECRET`) to preview the real recipient list without sending or touching dedup state. See 5.10.
- **`api/send-export-email.js` authorization bug fixed (2026-09-11):** the endpoint checked `profiles.role === "manager"/"admin"`, but `role` is a free-text job-title field (e.g. "VDC/BIM Manager") never validated as an enum — every real manager/admin was being 403'd. Now checks `profiles.is_manager` (boolean), matching every other authorization gate in the app.
- **Excel template border artifact fixed (2026-09-11):** visually verified `buildTimesheetSheet()`'s output against the reference sample (`VDC-Timesheets-DHancock-WE 08-30-2026.xlsx`) by exporting both to PDF and comparing directly. Found and removed a stray partial-border artifact in the blank footer area below the closing double-rule (leftover "footer spacer rows" code that doesn't match the real form). Confirmed fixed in the regenerated PDF.
- **Export email tested end-to-end (2026-09-11):** validated against a Vercel preview deployment with real Supabase/Resend credentials — single-employee send, then a 3-employee combined workbook (you, Jose Barron, James Pugh) confirming correctly-labeled, non-contaminated per-employee tabs. Both the auth bug and border artifact above were found during this testing.
- **Each employee now CC'd their own timesheet on export (2026-09-11):** `api/send-export-email.js` accepts a per-employee `{employeeId, base64}` list (the same buffer already used for the Storage archive copy — byte-identical, not regenerated) and emails each employee their own single-tab workbook, having re-looked-up their real email from `profiles` server-side rather than trusting the client. Status message reports `Employee copies: N/M sent`. Tested with a real send on a single-employee week; multi-employee attachment scoping verified structurally (same buffer already confirmed correct in the 3-employee Storage archive test) rather than via a second live send, to avoid emailing Jose's/James's real addresses during testing.
- **Employee week navigation added (2026-09-21):** `EmployeeView` (`src/App.js`) previously only ever operated on the app-load week (module-level `WS`, fixed at page load), so an employee who missed a week — e.g. last pay period — had no way to go back and fill it out. Added `viewWS`/`shiftWeek()` state, mirroring `ManagerView`'s existing `reviewWS` pattern: ‹/› buttons in the sticky header shift the viewed week ±7 days (capped so employees can't navigate into future weeks), with a "This Week" jump-back button. Confirmed via `npx react-scripts build` (compiles clean) — no schema/RLS change needed, since `timesheets` is already keyed uniquely on `(employee_id, week_start)` and RLS already permits an employee to manage any of their own timesheet rows regardless of date. See 8.3.
- **Daily reminder times split by weekday (2026-09-21):** Daniel reported reminders landing at ~2:18 PM every weekday and that Friday's was supposed to go out at 10 AM. Replaced the single shared 1:30 PM target with per-weekday targets (`REMINDER_TARGETS` in `api/daily-reminder.js`): Mon–Thu 12:30 PM, Friday 10:00 AM. Initially built as a 4-entry DST-auto-adjusting schedule, then corrected same-day per Daniel to the simpler 2-entry schedule (one fixed UTC time per weekday group, no DST auto-adjustment) to stay within the confirmed Hobby 2-cron-job cap — see 5.10 for the schedule and the ⚠ manual-DST-maintenance note (next hand-edit needed before 2026-11-01).

### 16.2 Known Outstanding
- **Multi-employee CC path not live-tested end-to-end** — the single-employee CC send was verified live; the multi-employee case rests on the structural guarantee that the CC'd buffer is identical to the already-verified Storage-archive buffer, not a second live send to real employee addresses (deliberately avoided during testing). Worth a real check next time multiple employees' exports are run for real.
- **Confirmed on Vercel Hobby plan (2026-09-11)**, per the dashboard plan badge. Hobby caps a project at 2 cron jobs total and doesn't allow sub-daily/exact-minute schedules per job. As of 2026-09-21 the daily-reminder's 2-entry schedule (see 5.10) fits this cap but has given up DST auto-adjustment as a result — `vercel.json`'s UTC hours must be hand-edited by 1 hour at each DST transition, **next one Sunday, November 1, 2026**, or the reminder will silently stop sending (see ⚠ in 5.10 for why it's silent, not just late).

### 16.3 Wishlist / Not Started

- Mobile layout optimization
- Surfacing archived Storage record links back in the UI (e.g. a "view record" link on the employee card) — not built, archiving is currently write-only
- Phase 3 items from Section 12.0 (demo/read-only mode, date-range export, etc.)

---

## 17.0 Continuing Development with Claude Code

Claude Code sessions (terminal, desktop, or the "Open Claude Code" button in claude.ai) do **not** inherit history from claude.ai chat conversations — each is a fresh session with no transcript carried over. This spec file is the persistent bridge between sessions.

**To resume work in Claude Code:**

1. Open Claude Code in the `timesheet-app` repo directory (via terminal `claude`, the desktop Code tab, or the "Open Claude Code" button).
2. First message: *"Read BIS_Timesheet_Platform_Spec.md at the repo root for full project context, then let's continue."*
3. Claude Code reads the file directly from disk and reconstructs schema, component structure, known issues, and current status from Sections 1–16 above.

**Keeping this file current:** After any significant session (new feature, bug fix, schema change), ask whichever Claude you're working with to append updates to Sections 16.1–16.3 and bump the Version/Date in the header, then commit the change alongside the code change.

---

*END OF DOCUMENT*

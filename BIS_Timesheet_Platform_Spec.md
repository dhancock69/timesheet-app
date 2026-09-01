# BeardONE Timesheet Platform — Technical Specification

**Document:** BIS-VDC-SPEC-001  
**Version:** 1.4  
**Date:** September 1, 2026  
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
| Excel Export | SheetJS (XLSX) | 0.18.5 via CDN |
| Font | DM Sans | Google Fonts (400, 500, 700, 900) |
| Supabase Client | @supabase/supabase-js | ^2.39.0 |

---

## 3.0 Repository Structure

```
timesheet-app/
├── public/
│   ├── index.html              # App shell, Google Fonts, SheetJS CDN
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

**Known keys:** `supervisor`, `company_name`, `reminder_time`, `reminder_days`, `locations`, `manager_email`, `payroll_email`, `daily_report_file_location` (Storage folder for the weekly all-employee daily report archive — see 5.9)

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

**Key functions:**

| Function | Description |
|---|---|
| `loadTimesheet()` | Fetches existing timesheet + entries + reports for current week. Fires when `empProjects.length > 0`. |
| `handleSave(submit)` | Deletes existing entries then re-inserts all current data. Sets status to `draft` or `submitted`. |
| `updateEntry(dayIdx, projId, field, val)` | Updates a single hour field in local state |
| `updateDay(i, field, val)` | Updates location/notes/report for a day |

**Sticky action bar (top of view):**
- Row 1: Employee name, week range, emp_no, hours summary (REG/OT/DT/Total), saved/submitted badge
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

**Excel Export** (`exportTimesheets()`, triggered by the "↓ Export Timesheets Excel" button):
- Uses `window.XLSX` (SheetJS loaded via CDN in `index.html`)
- Operates on all submitted + approved timesheets for the currently-reviewed week (`reviewWS`, navigable via ‹/› — export dates are anchored to this, not to "today")
- Produces two downloaded files plus per-record archive copies in Supabase Storage (see 5.9):
  1. **`BIS_VDC_Timesheets_{weekEndDate}.xlsx`** — one tab per employee, named by `emp_no`. BIS payroll format: Employee No, Week Ending, Supervisor header rows; PROJECT #, TASK #, EXPENSE TYPE, PROJECT DESCRIPTION columns (only projects the employee logged hours against); daily REG/OT/DT; row totals.
  2. **`BIS_VDC_DailyReports_{weekEndDate}.xlsx`** — single tab, all employees for the week, one row per employee per day that has a location, notes, or report entry.
- Also uploads: one single-tab timesheet workbook per employee to `{profiles.timesheet_file_location}/...` in the `timesheet-records` bucket, and one copy of the daily-report workbook to `{app_settings.daily_report_file_location}/...`. Employees/settings with no folder configured are skipped and listed in the status message.

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

## 16.0 Current Status (as of September 1, 2026)

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

### 16.2 Known Outstanding
- Upper-management presentation itself — not yet delivered
- Demo account population with realistic sample data — not yet confirmed complete
- Notification system (10 AM Friday reminder, configurable 1 PM daily reminder) — designed but not confirmed fully implemented

### 16.3 Wishlist / Not Started

- Email submission directly to payroll
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

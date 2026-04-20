# CLAUDE.md - CLAUDE Context for PayrollX

This file provides AI assistants with context about the PayrollX project structure, conventions, and codebase organization.

## Project Overview

PayrollX is a **Smart AI-Powered Payroll Management System** built as a Final Year Project (FYP). It's a full-stack application with:

- **Backend**: Node.js/Express.js with PostgreSQL (`payrollx-server/`)
- **Frontend**: React 18 with TypeScript, Redux Toolkit, React Query, shadcn/ui (`payrollx-ui/`)
- **AI Features**: Advanced fraud detection (10 algorithms), salary anomaly detection, payroll forecasting, salary recommendations, HR chatbot

## Directory Structure

```
pay/
├── payrollx-server/            # Backend (Node.js/Express)
│   ├── migrations/             # SQL migration files (001-020)
│   ├── seeds/                  # Database seed scripts
│   │   ├── seed.js             # Main seed (employees, attendance, etc.)
│   │   └── fraud-test-seed.js  # Fraud detection test data (10 scenarios)
│   └── src/
│       ├── config/             # Configuration (database, env)
│       ├── controllers/        # HTTP request handlers
│       ├── middleware/         # Express middleware (auth, validation, error handling)
│       ├── routes/             # API route definitions
│       ├── services/           # Business logic
│       │   └── ai/             # AI services (fraud, anomaly, forecast, chatbot)
│       └── utils/              # Utilities (JWT, errors, transformers, tax calculator)
│
├── payrollx-ui/                # Frontend (React/TypeScript)
│   └── src/
│       ├── components/         # UI components (shadcn/ui)
│       │   ├── layout/         # AppShell, AppSidebar, TopBar
│       │   └── AlertDetailModal.tsx  # Fraud alert case management modal
│       ├── hooks/              # React Query hooks for API calls
│       ├── lib/                # API client, utilities
│       ├── pages/              # Page components
│       └── store/              # Redux store
│
└── .claude/
    ├── CLAUDE.md               # This file
    └── README.md               # Project documentation
```

## Key Technical Details

### Backend Architecture

- **Language**: JavaScript (ES6+) — NOT TypeScript
- **Database**: PostgreSQL with raw SQL queries (pg/node-postgres)
- **Authentication**: JWT with refresh token rotation
  - Access token: 15 minutes
  - Refresh token: 7 days with rotation
- **API Response Format**:
```javascript
{
  success: true,
  data: { ... },
  meta: { page, limit, total, totalPages },  // paginated responses
  error: { message, code }                   // errors
}
```

### Database Schema (20 migrations)

1. `users` - Authentication (admin, hr, employee roles)
2. `departments` - Company departments
3. `employees` - Employee records (`joining_date`, `bank_account_number`, `status`)
4. `salary_structures` - Salary components; `gross_salary` is a GENERATED column
5. `attendance` - Daily records (`status`, `overtime_hours`)
6. `leave_types` - Types of leave (Annual/AL, Sick/SL, Casual/CL, etc.)
7. `leave_requests` - Applications (`status`: pending/approved/rejected/cancelled)
8. `leave_allocations` - Per-employee leave balances
9. `payroll_runs` - Monthly batches (`status`: draft/processing/completed/approved/paid/cancelled)
10. `payslips` - Individual payslips; UNIQUE on `(payroll_run_id, employee_id)`
11. `ai_alerts` - AI-generated alerts (fraud, anomaly) with case management fields
12. `chatbot_sessions` / `chatbot_messages` - HR chatbot logs
13. `public_holidays` - Pakistani public holidays
14. `refresh_tokens` - JWT refresh token storage
15. `security_audit_log` - Security event logging
16. `settings` - System configuration
17. `notifications` - User notifications
18. `notices` - Notice board posts

**Important column names:**
- Employees: `joining_date` (NOT `hire_date`), `employee_id` (the code like EMP0001, NOT the UUID)
- Salary structures: `gross_salary` is GENERATED (do not INSERT it directly)
- Payroll runs: valid statuses are `completed/approved/paid` (NOT `processed`)

### API Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Login, logout, refresh, register |
| Employees | `/api/v1/employees` | CRUD + stats |
| Attendance | `/api/v1/attendance` | Check-in/out, mark, bulk |
| Leaves | `/api/v1/leaves` | Requests, approvals, balance |
| Departments | `/api/v1/departments` | CRUD |
| Payroll | `/api/v1/payroll` | Runs, payslips, tax calculation |
| AI | `/api/v1/ai` | Fraud detection, anomaly, forecast, chatbot |
| Settings | `/api/v1/settings` | System config, holidays |

### Pakistani Tax Compliance

- **FBR Tax Slabs** (2024-25) for filers and non-filers
- **EOBI**: 0.75% employer contribution
- **SESSI**: 0.75% employer contribution (wages up to PKR 25,000)
- Tax calculator: `payrollx-server/src/utils/taxCalculator.js`

### Frontend Hooks

All API calls use React Query hooks in `payrollx-ui/src/hooks/`:

- `useAuth.ts` - Authentication
- `useEmployees.ts` - Employee CRUD and stats
- `useAttendance.ts` - Attendance management
- `useLeaves.ts` - Leave requests and balance
- `usePayroll.ts` - Payroll runs and payslips
- `useAI.ts` - All AI features including fraud detection and risk scoring
- `useDashboard.ts` - Dashboard data
- `useSettings.ts` - System settings

### Data Transformation

Backend uses snake_case, frontend uses camelCase. Transformers in `payrollx-server/src/utils/transformers.js`.

## Development Commands

### Backend (payrollx-server/)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (nodemon, port 5000)
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed sample data (employees, attendance, etc.)
npm run db:seed:fraud    # Seed fraud detection test scenarios (10 fraud cases)
npm run start            # Production start
```

### Frontend (payrollx-ui/)
```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server (port 5173)
npm run build     # Production build
```

## Test Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@payrollx.com | Admin@123 |
| HR | hr@payrollx.com | Hr@123456 |
| Employee | ahmad.khan@payrollx.com | Employee@123 |

## Code Conventions

1. **Error Handling**: Use custom error classes from `utils/errors.js`
2. **Validation**: Use express-validator middleware
3. **Auth Middleware**: `protect` for auth, `restrictTo('admin', 'hr')` for roles, `hrOnly` = both admin and hr
4. **Async Handlers**: Wrap controllers with `asyncHandler` from errorHandler
5. **Database Queries**: Use parameterized queries to prevent SQL injection
6. **Response Format**: Always use `success()` or `error()` from apiResponse
7. **saveAlert() idempotency**: Checks for same `(employee_id, title)` on same day before inserting

## AI Features Architecture

### 1. Fraud Detection (`fraudDetection.service.js`) — 10 Algorithms

**Existing algorithms:**
1. `checkDuplicateBankAccounts()` — employees sharing same bank_account_number (95% confidence, critical)
2. `checkSalarySpikes()` — >50% salary increase via LAG window (75%, high)
3. `checkGhostEmployees()` — no attendance >60 days (70–90%, critical)
4. `checkOvertimeAnomalies()` — >80 OT hours/month (65%, medium)

**New algorithms (added 2026-04-15):**
5. `checkDuplicatePayments()` — same employee_id + month + year in multiple payslips (98%, critical)
6. `checkRoundTripSalary()` — salary raised >15% then reverted within 5% of original (82%, high)
7. `checkPayrollOnLeave()` — salary paid for a month where approved leave covers all working days (78%, high)
8. `checkSuspiciousHire()` — joined ≤14 days ago + already in processed payroll (92%/70%, critical/high)
9. `checkSickLeaveAbuse()` — Z-score >3.0 vs department average sick leave (72%, medium)
10. `checkOvertimeAbsentContradiction()` — OT hours on absent/half-day attendance records (88%, medium/high)

**Additional exports:**
- `getEmployeeRiskScores()` — per-employee fraud risk score (0–100), weighted by severity/confidence/recency
- `getFraudStats()` — 30-day alert counts by status and severity
- `saveAlert()` — inserts to ai_alerts with idempotency guard (no duplicate same employee+title per day)

**Employee Risk Scoring formula:**
- Score = SUM(base_weight × confidence/100 × recency_factor), clamped to 100
- Severity weights: critical=40, high=25, medium=12, low=5
- Recency: ≤30 days=1.0, ≤60 days=0.7, older=0.4
- Risk tiers: 0–24 Low · 25–49 Medium · 50–74 High · 75–100 Critical

### 2. Salary Anomaly (`salaryAnomaly.service.js`)
- Z-score based (stddev >2) per department and designation
- Deduction pattern analysis (>50% of gross)

### 3. Payroll Forecasting (`payrollForecast.service.js`)
- Time-series trend analysis with seasonal adjustment factors

### 4. Salary Recommendations (`salaryRecommendation.service.js`)
- Market comparison (hardcoded Pakistani market rates 2024)
- Internal equity + experience factor

### 5. HR Chatbot (`chatbot.service.js`)
- Intent classification (8 intents: salary, leave, attendance, tax, payslip, policy, greeting, help)
- Real API endpoint: `POST /api/v1/ai/chatbot`

## AI Alerts Table — Case Management Workflow

```
ai_alerts.status flow: new → acknowledged → investigating → resolved | dismissed
```

- `resolved` and `dismissed` both set `resolved_by`, `resolved_at`, `resolution_notes`
- `resolution_notes` can be saved on any status transition (not just terminal)
- Alert types: `fraud_detection`, `salary_anomaly`, `attendance_anomaly`, `payroll_forecast`, `salary_recommendation`

## Fraud Detection API Endpoints

```
POST /api/v1/ai/fraud-detection/run           → runs all 10 algorithms, saves alerts
GET  /api/v1/ai/fraud-detection/stats         → 30-day stats by status/severity
GET  /api/v1/ai/fraud-detection/employee-risk → per-employee risk scores (0-100)
GET  /api/v1/ai/alerts                        → paginated alerts (filters: type, severity, status)
PATCH /api/v1/ai/alerts/:id                   → update status + resolution notes
```

## Frontend — Fraud Detection Center (`/hr/ai-insights`)

**Route**: `/hr/ai-insights` (sidebar label: "Fraud Detection" with ShieldAlert icon)

**Page file**: `payrollx-ui/src/pages/FraudDetection.tsx`

**4-tab layout:**
1. **Overview** — PieChart by fraud type, Risk Tier Distribution bars, Algorithm Coverage Table (all 10)
2. **Alerts** — Filterable table (severity/status/type/search), quick Acknowledge, View Details → modal
3. **Employee Risk** — Ranked leaderboard with colored progress bars (0–100 score), C/H/M breakdown
4. **Investigations** — Kanban: New | In Progress | Recently Closed, click card → modal

**`AlertDetailModal.tsx`** — Case management modal:
- Confidence progress bar
- Detection details (JSONB rendered as key-value, PKR prefix for salary fields)
- Status pipeline visualization (New → Acknowledged → Investigating → Resolved)
- Dynamic action buttons per status
- Resolution notes textarea (required for `resolved`, optional for `dismiss`)

## Role & Permission Architecture

### Frontend Route Guards
```typescript
const HR_ROLES = ["admin", "hr"] as const;
<ProtectedRoute allowedRoles={HR_ROLES}>...</ProtectedRoute>   // HR/Admin routes
<ProtectedRoute allowedRoles={["employee"]}>...</ProtectedRoute>  // Employee only
<ProtectedRoute>...</ProtectedRoute>                              // All authenticated
```

### Backend Permission Model
- `PRIVILEGED_ROLES = ['admin', 'hr']` — both have full HR access
- `hrOnly` middleware = `restrictTo(...PRIVILEGED_ROLES)`
- Admin role has all permissions; employee has self-service only

## Theme System

- Default: **dark** (`:root` CSS variables in `index.css`)
- Light theme: `.light` class on `<html>`
- Toggle: Sun/Moon button in TopBar → Redux `toggleTheme` action → localStorage `payrollx-theme`
- Persistence: `main.tsx` reads localStorage before first render (prevents flash)

## Sidebar Navigation

```
HR/Admin sidebar:
  Dashboard | Employees | Attendance | Leaves | Payroll | Payslips
  Notice Board | Fraud Detection (/hr/ai-insights) | Settings

Employee sidebar:
  Dashboard | My Profile | Attendance | Leaves | Payslips
  Notice Board | AI Insights (/employee/ai-insights) | Settings
```

## Important Notes

- This is an FYP project — AI features use rule-based algorithms (enhanceable with ML)
- Pakistani market context — tax slabs, EOBI, SESSI are Pakistan-specific
- `payrollx-server/` = backend, `payrollx-ui/` = frontend (not `server/` or `payroll-insights-hub/`)
- `salary_structures.gross_salary` is a GENERATED ALWAYS AS column — never insert it directly
- `employees.joining_date` is the hire date column (not `hire_date`)
- `payroll_runs.status` valid values: draft/processing/completed/approved/paid/cancelled (not 'processed')
- Admin accounts have the same frontend access as HR — both use `HR_ROLES` route guards

## Bug Fixes Applied

### Session: 2026-04-13
1. **Admin infinite redirect loop** — `HR_ROLES = ["admin","hr"]` in App.tsx, all 11 HR routes updated
2. **Employee dashboard 500 crash** — `latestPayslip.net_salary` (snake_case) in dashboard.service.js
3. **HR search shown to employees** — `isEmployee` guard in Payslips.tsx
4. **Chatbot using hardcoded responses** — rewrote Chatbot.tsx to use real API + sessionId

### Session: 2026-04-15
5. **saveAlert type error (500 on fraud run)** — `INSERT INTO ... SELECT $n` doesn't infer column types; reverted to `VALUES` syntax with separate idempotency pre-check
6. **hire_date column doesn't exist** — fixed to `joining_date` in checkSuspiciousHire()
7. **payroll_runs status 'processed' invalid** — fixed to `IN ('completed', 'approved', 'paid')`

## New Features Added

### Session: 2026-04-13
- **Dark/Light Theme Toggle** — index.css, uiSlice.ts, main.tsx, TopBar.tsx

### Session: 2026-04-15
- **Advanced Fraud Detection** — 6 new algorithms, employee risk scoring, AlertDetailModal, full Fraud Detection Center UI (4 tabs)
- **Fraud Test Seed** — `npm run db:seed:fraud` inserts 14 test employees across 10 fraud scenarios
- **Sidebar rename** — "AI Insights" → "Fraud Detection" (ShieldAlert icon) for HR nav

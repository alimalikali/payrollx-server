# CLAUDE.md - CLAUDE Context for # PayrollX - AI Instructions

This file provides AI assistants with context about the PayrollX project structure, conventions, and codebase organization.

## Project Overview

PayrollX is a **Smart AI-Powered Payroll Management System** built as a Final Year Project (FYP). It's a full-stack application with:

- **Backend**: Node.js/Express.js with PostgreSQL
- **Frontend**: React 18 with TypeScript, Redux Toolkit, React Query, shadcn/ui
- **AI Features**: Fraud detection, salary anomaly detection, payroll forecasting, salary recommendations, HR chatbot

## Directory Structure

```
payrollx/
├── server/                     # Backend (Node.js/Express)
│   ├── migrations/             # SQL migration files (001-014)
│   ├── seeds/                  # Database seed scripts
│   └── src/
│       ├── config/             # Configuration (database, env)
│       ├── controllers/        # HTTP request handlers
│       ├── middleware/         # Express middleware (auth, validation, error handling)
│       ├── routes/             # API route definitions
│       ├── services/           # Business logic
│       │   └── ai/             # AI services (fraud, anomaly, forecast, chatbot)
│       └── utils/              # Utilities (JWT, errors, transformers, tax calculator)
│
├── payroll-insights-hub/       # Frontend (React/TypeScript)
│   └── src/
│       ├── components/         # UI components (shadcn/ui)
│       ├── hooks/              # React Query hooks for API calls
│       ├── lib/                # API client, utilities
│       ├── pages/              # Page components
│       └── store/              # Redux store
│
├── CLAUDE.md                   # This file - AI instructions
├── README.md                   # Project documentation
└── PAYROLLX_MASTER_PROMPT.md   # Complete project specification
```

## Key Technical Details

### Backend Architecture

- **Language**: JavaScript (ES6+) - NOT TypeScript
- **Database**: PostgreSQL with raw SQL queries (pg/node-postgres)
- **Authentication**: JWT with refresh token rotation
  - Access token: 15 minutes
  - Refresh token: 7 days with rotation
- **API Response Format**:
```javascript
{
  success: true,
  data: { ... },
  meta: { page, limit, total, totalPages },  // for paginated responses
  error: { message, code }  // for errors
}
```

### Database Schema (14 tables)

1. `users` - Authentication users (admin, hr, employee roles)
2. `departments` - Company departments
3. `employees` - Employee records
4. `salary_structures` - Salary components and allocations
5. `attendance` - Daily attendance records
6. `leave_types` - Types of leave (annual, sick, casual, etc.)
7. `leave_requests` - Leave applications
8. `leave_allocations` - Per-employee leave balances
9. `payroll_runs` - Monthly payroll processing batches
10. `payslips` - Individual employee payslips
11. `ai_alerts` - AI-generated alerts (fraud, anomaly)
12. `chatbot_sessions` / `chatbot_messages` - HR chatbot logs
13. `public_holidays` - Pakistani public holidays
14. `refresh_tokens` - JWT refresh token storage
15. `security_audit_log` - Security event logging
16. `settings` - System configuration
17. `migrations` - Migration tracking

### API Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Login, logout, refresh, register |
| Employees | `/api/v1/employees` | CRUD + stats |
| Attendance | `/api/v1/attendance` | Check-in/out, mark, bulk |
| Leaves | `/api/v1/leaves` | Requests, approvals, balance |
| Departments | `/api/v1/departments` | CRUD |
| Payroll | `/api/v1/payroll` | Runs, payslips, tax calculation |
| AI | `/api/v1/ai` | Fraud, anomaly, forecast, chatbot |
| Settings | `/api/v1/settings` | System config, holidays |

### Pakistani Tax Compliance

- **FBR Tax Slabs** (2024-25) implemented for both filers and non-filers
- **EOBI**: 0.75% employer contribution
- **SESSI**: 0.75% employer contribution (wages up to PKR 25,000)
- Tax calculator in `server/src/utils/taxCalculator.js`

### Frontend Hooks

All API calls use React Query hooks located in `payroll-insights-hub/src/hooks/`:

- `useAuth.ts` - Authentication (login, logout, current user)
- `useEmployees.ts` - Employee CRUD and stats
- `useAttendance.ts` - Attendance management
- `useLeaves.ts` - Leave requests and balance
- `usePayroll.ts` - Payroll runs and payslips
- `useAI.ts` - AI features and chatbot

### Data Transformation

Backend uses snake_case, frontend uses camelCase. Transformers in `server/src/utils/transformers.js` handle conversion.

## Development Commands

### Backend (server/)
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (nodemon)
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed sample data
npm run start        # Production start
```

### Frontend (payroll-insights-hub/)
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run build        # Production build
```

## Test Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@payrollx.com | Admin@123 |
| HR | hr@payrollx.com | Hr@123456 |
| Employee | ahmad.khan@payrollx.com | Employee@123 |

## Environment Variables

Backend requires `.env` file in `server/` directory:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payrollx
DB_USER=your_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

Frontend needs `.env` in `payroll-insights-hub/`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

## Code Conventions

1. **Error Handling**: Use custom error classes from `utils/errors.js`
2. **Validation**: Use express-validator middleware
3. **Auth Middleware**: `protect` for auth, `restrictTo('admin', 'hr')` for roles
4. **Async Handlers**: Wrap controllers with `asyncHandler` from errorHandler
5. **Database Queries**: Use parameterized queries to prevent SQL injection
6. **Response Format**: Always use `success()` or `error()` from apiResponse

## AI Features Architecture

### 1. Fraud Detection (`fraudDetection.service.js`)
- Duplicate bank account detection
- Salary spike detection (>50% increase)
- Ghost employee detection (no attendance >60 days)
- Overtime anomaly detection (>80 hours/month)

### 2. Salary Anomaly (`salaryAnomaly.service.js`)
- Z-score based statistical analysis
- Department-wise anomaly detection
- Designation-wise comparison
- Deduction pattern analysis

### 3. Payroll Forecasting (`payrollForecast.service.js`)
- Time-series trend analysis
- Seasonal adjustment factors
- Budget vs actual comparison

### 4. Salary Recommendations (`salaryRecommendation.service.js`)
- Market data comparison (simulated)
- Internal equity analysis
- Experience-based adjustments

### 5. HR Chatbot (`chatbot.service.js`)
- Intent classification (rule-based)
- Context-aware responses
- Query handling for salary, leave, attendance, tax

## Common Tasks

### Adding a New API Endpoint

1. Create service in `server/src/services/`
2. Create controller in `server/src/controllers/`
3. Create routes in `server/src/routes/`
4. Register routes in `server/src/routes/index.js`
5. Add validation rules in route file

### Adding a Frontend Hook

1. Create hook in `payroll-insights-hub/src/hooks/`
2. Export from `hooks/index.ts`
3. Use React Query patterns (useQuery, useMutation)

### Modifying Database Schema

1. Create new migration file in `server/migrations/` with next number
2. Run `npm run db:migrate`

## Bug Fixes Applied (Session: 2026-04-13)

### 1. Admin Role Infinite Redirect Loop (CRITICAL)
- **Root cause**: All HR routes had `allowedRoles={["hr"]}`. Admin role (`admin`) is not `"hr"`, so `ProtectedRoute` redirected admin to `getDefaultHome("admin")` = `/hr/dashboard`, which also blocked admin → infinite redirect loop, resulting in a blank/black page.
- **Fix**: Added `const HR_ROLES = ["admin", "hr"] as const` in `App.tsx` and replaced all 11 instances of `allowedRoles={["hr"]}` with `allowedRoles={HR_ROLES}`.
- **File**: `payroll-insights-hub/src/App.tsx`

### 3. Employee Dashboard — Server 500 Crash (CRITICAL)
- **Root cause**: `buildEmployeeInsights()` in `dashboard.service.js` used `latestPayslip.netSalary` (camelCase) on a raw PostgreSQL row object (snake_case). Any employee with a payslip caused `Cannot read properties of undefined (reading 'toLocaleString')`.
- **Fix**: Changed to `(parseFloat(latestPayslip.net_salary) || 0).toLocaleString()`.
- **File**: `server/src/services/dashboard.service.js`

### 4. Payslips Page — HR Search Field Shown to Employees (UX)
- **Root cause**: `Payslips.tsx` is a shared page used by both HR and employees. The "Search employee..." input and HR-facing subtitle were always rendered regardless of role.
- **Fix**: Added `isEmployee` boolean derived from `useCurrentUser()`, hide the search input for employees, show role-appropriate subtitle.
- **File**: `payroll-insights-hub/src/pages/Payslips.tsx`

### 2. Chatbot Using Hardcoded Mock Responses (FUNCTIONAL)
- **Root cause**: `Chatbot.tsx` had a local `getBotResponse(query: string)` function with hardcoded if/else string matching, completely bypassing the real `/api/v1/ai/chatbot` endpoint.
- **Fix**: Complete rewrite of `Chatbot.tsx` to use `useSendChatMessage` mutation, persist `sessionId` across messages, show animated typing indicator, render suggestion chips from API, and handle errors gracefully.
- **File**: `payroll-insights-hub/src/components/Chatbot.tsx`

## New Features Added (Session: 2026-04-13)

### Dark/Light Theme Toggle
- **CSS Variables**: Added complete `.light` class override in `index.css` with all ~40 CSS custom properties.
- **Redux State**: Added `theme: "dark" | "light"` to `UIState` in `uiSlice.ts`, with `toggleTheme` and `setTheme` reducers persisting to `localStorage` and toggling `.light` class on `document.documentElement`.
- **Persistence**: `main.tsx` reads stored theme from `localStorage` before first React render to prevent flash of wrong theme.
- **UI Button**: Added Sun/Moon toggle button in `TopBar.tsx` using `toggleTheme` Redux action.
- **Files**: `index.css`, `store/slices/uiSlice.ts`, `main.tsx`, `components/layout/TopBar.tsx`

## Role & Permission Architecture

### Frontend Route Guards
```typescript
const HR_ROLES = ["admin", "hr"] as const;
// HR/Admin routes use HR_ROLES
<ProtectedRoute allowedRoles={HR_ROLES}>...</ProtectedRoute>
// Employee-only routes
<ProtectedRoute allowedRoles={["employee"]}>...</ProtectedRoute>
// Public authenticated routes (all roles)
<ProtectedRoute>...</ProtectedRoute>
```

### Backend Permission Model
- `PRIVILEGED_ROLES = ['admin', 'hr']` — both have full access to all HR endpoints
- `hrOnly` middleware = `restrictTo(...PRIVILEGED_ROLES)` — allows both admin and HR
- Admin role has ALL permissions; employee role has self-service permissions only

## Theme System

### How It Works
1. `main.tsx` reads `localStorage.getItem("payrollx-theme")` before render — adds `.light` class if needed.
2. Default theme is **dark** (`:root` CSS variables).
3. Light theme activates via `.light` class on `<html>` element.
4. `toggleTheme` action in Redux updates state, localStorage, and DOM class simultaneously.
5. `TopBar.tsx` shows Sun icon in dark mode (click → switch to light), Moon icon in light mode (click → switch to dark).

## Important Notes

- This is an FYP project - AI features use rule-based algorithms (can be enhanced with ML)
- Pakistani market context - tax slabs, EOBI, SESSI are Pakistan-specific
- Mock data is seeded for development/demo purposes
- Frontend was generated with Lovable.dev and styled with shadcn/ui
- Admin accounts (role: `admin`) have the same frontend access as HR accounts — both use `HR_ROLES` in route guards

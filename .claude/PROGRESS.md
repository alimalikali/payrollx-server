# PayrollX — Development Progress

> Last updated: 2026-04-13

---

## ✅ Completed Features

### Core Infrastructure
- [x] PostgreSQL database schema — 17 tables covering all business domains
- [x] JWT authentication with refresh token rotation (15min access / 7-day refresh)
- [x] Role-based access control — `admin`, `hr`, `employee` roles
- [x] Express.js REST API with standardized response format
- [x] React 18 + TypeScript frontend with Vite
- [x] TanStack Query (React Query) for all data fetching/mutations
- [x] Redux Toolkit for UI state (sidebar, chatbot, theme)
- [x] shadcn/ui component library with Tailwind CSS

### Authentication
- [x] Login page with email/password
- [x] JWT refresh token rotation on every request
- [x] Protected routes with role-based guards
- [x] Automatic redirect to role-appropriate home on login
- [x] Logout with server-side token invalidation

### HR Dashboard
- [x] Total employees, payroll cost, attendance rate, pending leaves KPI cards
- [x] Headcount by department bar chart
- [x] Monthly payroll cost trend line chart
- [x] Attendance breakdown pie chart
- [x] Recent payroll runs table
- [x] Recent leave requests list

### Employee Management
- [x] Paginated employee list with search and department filter
- [x] Add / Edit / Delete employee modals
- [x] Employee profile detail view (personal, salary, attendance, leave history)
- [x] Department management (CRUD)
- [x] Salary structure assignment per employee

### Attendance Management
- [x] HR view — mark attendance for any employee
- [x] Employee view — own check-in/check-out
- [x] Bulk mark attendance
- [x] Monthly attendance summary calendar
- [x] Filter by department and date range

### Leave Management
- [x] Leave types (Annual, Sick, Casual, Maternity, Paternity, Unpaid)
- [x] Employee leave request submission
- [x] HR approval / rejection workflow
- [x] Leave balance display per employee
- [x] Leave allocation management
- [x] Notification system for leave request status changes

### Payroll Processing
- [x] Monthly payroll run creation
- [x] Payslip generation per employee
- [x] Pakistani FBR tax slabs (2024-25) for filers and non-filers
- [x] EOBI (0.75%) and SESSI (0.75%) statutory deductions
- [x] Gross/net salary breakdown with all components
- [x] Payslip list view for HR
- [x] Employee self-service payslip view

### AI Insights (HR)
- [x] Fraud detection — duplicate bank accounts, salary spikes, ghost employees, overtime anomalies
- [x] Salary anomaly detection — Z-score analysis by department and designation
- [x] Payroll forecasting — trend analysis with seasonal adjustment
- [x] Salary recommendations — market comparison and internal equity analysis
- [x] AI alerts list with severity levels

### Employee Self-Service Portal
- [x] Employee dashboard with personal KPIs
- [x] Own attendance records
- [x] Leave request submission and history
- [x] Payslip download/view
- [x] AI insights (salary trends, personal analytics)
- [x] Profile page

### Settings
- [x] System settings (company info, payroll cutoff date)
- [x] Public holidays management (Pakistani calendar)
- [x] Leave type configuration

### Notifications
- [x] Real-time notification bell in TopBar (HR only)
- [x] Unread count badge
- [x] Mark individual / mark all as read
- [x] Click notification → navigate to relevant page

---

## 🐛 Bugs Fixed (2026-04-13)

### 3. Employee Dashboard — Server 500 Crash (CRITICAL)
- **Symptom**: Logging in as employee showed "Unable to load employee dashboard." — all dashboard data empty.
- **Root cause**: `buildEmployeeInsights()` in `dashboard.service.js` called `latestPayslip.netSalary.toLocaleString()` but `latestPayslip` is the raw DB row (snake_case), so `netSalary` was `undefined`. Any employee with a payslip would crash the endpoint.
- **Fix**: Changed to `(parseFloat(latestPayslip.net_salary) || 0).toLocaleString()`.
- **File**: `server/src/services/dashboard.service.js`

### 4. Payslips Page — Wrong UI for Employee Role (UX)
- **Symptom**: Employees saw "Search employee..." input (HR feature) and subtitle "View and download employee payslips" — HR-facing language on an employee self-service page.
- **Fix**: Added `isEmployee` flag; hide search input for employees; show role-appropriate subtitle "View and download your payslips".
- **File**: `payroll-insights-hub/src/pages/Payslips.tsx`

### 1. Admin Role — Infinite Redirect Loop (CRITICAL)
- **Symptom**: Logging in as admin resulted in a blank black page.
- **Root cause**: All HR routes had `allowedRoles={["hr"]}`. Admin (role: `admin`) is not `"hr"`, causing `ProtectedRoute` to redirect to `/hr/dashboard` which also blocked admin — infinite loop.
- **Fix**: Added `const HR_ROLES = ["admin", "hr"] as const` in `App.tsx`, replaced all 11 route instances.
- **Impact**: Admin can now access all HR routes identically to HR users.

### 2. Chatbot — Hardcoded Mock Responses (FUNCTIONAL)
- **Symptom**: Chatbot was responding with locally hardcoded strings, ignoring the real AI backend.
- **Root cause**: `Chatbot.tsx` used a local `getBotResponse()` function with if/else string matching instead of calling the API.
- **Fix**: Complete rewrite using `useSendChatMessage` hook, session continuity via `sessionId`, animated typing indicator, suggestion chips rendered from API response.
- **Impact**: Chatbot now fully connected to `/api/v1/ai/chatbot` endpoint with context-aware responses.

---

## ✨ New Features Added (2026-04-13)

### Dark / Light Theme Toggle
- Full light theme CSS variable set added alongside existing dark theme.
- Theme toggled via Redux `toggleTheme` action — updates state, localStorage, and `<html>` class simultaneously.
- Theme persisted across page reloads (localStorage → applied in `main.tsx` before React renders to prevent flash).
- Sun/Moon toggle button added to TopBar visible on all pages.

### Chatbot Improvements
- Session continuity — `sessionId` maintained across messages so chatbot has conversation memory.
- Animated typing indicator (three bouncing dots) while waiting for API response.
- Suggestion chips displayed under last bot message — click to auto-send.
- Error state handling with user-friendly message.
- Enter key to send.

---

## 🚧 Remaining / Future Enhancements

### High Priority
- [ ] **Employee check-in/check-out via QR code** — unique differentiation feature
- [ ] **Payslip PDF export** — employees should be able to download payslips as formatted PDF
- [ ] **Payroll run approval workflow** — draft → review → approved → processed stages
- [ ] **Employee onboarding wizard** — step-by-step form for adding new employees with all related data at once

### Medium Priority
- [ ] **Advanced search** — full-text search across employees, payslips, and leave requests
- [ ] **Bulk operations UI** — bulk approve leaves, bulk payroll actions with confirmation dialogs
- [ ] **Audit trail viewer** — surface `security_audit_log` data in Settings for admins
- [ ] **Dashboard date range filter** — currently fixed to current month; add date picker
- [ ] **Mobile responsive layout** — sidebar collapses correctly but some data tables overflow on small screens
- [ ] **Email notifications** — trigger emails on leave approval/rejection, payslip generation (backend infrastructure needed)

### Low Priority / Future
- [ ] **ML-powered chatbot** — replace rule-based intent classifier with an LLM API (Claude/OpenAI)
- [ ] **Advanced fraud detection** — time-series anomaly detection using actual ML models
- [ ] **Multi-company support** — tenant isolation for SaaS deploymenthree files
- [ ] **Tax filing export** — generate FBR-compliant CSV/Excel export for tax submission
- [ ] **Biometric integration** — integrate with physical attendance hardware
- [ ] **Employee self-service profile editing** — allow employees to update contact info, bank details (with HR approval)
- [ ] **Overtime management** — dedicated OT request and approval workflow
- [ ] **Announcements / Notice board** — HR posts company-wide announcements

### Technical Debt
- [ ] Add proper loading skeletons for all data-fetching pages (currently some show nothing while loading)
- [ ] Form validation feedback (inline errors) is inconsistent across modals
- [ ] `Dashboard.tsx` page exists but is not registered in any route — either delete or repurpose
- [ ] `Index.tsx` page is unused — clean up
- [ ] Test coverage is minimal — expand unit tests for services and integration tests for API endpoints
- [ ] Backend error messages could be more specific in some cases
- [ ] Rate limiting is configured but not tuned for production load

---

## 🏗 Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Raw SQL over ORM | Full control over query performance; avoids ORM magic for a learning project |
| Redux for UI state only | Server state lives in React Query; Redux handles only ephemeral UI (sidebar open, chatbot visible, theme) |
| snake_case ↔ camelCase transform layer | Backend follows PostgreSQL conventions; frontend follows JS conventions; `transformers.js` bridges the gap |
| `.light` class on `<html>` | Scoped CSS variable override pattern — no JS-in-CSS, works with Tailwind's `dark:` prefix when needed |
| Rule-based AI | Deterministic and explainable for FYP demonstration; all algorithms are in `server/src/services/ai/` and can be replaced with ML models |

---

## 📁 Key Files Reference

| Purpose | Path |
|---------|------|
| Route definitions | `payroll-insights-hub/src/App.tsx` |
| Protected route guard | `payroll-insights-hub/src/components/auth/ProtectedRoute.tsx` |
| Theme CSS variables | `payroll-insights-hub/src/index.css` |
| Redux UI slice | `payroll-insights-hub/src/store/slices/uiSlice.ts` |
| Chatbot component | `payroll-insights-hub/src/components/Chatbot.tsx` |
| TopBar component | `payroll-insights-hub/src/components/layout/TopBar.tsx` |
| All React Query hooks | `payroll-insights-hub/src/hooks/` |
| Pakistani tax calculator | `server/src/utils/taxCalculator.js` |
| Chatbot AI service | `server/src/services/ai/chatbot.service.js` |
| Fraud detection service | `server/src/services/ai/fraudDetection.service.js` |
| Database migrations | `server/migrations/` |
| Seed data | `server/seeds/` |

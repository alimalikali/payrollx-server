# PayrollX - Smart AI-Powered Payroll Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/React-18-blue.svg" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-blue.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript">
</p>

## Overview

PayrollX is a comprehensive, AI-powered payroll management system designed for Pakistani businesses. It features automated payroll processing, attendance management, leave tracking, and AI-driven insights including fraud detection, salary anomaly detection, and payroll forecasting.

## Features

### Core Features
- **Employee Management** - Complete CRUD with department assignment
- **Attendance Tracking** - Check-in/out, manual marking, bulk operations
- **Leave Management** - Request, approve/reject workflow with balance tracking
- **Payroll Processing** - Automated salary calculation with tax compliance
- **Payslip Generation** - Detailed payslips with earnings and deductions

### AI-Powered Features
- **Fraud Detection** - Identifies duplicate bank accounts, ghost employees, salary spikes
- **Salary Anomaly Detection** - Statistical analysis to find outliers
- **Payroll Forecasting** - Predicts future payroll costs
- **Salary Recommendations** - Market-based salary suggestions
- **HR Chatbot** - Natural language interface for HR queries

### Pakistani Tax Compliance
- FBR Tax Slabs (Tax Year 2024-25)
- Separate rates for Filers and Non-Filers
- EOBI and SESSI contribution calculations
- Public holiday management

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15+
- **Authentication**: JWT with refresh token rotation
- **Validation**: express-validator
- **Security**: helmet, rate-limiting, bcrypt

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **Data Fetching**: TanStack Query (React Query)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd payrollx
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE payrollx;
CREATE USER payrollx_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE payrollx TO payrollx_user;
\c payrollx
GRANT ALL ON SCHEMA public TO payrollx_user;
\q
```

### 3. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Start development server
npm run dev
```

### 4. Frontend Setup

```bash
cd payroll-insights-hub

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:5000/api/v1" > .env

# Start development server
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api/v1
- **Health Check**: http://localhost:5000/health

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@payrollx.com | Admin@123 |
| HR | hr@payrollx.com | Hr@123456 |
| Employee | ahmad.khan@payrollx.com | Employee@123 |

## API Documentation

### Authentication
```
POST /api/v1/auth/register    - Register new user
POST /api/v1/auth/login       - Login
POST /api/v1/auth/logout      - Logout
POST /api/v1/auth/refresh     - Refresh token
GET  /api/v1/auth/me          - Get current user
```

### Employees
```
GET    /api/v1/employees         - List employees
POST   /api/v1/employees         - Create employee
GET    /api/v1/employees/:id     - Get employee
PUT    /api/v1/employees/:id     - Update employee
DELETE /api/v1/employees/:id     - Delete employee
GET    /api/v1/employees/stats   - Get statistics
```

### Attendance
```
GET  /api/v1/attendance              - List attendance
POST /api/v1/attendance/check-in     - Check in
POST /api/v1/attendance/check-out    - Check out
POST /api/v1/attendance/mark         - Mark attendance
GET  /api/v1/attendance/daily-stats  - Daily statistics
```

### Leaves
```
GET  /api/v1/leaves                - List leave requests
POST /api/v1/leaves                - Create request
POST /api/v1/leaves/:id/approve    - Approve request
POST /api/v1/leaves/:id/reject     - Reject request
GET  /api/v1/leaves/balance/:id    - Get leave balance
GET  /api/v1/leaves/types          - Get leave types
```

### Payroll
```
GET  /api/v1/payroll/runs              - List payroll runs
POST /api/v1/payroll/runs              - Create payroll run
POST /api/v1/payroll/runs/:id/process  - Process payroll
POST /api/v1/payroll/runs/:id/approve  - Approve payroll
GET  /api/v1/payroll/payslips          - List payslips
GET  /api/v1/payroll/tax-slabs         - Get tax slabs
POST /api/v1/payroll/calculate-tax     - Calculate tax
```

### AI Features
```
GET  /api/v1/ai/dashboard                     - AI dashboard stats
GET  /api/v1/ai/alerts                        - AI alerts
POST /api/v1/ai/fraud-detection/run           - Run fraud detection
POST /api/v1/ai/salary-anomaly/detect         - Detect anomalies
GET  /api/v1/ai/forecast                      - Payroll forecast
GET  /api/v1/ai/salary-recommendations        - Salary recommendations
POST /api/v1/ai/chatbot                       - Chat message
```

## Project Structure

```
payrollx/
├── server/                      # Backend
│   ├── migrations/              # Database migrations
│   ├── seeds/                   # Seed data
│   └── src/
│       ├── config/              # Configuration
│       ├── controllers/         # Request handlers
│       ├── middleware/          # Express middleware
│       ├── routes/              # Route definitions
│       ├── services/            # Business logic
│       │   └── ai/              # AI services
│       └── utils/               # Utilities
│
├── payroll-insights-hub/        # Frontend
│   └── src/
│       ├── components/          # UI components
│       ├── hooks/               # React Query hooks
│       ├── lib/                 # API client
│       ├── pages/               # Page components
│       └── store/               # Redux store
│
├── CLAUDE.md                    # AI assistant instructions
├── README.md                    # This file
```

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payrollx
DB_USER=payrollx_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api/v1
```

## Development

### Running Tests
```bash
cd server
npm test
```

### Database Migrations
```bash
# Run migrations
npm run db:migrate

# Seed data
npm run db:seed
```

### Code Style
- Backend: JavaScript ES6+
- Frontend: TypeScript with strict mode
- Linting: ESLint with Prettier

## Pakistani Tax Information

### FBR Tax Slabs (2024-25) - Filers

| Annual Income (PKR) | Tax Rate |
|---------------------|----------|
| Up to 600,000 | 0% |
| 600,001 - 1,200,000 | 2.5% |
| 1,200,001 - 2,200,000 | 12.5% + 15,000 |
| 2,200,001 - 3,200,000 | 22.5% + 140,000 |
| 3,200,001 - 4,100,000 | 27.5% + 365,000 |
| Above 4,100,000 | 35% + 612,500 |

*Non-filers pay approximately 10% higher rates*

### Statutory Contributions
- **EOBI**: 0.75% employer contribution
- **SESSI**: 0.75% employer contribution (up to PKR 25,000 wages)

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secret
- [ ] Configure proper CORS origins
- [ ] Set up SSL/HTTPS
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Configure logging

### Docker (Optional)
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Create a GitHub issue
- Contact: [your-email@example.com]

---

**PayrollX** - Making Payroll Smart with AI

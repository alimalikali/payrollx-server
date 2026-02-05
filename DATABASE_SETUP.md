# PostgreSQL Database Setup Guide

## 1. Install PostgreSQL

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### macOS (using Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Windows
Download and install from: https://www.postgresql.org/download/windows/

## 2. Start PostgreSQL Service

### Ubuntu/Debian
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew services start postgresql
```

## 3. Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Or on macOS
psql postgres
```

Run the following SQL commands:

```sql
-- Create database
CREATE DATABASE payrollx;

-- Create user with password
CREATE USER payrollx_user WITH ENCRYPTED PASSWORD 'alimalikali';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE payrollx TO payrollx_user;

-- Connect to the database
\c payrollx

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO payrollx_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payrollx_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payrollx_user;

-- Exit
\q
```

## 4. Configure Environment

Copy the example env file and update with your credentials:

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payrollx
DB_USER=payrollx_user
DB_PASSWORD=your_secure_password
```

## 5. Run Migrations

```bash
# Install dependencies first
npm install

# Run migrations
npm run db:migrate
```

## 6. Verify Setup

```bash
# Connect to database
psql -h localhost -U payrollx_user -d payrollx

# List tables
\dt

# You should see:
#  - users
#  - departments
#  - employees
#  - salary_structures
#  - attendance
#  - leave_types
#  - leave_requests
#  - leave_allocations
#  - payroll_runs
#  - payslips
#  - ai_alerts
#  - chatbot_sessions
#  - chatbot_messages
#  - public_holidays
#  - refresh_tokens
#  - security_audit_log
#  - migrations
```

## Troubleshooting

### Connection Refused
1. Check if PostgreSQL is running: `sudo systemctl status postgresql`
2. Check pg_hba.conf for local connections
3. Verify port 5432 is not blocked

### Permission Denied
```sql
-- Run as superuser
GRANT ALL PRIVILEGES ON DATABASE payrollx TO payrollx_user;
\c payrollx
GRANT ALL ON SCHEMA public TO payrollx_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payrollx_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payrollx_user;
```

### Reset Database
```sql
-- Drop and recreate (WARNING: destroys all data)
DROP DATABASE IF EXISTS payrollx;
CREATE DATABASE payrollx;
```

Then run migrations again.

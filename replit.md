# Conference CRM - Replit Project

## Project Overview

**Conference CRM** is a comprehensive CRM system for managing conference clients with automated email follow-ups, bulk email capabilities, and SMTP integration. The system was originally designed for MySQL but has been migrated to PostgreSQL for the Replit environment.

**Last Updated:** October 20, 2025

## Project Architecture

### Tech Stack
- **Frontend:** React 18.2 with Tailwind CSS
- **Backend:** Node.js 20 with Express.js
- **Database:** PostgreSQL (Replit-provided)
- **ORM:** Sequelize 6
- **Real-time:** Socket.IO for live updates
- **Authentication:** JWT-based

### Directory Structure
```
crm1/
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts (Auth, etc.)
│   │   ├── hooks/       # Custom React hooks
│   │   └── services/    # API service layer
│   └── public/          # Static assets
├── server/              # Node.js backend API
│   ├── config/          # Database and config files
│   ├── database/        # Database initialization and seeding
│   ├── middleware/      # Express middleware (RBAC, etc.)
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   └── services/        # Business logic services
├── .env                 # Environment variables
└── package.json         # Root package.json with scripts
```

## Current Setup

### Ports
- **Frontend (React):** Port 5000 (0.0.0.0) - Publicly accessible
- **Backend (API):** Port 3001 (localhost) - Internal only

### Environment Variables
The project uses a `.env` file in the crm1 directory:
- `PORT=3001` - Backend server port
- `NODE_ENV=development`
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `EMAIL_TEST_MODE=true` - Email testing mode

### Database
- **Type:** PostgreSQL (managed by Replit)
- **Connection:** Automatically configured via `DATABASE_URL` environment variable
- **ORM:** Sequelize 6.37
- **Migrations:** Uses Sequelize sync (currently set to `force: true` for initial setup)

## Known Issues and Status

###  Database Initialization
The database uses Sequelize ORM with complex models that have numerous relationships. During the import process, the following issues were encountered:

1. **Sequelize Sync Issues:** The original MySQL schema had compatibility issues with PostgreSQL. Sequelize's `sync()` operation with the `alter` flag generates invalid SQL for PostgreSQL.
   
2. **Current State:** The database is configured to use `sync({ force: true })` which drops and recreates all tables on startup. This ensures clean schema creation but **will delete all data on restart**.

3. **Fixed Issues:**
   - Replaced `mysql2` package with `pg` and `pg-hstore` for PostgreSQL
   - Updated database configuration to use `DATABASE_URL`
   - Fixed CORS to allow Replit's proxy
   - Configured React dev server to allow all hosts
   - Removed problematic ENUM column comments that caused SQL syntax errors

### ⚠️ Important Notes

**Database Synchronization Strategy:**
The application uses Sequelize's `sync({ alter: true })` which:
- On first run with empty database: Creates all tables from model definitions
- On subsequent runs: Updates existing schema to match models while preserving data
- Note: Can be slow (30-60 seconds) on startup due to complex model relationships

**Before going to production:**
1. Consider implementing proper Sequelize migrations for better control
2. The `alter: true` mode may generate warnings for complex schema changes
3. Test all database operations thoroughly after schema changes
4. Review and rotate JWT_SECRET and other credentials

## Running the Project

### Development Mode
The project uses `concurrently` to run both frontend and backend servers simultaneously:

```bash
cd crm1
npm start
```

This command:
1. Starts the backend API on port 3001
2. Starts the React dev server on port 5000
3. The React app proxies API requests to the backend

### Individual Components
```bash
# Backend only
cd crm1/server
PORT=3001 node index.js

# Frontend only
cd crm1/client
PORT=5000 HOST=0.0.0.0 npm start
```

## Demo Accounts

Once the database is seeded, the following demo accounts are available:

- **CEO:** admin@crm.com / admin123
- **Manager:** manager@crm.com / manager123
- **Agent:** agent@crm.com / agent123

## Features

### Core Functionality
- Bulk email system for client outreach
- Automated follow-up workflows (Stage 1: Abstract submission, Stage 2: Registration)
- Email template management with merge fields
- Client relationship management
- SMTP integration for multiple email accounts
- Role-based access control (CEO, Manager, Agent)

### Dashboard & Analytics
- Client overview with filtering and export
- Admin/CEO dashboard with KPIs
- Email communication logs
- Real-time statistics and notifications

### Security & Compliance
- JWT-based authentication
- Role-based access control (RBAC)
- Email security (SSL/TLS)
- Audit logging
- Unsubscribe management

## Deployment Configuration

When ready to deploy, configure the deployment settings using the deploy configuration tool. The recommended settings are:

- **Deployment Type:** `autoscale` (for stateless web applications)
- **Build Command:** None required (React builds on startup)
- **Run Command:** `npm start` (from crm1 directory)

## Recent Changes (Import Process)

1. **Database Migration:** MySQL → PostgreSQL
   - Replaced `mysql2` with `pg` and `pg-hstore`
   - Updated connection string to use `DATABASE_URL`
   - Modified `sync()` strategy to work with PostgreSQL

2. **Replit Environment Configuration:**
   - Set frontend to bind on `0.0.0.0:5000`
   - Configured React to allow all hosts (`DANGEROUSLY_DISABLE_HOST_CHECK=true`)
   - Updated CORS to allow all origins
   - Created `public/` directory with `index.html` and manifest files

3. **Server Startup Logic:**
   - Modified to start HTTP server before database initialization
   - Database initialization now runs in background
   - Server remains available even if database sync fails

4. **Bug Fixes:**
   - Removed problematic ENUM column comment in Email model
   - Fixed PostgreSQL-specific SQL syntax issues

## Troubleshooting

### Frontend Not Loading
1. Check that workflow is running
2. Verify port 5000 is accessible
3. Check browser console for errors
4. Ensure `client/.env` has correct settings

### Backend API Errors
1. Check backend logs in workflow console
2. Verify database connection via `/api/health` endpoint
3. Check PostgreSQL database status
4. Review environment variables in `.env`

### Database Issues
1. Database sync can take 30-60 seconds on first run
2. Check logs for Sequelize errors
3. If schema errors persist, the database can be reset via Replit's database tools
4. Current setup uses `force: true` which will recreate tables on restart

## Next Steps for Production

1. **Change Database Sync Strategy:**
   - Update `server/index.js` line 91 from `sync({ force: true })` to `sync({ force: false })`
   - Consider implementing proper Sequelize migrations

2. **Environment Configuration:**
   - Set `NODE_ENV=production`
   - Use strong `JWT_SECRET`
   - Configure proper email SMTP settings
   - Disable `EMAIL_TEST_MODE`

3. **Security:**
   - Implement rate limiting
   - Add request validation
   - Configure proper CORS origins
   - Enable HTTPS

4. **Monitoring:**
   - Set up error logging
   - Implement health checks
   - Monitor database performance

## Support & Documentation

For additional information, refer to:
- Main README: `crm1/README.md`
- API Documentation: Various guides in `crm1/` directory
- Email Setup Guides: `GMAIL_SETUP_GUIDE.md`, `ESPO_EMAIL_SETUP_GUIDE.md`
- Feature Documentation: Multiple `*_GUIDE.md` files in project root

## Project Status

✅ **Completed:**
- Node.js environment setup
- PostgreSQL database connection
- Backend API server running (port 3001)
- Frontend React app running (port 5000)
- CORS and proxy configuration
- Basic workflow setup

⚠️ **In Progress:**
- Database schema initialization (Sequelize sync in progress)
- Initial data seeding

📋 **TODO:**
- Verify all features work with PostgreSQL
- Test authentication flow
- Validate email functionality
- Configure deployment settings
- Performance optimization

# Conference CRM - Bulk Emails, Follow-up & SMTP Integration

A comprehensive CRM system for managing conference clients with automated email follow-ups, bulk email capabilities, and SMTP integration.

## Features

### Core Features
- **Bulk Email System**: Send emails in bulk to clients/leads
- **Automated Follow-up Workflow**: 
  - Stage 1: Abstract submission (7-day intervals, up to 6 follow-ups)
  - Stage 2: Registration (3-day intervals, up to 6 follow-ups)
- **Email Templates**: Central repository with merge fields support
- **Client Management**: Complete client profiles with status tracking
- **SMTP Integration**: Multiple SMTP accounts with system/user permissions
- **Role-Based Access Control**: CEO, Manager, and Agent roles

### Dashboard & Analytics
- **Client Overview Dashboard**: Filter, sort, and export capabilities
- **Admin/CEO Dashboard**: KPIs including conversion rates and revenue tracking
- **Email Logs**: Complete communication history with threaded view
- **Real-time Statistics**: Active follow-ups, emails sent, conversion rates

### Security & Compliance
- **Authentication**: JWT-based authentication
- **RBAC**: Role-based access control
- **Email Security**: SSL/TLS encryption
- **Audit Logging**: Complete action tracking
- **Opt-out Management**: Unsubscribe link support

## Tech Stack

### Backend
- **Node.js** with Express.js
- **In-memory Database** (for development)
- **JWT Authentication**
- **Nodemailer** for SMTP integration
- **Node-cron** for scheduled tasks

### Frontend
- **React.js** with functional components
- **React Router** for navigation
- **React Query** for data fetching
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications

## Quick Start

### Option 1: Docker (Recommended)

#### Prerequisites
- Docker and Docker Compose installed

#### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd crm
   ```

2. **Set up environment**:
   ```bash
   cp env.example .env
   # Edit .env file with your configuration
   ```

3. **Start with Docker**:
   ```bash
   # Development mode
   ./scripts/docker-setup.sh setup dev
   
   # Or manually
   docker-compose -f docker-compose.dev.yml up --build -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

### Option 2: Local Development

#### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

#### Installation

1. **Clone and install dependencies**:
   ```bash
   cd crm
   npm run install-all
   ```

2. **Start the development servers**:
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:5001`
   - Frontend development server on `http://localhost:3000`

### Demo Accounts

The system comes with pre-configured demo accounts:

- **CEO**: `admin@crm.com` / `admin123`
- **Manager**: `manager@crm.com` / `manager123`
- **Agent**: `agent@crm.com` / `agent123`

## Usage Guide

### 1. Adding Clients
- Navigate to the Clients page
- Click "Add Client" to create new leads
- Clients automatically enter Stage 1 follow-up workflow

### 2. Managing Email Templates
- Go to Templates page
- Create templates for different stages (Abstract Invitation, Follow-up, Registration)
- Use merge fields: `{Name}`, `{ConferenceName}`, `{Email}`, `{Country}`

### 3. SMTP Configuration
- Access Settings (CEO/Manager only)
- Add SMTP accounts for email sending
- Configure system vs user-specific accounts

### 4. Automated Workflows
- **Stage 1**: Abstract submission follow-ups (7-day intervals)
- **Stage 2**: Registration follow-ups (3-day intervals)
- Automatic status transitions based on client actions

### 5. Monitoring & Analytics
- Dashboard shows real-time KPIs
- Email logs track all communications
- Follow-up job management with pause/resume capabilities

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Clients
- `GET /api/clients` - List clients (with filters)
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `POST /api/clients/:id/submit-abstract` - Move to Stage 2
- `POST /api/clients/:id/register` - Mark as registered

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template

### SMTP Accounts
- `GET /api/smtp-accounts` - List SMTP accounts
- `POST /api/smtp-accounts` - Add SMTP account
- `POST /api/smtp-accounts/:id/test` - Test connection

### Follow-ups
- `GET /api/followups` - List follow-up jobs
- `POST /api/followups/:id/pause` - Pause follow-up
- `POST /api/followups/:id/resume` - Resume follow-up
- `POST /api/followups/:id/stop` - Stop follow-up

### Email Logs
- `GET /api/email-logs` - List email logs
- `GET /api/email-logs/:id` - Get email details

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## Configuration

### Environment Variables
Create a `.env` file in the server directory:

```env
PORT=5000
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### SMTP Setup
1. Configure SMTP accounts in the Settings page
2. For Gmail, use App Passwords instead of regular passwords
3. Test connections before using in production

## Development

### Project Structure
```
crm/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   └── ...
│   ├── Dockerfile          # Production Dockerfile
│   ├── Dockerfile.dev      # Development Dockerfile
│   └── nginx.conf          # Nginx configuration
├── server/                 # Node.js backend
│   ├── index.js           # Main server file
│   ├── healthcheck.js     # Health check script
│   ├── Dockerfile          # Production Dockerfile
│   ├── Dockerfile.dev      # Development Dockerfile
│   └── package.json
├── scripts/                # Utility scripts
│   └── docker-setup.sh    # Docker setup script
├── docker-compose.yml      # Production Docker Compose
├── docker-compose.dev.yml  # Development Docker Compose
├── docker-compose.prod.yml # Production Docker Compose
├── .dockerignore           # Docker ignore file
├── env.example             # Environment variables example
└── package.json           # Root package.json
```

### Adding New Features
1. Backend: Add routes in `server/index.js`
2. Frontend: Create components in `client/src/components/`
3. Update navigation in `Layout.js` if needed

## Docker Commands

### Development Mode
```bash
# Start development environment
./scripts/docker-setup.sh setup dev

# View logs
./scripts/docker-setup.sh logs

# View specific service logs
./scripts/docker-setup.sh logs backend

# Stop containers
./scripts/docker-setup.sh stop

# Restart containers
./scripts/docker-setup.sh restart dev
```

### Production Mode
```bash
# Start production environment
./scripts/docker-setup.sh setup prod

# Or manually
docker-compose -f docker-compose.prod.yml up --build -d
```

### Manual Docker Commands
```bash
# Build and start development
docker-compose -f docker-compose.dev.yml up --build -d

# Build and start production
docker-compose -f docker-compose.prod.yml up --build -d

# View container status
docker-compose ps

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Clean up (removes volumes and images)
docker-compose down -v --remove-orphans
docker system prune -f
```

## Production Deployment

### Docker Production Deployment
1. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with production values
   ```

2. **Deploy with Docker Compose**:
   ```bash
   ./scripts/docker-setup.sh setup prod
   ```

3. **Configure reverse proxy** (optional):
   - Use the included nginx configuration
   - Set up SSL certificates
   - Configure domain names

### Traditional Deployment
1. Set production environment variables
2. Use a proper database (PostgreSQL recommended)
3. Set up Redis for job queues
4. Configure proper SMTP credentials
5. Build the React app: `npm run build`
6. Serve static files with a web server
7. Configure API endpoints for production

### Security Considerations
- Use HTTPS in production
- Encrypt SMTP passwords
- Implement rate limiting
- Set up proper CORS policies
- Use environment variables for secrets

## Troubleshooting

### Common Issues

1. **SMTP Connection Failed**
   - Check SMTP credentials
   - Verify port and security settings
   - Use App Passwords for Gmail

2. **Follow-ups Not Sending**
   - Check if cron job is running
   - Verify SMTP configuration
   - Check email logs for errors

3. **Authentication Issues**
   - Clear browser storage
   - Check JWT secret configuration
   - Verify user credentials

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please create an issue in the repository.

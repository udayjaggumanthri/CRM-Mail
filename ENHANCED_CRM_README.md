# 🚀 Enhanced Conference CRM Platform

A production-ready, conference-scoped CRM platform with automated follow-ups, bulk email campaigns, role-based access control, and comprehensive analytics.

## 🌟 Key Features

### 🏢 **Conference Management**
- Multi-conference support with scoped data
- Conference-specific settings and customization
- Dynamic follow-up intervals and max attempts per conference
- Timezone and working hours configuration

### 👥 **Role-Based Access Control (RBAC)**
- **CEO**: Full system access and management
- **TeamLead**: Manage team members and assigned clients
- **Member**: Manage only assigned clients
- Hierarchical permissions with manager-subordinate relationships

### 📧 **Advanced Email System**
- **SMTP/IMAP Integration**: Custom email accounts per conference
- **Template Engine**: Dynamic variable replacement with validation
- **Bulk Campaigns**: Throttled email campaigns with progress tracking
- **Email Tracking**: Delivery, bounce, reply, and open rate monitoring
- **Thread Management**: Email conversation threading

### 🔄 **Automated Follow-up Engine**
- **Multi-stage Workflows**: Abstract Submission → Registration
- **Smart Scheduling**: Skip weekends, custom intervals
- **Status-based Triggers**: Automatic stage progression
- **Pause/Resume/Override**: Manual control over automation

### 📊 **Comprehensive Analytics**
- **Real-time Dashboard**: KPIs, charts, and performance metrics
- **Team Performance**: Individual and team-level analytics
- **Email Performance**: Delivery rates, engagement metrics
- **Conversion Tracking**: Lead to registration funnel analysis

### 🎯 **Campaign Management**
- **Bulk Email Campaigns**: CSV upload, column mapping
- **Template Integration**: Use existing email templates
- **Progress Tracking**: Real-time campaign status and metrics
- **Throttling**: Configurable send rates to avoid spam

## 🏗️ Architecture

### Backend (Node.js + Express + Sequelize)
```
server/
├── models/           # Database models with relationships
├── routes/           # API endpoints with RBAC
├── middleware/       # Authentication and authorization
├── services/         # Business logic services
├── utils/            # Template rendering, encryption
├── database/         # Initialization and seeding
└── jobs/            # Scheduled tasks and automation
```

### Frontend (React + Vite + Tailwind)
```
client/src/
├── components/       # Reusable UI components
├── contexts/         # React context providers
├── hooks/           # Custom React hooks
└── pages/           # Main application pages
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

### 1. Clone and Install
```bash
git clone <repository-url>
cd crm1
npm run install-all
```

### 2. Environment Setup
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=crmdb
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

### 3. Database Setup
```bash
# Start MySQL service
# Create database
mysql -u root -p
CREATE DATABASE crmdb;

# The application will automatically create tables and seed data
```

### 4. Start Development Servers
```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend  
cd client
npm start
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Default Login**: admin@crm.com / admin123

## 📊 Default User Accounts

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| CEO | admin@crm.com | admin123 | Full system access |
| TeamLead | teamlead@crm.com | teamlead123 | Manage team and clients |
| Member | member@crm.com | member123 | Manage assigned clients |

## 🎯 Core Workflows

### 1. **Client Onboarding**
```
Lead → Abstract Submitted → Registered → Unresponsive
  ↓           ↓              ↓            ↓
Stage 1    Stage 2       Complete      Stop
Follow-ups Follow-ups    Automation    Automation
```

### 2. **Email Automation**
```
Client Status Change → Trigger Follow-up Job → Render Template → Send Email → Update Status
```

### 3. **Campaign Execution**
```
Create Campaign → Upload Recipients → Select Template → Start Campaign → Track Progress
```

## 🔧 Configuration

### Conference Settings
Each conference can be configured with:
- **Follow-up Intervals**: Days between follow-ups per stage
- **Max Attempts**: Maximum follow-up attempts per stage
- **Skip Weekends**: Whether to skip weekend sends
- **Working Hours**: Business hours for email sending
- **Timezone**: Conference timezone

### Email Templates
Templates support dynamic variables:
- `{{client_name}}` - Client's full name
- `{{conference_name}}` - Conference name
- `{{conference_date}}` - Conference start date
- `{{abstract_deadline}}` - Abstract submission deadline
- `{{registration_deadline}}` - Registration deadline
- `{{registration_link}}` - Dynamic registration URL
- `{{unsubscribe_link}}` - Unsubscribe URL

## 📈 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Conferences
- `GET /api/conferences` - List conferences
- `POST /api/conferences` - Create conference
- `GET /api/conferences/:id/summary` - Conference KPIs

### Clients
- `GET /api/clients` - List clients (with filtering)
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `GET /api/campaigns/:id/status` - Campaign progress

### Dashboard
- `GET /api/dashboard/stats` - Comprehensive analytics
- `GET /api/dashboard/kpis` - KPI metrics
- `GET /api/dashboard/conference/:id/summary` - Conference summary

## 🗄️ Database Schema

### Core Models
- **User**: Authentication and role management
- **Role**: Permission definitions
- **Conference**: Conference data and settings
- **Client**: Client information and status
- **EmailTemplate**: Reusable email templates
- **FollowUpJob**: Automated follow-up scheduling
- **Campaign**: Bulk email campaigns
- **EmailLog**: Email tracking and analytics
- **EmailAccount**: SMTP/IMAP configurations

### Key Relationships
- User → Role (many-to-one)
- User → User (manager-subordinate hierarchy)
- Conference → Client (one-to-many)
- Conference → EmailTemplate (one-to-many)
- Client → FollowUpJob (one-to-many)
- Campaign → EmailTemplate (many-to-one)

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-based Access Control**: Granular permissions
- **Password Encryption**: bcrypt hashing
- **SMTP Password Encryption**: AES encryption for email credentials
- **Input Validation**: Joi schema validation
- **Rate Limiting**: API rate limiting protection

## 📊 Monitoring & Analytics

### Real-time Metrics
- Client acquisition trends
- Email performance metrics
- Campaign success rates
- Team performance tracking
- Conversion funnel analysis

### Automated Reporting
- Daily activity summaries
- Weekly performance reports
- Monthly KPI dashboards
- Email deliverability monitoring

## 🚀 Production Deployment

### Docker Support
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Environment Variables
```env
# Database
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=crmdb

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Email
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password

# Frontend
FRONTEND_URL=https://your-domain.com
```

## 🔧 Customization

### Adding New User Roles
1. Add role to `Role` model
2. Update RBAC middleware
3. Configure permissions in seed data

### Creating New Follow-up Stages
1. Add stage to `FollowUpJob` model enum
2. Create corresponding email templates
3. Update automation logic

### Custom Email Templates
1. Use template variables for dynamic content
2. Validate against `varsSchema`
3. Test with preview functionality

## 📝 Development

### Running Tests
```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API documentation

---

**Built with ❤️ for conference organizers and CRM professionals**

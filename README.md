# Conference CRM

A comprehensive Customer Relationship Management (CRM) system designed for conference management, email automation, and client communication. This application provides real-time email synchronization with Gmail/IMAP, automated follow-up sequences, template management, and advanced analytics.

## 🚀 Features

- **Email Management**
  - Real-time IMAP/Gmail synchronization
  - Compose, send, and manage emails
  - Draft management with auto-save
  - Email threading and conversation view
  - Attachment support

- **Client Management**
  - Comprehensive client profiles
  - Client status tracking
  - Bulk client import/export
  - Client notes and task management
  - Advanced filtering and search

- **Conference Management**
  - Create and manage conferences
  - Conference-specific client assignments
  - Revenue tracking
  - Conference analytics

- **Email Templates**
  - Rich text email templates
  - Variable substitution
  - Template sequences
  - Draft auto-save

- **Follow-up Automation**
  - Automated email sequences
  - Smart scheduling
  - Custom intervals and working hours
  - Follow-up tracking

- **User Management**
  - Role-based access control (CEO, TeamLead, Member)
  - User authentication and authorization
  - Password management
  - Activity tracking

- **Dashboard & Analytics**
  - Real-time metrics
  - Email statistics
  - Client conversion tracking
  - Revenue reports

- **Real-time Updates**
  - WebSocket integration
  - Live email synchronization
  - Real-time notifications

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **React Router** - Routing
- **React Query** - Data fetching and caching
- **Tailwind CSS** - Styling
- **Socket.io Client** - Real-time communication
- **React Quill** - Rich text editor
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Sequelize** - ORM
- **Socket.io** - WebSocket server
- **IMAPflow** - IMAP client
- **Nodemailer** - Email sending
- **JWT** - Authentication
- **Bcrypt** - Password hashing

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (v8 or higher) or **yarn**
- **PostgreSQL** (v12 or higher)
- **Git**

## 📦 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/conference-crm.git
cd conference-crm/crm1
```

### Step 2: Install Dependencies

Install dependencies for root, server, and client:

```bash
npm run install-all
```

Or install them separately:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### Step 3: Database Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE conference_crm;
```

2. Update database configuration in `server/config/database.js` or use environment variables.

### Step 4: Environment Configuration

1. Copy the example environment file:

```bash
cp env.example .env
```

2. Update the `.env` file with your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=conference_crm
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Email Configuration (for SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# IMAP Configuration (for email sync)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true

# Frontend URL
REACT_APP_API_URL=http://localhost:3001
```

**Important:** For Gmail, you'll need to:
- Enable 2-factor authentication
- Generate an App Password for SMTP/IMAP access
- Use the App Password in your `.env` file

### Step 5: Database Migration

Run database migrations to set up the schema:

```bash
cd server
npx sequelize-cli db:migrate
```

### Step 6: (Optional) Seed Initial Data

If you have seed files, run them:

```bash
npx sequelize-cli db:seed:all
```

## 🚀 Running the Application

### Development Mode

Run both server and client concurrently:

```bash
npm start
```

Or run them separately:

**Terminal 1 - Server:**
```bash
cd server
npm start
```

**Terminal 2 - Client:**
```bash
cd client
npm start
```

The application will be available at:
- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:3001

### Production Mode

1. Build the client:

```bash
cd client
npm run build
```

2. Start the server (which will serve the built client):

```bash
cd server
npm start
```

## 📁 Project Structure

```
crm1/
├── client/                 # React frontend application
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom React hooks
│   │   └── index.js      # Entry point
│   ├── build/            # Production build output
│   └── package.json
│
├── server/                # Node.js backend application
│   ├── config/           # Configuration files
│   ├── database/        # Database migrations and seeds
│   ├── middleware/      # Express middleware
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── index.js         # Server entry point
│
├── scripts/              # Deployment and utility scripts
├── .env                  # Environment variables (not in git)
├── env.example           # Example environment file
└── package.json          # Root package.json
```

## 🔐 Default Login Credentials

After initial setup, you may need to create a user. If you have seed data, check the seed files for default credentials.

**Note:** Change default passwords immediately in production!

## 📝 API Documentation

API endpoints are documented in:
- `Conference_CRM_API_Collection.postman_collection.json` - Postman collection

### Key API Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/dashboard` - Dashboard data
- `GET /api/clients` - Get clients
- `POST /api/clients` - Create client
- `GET /api/emails` - Get emails
- `POST /api/emails/send` - Send email
- `GET /api/conferences` - Get conferences
- `POST /api/conferences` - Create conference

## 🚢 Deployment

### Deploying to GitHub

#### Step 1: Initialize Git Repository

If not already initialized:

```bash
git init
```

#### Step 2: Create .gitignore

Ensure you have a `.gitignore` file (create if missing):

```gitignore
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
client/build/
dist/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Database
*.sqlite
*.db

# Temporary files
*.tmp
*.temp
```

#### Step 3: Add Files to Git

```bash
# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Conference CRM application"
```

#### Step 4: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right
3. Select "New repository"
4. Name your repository (e.g., `conference-crm`)
5. Choose visibility (Public or Private)
6. **Do NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

#### Step 5: Connect Local Repository to GitHub

```bash
# Add remote repository (replace with your GitHub username and repo name)
git remote add origin https://github.com/yourusername/conference-crm.git

# Verify remote
git remote -v
```

#### Step 6: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

#### Step 7: Set Up GitHub Actions (Optional)

Create `.github/workflows/ci.yml` for continuous integration:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install
        cd server && npm install
        cd ../client && npm install
    
    - name: Run tests (if available)
      run: npm test --if-present
```

### Deploying to Production

#### Option 1: Using PM2 (Recommended)

1. Install PM2 globally:

```bash
npm install -g pm2
```

2. Create `ecosystem.config.js` in the root:

```javascript
module.exports = {
  apps: [
    {
      name: 'crm-server',
      script: './server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'crm-client',
      script: './client/serve-build.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
```

3. Build and start:

```bash
# Build client
cd client
npm run build
cd ..

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Option 2: Using Docker (Optional)

Create `Dockerfile` in the root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm run install-all

COPY . .

RUN cd client && npm run build

EXPOSE 3001 5000

CMD ["npm", "start"]
```

#### Option 3: Deploy to Cloud Platforms

**Heroku:**
1. Install Heroku CLI
2. Create `Procfile`:
```
web: cd server && npm start
```
3. Deploy:
```bash
heroku create your-app-name
git push heroku main
```

**Vercel/Netlify (Frontend only):**
- Build the React app
- Deploy the `client/build` folder
- Set API URL in environment variables

**AWS/DigitalOcean:**
- Use PM2 or Docker
- Set up reverse proxy (Nginx)
- Configure SSL certificates

## 🔧 Configuration

### Database Configuration

Update `server/config/database.js` or use environment variables:

```javascript
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  }
};
```

### Email Account Setup

1. Go to Settings > Email Accounts
2. Add your SMTP account
3. Configure IMAP settings for email sync
4. Test the connection

### Security Considerations

- Change default JWT secret
- Use strong database passwords
- Enable HTTPS in production
- Set up CORS properly
- Use environment variables for secrets
- Regularly update dependencies

## 🧪 Testing

Run tests (if available):

```bash
# Server tests
cd server
npm test

# Client tests
cd client
npm test
```

## 📚 Additional Documentation

- `DEPLOYMENT.md` - Detailed deployment guide
- `QUICK_DEPLOY.md` - Quick deployment instructions
- `ENTERPRISE_ARCHITECTURE.md` - Architecture documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow existing code style
- Use meaningful variable names
- Add comments for complex logic
- Write descriptive commit messages

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error:**
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure database exists

**Email Sync Not Working:**
- Verify IMAP credentials
- Check firewall settings
- Ensure App Password is used for Gmail

**Port Already in Use:**
- Change PORT in `.env`
- Kill process using the port:
  ```bash
  # Windows
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -ti:3001 | xargs kill
  ```

**Build Errors:**
- Clear node_modules and reinstall
- Check Node.js version compatibility
- Verify all dependencies are installed

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- React team for the amazing framework
- Express.js for the robust backend framework
- All open-source contributors

## 📞 Support

For support, email support@yourdomain.com or create an issue in the GitHub repository.

## 🔄 Changelog

See `CHANGELOG.md` for detailed changelog.

---

**Made with ❤️ for conference management**


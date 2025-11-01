# Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Docker Deployment (Recommended)

```bash
# 1. Clone repository
git clone <repository-url>
cd crm1

# 2. Set up environment
cp env.example .env
# Edit .env with your settings

# 3. Start with Docker
docker-compose up --build -d

# Access:
# Frontend: http://localhost:3000
# Backend: http://localhost:5001
```

### Option 2: Manual Node.js Deployment

```bash
# 1. Clone repository
git clone <repository-url>
cd crm1

# 2. Install all dependencies
npm run install-all

# 3. Configure environment
cp env.example .env
# Edit .env with your settings

# 4. Start application
# On Linux/Mac:
npm start

# On Windows:
start-windows.bat

# Access:
# Frontend: http://localhost:5000
# Backend: http://localhost:3001
```

### Option 3: Production Build

```bash
# 1. Clone repository
git clone <repository-url>
cd crm1

# 2. Install all dependencies
npm run install-all

# 3. Build frontend for production
cd client
npm run build
cd ..

# 4. Set environment to production
cp env.example .env
# Edit .env and set NODE_ENV=production

# 5. Start server
npm run server

# Frontend will be served from server static files
# Backend: http://localhost:3001
```

## 📋 Prerequisites

- **Node.js**: v14 or higher
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for Docker deployment)
- **PostgreSQL** database (or configure in-memory for development)

## ⚙️ Environment Configuration

Create a `.env` file in the `crm1` directory with:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=conference_crm
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Secret
JWT_SECRET=your-secret-key-change-this

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Node Environment
NODE_ENV=development
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start both server and client concurrently |
| `npm run server` | Start only backend server |
| `npm run client` | Start only frontend development server |
| `npm run install-all` | Install dependencies for root, server, and client |
| `start.sh` | Linux/Mac startup script |
| `start-windows.bat` | Windows startup script |
| `./scripts/docker-setup.sh` | Docker setup helper |

## 📁 Project Structure

```
crm1/
├── server/              # Backend API
│   ├── config/         # Configuration files
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── database/       # Migrations & seeds
│   └── index.js        # Server entry point
├── client/             # Frontend React app
│   ├── public/         # Static files
│   ├── src/            # Source code
│   ├── package.json    # Frontend dependencies
│   └── Dockerfile      # Frontend Docker config
├── scripts/            # Utility scripts
├── docker-compose.yml  # Docker orchestration
├── package.json        # Root dependencies
└── .gitignore          # Git ignore rules
```

## 🐳 Docker Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production
```bash
docker-compose up --build -d
```

### Stop Containers
```bash
docker-compose down
```

## 🔐 Default Login Credentials

- **CEO**: `admin@crm.com` / `admin123`
- **Manager**: `manager@crm.com` / `manager123`
- **Agent**: `agent@crm.com` / `agent123`

⚠️ **Important**: Change these passwords in production!

## 🛠️ Troubleshooting

### Port Already in Use
If ports 3001 (backend) or 5000 (frontend) are in use:
- Edit `package.json` scripts to use different ports
- Or kill existing processes:
```bash
# Linux/Mac
lsof -ti:3001 | xargs kill -9
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Database Connection Issues
- Verify PostgreSQL is running
- Check `.env` credentials
- Ensure database exists: `CREATE DATABASE conference_crm;`

### Node Modules Issues
```bash
# Clean install
rm -rf node_modules client/node_modules server/node_modules
npm run install-all
```

### Missing Dependencies
```bash
# Install specific missing package
cd server && npm install <package-name>
cd ../client && npm install <package-name>
```

## 📊 Health Checks

### Backend Health
```bash
curl http://localhost:3001/api/health
```

### Frontend Status
Open browser console and check for errors at: `http://localhost:5000`

## 🌐 Production Considerations

1. **Security**:
   - Change JWT_SECRET to a strong random string
   - Use HTTPS in production
   - Enable helmet.js security headers
   - Set secure cookies

2. **Database**:
   - Use PostgreSQL with proper backups
   - Configure connection pooling
   - Enable database SSL

3. **Email**:
   - Configure production SMTP server
   - Set up SPF/DKIM records
   - Monitor email delivery rates

4. **Performance**:
   - Enable gzip compression
   - Use CDN for static assets
   - Implement Redis caching
   - Configure reverse proxy (nginx/Apache)

## 📞 Support

For issues or questions:
1. Check README.md for features and usage
2. Review API documentation
3. Check logs: `logs/` directory
4. Open an issue on GitHub

## 📝 Deployment Checklist

- [ ] Dependencies installed (`npm run install-all`)
- [ ] Environment variables configured (`.env`)
- [ ] Database created and migrated
- [ ] SMTP credentials configured
- [ ] Default passwords changed
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Backup strategy in place
- [ ] Monitoring/logging configured
- [ ] Health checks passing

---

**Last Updated**: 2025


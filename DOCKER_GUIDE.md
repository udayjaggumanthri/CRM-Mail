# Docker Deployment Guide - Mail CRM

This guide explains how to run the Mail CRM application using Docker.

## 📋 Prerequisites

- Docker Desktop installed (Windows/Mac/Linux)
- Docker Compose installed
- At least 4GB of free RAM
- Ports 3001, 5000, and 5432 available

## 🚀 Quick Start

### Development Mode (Recommended for Local Development)

```bash
# Navigate to project directory
cd crm1

# Start all services (database, backend, frontend)
docker-compose -f docker-compose.dev.yml up --build

# Access the application
# Frontend: http://localhost:5000
# Backend API: http://localhost:3001
# Database: localhost:5432
```

### Production Mode

```bash
# Navigate to project directory
cd crm1

# Start all services
docker-compose up --build -d

# Access the application
# Frontend: http://localhost:5000
# Backend API: http://localhost:3001
```

## 📦 What Gets Created

The Docker setup creates 3 containers:

1. **crm-postgres** - PostgreSQL database (port 5432)
2. **crm-backend** - Node.js Express API (port 3001)
3. **crm-frontend** - React app with Nginx (port 5000)

## 🔧 Docker Commands

### Start Services

```bash
# Development mode
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose up -d
```

### Stop Services

```bash
# Stop without removing containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (WARNING: Deletes database data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Rebuild Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Rebuild and start
docker-compose up --build
```

### Access Container Shell

```bash
# Backend container
docker exec -it crm-backend sh

# Frontend container
docker exec -it crm-frontend sh

# Database container
docker exec -it crm-postgres psql -U postgres -d crmdb
```

## 🔍 Health Checks

All services include health checks:

```bash
# Check service status
docker-compose ps

# View health status
docker inspect --format='{{.State.Health.Status}}' crm-backend
docker inspect --format='{{.State.Health.Status}}' crm-frontend
docker inspect --format='{{.State.Health.Status}}' crm-postgres
```

## 🗄️ Database Management

### Access PostgreSQL

```bash
# Using docker exec
docker exec -it crm-postgres psql -U postgres -d crmdb

# Using psql from host (if installed)
psql -h localhost -p 5432 -U postgres -d crmdb
```

### Backup Database

```bash
# Create backup
docker exec crm-postgres pg_dump -U postgres crmdb > backup.sql

# Restore backup
docker exec -i crm-postgres psql -U postgres -d crmdb < backup.sql
```

### Reset Database

```bash
# Stop services
docker-compose down

# Remove database volume
docker volume rm crm1_postgres_data

# Start services (will create fresh database)
docker-compose up -d
```

## 🌐 Environment Variables

### Backend Environment Variables

Edit `docker-compose.yml` to customize:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3001
  - JWT_SECRET=your-secret-key-here
  - PGHOST=postgres
  - PGPORT=5432
  - PGDATABASE=crmdb
  - PGUSER=postgres
  - PGPASSWORD=your-password-here
  - EMAIL_TEST_MODE=true
```

### Frontend Environment Variables

```yaml
environment:
  - REACT_APP_API_URL=http://localhost:3001
```

## 🔐 Default Login Credentials

After first run, use these credentials:

- **CEO**: admin@crm.com / admin123
- **Manager**: manager@crm.com / manager123
- **Agent**: agent@crm.com / agent123

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find and kill process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
ports:
  - "3002:3001"  # Use port 3002 instead
```

### Container Won't Start

```bash
# View container logs
docker-compose logs backend

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Database Connection Failed

```bash
# Check if postgres is healthy
docker-compose ps

# Restart postgres
docker-compose restart postgres

# Check postgres logs
docker-compose logs postgres
```

### Frontend Can't Connect to Backend

1. Check if backend is running: `docker-compose ps`
2. Check backend health: `curl http://localhost:3001/api/health`
3. Check nginx configuration in `client/nginx.conf`
4. Verify REACT_APP_API_URL environment variable

## 📊 Monitoring

### View Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats crm-backend
```

### View Network

```bash
# List networks
docker network ls

# Inspect CRM network
docker network inspect crm1_crm-network
```

## 🔄 Updates and Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes (WARNING: Deletes data)
docker volume prune

# Complete cleanup
docker system prune -a --volumes
```

## 📝 Production Deployment Checklist

Before deploying to production:

1. ✅ Change JWT_SECRET in docker-compose.yml
2. ✅ Change database password
3. ✅ Set EMAIL_TEST_MODE=false
4. ✅ Configure real SMTP settings
5. ✅ Set up SSL/HTTPS (use reverse proxy like Nginx)
6. ✅ Configure backup strategy for database
7. ✅ Set up monitoring and logging
8. ✅ Configure firewall rules

## 🌍 Deployment to Cloud

### Deploy to AWS

```bash
# Install Docker on EC2
sudo yum update -y
sudo yum install docker -y
sudo service docker start

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone and run
git clone <your-repo>
cd crm1
docker-compose up -d
```

### Deploy to DigitalOcean

```bash
# Use Docker Droplet
# SSH into droplet
git clone <your-repo>
cd crm1
docker-compose up -d
```

## 🆘 Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Check network connectivity
4. Review health checks

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)


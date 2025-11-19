#!/bin/bash

# Deployment script for Conference CRM
# This script updates the code, clears caches, and restarts the application

echo "🚀 Starting deployment..."
echo "⚠️  Tip: Put the app in maintenance mode or warn users before continuing."

# Step 0: Confirm database backup
read -p "🛡️  Have you created a fresh backup of the production database? (yes/no): " backup_confirm
if [[ "$backup_confirm" != "yes" ]]; then
  echo "❌ Deployment aborted. Please back up the database before proceeding."
  exit 1
fi

# Step 1: Pull latest code
echo "📥 Pulling latest code from git..."
git pull origin main || git pull origin master

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
cd server
npm install
cd ../client
npm install
cd ..

# Step 3: Offer to run migrations manually
cd server
read -p "🔧 Run pending database migrations now? (y/N): " run_migrations
if [[ "$run_migrations" == "y" || "$run_migrations" == "Y" ]]; then
  echo "⚙️  Running migrations..."
  npm run migrate || { echo "❌ Migrations failed. Resolve the issue before restarting."; exit 1; }
else
  echo "ℹ️  Skipping migrations. Remember to run 'npm run migrate' before restarting the backend if schema changes are required."
fi
cd ..

# Step 4: Clear build cache
echo "🧹 Clearing build cache..."
rm -rf client/build
rm -rf client/node_modules/.cache
rm -rf server/node_modules/.cache

# Step 5: Clear browser cache markers
echo "🔄 Clearing cache markers..."
# This will trigger cache clear in browser on next load
touch client/public/index.html

# Step 6: Restart servers (if using PM2 or similar)
if command -v pm2 &> /dev/null; then
    echo "🔄 Restarting with PM2..."
    pm2 restart all
else
    echo "⚠️  PM2 not found. Please restart servers manually."
    echo "   Backend: cd server && node index.js"
    echo "   Frontend: cd client && npm start"
fi

echo "✅ Deployment complete!"
echo "💡 Users may need to clear browser cache or do a hard refresh (Ctrl+Shift+R)"

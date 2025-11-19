# Quick Deployment Guide

## ⚠️ IMPORTANT: After `git pull`, you MUST restart the frontend server and guard the database

The React dev server (`npm start`) does NOT automatically detect changes from `git pull`, and the backend no longer auto-syncs schemas in production. Always restart both services and run migrations manually (if required) after taking a DB backup.

## Quick Steps:

### 1. Pull Latest Code
```bash
git pull origin main
```

### 2. Stop Current Servers
- Press `Ctrl+C` in the backend server window
- Press `Ctrl+C` in the frontend client window
- Wait for both to stop

### 3. Safeguard the database
- Take a fresh backup (pg_dump, cloud snapshot, etc.)
- Apply pending migrations **only if needed**:
  ```bash
  cd server
  NODE_ENV=production npm run migrate
  cd ..
  ```

### 4. Restart Application
```bash
# Windows
start-windows.bat

# Or manually:
cd server && node index.js
# (in another window)
cd client && npm start
```

### 5. Clear Browser Cache (if UI doesn't update)
- Press `Ctrl+Shift+R` (hard refresh)
- Or `Ctrl+Shift+Delete` → Clear "Cached images and files"

## Why Restart is Needed

The webpack dev server (`npm start`) watches files for changes, but it only detects changes that happen **while it's running**. Changes from `git pull` happen **before** the server starts, so it doesn't detect them.

## Automated Deployment

Use the deployment script (it now prompts for backups/migrations before restarting):
```bash
# Windows
deploy-windows.bat

# Linux/Mac
./deploy.sh
```

This will:
1. Pull latest code
2. Install dependencies
3. Clear build cache
4. Give you instructions to restart

## Troubleshooting

### UI still shows old version after restart:

1. **Clear browser cache:**
   - `Ctrl+Shift+Delete` → Clear cache
   - Or hard refresh: `Ctrl+Shift+R`

2. **Clear React Query cache:**
   - Open browser console (F12)
   - Run: `localStorage.clear(); sessionStorage.clear();`
   - Refresh page

3. **Verify code is updated:**
   - Check `Settings.js` has latest changes
   - Check git log: `git log -1`

4. **Check if frontend is running:**
   - Should be on port 5000
   - Check browser console for errors

## Production Deployment

For production, build the React app:
```bash
cd client
npm run build
```

Then serve the `build` folder with a web server.

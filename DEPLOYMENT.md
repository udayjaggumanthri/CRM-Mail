# Deployment Guide

## Quick Deployment Steps

After pulling the latest code from git, follow these steps to ensure the UI updates properly **without touching the production database unexpectedly**:

### Option 1: Using Deployment Script (Recommended)

Both scripts now pause to confirm a database backup and prompt you before running migrations.

**Windows:**
```bash
.\deploy-windows.bat
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Deployment

1. **Pull latest code:**
   ```bash
   git pull origin main
   ```

2. **Install dependencies:**
   ```bash
   cd server
   npm install
   cd ../client
   npm install
   ```

3. **Confirm DB backup + run migrations (manual step):**
   ```bash
   # Back up the database using pg_dump / managed backup
   # Then apply pending migrations:
   cd server
   npm run migrate -- --env production
   cd ..
   ```

4. **Clear build cache:**
   ```bash
   # Windows
   rmdir /s /q client\build
   rmdir /s /q client\node_modules\.cache
   rmdir /s /q server\node_modules\.cache
   
   # Linux/Mac
   rm -rf client/build
   rm -rf client/node_modules/.cache
   rm -rf server/node_modules/.cache
   ```

5. **Restart servers:**
   - Stop current servers (Ctrl+C)
   - Restart using `start-windows.bat` or `start.sh`

## Clearing Browser Cache

After deployment, users may need to clear their browser cache:

### Chrome/Edge:
- Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "Cached images and files"
- Click "Clear data"

### Firefox:
- Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "Cache"
- Click "Clear Now"

### Hard Refresh (Quick Fix):
- **Windows:** `Ctrl+Shift+R` or `Ctrl+F5`
- **Mac:** `Cmd+Shift+R`

## Troubleshooting

### UI Not Updating After Deployment

1. **Clear browser cache** (see above)
2. **Hard refresh** the page (`Ctrl+Shift+R`)
3. **Clear localStorage and sessionStorage:**
   - Open browser console (F12)
   - Run: `localStorage.clear(); sessionStorage.clear();`
   - Refresh the page

4. **Check if React dev server is running:**
   - The client should be running on port 5000
   - If using `npm start`, it should auto-reload on changes
   - If not, restart the client: `cd client && npm start`

5. **Verify code is updated:**
   - Check if `Settings.js` has the latest changes
   - Check git log: `git log -1`

### React Query Cache Issues

The app now automatically clears React Query cache on deployment. If you still see stale data:

1. Open browser console (F12)
2. Run: `localStorage.clear(); sessionStorage.clear();`
3. Refresh the page

### Build Cache Issues

If changes aren't reflected even after clearing browser cache:

1. **Delete node_modules and reinstall:**
   ```bash
   cd client
   rm -rf node_modules
   npm install
   ```

2. **Clear webpack cache:**
   ```bash
   cd client
   rm -rf node_modules/.cache
   ```

3. **Restart the dev server:**
   ```bash
   cd client
   npm start
   ```

## Production Deployment

### Required order of operations

1. (Optional) Put the site in maintenance mode or notify users.
2. Pull latest code: `git pull origin main`.
3. Take a fresh database backup (`pg_dump`, cloud snapshot, etc.).
4. Install dependencies in `server/` and `client/`.
5. Apply migrations manually:
   ```bash
   cd server
   NODE_ENV=production npm run migrate
   cd ..
   ```
6. Restart backend + frontend (PM2 or manual `node index.js` / `npm start`).
7. Remove maintenance mode and monitor logs.

### React build

```bash
cd client
npm run build
```

Serve the `client/build` folder with nginx/Apache/S3/etc.

### Environment checklist

- Production `.env` must set `NODE_ENV=production`.
- Leave `AUTO_DB_SYNC`, `ALLOW_SCHEMA_BOOTSTRAP`, and `ALLOW_AUTO_SEED` unset (defaults to safe/disabled).
- Only set those flags to `true` temporarily when you intentionally need bootstrap behavior, then revert.

## Cache-Busting Features

The application includes automatic cache-busting:

1. **HTML meta tags** prevent browser caching
2. **Version tracking** in sessionStorage
3. **Automatic cache clearing** on version change
4. **React Query cache clearing** on app start
5. **Service worker cache clearing** (if applicable)

## Best Practices

1. **Always clear cache after deployment**
2. **Use deployment script** to automate the process (it now enforces DB backup prompts)
3. **Notify users** to clear cache after major updates
4. **Test in incognito mode** to verify changes
5. **Check browser console** for any errors
6. **Never rely on automatic `sequelize.sync` in production** – use migrations only.

## Support

If you continue to experience caching issues:

1. Check browser console for errors
2. Verify server is running and responding
3. Check network tab for cached responses
4. Try accessing the app in incognito mode
5. Contact support with specific error messages

# Render Deployment Troubleshooting Guide

## Issue: Deployment Stops Loading / Nothing Happens

If your deployment starts but then stops without completing, follow these steps:

### Solution 1: Check Render Logs

1. Go to your Render dashboard
2. Click on your service
3. Go to the **"Logs"** tab
4. Look for error messages - this will tell you exactly what's wrong

### Solution 2: Use Dashboard Method (Not render.yaml)

**Important**: If you're deploying via the Render dashboard, the `render.yaml` file might cause conflicts.

**Option A: Remove render.yaml temporarily**
```bash
# Rename it so Render doesn't use it
git mv render.yaml render.yaml.backup
git commit -m "Temporarily disable render.yaml"
git push
```

**Option B: Use render.yaml only**
- Delete the service in Render dashboard
- Create a new **"Blueprint"** instead of "Web Service"
- This will use the render.yaml file

### Solution 3: Verify Build and Start Commands

In Render dashboard, make sure:
- **Build Command**: `npm install` (or leave empty - Render auto-detects)
- **Start Command**: `npm start`
- **Node Version**: Auto-detected (or set to 18.x or 20.x)

### Solution 4: Check Environment Variables

**Critical**: Add these environment variables BEFORE deploying:

1. Go to your service → **Environment** tab
2. Add these variables (even if empty initially):
   - `NODE_ENV` = `production`
   - `MONGO_URI` = (your MongoDB connection string)
   - `CLIENT_URL` = (your frontend URL)
   - `JWT_SECRET` = (any random string for now)

**Note**: The app will now start even without MONGO_URI (it will retry), but you should add it.

### Solution 5: Manual Deployment Steps

Try this step-by-step:

1. **Delete the existing service** (if it exists and is stuck)

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect GitHub repo
   - Select `zayan_backend` repository
   - Select branch: `main` (or your default branch)

3. **Basic Settings**:
   - Name: `zayan-backend`
   - Region: Choose closest to you
   - Branch: `main`
   - Root Directory: **Leave EMPTY** (or `./` if needed)
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Environment Variables** (Add these BEFORE clicking "Create"):
   - Click "Advanced" → "Add Environment Variable"
   - Add:
     ```
     NODE_ENV = production
     PORT = (leave empty - Render sets this automatically)
     MONGO_URI = mongodb+srv://user:pass@cluster.mongodb.net/dbname
     CLIENT_URL = http://localhost:3000 (update later)
     JWT_SECRET = your-secret-key-here
     ```

5. **Click "Create Web Service"**

6. **Wait for deployment** (2-5 minutes)

7. **Check Logs** if it fails

### Solution 6: Test Locally First

Make sure your app runs locally:
```bash
npm install
npm start
```

If it doesn't work locally, fix those issues first.

### Solution 7: Check Common Issues

#### Issue: "Cannot find module"
- **Fix**: Make sure `package.json` has all dependencies
- Check that `node_modules` is in `.gitignore` (it should be)

#### Issue: "Port already in use" or "EADDRINUSE"
- **Fix**: Don't set PORT manually - Render sets it automatically
- Remove PORT from environment variables if you added it

#### Issue: "MongoDB connection failed"
- **Fix**: The app will now start even if DB fails initially
- Add MONGO_URI in environment variables
- Check MongoDB Atlas network access (allow 0.0.0.0/0)

#### Issue: Build timeout
- **Fix**: Free tier has limits
- Try again or upgrade plan

### Solution 8: Alternative - Use Render CLI

If dashboard keeps failing:

1. Install Render CLI:
```bash
npm install -g render-cli
```

2. Login:
```bash
render login
```

3. Deploy:
```bash
cd zayan_backend
render deploy
```

### Solution 9: Check GitHub Connection

- Make sure Render can access your GitHub repo
- Check repository is public or Render has access
- Reconnect GitHub account if needed

### Solution 10: Verify File Structure

Make sure your project structure is correct:
```
zayan_backend/
├── index.js          (main file)
├── package.json      (with "start" script)
├── .gitignore        (with node_modules)
├── config/
├── routes/
├── controller/
└── ...
```

## Quick Checklist

Before deploying, verify:
- [ ] Code is pushed to GitHub
- [ ] `package.json` has `"start": "node index.js"`
- [ ] `index.js` exists and is the entry point
- [ ] Environment variables are ready to add
- [ ] MongoDB connection string is ready
- [ ] No syntax errors in code
- [ ] App runs locally with `npm start`

## Still Having Issues?

1. **Check Render Status**: [status.render.com](https://status.render.com)
2. **View Detailed Logs**: Service → Logs tab
3. **Contact Render Support**: Available in dashboard
4. **Check Render Docs**: [render.com/docs](https://render.com/docs)

## Success Indicators

When deployment succeeds, you'll see:
- ✅ Green "Live" status
- ✅ Service URL (e.g., `https://zayan-backend.onrender.com`)
- ✅ Logs showing "Server running on port..."
- ✅ Health check endpoint works: `https://your-url.onrender.com/health`


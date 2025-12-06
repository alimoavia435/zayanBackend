# Render.com Deployment Guide

This guide will help you deploy your backend to Render.com.

## Prerequisites

1. A Render account (sign up at [render.com](https://render.com))
2. Your project pushed to GitHub
3. MongoDB connection string (MongoDB Atlas or your MongoDB instance)

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

Make sure all your changes are committed and pushed:
```bash
git add .
git commit -m "Setup Render deployment"
git push origin main
```

### 2. Deploy to Render

#### Option A: Using Render Dashboard (Recommended)

1. **Sign in to Render**
   - Go to [render.com](https://render.com) and sign in
   - Connect your GitHub account if you haven't already

2. **Create a New Web Service**
   - Click **"New +"** button in the dashboard
   - Select **"Web Service"**
   - Connect your GitHub repository (`zayan_backend`)

3. **Configure Your Service**
   - **Name**: `zayan-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose the closest region to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (or `./` if needed)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choose **Free** (or upgrade for better performance)

4. **Add Environment Variables**
   Click on "Advanced" and add all your environment variables:
   - `MONGO_URI` - Your MongoDB connection string
   - `CLIENT_URL` - Your frontend URL (e.g., `https://your-frontend.onrender.com` or your custom domain)
   - `JWT_SECRET` - Your JWT secret key (use a strong random string)
   - `NODE_ENV` - Set to `production`
   - `PORT` - Render sets this automatically, but you can leave it or set to `10000`
   - Any other environment variables you use (AWS keys, email config, etc.)

5. **Deploy**
   - Click **"Create Web Service"**
   - Render will start building and deploying your application
   - Wait for the deployment to complete (usually 2-5 minutes)

#### Option B: Using render.yaml (Infrastructure as Code)

If you prefer using the `render.yaml` file:

1. Push your code with `render.yaml` to GitHub
2. In Render dashboard, click **"New +"** → **"Blueprint"**
3. Connect your repository
4. Render will automatically detect and use `render.yaml`
5. Add environment variables in the dashboard (they won't be in the YAML for security)

### 3. Configure Your Service

After deployment:

1. **Get Your Service URL**
   - Render provides a URL like: `https://zayan-backend.onrender.com`
   - You can also set up a custom domain in **Settings** → **Custom Domains**

2. **Update CORS Settings**
   - Make sure `CLIENT_URL` environment variable matches your frontend URL
   - Update it in **Environment** tab if needed
   - Redeploy after changing environment variables

3. **Enable Auto-Deploy** (Recommended)
   - In **Settings** → **Build & Deploy**
   - Enable **"Auto-Deploy"** so Render deploys on every push to your main branch

### 4. Socket.io Configuration

✅ **Good News**: Socket.io works perfectly on Render!
- Render supports WebSockets and persistent connections
- No special configuration needed
- Your real-time features will work as expected

### 5. Database Connection

- **MongoDB Atlas**: Recommended for production
  - Make sure your MongoDB Atlas allows connections from anywhere (0.0.0.0/0) or add Render's IP ranges
  - Your connection string should look like: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`

- **Connection Pooling**: Already optimized in `config/db.js`
  - Connections are cached and reused efficiently

## Environment Variables Reference

Add these in Render dashboard under **Environment**:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `CLIENT_URL` | Frontend URL for CORS | `https://your-frontend.onrender.com` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key-here` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (auto-set by Render) | `10000` |

## Testing Your Deployment

After deployment, test your API:

```bash
# Health check
curl https://your-service.onrender.com/api/auth/test

# Or visit in browser
https://your-service.onrender.com
```

## Free Tier Limitations

⚠️ **Important Notes for Free Tier**:

1. **Sleep Mode**: Free services spin down after 15 minutes of inactivity
   - First request after sleep takes ~30-60 seconds to wake up
   - Consider upgrading to paid plan for always-on service

2. **Build Time**: Free tier has longer build times
   - Usually 2-5 minutes for deployment

3. **Resource Limits**: 
   - 512MB RAM
   - 0.1 CPU
   - Sufficient for most small to medium applications

## Upgrading to Paid Plan

Benefits of paid plans:
- ✅ Always-on service (no sleep mode)
- ✅ Faster builds and deployments
- ✅ More resources (RAM, CPU)
- ✅ Better performance
- ✅ Priority support

## Monitoring and Logs

1. **View Logs**
   - Go to your service dashboard
   - Click **"Logs"** tab to see real-time logs
   - Useful for debugging

2. **Metrics**
   - View CPU, Memory, and Request metrics
   - Monitor your service performance

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Render dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility
   - Check for syntax errors

2. **Database Connection Errors**
   - Verify `MONGO_URI` is correct
   - Check MongoDB Atlas network access (allow 0.0.0.0/0)
   - Ensure MongoDB credentials are correct

3. **CORS Errors**
   - Verify `CLIENT_URL` matches your frontend URL exactly
   - Check CORS configuration in `index.js`
   - Include protocol (https://) in CLIENT_URL

4. **Service Not Starting**
   - Check logs for error messages
   - Verify `startCommand` is correct (`npm start`)
   - Ensure `PORT` environment variable is set (Render sets this automatically)

5. **Socket.io Not Working**
   - Verify WebSocket support is enabled (should work by default)
   - Check CORS settings for Socket.io
   - Ensure client is connecting to correct URL

### Getting Help

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Community**: [community.render.com](https://community.render.com)
- **Support**: Available in Render dashboard

## Local Development

Your local development remains unchanged:
```bash
npm run dev
```

The code works the same way locally and on Render.

## Next Steps

1. ✅ Set up custom domain (optional)
2. ✅ Configure production environment variables
3. ✅ Set up monitoring and alerts
4. ✅ Configure auto-deploy from GitHub
5. ✅ Set up staging environment (optional)

## Security Best Practices

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Use strong JWT secrets** (random strings, 32+ characters)
3. **Keep dependencies updated**
4. **Use HTTPS** (Render provides this automatically)
5. **Restrict MongoDB access** (use IP whitelisting in production)

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables added in Render
- [ ] MongoDB connection string configured
- [ ] CORS URL set correctly
- [ ] JWT secret configured
- [ ] Service deployed successfully
- [ ] API endpoints tested
- [ ] Socket.io connections tested
- [ ] Frontend updated with new backend URL

---

**Congratulations!** Your backend is now deployed on Render.com 🎉


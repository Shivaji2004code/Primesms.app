# 🚀 Prime SMS - Coolify Deployment Guide

This guide will help you deploy Prime SMS WhatsApp Business API platform to Coolify.

## 📋 Prerequisites

- Coolify instance (self-hosted or cloud)
- GitHub account with access to this repository
- Meta WhatsApp Business API credentials
- Domain name (optional but recommended)

## 🔧 Step-by-Step Deployment

### 1. Repository Setup
✅ **Repository**: https://github.com/Shivaji2004code/Primesms.app
✅ **Branch**: `main`
✅ **Dockerfile**: Ready for Coolify
✅ **Health Checks**: Configured

### 2. Create Project in Coolify

1. **Login to Coolify Dashboard**
2. **Create New Project**
   - Click "New Project"
   - Choose "GitHub Repository"
   - Connect repository: `https://github.com/Shivaji2004code/Primesms.app`
   - Select branch: `main`

### 3. Application Configuration

```yaml
# Build Settings
Build Command: (leave empty - uses Dockerfile)
Start Command: (leave empty - uses CMD from Dockerfile)
Port: 3000
```

### 4. Environment Variables

Copy these variables into Coolify's Environment tab:

```bash
# Required Variables
NODE_ENV=production
PORT=3000

# Database (Coolify will provide PostgreSQL)
DATABASE_URL=postgresql://username:password@postgres:5432/primesms
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=primesms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Security Secrets (generate secure values)
JWT_SECRET=your_jwt_secret_minimum_32_characters
SESSION_SECRET=your_session_secret_minimum_32_characters

# Meta WhatsApp Business API
META_ACCESS_TOKEN=your_meta_access_token
META_PHONE_NUMBER_ID=your_phone_number_id
META_VERIFY_TOKEN=your_webhook_verify_token

# App Secrets (Multiple WhatsApp Apps Support)
META_APP_SECRET=your_first_whatsapp_app_secret
META_APP_SECRET_2=your_second_whatsapp_app_secret

GRAPH_API_VERSION=v22.0

# Webhook Debug
WEBHOOK_DEBUG_TOKEN=your_debug_token
```

### 5. Database Setup

1. **Add PostgreSQL Service**
   - In your project, click "Add Service"
   - Select "PostgreSQL"
   - Version: 15
   - Set database credentials matching your environment variables

2. **Database will auto-create with**:
   - Database name: `primesms`
   - User: `postgres`
   - Password: (set in environment variables)

### 6. Domain Configuration (Optional)

1. **Add Domain**
   - Go to "Domains" tab
   - Add your domain: `yourdomain.com`
   - Enable SSL certificate

2. **DNS Configuration**
   - Point your domain to Coolify's IP
   - Wait for SSL certificate generation

### 7. Deploy

1. **Deploy Application**
   - Click "Deploy" button
   - Monitor build logs
   - Wait for successful deployment

2. **Verify Health**
   - Check application logs
   - Visit health endpoint: `https://yourdomain.com/health`
   - Should return: `{"status": "OK"}`

## 🔍 Post-Deployment Verification

### Health Checks
```bash
# Application Health
curl https://yourdomain.com/health

# Database Connection
curl https://yourdomain.com/api/health
```

### Application Access
- **Frontend**: `https://yourdomain.com`
- **Admin Panel**: `https://yourdomain.com/admin`
- **API Documentation**: `https://yourdomain.com/api`

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
   ```bash
   # Check logs in Coolify dashboard
   # Ensure all environment variables are set
   ```

2. **Database Connection Error**
   ```bash
   # Verify DATABASE_URL format
   # Check PostgreSQL service is running
   ```

3. **App Secret Issues**
   ```bash
   # Ensure META_APP_SECRET is set
   # Check webhook signature verification logs
   ```

### Debug Commands
```bash
# View application logs
docker logs <container_name>

# Check environment variables
printenv | grep -E "(META_|POSTGRES_|JWT_)"

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"
```

## 🔄 Automatic Deployments

Coolify will automatically deploy when you push to the `main` branch.

### Manual Deployment
- Use Coolify dashboard "Deploy" button
- Or push changes to trigger auto-deployment

## 🛡️ Security Checklist

- ✅ JWT_SECRET is 32+ characters
- ✅ SESSION_SECRET is unique
- ✅ Database password is secure
- ✅ META_APP_SECRET is configured
- ✅ WEBHOOK_DEBUG_TOKEN is set
- ✅ SSL certificate is active
- ✅ Environment variables are not exposed

## 📞 Support

- **GitHub Issues**: https://github.com/Shivaji2004code/Primesms.app/issues
- **Documentation**: See README.md
- **Logs**: Check Coolify dashboard for real-time logs

---

**🎉 Your Prime SMS application is now ready for production!**

Access your app at: `https://yourdomain.com`
# 🚀 Coolify Deployment Guide for Prime SMS

This guide will help you deploy Prime SMS on Coolify with full production configuration.

## 📋 Prerequisites

- Coolify instance running and accessible
- Domain name configured (primesms.app)
- Meta WhatsApp Business API account setup
- PostgreSQL credentials ready

## 🛠️ Deployment Steps

### 1. Create New Project in Coolify

1. Log into your Coolify dashboard
2. Click "Create New Project"
3. Select "Git Repository"
4. Connect to: `https://github.com/Shivaji2004code/Primesms.app.git`
5. Select branch: `main`

### 2. Configure Project Settings

- **Project Name**: `primesms-app`
- **Build Pack**: Docker Compose
- **Docker Compose File**: `docker-compose.production.yml`
- **Port**: `3000`

### 3. Environment Variables

Copy all variables from `.env.production.example` and set them in Coolify:

#### Required Variables:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/primesms
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
JWT_SECRET=YOUR_JWT_SECRET_32_CHARS_MIN
SESSION_SECRET=YOUR_SESSION_SECRET_32_CHARS_MIN
META_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN
META_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
META_VERIFY_TOKEN=YOUR_WEBHOOK_VERIFY_TOKEN
META_APP_SECRET=YOUR_FACEBOOK_APP_SECRET
```

### 4. Domain Configuration

1. Go to your project settings
2. Add domains:
   - `primesms.app`
   - `www.primesms.app`
3. Enable SSL (automatic with Coolify)

### 5. Database Setup

PostgreSQL will be automatically provisioned via docker-compose. Database migrations will run automatically on first deployment.

### 6. Health Checks

Health checks are pre-configured:
- **Endpoint**: `/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## 🎯 Post-Deployment Verification

### 1. Check Application Health
```bash
curl https://primesms.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

### 2. Verify Database Connection
Check Coolify logs to ensure PostgreSQL connection is successful.

### 3. Test WhatsApp API Integration
1. Login to the application
2. Go to Templates section
3. Verify templates are loading from Meta API

## 🔧 Configuration Files Overview

- **`coolify.json`**: Coolify-specific configuration
- **`docker-compose.production.yml`**: Production Docker Compose setup
- **`Dockerfile`**: Multi-stage build configuration
- **`.env.production.example`**: Environment variables template

## 🚨 Security Considerations

1. **Secrets**: All sensitive data is managed via environment variables
2. **Database**: PostgreSQL runs with restricted access
3. **SSL**: Automatic HTTPS with Coolify
4. **Health Checks**: Application monitoring enabled
5. **Non-root User**: Application runs as non-root user in container

## 📊 Monitoring & Logs

- **Application Logs**: Available in Coolify dashboard
- **Database Logs**: PostgreSQL logs accessible via Coolify
- **Health Status**: Real-time health monitoring
- **Performance**: Built-in metrics and monitoring

## 🔄 Auto-Deployment

Auto-deployment is enabled for the `main` branch. Any push to main will trigger:

1. Automatic build
2. Docker image creation
3. Health check verification
4. Zero-downtime deployment

## 🛠️ Troubleshooting

### Common Issues:

1. **Database Connection Failed**
   - Check POSTGRES_PASSWORD in environment variables
   - Verify DATABASE_URL format

2. **Meta API Errors**
   - Verify META_ACCESS_TOKEN is valid
   - Check META_PHONE_NUMBER_ID is correct

3. **Health Check Failures**
   - Check application logs in Coolify
   - Verify port 3000 is accessible

### Debug Commands:
```bash
# Check container status
docker ps

# View application logs
docker logs primesms-app_app_1

# Check database connectivity
docker exec -it primesms-app_postgres_1 psql -U postgres -d primesms
```

## 📞 Support

For deployment issues:
1. Check Coolify documentation
2. Review application logs
3. Verify environment variables
4. Contact support with error logs

---

**✅ Deployment Status**: Production Ready  
**🔧 Last Updated**: January 2024  
**📱 Platform**: Prime SMS WhatsApp Business API  
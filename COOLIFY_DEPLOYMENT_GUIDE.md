# 🚀 Prime SMS Coolify Deployment Guide

## ✅ **Ready for Production Deployment**

This application is fully configured for Coolify deployment with:
- ✅ Loop-based bulk messaging (200 messages per loop)
- ✅ Complete campaign log tracking  
- ✅ Real-time webhook status updates
- ✅ Enhanced frontend reports with all columns
- ✅ Database constraints and type safety
- ✅ Multi-stage Docker build optimization

---

## 🔧 **Pre-Deployment Setup**

### 1. **Database Migration**
Run these migrations in order on your PostgreSQL database:

```sql
-- 1. Basic schema (if new deployment)
\i database_schema.sql

-- 2. App secret support  
\i migration_add_app_secret.sql

-- 3. Campaign logs constraints (REQUIRED for bulk messaging)
\i migration_fix_campaign_logs_constraints.sql
```

### 2. **Environment Variables**
Set these in Coolify Environment tab:

```bash
# Application
NODE_ENV=production
PORT=3000

# Database (Update with your Coolify PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@postgres:5432/primesms
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=primesms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Security
JWT_SECRET=your_jwt_secret_here_minimum_32_characters
SESSION_SECRET=your_session_secret_here_minimum_32_characters

# Meta WhatsApp Business API
META_ACCESS_TOKEN=your_meta_access_token
META_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
META_VERIFY_TOKEN=your_webhook_verify_token
META_APP_SECRET=your_first_whatsapp_app_secret
META_APP_SECRET_2=your_second_whatsapp_app_secret
GRAPH_API_VERSION=v22.0

# Bulk Messaging Configuration (Loop-based)
BULK_LOOP_SIZE=200
BULK_LOOP_PAUSE_MS=2000
BULK_MESSAGES_PER_SECOND=10
BULK_MAX_RETRIES=3
BULK_RETRY_BASE_MS=500
BULK_HARD_CAP=50000

# Webhook Configuration
WEBHOOK_DEBUG_TOKEN=your_webhook_debug_token

# Optional: N8N Integration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook

# Coolify Deployment Flag
COOLIFY_DEPLOYMENT=true

# Health Check Settings
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/health
```

---

## 🐳 **Coolify Deployment Steps**

### 1. **Create New Resource**
- Go to Coolify Dashboard
- Click "New Resource" → "Docker Compose" or "Application"
- Choose "Git Repository"

### 2. **Repository Configuration**
- **Repository URL**: `https://github.com/your-org/prime-sms-repo`
- **Branch**: `main`
- **Build Pack**: Docker

### 3. **Build Configuration**
- **Dockerfile Path**: `./Dockerfile` (root level)
- **Build Context**: Root directory
- **Port**: `3000`

### 4. **Database Service**
Add PostgreSQL service:
- Service Name: `postgres`
- Image: `postgres:15-alpine`
- Environment Variables:
  ```
  POSTGRES_DB=primesms
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=your_secure_password
  ```
- Persistent Volume: `/var/lib/postgresql/data`

### 5. **Domain Configuration**
- Set your custom domain or use Coolify subdomain
- Enable SSL certificate (automatic with Coolify)

### 6. **Deploy**
- Click "Deploy"
- Monitor logs for successful startup
- Verify health check endpoint: `https://your-domain.com/health`

---

## 📊 **Features Ready for Production**

### **Bulk Messaging System**
- **Loop Processing**: 200 messages per loop with 2-second pauses
- **Rate Limiting**: 10 messages per second within loops
- **Error Handling**: Complete failure tracking and retry logic
- **Real-time Progress**: SSE updates for live progress tracking

### **Campaign Management**
- **Complete Tracking**: Every message tracked in campaign_logs
- **Webhook Integration**: Automatic status updates (sent/delivered/read)
- **Export Functionality**: CSV/Excel export with all data fields
- **Advanced Filtering**: Date range, status, template, recipient filters

### **Frontend Reports**
- **Enhanced Columns**: Campaign, Template, From, Recipient, Status, Sent At, Delivered At, Read At, Error
- **Real-time Updates**: Automatic refresh and live status changes
- **Export Options**: CSV and Excel with complete data
- **Advanced Filters**: Multiple filter combinations

### **Performance Optimizations**
- **Database Indexing**: Optimized queries for large datasets
- **Memory Management**: Efficient loop processing reduces memory usage
- **Type Safety**: PostgreSQL type casting prevents parameter errors
- **Connection Pooling**: Efficient database connection management

---

**🎉 Your Prime SMS application is now ready for production on Coolify!**

The loop-based bulk messaging system will efficiently handle large campaigns while the enhanced reporting provides complete visibility into message delivery and engagement metrics.
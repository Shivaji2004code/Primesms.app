# Prime SMS Production Deployment Guide

## Overview

This guide covers deploying Prime SMS WhatsApp Business API with the integrated pricing system in production environments including Docker, Docker Compose, and Coolify.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 2GB RAM and 10GB disk space
- PostgreSQL database access
- WhatsApp Business API credentials

### 1-Command Deployment

```bash
# Clone and deploy
git clone https://github.com/your-repo/prime-sms.git
cd prime-sms
cp .env.example .env
# Edit .env with your values
./deploy.sh
```

## 📋 Production Checklist

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@host:5432/database
POSTGRES_DB=PrimeSMS_W
POSTGRES_USER=postgres  
POSTGRES_PASSWORD=secure-password-here

# Security
SESSION_SECRET=generate-32-char-secure-secret
JWT_SECRET=generate-another-32-char-secret

# WhatsApp API
META_ACCESS_TOKEN=your-whatsapp-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
META_VERIFY_TOKEN=your-webhook-verify-token
META_APP_SECRET=your-app-secret

# Application
NODE_ENV=production
PORT=3000
APP_VERSION=1.2.0
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
LOG_LEVEL=info

# Pricing System
PRICING_CURRENCY=INR
PRICING_DEFAULT_MARKETING=0.80
PRICING_DEFAULT_UTILITY=0.15
PRICING_DEFAULT_AUTHENTICATION=0.15
```

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong SESSION_SECRET and JWT_SECRET
- [ ] Configure CORS_ORIGINS for your domain
- [ ] Enable HTTPS with reverse proxy
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Enable container security scanning

## 🐳 Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t prime-sms:1.2.0 .

# Run with environment file
docker run -d \
  --name prime-sms \
  -p 3000:3000 \
  --env-file .env \
  -v prime-sms-uploads:/app/uploads \
  -v prime-sms-logs:/app/logs \
  prime-sms:1.2.0
```

### Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Health check
curl http://localhost:3000/healthz

# Stop services
docker-compose down
```

## ☁️ Coolify Deployment

### Setup Steps

1. **Create New Project** in Coolify dashboard
2. **Connect Repository**: https://github.com/your-repo/prime-sms
3. **Build Configuration**:
   - Build Command: `(leave empty - uses Dockerfile)`
   - Start Command: `(leave empty - uses CMD from Dockerfile)`
   - Port: `3000`
   - Dockerfile: `./Dockerfile`

4. **Environment Variables** (add all from checklist above)

5. **Database Setup**:
   - Enable PostgreSQL service in Coolify
   - Update `DATABASE_URL` to Coolify's PostgreSQL URL

6. **Domain Configuration**:
   - Set your domain
   - Enable SSL certificate
   - Configure CORS_ORIGINS to match your domain

7. **Deploy**: Click deploy and monitor build logs

### Coolify Health Checks

Coolify automatically uses these endpoints:
- Primary: `GET /healthz` (fast, no DB check)  
- Fallback: `GET /health` (same as above)
- Deep check: `GET /api/health/db` (includes DB check)

## 🏥 Monitoring & Health Checks

### Health Endpoints

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/healthz` | Container health | Kubernetes, Docker, Coolify |
| `/health` | Application status | Load balancers |
| `/api/health/db` | Database connectivity | Deep health monitoring |
| `/api/metrics` | System metrics | Monitoring tools |
| `/version` | Version info | Deployment tracking |

### Example Health Check Response

```json
{
  "status": "ok",
  "service": "prime-sms",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 95653888,
    "heapTotal": 67108864,
    "heapUsed": 45234176
  },
  "pid": 1
}
```

### Monitoring Integration

**Prometheus/Grafana**:
```yaml
- job_name: 'prime-sms'
  static_configs:
    - targets: ['prime-sms:3000']
  metrics_path: '/api/metrics'
```

**Uptime Monitoring**:
- Monitor: `https://yourdomain.com/healthz`
- Expected: `200 OK` with `{"status": "ok"}`

## 📊 Performance Optimization

### Recommended Resources

| Environment | CPU | RAM | Disk | Concurrent Users |
|-------------|-----|-----|------|------------------|
| Small | 1 vCPU | 2GB | 20GB | 100 |
| Medium | 2 vCPU | 4GB | 50GB | 500 |
| Large | 4 vCPU | 8GB | 100GB | 1000+ |

### Database Optimization

```sql
-- Add indexes for pricing queries
CREATE INDEX IF NOT EXISTS idx_user_business_info_pricing 
ON user_business_info (user_id, marketing_price, utility_price, authentication_price);

CREATE INDEX IF NOT EXISTS idx_settings_pricing_keys 
ON settings (key) WHERE key LIKE 'pricing_%';

-- Connection pooling settings
SET max_connections = 100;
SET shared_buffers = '256MB';
SET effective_cache_size = '1GB';
```

### Container Optimization

```dockerfile
# Resource limits in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
```

## 💰 Pricing System Configuration

### Default Pricing Setup

```bash
# Set via environment variables
PRICING_CURRENCY=INR
PRICING_DEFAULT_MARKETING=0.80
PRICING_DEFAULT_UTILITY=0.15  
PRICING_DEFAULT_AUTHENTICATION=0.15
```

### Admin Configuration

1. **Access Admin Panel**: `/admin/pricing`
2. **Set Global Defaults**: Configure default rates for all users
3. **Per-User Pricing**: Override defaults in User Settings → Pricing tab

### API Integration

```javascript
// Get cost preview
const response = await fetch('/api/send/cost-preview', {
  method: 'POST',
  body: JSON.stringify({
    username: 'client_username',
    templatename: 'template_name', 
    recipients: ['recipient_list']
  })
});

// Response includes real-time pricing
{
  "success": true,
  "preview": {
    "unitPrice": "0.80",
    "totalCost": "120.00", 
    "pricingMode": "custom",
    "currency": "INR"
  }
}
```

## 🔧 Maintenance

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy  
docker-compose build --no-cache
docker-compose up -d

# Verify health
curl http://localhost:3000/healthz
```

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres PrimeSMS_W > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres PrimeSMS_W < backup.sql
```

### Log Management

```bash
# View application logs
docker-compose logs -f app

# Rotate logs (set up with logrotate)
docker-compose exec app logrotate /etc/logrotate.conf
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start**:
```bash
# Check environment variables
docker-compose config

# View detailed logs
docker-compose logs app

# Check database connectivity
docker-compose exec app node -e "require('./dist/db').query('SELECT 1')"
```

**Health check failing**:
```bash
# Test health endpoint directly
curl -v http://localhost:3000/healthz

# Check container status
docker-compose ps

# Inspect container
docker-compose exec app ps aux
```

**Pricing not updating**:
```bash
# Check pricing service
curl http://localhost:3000/api/admin/pricing/defaults

# Verify database pricing columns
docker-compose exec postgres psql -U postgres -d PrimeSMS_W -c "SELECT marketing_price, utility_price, authentication_price FROM user_business_info LIMIT 5;"
```

### Performance Issues

```bash
# Monitor container resources
docker stats prime-sms-app

# Database performance
docker-compose exec postgres psql -U postgres -d PrimeSMS_W -c "SELECT * FROM pg_stat_activity;"

# Application metrics  
curl http://localhost:3000/api/metrics
```

## 🔐 Security Hardening

### Container Security

```dockerfile
# Already implemented in Dockerfile:
# - Non-root user (primesms)
# - Minimal base image (alpine)
# - Security labels
# - Resource limits
```

### Network Security

```bash
# Firewall rules (example for ufw)
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS  
ufw deny 3000/tcp     # Block direct app access
ufw enable
```

### Database Security

```sql
-- Create app-specific user
CREATE USER primesms_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO primesms_app;

-- Remove default postgres user from production
```

## 📞 Support

### Health Check URLs
- Application: `https://yourdomain.com/healthz`
- Database: `https://yourdomain.com/api/health/db`
- Metrics: `https://yourdomain.com/api/metrics`
- Version: `https://yourdomain.com/version`

### Log Locations
- Application: `/app/logs/` (inside container)
- Database: Container logs via `docker-compose logs postgres`
- Redis: Container logs via `docker-compose logs redis`

### Quick Diagnosis

```bash
# Full system check
./deploy.sh --health-check

# Component status
docker-compose ps
docker-compose exec app curl http://localhost:3000/healthz
docker-compose exec postgres pg_isready
docker-compose exec redis redis-cli ping
```

---

## ✅ Production Deployment Verified

This deployment configuration has been optimized for:
- ✅ Docker and Docker Compose
- ✅ Coolify Platform  
- ✅ Kubernetes (with health checks)
- ✅ Manual server deployment
- ✅ High availability setup
- ✅ Integrated pricing system
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Comprehensive monitoring
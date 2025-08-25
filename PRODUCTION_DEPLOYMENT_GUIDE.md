# Prime SMS Production Deployment Guide - Custom Pricing System

## ✅ Production Ready Components

### 1. **Database Schema Updates** (Required First)
```sql
-- Run these migrations in production database:

-- Add pricing columns to user_business_info
ALTER TABLE user_business_info 
ADD COLUMN IF NOT EXISTS marketing_price DECIMAL(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utility_price DECIMAL(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS authentication_price DECIMAL(10,4) DEFAULT NULL;

-- Create global_pricing_defaults table
CREATE TABLE IF NOT EXISTS global_pricing_defaults (
  id SERIAL PRIMARY KEY,
  marketing_price DECIMAL(10,4) NOT NULL DEFAULT 0.80,
  utility_price DECIMAL(10,4) NOT NULL DEFAULT 0.15,
  authentication_price DECIMAL(10,4) NOT NULL DEFAULT 0.15,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default values
INSERT INTO global_pricing_defaults (marketing_price, utility_price, authentication_price, currency)
VALUES (0.80, 0.15, 0.15, 'INR')
ON CONFLICT DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_business_info_pricing 
ON user_business_info (user_id, marketing_price, utility_price, authentication_price);
```

### 2. **Server Components** ✅
- **Built**: `/server/dist/` (Production TypeScript compiled)
- **Pricing Service**: Dynamic user & global pricing with Decimal.js precision
- **API Endpoints**: 
  - `/api/admin/pricing/*` (Admin pricing management)
  - `/send/my-pricing` (User session-based pricing)
  - `/send/cost-preview` (Real-time cost estimates)
- **Credit System**: Uses custom pricing for all charges
- **Session Authentication**: Secure user context for pricing

### 3. **Client Components** ✅
- **Built**: `/server/client-build/` (Production Vite build)
- **Admin UI**: Complete pricing management interface
- **Quick Send**: Uses custom pricing via `/send/my-pricing`
- **CustomizeMessage**: Uses custom pricing via `/send/my-pricing`
- **Indian Rupee (₹)**: Proper currency display throughout

### 4. **API Integration** ✅
- **All Send APIs**: Use `calculateCreditCost()` with custom pricing
- **Credit Charging**: Charges based on user's custom rates
- **Cost Preview**: Real-time pricing for all templates
- **Fallback System**: Global defaults → Hardcoded fallbacks

## 🚀 Deployment Steps

### Step 1: Database Update
```bash
# Connect to production database
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME

# Run the migration scripts
\i /path/to/add_pricing_columns.sql
\i /path/to/create_global_pricing_defaults.sql
```

### Step 2: Deploy Application
- **Server**: `/server/dist/` is production ready
- **Client**: `/server/client-build/` is production ready
- **Environment**: Check `.env` variables are set correctly

### Step 3: Verify Deployment
```bash
# Run the validation script
chmod +x validate-deployment.sh
./validate-deployment.sh
```

## 📊 Custom Pricing Features

### Admin Interface
- **Global Defaults**: Set system-wide pricing for all message types
- **Per-User Custom**: Override prices for individual users
- **Real-time Preview**: See effective pricing immediately
- **Currency Support**: Full Indian Rupee (₹) display

### User Experience
- **Quick Send**: Shows custom pricing in cost preview modal
- **CustomizeMessage**: Displays user-specific pricing
- **API Integration**: All APIs respect custom pricing
- **Credit Charging**: Accurate charging based on custom rates

### Pricing Logic (Cascade)
1. **Custom User Pricing** (if set) → 
2. **Global Defaults** (if available) →
3. **Hardcoded Fallbacks** (₹0.80, ₹0.15, ₹0.15)

## 🔒 Security Features
- **Admin-only Access**: Pricing management restricted to admins
- **Session-based Auth**: User pricing via secure sessions
- **Input Validation**: Zod schemas for all pricing inputs
- **SQL Injection Protection**: Parameterized queries throughout

## 📈 Monitoring
- **Health Checks**: `/healthz` endpoint for container orchestration
- **Metrics**: `/api/metrics` for performance monitoring
- **Database Health**: `/api/health/db` for connectivity
- **Version Info**: `/version` for deployment tracking

## 🐛 Troubleshooting

### Common Issues:
1. **"Pricing columns don't exist"** → Run database migrations
2. **"User pricing not loading"** → Check session authentication
3. **"Default fallback pricing"** → Verify database has default values
4. **"Admin can't set pricing"** → Check admin role permissions

### Logs to Monitor:
```bash
# Server logs
tail -f /var/log/prime-sms/app.log | grep "PRICING"

# Database logs
tail -f /var/log/postgresql/postgresql.log | grep "pricing"
```

## ✅ Production Checklist
- [ ] Database migrations applied
- [ ] Server deployed and running
- [ ] Client-build served correctly
- [ ] Admin can set global defaults
- [ ] Admin can set user custom pricing
- [ ] Quick Send shows custom pricing
- [ ] CustomizeMessage shows custom pricing
- [ ] Credit charges use custom pricing
- [ ] All APIs return correct pricing
- [ ] Health checks pass
- [ ] Error handling works
- [ ] Fallback pricing works
- [ ] Session authentication secure

## 📞 Support
- **Database Issues**: Check migration scripts
- **API Issues**: Verify session authentication
- **UI Issues**: Check client-build deployment
- **Pricing Issues**: Review cascade logic

---
**Custom Pricing System is Production Ready** ✅
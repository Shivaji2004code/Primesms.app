# Prime SMS Pricing System Documentation

## Overview

The Prime SMS pricing system provides flexible per-message pricing for WhatsApp Business API messages with support for global defaults and per-user custom pricing. The system handles three message categories with precise decimal calculations and seamless billing integration.

## Features

- **Global Default Pricing**: Set default per-message rates for all users
- **Per-User Custom Pricing**: Override defaults for specific users
- **Message Categories**: Support for Marketing, Utility, and Authentication messages
- **Precise Decimal Calculations**: Up to 4 decimal places with proper rounding
- **Currency Support**: INR (Indian Rupee) with proper symbol display
- **Admin UI**: Complete admin interface for pricing management
- **API Integration**: RESTful API endpoints for all pricing operations

## Message Categories

| Category | Description | Typical Use Cases | Default Price |
|----------|-------------|-------------------|---------------|
| **Marketing** | Promotional and marketing messages | Promotions, newsletters, product announcements | ₹0.80 |
| **Utility** | Transactional and service messages | Order updates, shipping notifications, account alerts | ₹0.15 |
| **Authentication** | Security and verification messages | OTP codes, login verification, password resets | ₹0.15 |

## API Endpoints

### Global Pricing Defaults

#### Get Global Defaults
```http
GET /api/admin/pricing/defaults
Authorization: Admin Session Required
```

**Response:**
```json
{
  "success": true,
  "defaults": {
    "marketing": "0.80",
    "utility": "0.15",
    "authentication": "0.15",
    "currency": "INR"
  }
}
```

#### Update Global Defaults
```http
PUT /api/admin/pricing/defaults
Content-Type: application/json
Authorization: Admin Session Required

{
  "marketing": "0.85",
  "utility": "0.18",
  "authentication": "0.20"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Global pricing defaults updated successfully",
  "defaults": {
    "marketing": "0.85",
    "utility": "0.18",
    "authentication": "0.20",
    "currency": "INR"
  }
}
```

### Per-User Pricing

#### Get User Pricing
```http
GET /api/admin/pricing/users/{userId}/pricing
Authorization: Admin Session Required
```

**Response:**
```json
{
  "success": true,
  "userId": 42,
  "mode": "custom",
  "custom": {
    "marketing": "0.90",
    "utility": "0.20",
    "authentication": "0.22"
  },
  "effective": {
    "marketing": "0.90",
    "utility": "0.20",
    "authentication": "0.22",
    "currency": "INR"
  },
  "defaults": {
    "marketing": "0.85",
    "utility": "0.18",
    "authentication": "0.20"
  }
}
```

#### Update User Pricing - Custom Mode
```http
PUT /api/admin/pricing/users/{userId}/pricing
Content-Type: application/json
Authorization: Admin Session Required

{
  "mode": "custom",
  "pricing": {
    "marketing": "1.05",
    "utility": "0.25"
  }
}
```

#### Update User Pricing - Default Mode
```http
PUT /api/admin/pricing/users/{userId}/pricing
Content-Type: application/json
Authorization: Admin Session Required

{
  "mode": "default"
}
```

## Billing Integration

### Computing Message Charges

```typescript
import { computeMessageCharge, mapMetaCategory } from '../services/pricing.service';

// Example: Billing for a marketing campaign
const charge = await computeMessageCharge({
  userId: 42,
  category: 'marketing',
  recipientsCount: 150
});

console.log(charge);
// Output:
// {
//   unitPrice: "1.05",
//   totalPrice: "157.50",
//   currency: "INR",
//   pricingMode: "custom"
// }
```

### Message Log Integration

When logging messages, include the billing information:

```typescript
// In your message sending pipeline
const billing = await computeMessageCharge({
  userId: message.userId,
  category: mapMetaCategory(template.category), // Maps Meta categories to internal
  recipientsCount: recipients.length
});

// Store in message log
await logMessage({
  ...messageData,
  billing: {
    category: billing.category,
    unitPrice: billing.unitPrice,
    totalPrice: billing.totalPrice,
    currency: billing.currency,
    pricingMode: billing.pricingMode
  }
});
```

### Category Mapping

The system automatically maps WhatsApp Meta categories to internal categories:

```typescript
import { mapMetaCategory } from '../services/pricing.service';

// Maps various Meta categories to internal categories
mapMetaCategory('MARKETING'); // → 'marketing'
mapMetaCategory('promotional'); // → 'marketing'
mapMetaCategory('UTILITY'); // → 'utility'
mapMetaCategory('transactional'); // → 'utility'
mapMetaCategory('AUTHENTICATION'); // → 'authentication'
mapMetaCategory('otp'); // → 'authentication'
mapMetaCategory('unknown'); // → 'utility' (default)
```

## Admin UI Navigation

### Accessing Pricing Features

1. **Global Pricing Management**: 
   - Navigate to **Admin Dashboard → Pricing Management**
   - URL: `/admin/pricing`

2. **Per-User Pricing**:
   - Navigate to **Admin Dashboard → User Management → [Select User] → Settings → Pricing Tab**
   - URL: `/admin/users/{userId}/settings` (Pricing tab)

### Pricing Management Workflow

1. **Set Global Defaults**:
   - Go to Pricing Management page
   - Update Marketing, Utility, and Authentication prices
   - Save changes (affects all users without custom pricing)

2. **Configure Custom User Pricing**:
   - Select user from User Management
   - Open Settings → Pricing tab
   - Toggle "Use Custom Pricing"
   - Set specific rates for the user
   - Save changes

3. **Revert to Defaults**:
   - In user's Pricing tab
   - Click "Revert to Defaults" button
   - Confirm the action

## Validation Rules

### Price Format
- **Format**: Decimal number with up to 4 decimal places
- **Range**: Non-negative values (≥ 0)
- **Examples**: 
  - ✅ `0.15`, `1.2345`, `10`, `0.0001`
  - ❌ `-0.15`, `1.23456`, `abc`, `1.2.3`

### API Validation
- All price fields are validated server-side
- Invalid prices return 400 Bad Request with detailed error messages
- Partial updates are supported (only update provided fields)

## Environment Configuration

Add these optional environment variables to configure default pricing:

```bash
# .env file
PRICING_CURRENCY=INR
PRICING_DEFAULT_MARKETING=0.80
PRICING_DEFAULT_UTILITY=0.15
PRICING_DEFAULT_AUTHENTICATION=0.15
```

## Database Schema

The pricing system uses existing tables:

### user_business_info table
```sql
-- Pricing columns (already exist)
marketing_price VARCHAR(10) DEFAULT NULL,
utility_price VARCHAR(10) DEFAULT NULL,
authentication_price VARCHAR(10) DEFAULT NULL
```

### settings table
```sql
-- Global defaults stored as JSON
INSERT INTO settings (key, value, description) VALUES 
('pricing_marketing', '{"price": "0.80"}', 'Global default marketing price per message'),
('pricing_utility', '{"price": "0.15"}', 'Global default utility price per message'),
('pricing_authentication', '{"price": "0.15"}', 'Global default authentication price per message');
```

## Coolify Deployment Notes

The application is fully Coolify-ready with:

- **Health Endpoints**: `/healthz` for container health checks
- **Static Serving**: Client build served from `/client-build`
- **Docker Configuration**: Multi-stage build with Node 20 Alpine
- **Environment Variables**: Configurable via Coolify environment settings
- **Port Configuration**: Defaults to 3000, configurable via `PORT` env var

### Deployment Steps
1. Set environment variables in Coolify
2. Deploy using the provided Dockerfile
3. Access admin pricing features at `/admin/pricing`

## Error Handling

The system provides comprehensive error handling:

### Common Error Responses

```json
// Validation Error
{
  "success": false,
  "error": "Invalid request data",
  "details": [
    {
      "field": "marketing",
      "message": "Price must be a valid decimal with up to 4 decimal places"
    }
  ]
}

// User Not Found
{
  "success": false,
  "error": "User not found"
}

// Server Error
{
  "success": false,
  "error": "Failed to update pricing defaults"
}
```

## Security

- All pricing endpoints require admin authentication
- Input validation prevents SQL injection
- Decimal.js library prevents floating-point precision issues
- Audit logging for pricing changes (stored in admin_actions table)

## Future Enhancements

Potential future features:
- Bulk pricing updates for multiple users
- Pricing analytics and usage reports
- Time-based pricing (different rates by hour/day)
- Volume discounts (tiered pricing)
- Currency conversion support
- Pricing history and change logs

## Support

For questions or issues:
1. Check server logs for detailed error messages
2. Verify database connectivity and table structure
3. Ensure admin authentication is working
4. Review API endpoint responses for validation errors

## License

Part of the Prime SMS application suite.
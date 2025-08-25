import Decimal from 'decimal.js';
import pool from '../db';
import { logger } from '../utils/logger';

// Configure Decimal.js for precision (4 decimal places max)
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 9e15,
  toExpNeg: -7,
  maxE: 9e15,
  minE: -9e15,
  modulo: Decimal.ROUND_DOWN,
  crypto: false
});

// Types for pricing system
export interface PricingDefaults {
  marketing: string;
  utility: string;
  authentication: string;
  currency: string;
}

export interface UserPricingCustom {
  marketing?: string;
  utility?: string;
  authentication?: string;
}

export interface UserPricingResponse {
  userId: number;
  mode: 'custom' | 'default';
  custom: UserPricingCustom;
  effective: PricingDefaults;
  defaults: Omit<PricingDefaults, 'currency'>;
}

export interface MessageCharge {
  unitPrice: string;
  totalPrice: string;
  currency: string;
  pricingMode: 'custom' | 'default';
}

// Hardcoded fallback prices (in INR)
const FALLBACK_PRICES: Omit<PricingDefaults, 'currency'> = {
  marketing: '0.80',
  utility: '0.15',
  authentication: '0.15'
};

// Price validation helper
function validatePrice(price: string | number | undefined | null): string | null {
  if (price === undefined || price === null || price === '') {
    return null;
  }

  try {
    const decimal = new Decimal(price);
    
    // Check if non-negative
    if (decimal.isNegative()) {
      throw new Error('Price cannot be negative');
    }

    // Check decimal places (max 4)
    const decimalPlaces = decimal.decimalPlaces();
    if (decimalPlaces > 4) {
      throw new Error('Price cannot have more than 4 decimal places');
    }

    return decimal.toFixed();
  } catch (error) {
    throw new Error(`Invalid price format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Format price for display (2 decimal places)
function formatPriceForDisplay(price: string): string {
  try {
    const decimal = new Decimal(price);
    return decimal.toFixed(2);
  } catch (error) {
    return price; // fallback to original if parsing fails
  }
}

/**
 * Get global default pricing settings
 */
export async function getGlobalDefaults(): Promise<PricingDefaults> {
  try {
    const result = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('pricing_marketing', 'pricing_utility', 'pricing_authentication')`
    );

    const settings: { [key: string]: string } = {};
    result.rows.forEach(row => {
      try {
        const parsed = JSON.parse(row.value);
        settings[row.key] = typeof parsed === 'string' ? parsed : parsed.price;
      } catch (error) {
        logger.warn(`Failed to parse pricing setting ${row.key}:`, error);
      }
    });

    return {
      marketing: formatPriceForDisplay(settings.pricing_marketing || FALLBACK_PRICES.marketing),
      utility: formatPriceForDisplay(settings.pricing_utility || FALLBACK_PRICES.utility),
      authentication: formatPriceForDisplay(settings.pricing_authentication || FALLBACK_PRICES.authentication),
      currency: 'INR'
    };
  } catch (error) {
    logger.error('Failed to get global defaults:', error);
    return {
      marketing: formatPriceForDisplay(FALLBACK_PRICES.marketing),
      utility: formatPriceForDisplay(FALLBACK_PRICES.utility),
      authentication: formatPriceForDisplay(FALLBACK_PRICES.authentication),
      currency: 'INR'
    };
  }
}

/**
 * Update global default pricing settings (partial update allowed)
 */
export async function updateGlobalDefaults(updates: Partial<Omit<PricingDefaults, 'currency'>>): Promise<PricingDefaults> {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Validate and update each provided price
      for (const [category, price] of Object.entries(updates)) {
        if (price !== undefined) {
          const validatedPrice = validatePrice(price);
          if (validatedPrice === null) {
            throw new Error(`Invalid price for ${category}`);
          }

          const settingKey = `pricing_${category}`;
          const settingValue = JSON.stringify({ price: validatedPrice });
          
          // Upsert the setting
          await client.query(
            `INSERT INTO settings (key, value, description, updated_at) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET 
               value = EXCLUDED.value,
               updated_at = CURRENT_TIMESTAMP`,
            [settingKey, settingValue, `Global default ${category} price per message`]
          );

          logger.info(`Updated global ${category} price to ${validatedPrice} INR`);
        }
      }

      await client.query('COMMIT');
      
      // Return updated defaults
      return await getGlobalDefaults();
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update global defaults:', error);
    throw new Error('Failed to update global pricing defaults');
  }
}

/**
 * Get user-specific pricing (returns mode, custom, effective, defaults)
 */
export async function getUserPricing(userId: number): Promise<UserPricingResponse> {
  try {
    // Get user's custom pricing from user_business_info
    const userResult = await pool.query(
      'SELECT marketing_price, utility_price, authentication_price FROM user_business_info WHERE user_id = $1',
      [userId]
    );

    // Get global defaults
    const defaults = await getGlobalDefaults();

    let custom: UserPricingCustom = {};
    let hasCustomPricing = false;

    if (userResult.rows.length > 0) {
      const userRow = userResult.rows[0];
      
      if (userRow.marketing_price) {
        custom.marketing = formatPriceForDisplay(userRow.marketing_price);
        hasCustomPricing = true;
      }
      if (userRow.utility_price) {
        custom.utility = formatPriceForDisplay(userRow.utility_price);
        hasCustomPricing = true;
      }
      if (userRow.authentication_price) {
        custom.authentication = formatPriceForDisplay(userRow.authentication_price);
        hasCustomPricing = true;
      }
    }

    // Calculate effective pricing (custom overrides defaults)
    const effective: PricingDefaults = {
      marketing: custom.marketing || defaults.marketing,
      utility: custom.utility || defaults.utility,
      authentication: custom.authentication || defaults.authentication,
      currency: 'INR'
    };

    return {
      userId,
      mode: hasCustomPricing ? 'custom' : 'default',
      custom,
      effective,
      defaults: {
        marketing: defaults.marketing,
        utility: defaults.utility,
        authentication: defaults.authentication
      }
    };
  } catch (error) {
    logger.error(`Failed to get user pricing for user ${userId}:`, error);
    throw new Error('Failed to retrieve user pricing information');
  }
}

/**
 * Update user-specific pricing
 */
export async function updateUserPricing(
  userId: number, 
  mode: 'custom' | 'default', 
  pricing?: UserPricingCustom
): Promise<UserPricingResponse> {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }

      // Ensure user_business_info record exists
      const businessInfoCheck = await client.query(
        'SELECT user_id FROM user_business_info WHERE user_id = $1',
        [userId]
      );

      if (businessInfoCheck.rows.length === 0) {
        // Create a basic user_business_info record
        await client.query(
          `INSERT INTO user_business_info (user_id, business_name, is_active, created_at, updated_at)
           VALUES ($1, 'Default Business', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userId]
        );
        logger.info(`Created user_business_info record for user ${userId}`);
      }

      if (mode === 'default') {
        // Clear all custom pricing (revert to defaults)
        await client.query(
          `UPDATE user_business_info 
           SET marketing_price = NULL, utility_price = NULL, authentication_price = NULL, updated_at_new = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [userId]
        );
        logger.info(`Cleared custom pricing for user ${userId} - reverted to defaults`);
      } else if (mode === 'custom' && pricing) {
        // Validate and update custom pricing (partial updates allowed)
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramCount = 1;

        if (pricing.marketing !== undefined) {
          const validatedPrice = validatePrice(pricing.marketing);
          if (validatedPrice !== null) {
            updateFields.push(`marketing_price = $${paramCount++}`);
            updateValues.push(validatedPrice);
          }
        }

        if (pricing.utility !== undefined) {
          const validatedPrice = validatePrice(pricing.utility);
          if (validatedPrice !== null) {
            updateFields.push(`utility_price = $${paramCount++}`);
            updateValues.push(validatedPrice);
          }
        }

        if (pricing.authentication !== undefined) {
          const validatedPrice = validatePrice(pricing.authentication);
          if (validatedPrice !== null) {
            updateFields.push(`authentication_price = $${paramCount++}`);
            updateValues.push(validatedPrice);
          }
        }

        if (updateFields.length > 0) {
          updateFields.push(`updated_at_new = CURRENT_TIMESTAMP`);
          updateValues.push(userId);

          await client.query(
            `UPDATE user_business_info SET ${updateFields.join(', ')} WHERE user_id = $${paramCount}`,
            updateValues
          );

          logger.info(`Updated custom pricing for user ${userId}: ${JSON.stringify(pricing)}`);
        }
      }

      await client.query('COMMIT');
      
      // Return updated user pricing
      return await getUserPricing(userId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Failed to update user pricing for user ${userId}:`, error);
    throw new Error('Failed to update user pricing information');
  }
}

/**
 * Compute message charge for billing
 */
export async function computeMessageCharge(params: {
  userId: number;
  category: 'marketing' | 'utility' | 'authentication';
  recipientsCount: number;
}): Promise<MessageCharge> {
  try {
    const { userId, category, recipientsCount } = params;

    if (recipientsCount < 0) {
      throw new Error('Recipients count cannot be negative');
    }

    // Get user's effective pricing
    const userPricing = await getUserPricing(userId);
    const unitPriceStr = userPricing.effective[category];
    
    // Calculate total using decimal arithmetic
    const unitPrice = new Decimal(unitPriceStr);
    const totalPrice = unitPrice.mul(recipientsCount);

    return {
      unitPrice: formatPriceForDisplay(unitPrice.toFixed()),
      totalPrice: formatPriceForDisplay(totalPrice.toFixed()),
      currency: 'INR',
      pricingMode: userPricing.mode
    };
  } catch (error) {
    logger.error('Failed to compute message charge:', error);
    throw new Error('Failed to compute message charge');
  }
}

/**
 * Map WhatsApp Meta category to internal category
 */
export function mapMetaCategory(metaCategory?: string): 'marketing' | 'utility' | 'authentication' {
  if (!metaCategory) {
    return 'utility'; // default fallback
  }

  const category = metaCategory.toLowerCase();
  
  if (category.includes('marketing') || category.includes('promotional')) {
    return 'marketing';
  } else if (category.includes('authentication') || category.includes('auth') || category.includes('otp')) {
    return 'authentication';
  } else {
    return 'utility'; // utility is the default for transactional messages
  }
}

/**
 * Settings service stubs for integration
 */
export class SettingsService {
  static async get(key: string): Promise<any> {
    try {
      const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
      if (result.rows.length === 0) {
        return null;
      }
      return JSON.parse(result.rows[0].value);
    } catch (error) {
      logger.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  }

  static async set(key: string, value: any, description?: string): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await pool.query(
        `INSERT INTO settings (key, value, description, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET 
           value = EXCLUDED.value,
           updated_at = CURRENT_TIMESTAMP`,
        [key, jsonValue, description || '']
      );
    } catch (error) {
      logger.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }
}

/**
 * User Business Info Repository stubs
 */
export class UserBusinessInfoRepo {
  static async findByUserId(userId: number): Promise<any> {
    try {
      const result = await pool.query(
        'SELECT * FROM user_business_info WHERE user_id = $1',
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Failed to find business info for user ${userId}:`, error);
      return null;
    }
  }

  static async updatePricing(userId: number, pricing: UserPricingCustom): Promise<void> {
    try {
      await pool.query(
        `UPDATE user_business_info 
         SET marketing_price = $2, utility_price = $3, authentication_price = $4, updated_at_new = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, pricing.marketing, pricing.utility, pricing.authentication]
      );
    } catch (error) {
      logger.error(`Failed to update pricing for user ${userId}:`, error);
      throw error;
    }
  }
}
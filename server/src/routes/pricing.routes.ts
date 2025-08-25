import express from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth';
import { 
  getGlobalDefaults, 
  updateGlobalDefaults, 
  getUserPricing, 
  updateUserPricing,
  PricingDefaults,
  UserPricingCustom
} from '../services/pricing.service';
import { logger } from '../utils/logger';

const router = express.Router();

// All pricing routes require admin authentication
router.use(requireAdmin);

// Validation schemas
const PriceSchema = z.string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Price must be a valid decimal with up to 4 decimal places')
  .refine((val) => {
    const num = parseFloat(val);
    return num >= 0;
  }, 'Price must be non-negative');

const UpdateDefaultsSchema = z.object({
  marketing: PriceSchema.optional(),
  utility: PriceSchema.optional(),
  authentication: PriceSchema.optional()
}).strict();

const UpdateUserPricingSchema = z.object({
  mode: z.enum(['default', 'custom']),
  pricing: z.object({
    marketing: PriceSchema.optional(),
    utility: PriceSchema.optional(),
    authentication: PriceSchema.optional()
  }).optional()
}).strict();

/**
 * GET /admin/pricing/defaults
 * Get global default pricing settings
 */
router.get('/defaults', async (req, res) => {
  try {
    const defaults = await getGlobalDefaults();
    
    res.json({
      success: true,
      defaults
    });
  } catch (error) {
    logger.error('Get pricing defaults error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pricing defaults'
    });
  }
});

/**
 * PUT /admin/pricing/defaults
 * Update global default pricing settings (partial update allowed)
 */
router.put('/defaults', async (req, res) => {
  try {
    // Validate request body
    const validation = UpdateDefaultsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const updates = validation.data;

    // Ensure at least one field is provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one pricing field must be provided'
      });
    }

    const updatedDefaults = await updateGlobalDefaults(updates);

    res.json({
      success: true,
      message: 'Global pricing defaults updated successfully',
      defaults: updatedDefaults
    });
  } catch (error) {
    logger.error('Update pricing defaults error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid price')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update pricing defaults'
    });
  }
});

/**
 * GET /admin/users/:userId/pricing
 * Get user-specific pricing information
 */
router.get('/users/:userId/pricing', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const userPricing = await getUserPricing(userId);

    res.json({
      success: true,
      ...userPricing
    });
  } catch (error) {
    logger.error(`Get user pricing error for user ${req.params.userId}:`, error);
    
    if (error instanceof Error && error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user pricing information'
    });
  }
});

/**
 * PUT /admin/users/:userId/pricing
 * Update user-specific pricing settings
 */
router.put('/users/:userId/pricing', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Validate request body
    const validation = UpdateUserPricingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const { mode, pricing } = validation.data;

    // For custom mode, pricing object is required
    if (mode === 'custom' && !pricing) {
      return res.status(400).json({
        success: false,
        error: 'Pricing information is required when mode is "custom"'
      });
    }

    // For custom mode, at least one price must be provided
    if (mode === 'custom' && pricing && Object.keys(pricing).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one pricing field must be provided in custom mode'
      });
    }

    const updatedUserPricing = await updateUserPricing(userId, mode, pricing);

    res.json({
      success: true,
      message: mode === 'default' 
        ? 'User pricing reverted to defaults' 
        : 'User pricing updated successfully',
      ...updatedUserPricing
    });
  } catch (error) {
    logger.error(`Update user pricing error for user ${req.params.userId}:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      if (error.message.includes('Invalid price')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update user pricing information'
    });
  }
});

export default router;
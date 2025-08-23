// WhatsApp 360dialog Settings API Routes
import { Router, Request, Response } from 'express';
import pool from '../db';
import { logger } from '../utils/logger';

const router = Router();

// Types for 360dialog settings
interface WhatsAppSettings360Dialog {
  userId: string;
  businessName: string;
  whatsappNumber: string;
  provider: '360dialog';
  channelId: string | null;
  apiKey: string | null;
  webhookUrl: string;
  updatedAt: string;
}

interface SaveWhatsAppSettingsRequest {
  channelId: string;
  apiKey?: string;
  providerMeta?: Record<string, unknown> | null;
}

/**
 * GET /api/admin/whatsapp/settings/:userId - Get 360dialog settings for a user
 */
router.get('/settings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const client = await pool.connect();
    try {
      // Get user business info with 360dialog settings
      const result = await client.query(`
        SELECT 
          u.id as user_id,
          u.name as business_name,
          ubi.whatsapp_number,
          ubi.provider,
          ubi.channel_id,
          CASE WHEN ubi.api_key IS NOT NULL AND LENGTH(ubi.api_key) > 0 
               THEN true ELSE false END as api_key_set,
          ubi.webhook_url,
          ubi.updated_at
        FROM users u
        LEFT JOIN user_business_info ubi ON u.id = ubi.user_id AND ubi.is_active = true
        WHERE u.id = $1
      `, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const row = result.rows[0];
      
      // Build webhook URL - adjust domain as needed
      const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://primesms.app';
      const webhookUrl = `${baseUrl}/webhooks/360dialog`;
      
      const settings: WhatsAppSettings360Dialog = {
        userId: row.user_id,
        businessName: row.business_name || 'Unknown Business',
        whatsappNumber: row.whatsapp_number || 'Not configured',
        provider: '360dialog',
        channelId: row.channel_id,
        apiKey: null, // Never return the actual API key
        webhookUrl,
        updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString()
      };
      
      // Return with apiKeySet flag instead of actual key
      res.json({
        ...settings,
        apiKeySet: row.api_key_set
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get WhatsApp settings:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp settings' });
  }
});

/**
 * PUT /api/admin/whatsapp/settings/:userId - Update 360dialog settings
 */
router.put('/settings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { channelId, apiKey, providerMeta }: SaveWhatsAppSettingsRequest = req.body;
    
    // Validation
    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({ error: 'channelId is required' });
    }
    
    // Validate channelId format
    const channelIdRegex = /^[A-Za-z0-9._-]+$/;
    if (!channelIdRegex.test(channelId) || channelId.length < 2 || channelId.length > 128) {
      return res.status(400).json({ 
        error: 'channelId must be 2-128 characters and contain only letters, numbers, dots, underscores, and hyphens' 
      });
    }
    
    // Validate API key if provided
    if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
      if (typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 4096) {
        return res.status(400).json({ 
          error: 'apiKey must be between 10 and 4096 characters when provided' 
        });
      }
      
      if (apiKey !== apiKey.trim()) {
        return res.status(400).json({ 
          error: 'apiKey cannot have leading or trailing spaces' 
        });
      }
    }
    
    const client = await pool.connect();
    try {
      // Check if user exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Build update query - only update API key if provided
      let updateQuery = `
        INSERT INTO user_business_info (
          user_id, provider, channel_id, api_key, provider_meta, updated_at, is_active
        ) VALUES (
          $1, '360dialog', $2, $3, $4, CURRENT_TIMESTAMP, true
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
          provider = '360dialog',
          channel_id = EXCLUDED.channel_id,
          ${apiKey ? 'api_key = EXCLUDED.api_key,' : ''}
          provider_meta = EXCLUDED.provider_meta,
          updated_at = CURRENT_TIMESTAMP,
          is_active = true
      `;
      
      const params = [
        userId,
        channelId.trim(),
        apiKey ? apiKey.trim() : null,
        providerMeta ? JSON.stringify(providerMeta) : null
      ];
      
      await client.query(updateQuery, params);
      
      // Get updated record
      const updatedResult = await client.query(`
        SELECT 
          channel_id,
          CASE WHEN api_key IS NOT NULL AND LENGTH(api_key) > 0 
               THEN true ELSE false END as api_key_set,
          updated_at
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
      
      const updatedRow = updatedResult.rows[0];
      
      logger.info(`360dialog settings updated for user ${userId}`, {
        channelId: channelId,
        apiKeyUpdated: Boolean(apiKey),
        hasApiKey: updatedRow.api_key_set
      });
      
      res.json({
        success: true,
        updatedAt: updatedRow.updated_at.toISOString(),
        apiKeySet: updatedRow.api_key_set,
        channelId: updatedRow.channel_id
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update WhatsApp settings:', error);
    
    // Check for unique constraint violations
    if (error instanceof Error && error.message.includes('unique')) {
      return res.status(409).json({ error: 'Settings conflict - please try again' });
    }
    
    res.status(500).json({ error: 'Failed to update WhatsApp settings' });
  }
});

/**
 * GET /api/admin/whatsapp/health - Test 360dialog connection
 */
router.get('/health/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT channel_id, api_key, provider
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true AND provider = '360dialog'
      `, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '360dialog settings not configured' });
      }
      
      const { channel_id, api_key } = result.rows[0];
      
      if (!channel_id || !api_key) {
        return res.status(400).json({ 
          error: 'Incomplete 360dialog configuration',
          missing: {
            channelId: !channel_id,
            apiKey: !api_key
          }
        });
      }
      
      // TODO: Add actual 360dialog API health check here
      // For now, just return configuration status
      
      res.json({
        status: 'configured',
        channelId: channel_id,
        hasApiKey: Boolean(api_key),
        provider: '360dialog',
        message: 'Settings configured successfully'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to check 360dialog health:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * POST /api/admin/whatsapp/test-send/:userId - Test message sending
 */
router.post('/test-send/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Both "to" and "message" fields are required' });
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT channel_id, api_key
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true AND provider = '360dialog'
      `, [userId]);
      
      if (result.rows.length === 0 || !result.rows[0].channel_id || !result.rows[0].api_key) {
        return res.status(400).json({ error: '360dialog not properly configured' });
      }
      
      // TODO: Implement actual 360dialog API call here
      // For now, return success simulation
      
      logger.info(`Test message requested for user ${userId}`, {
        to: to,
        messageLength: message.length
      });
      
      res.json({
        success: true,
        messageId: `test_${Date.now()}`,
        message: 'Test message queued (simulation)',
        timestamp: new Date().toISOString()
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to send test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

export default router;
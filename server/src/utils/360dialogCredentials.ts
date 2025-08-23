// 360dialog Credentials Resolver
// Retrieves API keys from user_business_info table for 360dialog integration
import pool from '../db';
import { logger } from './logger';
import type { Resolve360Credentials } from '../services/wa360Sender';

/**
 * Resolve 360dialog API credentials from database
 * Used with wa360Sender to fetch user's API key
 */
export const resolve360DialogCredentials: Resolve360Credentials = async (userId: string) => {
  try {
    // Query user's 360dialog API key from database
    const query = `
      SELECT api_key
      FROM user_business_info 
      WHERE user_id = $1 
        AND provider = '360dialog' 
        AND is_active = true
        AND api_key IS NOT NULL 
        AND LENGTH(TRIM(api_key)) > 0
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      logger.warn('[360DIALOG] No active API key found for user', { userId });
      throw new Error(`No active 360dialog API key found for user ${userId}`);
    }
    
    const apiKey = result.rows[0].api_key;
    
    if (!apiKey || apiKey.trim().length === 0) {
      logger.warn('[360DIALOG] Empty API key found for user', { userId });
      throw new Error(`Empty 360dialog API key for user ${userId}`);
    }
    
    // API key is stored as plaintext in the database (as per migration)
    return { apiKey: apiKey.trim() };
    
  } catch (error) {
    logger.error('[360DIALOG] Failed to resolve credentials', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

/**
 * Test function to validate that a user has valid 360dialog credentials
 * Useful for setup validation
 */
export async function validate360DialogSetup(userId: string): Promise<{
  isValid: boolean;
  hasApiKey: boolean;
  hasChannelId: boolean;
  provider: string | null;
  error?: string;
}> {
  try {
    const query = `
      SELECT 
        provider,
        channel_id,
        api_key,
        is_active
      FROM user_business_info 
      WHERE user_id = $1 AND provider = '360dialog'
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return {
        isValid: false,
        hasApiKey: false,
        hasChannelId: false,
        provider: null,
        error: 'No 360dialog configuration found'
      };
    }
    
    const row = result.rows[0];
    const hasApiKey = !!(row.api_key && row.api_key.trim().length > 0);
    const hasChannelId = !!(row.channel_id && row.channel_id.trim().length > 0);
    const isActive = row.is_active;
    
    return {
      isValid: hasApiKey && hasChannelId && isActive,
      hasApiKey,
      hasChannelId,
      provider: row.provider,
      error: !isActive ? 'Account is inactive' : 
             !hasApiKey ? 'API key not configured' :
             !hasChannelId ? 'Channel ID not configured' : undefined
    };
    
  } catch (error) {
    logger.error('[360DIALOG] Failed to validate setup', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      isValid: false,
      hasApiKey: false,
      hasChannelId: false,
      provider: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user's 360dialog configuration for admin/debug purposes
 * Returns safe information (no API key)
 */
export async function get360DialogConfig(userId: string): Promise<{
  userId: string;
  provider: string | null;
  channelId: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  webhookUrl: string | null;
  updatedAt: Date | null;
} | null> {
  try {
    const query = `
      SELECT 
        provider,
        channel_id,
        CASE WHEN api_key IS NOT NULL AND LENGTH(TRIM(api_key)) > 0 
             THEN true ELSE false END as has_api_key,
        is_active,
        webhook_url,
        updated_at_new as updated_at
      FROM user_business_info 
      WHERE user_id = $1 AND provider = '360dialog'
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      userId,
      provider: row.provider,
      channelId: row.channel_id,
      hasApiKey: row.has_api_key,
      isActive: row.is_active,
      webhookUrl: row.webhook_url,
      updatedAt: row.updated_at
    };
    
  } catch (error) {
    logger.error('[360DIALOG] Failed to get config', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
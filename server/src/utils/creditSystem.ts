// [Claude AI] Credit System Enhancement — Aug 2025
import pool from '../db';
import { getUserPricing, mapMetaCategory, type UserPricingResponse } from '../services/pricing.service';
import { validatePhoneNumber } from './sendApiHelpers';

// Fallback credit deduction rates by template category (in Rupees) - used when pricing service fails
export const CREDIT_RATES = {
  MARKETING: 0.80,
  UTILITY: 0.15,
  AUTHENTICATION: 0.15
} as const;

export type TemplateCategory = keyof typeof CREDIT_RATES;

// Credit transaction types
export enum CreditTransactionType {
  DEDUCTION_QUICKSEND = 'DEDUCTION_QUICKSEND',
  DEDUCTION_CUSTOMISE_SMS = 'DEDUCTION_CUSTOMISE_SMS', 
  DEDUCTION_API_DELIVERED = 'DEDUCTION_API_DELIVERED',
  DEDUCTION_DUPLICATE_BLOCKED = 'DEDUCTION_DUPLICATE_BLOCKED',
  ADMIN_ADD = 'ADMIN_ADD',
  ADMIN_DEDUCT = 'ADMIN_DEDUCT',
  REFUND = 'REFUND'
}

interface CreditTransaction {
  userId: string;
  amount: number;
  transactionType: CreditTransactionType;
  templateCategory?: TemplateCategory;
  templateName?: string;
  messageId?: string;
  campaignId?: string;
  description?: string;
}

/**
 * Get the credit rate for a template category (fallback function)
 * @deprecated Use getPricingForUser() instead for dynamic pricing
 */
export function getCreditRate(category: TemplateCategory): number {
  return CREDIT_RATES[category];
}

/**
 * Get user-specific pricing for a template category
 */
export async function getPricingForUser(
  userId: number,
  category: 'marketing' | 'utility' | 'authentication'
): Promise<number> {
  try {
    const userPricing = await getUserPricing(userId);
    const priceString = userPricing.effective[category];
    return parseFloat(priceString);
  } catch (error) {
    console.error(`Failed to get user pricing for user ${userId}, category ${category}:`, error);
    // Fallback to hardcoded rates
    const templateCategory = category.toUpperCase() as TemplateCategory;
    return CREDIT_RATES[templateCategory];
  }
}

/**
 * Check if user has sufficient credit balance
 */
export async function checkSufficientCredits(
  userId: string, 
  requiredAmount: number
): Promise<{ sufficient: boolean; currentBalance: number }> {
  const result = await pool.query(
    'SELECT credit_balance FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  const currentBalance = result.rows[0].credit_balance;
  return {
    sufficient: currentBalance >= requiredAmount,
    currentBalance
  };
}

/**
 * Deduct credits from user account with transaction logging
 */
export async function deductCredits(transaction: CreditTransaction): Promise<{
  success: boolean;
  newBalance: number;
  transactionId?: string;
}> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check current balance
    const balanceResult = await client.query(
      'SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE',
      [transaction.userId]
    );
    
    if (balanceResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const currentBalance = balanceResult.rows[0].credit_balance;
    
    // Check if sufficient credits
    if (currentBalance < transaction.amount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        newBalance: currentBalance
      };
    }
    
    // Deduct credits
    const newBalance = Math.round((currentBalance - transaction.amount) * 100) / 100; // Round to 2 decimal places
    await client.query(
      'UPDATE users SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, transaction.userId]
    );
    
    // Log the transaction
    const transactionResult = await client.query(
      `INSERT INTO credit_transactions 
       (user_id, amount, transaction_type, template_category, template_name, 
        message_id, campaign_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        transaction.userId,
        -transaction.amount, // Negative for deduction
        transaction.transactionType,
        transaction.templateCategory,
        transaction.templateName,
        transaction.messageId,
        transaction.campaignId,
        transaction.description || `Credit deduction for ${transaction.transactionType}`
      ]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      newBalance,
      transactionId: transactionResult.rows[0].id
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Credit deduction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add credits to user account (for admin use)
 */
export async function addCredits(transaction: CreditTransaction): Promise<{
  success: boolean;
  newBalance: number;
  transactionId?: string;
}> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current balance
    const balanceResult = await client.query(
      'SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE',
      [transaction.userId]
    );
    
    if (balanceResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const currentBalance = balanceResult.rows[0].credit_balance;
    
    // Add credits
    const newBalance = Math.round((currentBalance + transaction.amount) * 100) / 100; // Round to 2 decimal places
    await client.query(
      'UPDATE users SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, transaction.userId]
    );
    
    // Log the transaction
    const transactionResult = await client.query(
      `INSERT INTO credit_transactions 
       (user_id, amount, transaction_type, template_category, template_name, 
        message_id, campaign_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        transaction.userId,
        transaction.amount, // Positive for addition
        transaction.transactionType,
        transaction.templateCategory,
        transaction.templateName,
        transaction.messageId,
        transaction.campaignId,
        transaction.description || `Credit addition: ${transaction.transactionType}`
      ]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      newBalance,
      transactionId: transactionResult.rows[0].id
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Credit addition error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get template category from template name
 */
export async function getTemplateCategory(
  userId: string, 
  templateName: string
): Promise<TemplateCategory | null> {
  try {
    console.log(`💰 DEBUG CREDIT: Getting template category for userId: ${userId}, templateName: "${templateName}"`);
    
    // First, check if template exists with more detailed query
    const result = await pool.query(
      'SELECT category, status FROM templates WHERE user_id = $1 AND name = $2',
      [userId, templateName]
    );
    
    console.log(`💰 DEBUG CREDIT: Template query result:`, {
      rowCount: result.rows.length,
      category: result.rows[0]?.category,
      status: result.rows[0]?.status
    });
    
    if (result.rows.length === 0) {
      console.log(`❌ DEBUG CREDIT: Template not found for user ${userId}, template "${templateName}"`);
      
      // Show available templates for debugging
      const availableTemplates = await pool.query(
        'SELECT name, category, status FROM templates WHERE user_id = $1 AND status IN (\'APPROVED\', \'ACTIVE\') ORDER BY name',
        [userId]
      );
      
      console.log(`💡 DEBUG CREDIT: Available approved templates for user:`, 
        availableTemplates.rows.map(t => `${t.name} (${t.category})`).join(', ')
      );
      
      return null;
    }
    
    const template = result.rows[0];
    const category = template.category as TemplateCategory;
    
    // Check if template is in a usable status
    if (!['APPROVED', 'ACTIVE'].includes(template.status)) {
      console.log(`❌ DEBUG CREDIT: Template "${templateName}" found but status is "${template.status}" (not usable)`);
      return null;
    }
    
    console.log(`✅ DEBUG CREDIT: Template category found: ${category} (status: ${template.status})`);
    
    return category;
  } catch (error: any) {
    console.error(`❌ DEBUG CREDIT: Database error in getTemplateCategory:`, {
      error: error.message,
      code: error.code,
      userId,
      templateName,
      stack: error.stack
    });
    throw new Error(`Failed to get template category: ${error.message}`);
  }
}

/**
 * Calculate credit cost for sending messages using a template
 */
export async function calculateCreditCost(
  userId: string,
  templateName: string,
  messageCount: number = 1
): Promise<{ cost: number; category: TemplateCategory }> {
  const category = await getTemplateCategory(userId, templateName);
  
  if (!category) {
    throw new Error(`Template '${templateName}' not found or not accessible for this user. Please ensure the template exists and is approved.`);
  }
  
  // Convert template category to pricing category
  const pricingCategory = category.toLowerCase() as 'marketing' | 'utility' | 'authentication';
  
  // Get user-specific pricing
  const ratePerMessage = await getPricingForUser(parseInt(userId), pricingCategory);
  const totalCost = Math.round((ratePerMessage * messageCount) * 100) / 100; // Round to 2 decimal places
  
  console.log(`💰 PRICING: User ${userId} - ${category} template "${templateName}" x ${messageCount} = ₹${totalCost} (rate: ₹${ratePerMessage})`);
  
  return {
    cost: totalCost,
    category
  };
}

/**
 * Get cost preview for a template and recipient count
 */
export async function getCostPreview(
  userId: string,
  templateName: string,
  recipientCount: number = 1
): Promise<{
  unitPrice: number;
  totalCost: number;
  currency: string;
  category: TemplateCategory;
  pricingMode: 'custom' | 'default';
}> {
  const category = await getTemplateCategory(userId, templateName);
  
  if (!category) {
    throw new Error(`Template '${templateName}' not found or not accessible for this user.`);
  }
  
  // Convert template category to pricing category
  const pricingCategory = category.toLowerCase() as 'marketing' | 'utility' | 'authentication';
  
  try {
    // Get detailed pricing information including mode
    const userPricing = await getUserPricing(parseInt(userId));
    const unitPrice = parseFloat(userPricing.effective[pricingCategory]);
    const totalCost = Math.round((unitPrice * recipientCount) * 100) / 100;
    
    return {
      unitPrice,
      totalCost,
      currency: 'INR',
      category,
      pricingMode: userPricing.mode
    };
  } catch (error) {
    console.error(`Failed to get cost preview for user ${userId}:`, error);
    // Fallback to hardcoded rates
    const unitPrice = CREDIT_RATES[category];
    const totalCost = Math.round((unitPrice * recipientCount) * 100) / 100;
    
    return {
      unitPrice,
      totalCost,
      currency: 'INR',
      category,
      pricingMode: 'default'
    };
  }
}

/**
 * Get bulk cost preview for multiple recipients
 */
export async function getBulkCostPreview(
  userId: string,
  templateName: string,
  recipientsList: string[]
): Promise<{
  unitPrice: number;
  totalCost: number;
  currency: string;
  category: TemplateCategory;
  pricingMode: 'custom' | 'default';
  recipientCount: number;
  breakdown: {
    validRecipients: number;
    invalidRecipients: number;
    duplicatesRemoved: number;
  };
}> {
  // Remove duplicates and validate recipients
  const uniqueRecipients = [...new Set(recipientsList.filter(r => r && r.trim()))];
  const validRecipients = uniqueRecipients.filter(r => validatePhoneNumber(r));
  
  const costPreview = await getCostPreview(userId, templateName, validRecipients.length);
  
  return {
    ...costPreview,
    recipientCount: validRecipients.length,
    breakdown: {
      validRecipients: validRecipients.length,
      invalidRecipients: uniqueRecipients.length - validRecipients.length,
      duplicatesRemoved: recipientsList.length - uniqueRecipients.length
    }
  };
}

/**
 * Pre-check credits for bulk operations
 */
export async function preCheckCreditsForBulk(
  userId: string,
  templateName: string,
  messageCount: number
): Promise<{
  sufficient: boolean;
  requiredCredits: number;
  currentBalance: number;
  category: TemplateCategory;
}> {
  const { cost, category } = await calculateCreditCost(userId, templateName, messageCount);
  const { sufficient, currentBalance } = await checkSufficientCredits(userId, cost);
  
  return {
    sufficient,
    requiredCredits: cost,
    currentBalance,
    category
  };
}
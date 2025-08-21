/**
 * Razorpay Service
 * Handles order creation and integration with Razorpay APIs
 */

import Razorpay from 'razorpay';
import { logger } from '../utils/logger';

// Initialize Razorpay instance
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export type CreateOrderParams = {
  amountCredits: number;
  userId: string;
  receipt?: string;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: any;
  receipt: string;
  created_at: number;
};

/**
 * Creates a Razorpay order for credit top-up
 * @param params Order creation parameters
 * @returns Razorpay order object
 */
export async function createRazorpayOrder({ 
  amountCredits, 
  userId, 
  receipt 
}: CreateOrderParams): Promise<RazorpayOrder> {
  try {
    // Get price per credit from environment (default: ₹1 per credit)
    const pricePerCredit = Number(process.env.PRICE_PER_CREDIT_INR ?? 1);
    
    // Convert to paise (Indian currency subunit)
    // ₹1 = 100 paise, so ₹50,000 = 5,000,000 paise
    const amountInPaise = amountCredits * pricePerCredit * 100;
    
    // Generate receipt if not provided
    const orderReceipt = receipt ?? `rcpt_${userId}_${Date.now()}`;
    
    logger.info(`Creating Razorpay order for user ${userId}: ${amountCredits} credits = ₹${amountCredits * pricePerCredit} = ${amountInPaise} paise`);
    
    // Create order using Razorpay SDK
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderReceipt,
      notes: {
        userId,
        amountCredits: String(amountCredits),
        pricePerCredit: String(pricePerCredit)
      },
    });
    
    logger.info(`Razorpay order created successfully: ${order.id}`);
    
    return order as any;
  } catch (error) {
    logger.error('Failed to create Razorpay order:', error);
    throw new Error('Failed to create payment order');
  }
}

/**
 * Validates Razorpay configuration
 * @returns boolean indicating if configuration is valid
 */
export function validateRazorpayConfig(): boolean {
  const requiredEnvVars = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`Missing Razorpay environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  // Validate key format (test keys start with rzp_test_, live keys start with rzp_live_)
  const keyId = process.env.RAZORPAY_KEY_ID!;
  if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    logger.error('Invalid RAZORPAY_KEY_ID format');
    return false;
  }
  
  logger.info(`Razorpay configured in ${keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE'} mode`);
  return true;
}
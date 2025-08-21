/**
 * Signature Verification Utilities
 * Handles Razorpay signature verification for payments and webhooks
 */

import crypto from 'crypto';
import { logger } from './logger';

/**
 * Verifies Razorpay payment signature from client callback
 * Uses HMAC-SHA256 with order_id|payment_id as message and key_secret as key
 * 
 * @param params Signature verification parameters
 * @returns boolean indicating signature validity
 */
export function verifyPaymentSignature({ 
  orderId, 
  paymentId, 
  signature 
}: { 
  orderId: string; 
  paymentId: string; 
  signature: string; 
}): boolean {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    
    if (!keySecret) {
      logger.error('RAZORPAY_KEY_SECRET not configured');
      return false;
    }
    
    // Create HMAC with SHA256
    const hmac = crypto.createHmac('sha256', keySecret);
    
    // Update with order_id|payment_id
    const message = `${orderId}|${paymentId}`;
    hmac.update(message);
    
    // Generate digest
    const computedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'), 
      Buffer.from(signature, 'hex')
    );
    
    if (!isValid) {
      logger.warn(`Payment signature verification failed for order ${orderId}, payment ${paymentId}`);
    } else {
      logger.info(`Payment signature verified successfully for order ${orderId}, payment ${paymentId}`);
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying payment signature:', error);
    return false;
  }
}

/**
 * Verifies Razorpay webhook signature
 * Uses HMAC-SHA256 with raw request body as message and webhook_secret as key
 * 
 * @param rawBody Raw request body string (not parsed JSON)
 * @param headerSignature Signature from x-razorpay-signature header
 * @returns boolean indicating signature validity
 */
export function verifyWebhookSignature(
  rawBody: string, 
  headerSignature: string
): boolean {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    
    if (!webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }
    
    // Create HMAC with SHA256
    const hmac = crypto.createHmac('sha256', webhookSecret);
    
    // Update with raw body
    hmac.update(rawBody);
    
    // Generate digest
    const computedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'), 
      Buffer.from(headerSignature, 'hex')
    );
    
    if (!isValid) {
      logger.warn('Webhook signature verification failed');
      logger.debug(`Computed: ${computedSignature}, Received: ${headerSignature}`);
    } else {
      logger.info('Webhook signature verified successfully');
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Validates signature format (basic format check)
 * @param signature Signature string to validate
 * @returns boolean indicating if signature format is valid
 */
export function isValidSignatureFormat(signature: string): boolean {
  // Razorpay signatures are hex strings (typically 64 characters for SHA256)
  return /^[a-fA-F0-9]{64}$/.test(signature);
}

/**
 * Securely generates a webhook secret for initial setup
 * @param length Length of the secret (default: 32 characters)
 * @returns Random hex string to use as webhook secret
 */
export function generateWebhookSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
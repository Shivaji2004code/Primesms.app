/**
 * Razorpay Payment Routes
 * Handles order creation, payment verification, and webhooks for wallet top-ups
 */

import express, { Request, Response } from 'express';
import { createRazorpayOrder, validateRazorpayConfig } from '../services/razorpay.service';
import { verifyPaymentSignature, verifyWebhookSignature } from '../utils/signature.util';
import { walletStore } from '../services/wallet.store';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validate Razorpay configuration on startup
if (!validateRazorpayConfig()) {
  logger.error('Razorpay configuration invalid. Payment routes will not work properly.');
}

/**
 * Create Razorpay order for wallet top-up
 * POST /api/payments/razorpay/order
 */
router.post('/order', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;
    const { amountCredits } = req.body;

    logger.info(`Creating order for user ${userId}, amount: ${amountCredits} credits`);

    // Validate amount
    const amount = Number(amountCredits);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be between 1 and 1,00,000 credits'
      });
    }

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amountCredits: amount,
      userId: String(userId)
    });

    // Store order in our tracking system
    walletStore.createOrder(order.id, {
      userId: String(userId),
      amountCredits: amount,
      amountPaise: order.amount,
      status: 'created',
      receipt: order.receipt,
      notes: order.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Return order details to client (exclude sensitive info)
    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount, // in paise
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID // Public key ID is safe to send
    });

  } catch (error: any) {
    logger.error('Failed to create Razorpay order:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment order. Please try again.'
    });
  }
});

/**
 * Verify payment signature and credit wallet
 * POST /api/payments/razorpay/verify
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;
    const { orderId, paymentId, signature, amountCredits } = req.body;

    logger.info(`Verifying payment for user ${userId}, order ${orderId}, payment ${paymentId}`);

    // Validate required fields
    if (!orderId || !paymentId || !signature || !amountCredits) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields'
      });
    }

    // Get order from our store
    const order = walletStore.getOrder(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found. Please create a new order.'
      });
    }

    // Verify order belongs to current user
    if (order.userId !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Order does not belong to current user'
      });
    }

    // Check if already processed
    if (order.status === 'paid') {
      return res.json({
        success: true,
        paymentId: order.paymentId,
        message: 'Payment already processed'
      });
    }

    // Verify payment signature
    const isValidSignature = verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValidSignature) {
      logger.warn(`Invalid signature for payment verification: order ${orderId}, payment ${paymentId}`);
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed. Invalid signature.'
      });
    }

    // Verify amount matches
    if (Number(amountCredits) !== order.amountCredits) {
      return res.status(400).json({
        success: false,
        error: 'Amount mismatch. Please refresh and try again.'
      });
    }

    // Idempotency check
    if (!walletStore.isPaymentProcessed(paymentId)) {
      try {
        logger.info(`💰 🔄 Starting credit wallet process for user ${order.userId}, amount: ${order.amountCredits}, payment: ${paymentId}`);
        
        // Check user's current balance before crediting
        const { default: pool } = await import('../db');
        const preBalanceResult = await pool.query(
          'SELECT credit_balance, name, email FROM users WHERE id = $1',
          [order.userId]
        );
        
        const preCreditBalance = preBalanceResult.rows[0]?.credit_balance || 0;
        logger.info(`💰 📊 BEFORE CREDIT: User ${order.userId} (${preBalanceResult.rows[0]?.name}) balance: ₹${preCreditBalance}`);
        
        // Credit the wallet
        await walletStore.creditWallet(
          order.userId,
          order.amountCredits,
          paymentId,
          `Razorpay payment verification (Order: ${orderId})`
        );

        // Check user's balance after crediting
        const postBalanceResult = await pool.query(
          'SELECT credit_balance FROM users WHERE id = $1',
          [order.userId]
        );
        
        const postCreditBalance = postBalanceResult.rows[0]?.credit_balance || 0;
        logger.info(`💰 📊 AFTER CREDIT: User ${order.userId} balance: ₹${postCreditBalance} (increase: ₹${postCreditBalance - preCreditBalance})`);
        
        // Verify the credit was actually added
        const expectedBalance = parseFloat(preCreditBalance) + parseFloat(order.amountCredits);
        const actualBalance = parseFloat(postCreditBalance);
        
        if (Math.abs(actualBalance - expectedBalance) < 0.01) {
          logger.info(`💰 ✅ VERIFIED: Credit addition successful. Expected: ₹${expectedBalance}, Actual: ₹${actualBalance}`);
        } else {
          logger.error(`💰 ❌ MISMATCH: Credit addition failed. Expected: ₹${expectedBalance}, Actual: ₹${actualBalance}`);
          throw new Error(`Credit verification failed: expected ₹${expectedBalance}, got ₹${actualBalance}`);
        }

        // Mark as processed
        walletStore.markPaymentProcessed(paymentId);
        
        logger.info(`💰 ✅ Successfully credited ${order.amountCredits} credits to user ${userId} for payment ${paymentId}`);
      } catch (creditError) {
        logger.error(`💰 ❌ Failed to credit wallet for payment ${paymentId}:`, creditError);
        logger.error(`💰 ❌ Credit error details:`, {
          userId: order.userId,
          amountCredits: order.amountCredits,
          paymentId,
          orderId,
          error: creditError instanceof Error ? creditError.message : String(creditError),
          stack: creditError instanceof Error ? creditError.stack : undefined
        });
        return res.status(500).json({
          success: false,
          error: 'Payment verified but failed to credit wallet. Please contact support.',
          debug: {
            paymentId,
            orderId,
            userId: order.userId,
            amount: order.amountCredits
          }
        });
      }
    } else {
      logger.info(`💰 ⚠️ Payment ${paymentId} already processed, skipping credit addition`);
    }

    // Update order status
    walletStore.updateOrderStatus(orderId, 'paid', paymentId);

    return res.json({
      success: true,
      paymentId,
      message: 'Payment verified and credits added successfully'
    });

  } catch (error: any) {
    logger.error('Payment verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed. Please try again.'
    });
  }
});

/**
 * Razorpay webhook handler
 * POST /api/payments/razorpay/webhook
 * 
 * Note: This route uses raw body parsing to verify webhook signature
 */
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = req.body?.toString() || '';

      logger.info('Received Razorpay webhook');

      // Verify webhook signature
      if (!signature || !verifyWebhookSignature(rawBody, signature)) {
        logger.warn('Invalid webhook signature received');
        return res.status(400).send('Invalid signature');
      }

      // Parse webhook payload
      const event = JSON.parse(rawBody);
      const eventId = event.id as string;

      logger.info(`Processing webhook event: ${event.event} (ID: ${eventId})`);

      // Idempotency check
      if (walletStore.isEventProcessed(eventId)) {
        logger.info(`Event ${eventId} already processed, returning OK`);
        return res.status(200).send('OK');
      }

      // Process different event types
      await processWebhookEvent(event);

      // Mark event as processed
      walletStore.markEventProcessed(eventId);

      return res.status(200).send('OK');

    } catch (error: any) {
      logger.error('Webhook processing error:', error);
      // Always return 200 to prevent Razorpay retries on parsing errors
      return res.status(200).send('OK');
    }
  }
);

/**
 * Process webhook events
 * @param event Webhook event data
 */
async function processWebhookEvent(event: any): Promise<void> {
  try {
    const eventType = event.event;

    switch (eventType) {
      case 'payment.captured':
      case 'order.paid':
        await handlePaymentSuccess(event);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${eventType}`);
    }
  } catch (error) {
    logger.error('Error processing webhook event:', error);
    throw error;
  }
}

/**
 * Handle successful payment webhooks
 * @param event Webhook event data
 */
async function handlePaymentSuccess(event: any): Promise<void> {
  try {
    // Extract payment and order information
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const paymentId = paymentEntity?.id || orderEntity?.payments?.[0]?.id;
    const orderId = paymentEntity?.order_id || orderEntity?.id;

    if (!orderId || !paymentId) {
      logger.warn('Missing order ID or payment ID in webhook payload');
      return;
    }

    logger.info(`Processing successful payment webhook: order ${orderId}, payment ${paymentId}`);

    // Get order from our store
    const order = walletStore.getOrder(orderId);
    if (!order) {
      logger.warn(`Order ${orderId} not found in store for webhook processing`);
      return;
    }

    // Skip if already processed
    if (order.status === 'paid' || walletStore.isPaymentProcessed(paymentId)) {
      logger.info(`Payment ${paymentId} already processed, skipping`);
      return;
    }

    try {
      // Credit the wallet (idempotent operation)
      await walletStore.creditWallet(
        order.userId,
        order.amountCredits,
        `wh_${paymentId}`,
        `Webhook credit for payment ${paymentId} (Order: ${orderId})`
      );

      // Update tracking
      walletStore.updateOrderStatus(orderId, 'paid', paymentId);
      walletStore.markPaymentProcessed(paymentId);

      logger.info(`Webhook: Successfully credited ${order.amountCredits} credits to user ${order.userId}`);
    } catch (creditError) {
      logger.error(`Webhook: Failed to credit wallet for payment ${paymentId}:`, creditError);
      // Don't throw - we don't want webhook retries for credit system errors
    }

  } catch (error) {
    logger.error('Error handling payment success webhook:', error);
    throw error;
  }
}

/**
 * Handle failed payment webhooks
 * @param event Webhook event data
 */
async function handlePaymentFailed(event: any): Promise<void> {
  try {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;

    if (orderId) {
      const order = walletStore.getOrder(orderId);
      if (order && order.status === 'created') {
        walletStore.updateOrderStatus(orderId, 'failed');
        logger.info(`Order ${orderId} marked as failed due to payment failure`);
      }
    }
  } catch (error) {
    logger.error('Error handling payment failed webhook:', error);
    throw error;
  }
}

/**
 * Get wallet store statistics (for debugging/monitoring)
 * GET /api/payments/razorpay/stats
 */
router.get('/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    
    // Only allow access to admin users or for debugging in development
    if (process.env.NODE_ENV === 'production' && session.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = walletStore.getStats();
    return res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting payment stats:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
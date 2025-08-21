/**
 * Wallet Store Service
 * In-memory store for Razorpay orders and wallet operations
 * TODO: Replace with persistent database storage in production
 */

import { logger } from '../utils/logger';
import { addCredits, CreditTransactionType } from '../utils/creditSystem';
import pool from '../db';

export type OrderStatus = 'created' | 'paid' | 'failed' | 'expired';

export interface WalletOrder {
  userId: string;
  amountCredits: number;
  amountPaise: number;
  status: OrderStatus;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
  receipt?: string;
  notes?: Record<string, any>;
}

export interface WalletStore {
  // Order tracking
  orders: Map<string, WalletOrder>;
  
  // Idempotency tracking
  processedPayments: Set<string>;
  processedEvents: Set<string>;
  
  // Core wallet operations
  creditWallet: (userId: string, amountCredits: number, ref: string, description?: string) => Promise<void>;
  getOrder: (orderId: string) => WalletOrder | undefined;
  createOrder: (orderId: string, order: WalletOrder) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus, paymentId?: string) => void;
  
  // Idempotency helpers
  isPaymentProcessed: (paymentId: string) => boolean;
  markPaymentProcessed: (paymentId: string) => void;
  isEventProcessed: (eventId: string) => boolean;
  markEventProcessed: (eventId: string) => void;
  
  // Utility functions
  cleanupExpiredOrders: () => void;
  getStats: () => { totalOrders: number; processedPayments: number; processedEvents: number };
}

/**
 * In-memory wallet store implementation
 * This should be replaced with Redis or database persistence in production
 */
class InMemoryWalletStore implements WalletStore {
  orders: Map<string, WalletOrder> = new Map();
  processedPayments: Set<string> = new Set();
  processedEvents: Set<string> = new Set();

  /**
   * Credits user wallet through the existing credit system
   * @param userId User ID to credit
   * @param amountCredits Amount of credits to add
   * @param ref Reference/payment ID for tracking
   * @param description Optional description for the transaction
   */
  async creditWallet(
    userId: string, 
    amountCredits: number, 
    ref: string, 
    description?: string
  ): Promise<void> {
    try {
      logger.info(`💰 🔄 WALLET CREDIT START: userId=${userId}, amount=${amountCredits}, ref=${ref}, description="${description}"`);
      logger.info(`💰 📋 CREDIT METHOD: Attempting credit system first, then fallback to direct DB`);
      
      // Log current balance before any credit operations
      const preCheckResult = await pool.query(
        'SELECT credit_balance FROM users WHERE id = $1',
        [userId]
      );
      const currentBal = preCheckResult.rows[0]?.credit_balance || 0;
      logger.info(`💰 📊 WALLET STORE PRE-CHECK: User ${userId} current balance: ₹${currentBal}`);
      
      // Try using the existing credit system first
      try {
        logger.info(`💰 🔧 STEP 1: Attempting credit via addCredits() function...`);
        const result = await addCredits({
          userId,
          amount: amountCredits,
          transactionType: CreditTransactionType.ADMIN_ADD,
          description: description || `Wallet top-up via Razorpay (${ref})`
        });
        
        logger.info(`💰 📊 STEP 1 RESULT:`, {
          success: result.success,
          newBalance: result.newBalance,
          transactionId: result.transactionId
        });
        
        if (result.success) {
          logger.info(`💰 ✅ STEP 1 SUCCESS: Credit system worked! User ${userId} new balance: ${result.newBalance}, Transaction ID: ${result.transactionId}`);
          return;
        } else {
          logger.warn(`💰 ⚠️ STEP 1 FAILED: Credit system returned success=false, trying direct database update`);
        }
      } catch (creditSystemError) {
        logger.error(`💰 ❌ STEP 1 ERROR: Credit system failed:`, {
          error: creditSystemError instanceof Error ? creditSystemError.message : String(creditSystemError),
          stack: creditSystemError instanceof Error ? creditSystemError.stack : undefined
        });
        logger.info(`💰 🔄 STEP 2: Attempting direct database credit update as fallback`);
      }
      
      // Fallback: Direct database update
      logger.info(`💰 🔧 STEP 2: Starting direct database credit update...`);
      const client = await pool.connect();
      try {
        logger.info(`💰 🔧 STEP 2.1: Beginning database transaction...`);
        await client.query('BEGIN');
        
        // Get current balance
        logger.info(`💰 🔧 STEP 2.2: Fetching current balance for user ${userId}...`);
        const balanceResult = await client.query(
          'SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        
        if (balanceResult.rows.length === 0) {
          throw new Error(`User ${userId} not found`);
        }
        
        const currentBalance = parseFloat(balanceResult.rows[0].credit_balance || '0');
        const newBalance = Math.round((currentBalance + amountCredits) * 100) / 100;
        
        logger.info(`💰 📊 STEP 2.3: Balance calculation: User ${userId} current=${currentBalance} + add=${amountCredits} = new=${newBalance}`);
        
        // Update user balance
        logger.info(`💰 🔧 STEP 2.4: Updating user balance to ${newBalance}...`);
        const updateResult = await client.query(
          'UPDATE users SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newBalance, userId]
        );
        
        logger.info(`💰 📊 STEP 2.4 RESULT: Updated ${updateResult.rowCount} rows`);
        
        // Insert transaction log (try, but don't fail if table doesn't exist)
        try {
          logger.info(`💰 🔧 STEP 2.5: Inserting transaction log...`);
          const logResult = await client.query(
            `INSERT INTO credit_transactions 
             (user_id, amount, transaction_type, description, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING id`,
            [userId, amountCredits, 'ADMIN_ADD', description || `Wallet top-up via Razorpay (${ref})`]
          );
          logger.info(`💰 📊 STEP 2.5 RESULT: Transaction logged with ID ${logResult.rows[0]?.id}`);
        } catch (transactionLogError) {
          logger.warn(`💰 ⚠️ STEP 2.5 WARNING: Failed to log transaction, but continuing:`, {
            error: transactionLogError instanceof Error ? transactionLogError.message : String(transactionLogError)
          });
        }
        
        logger.info(`💰 🔧 STEP 2.6: Committing transaction...`);
        await client.query('COMMIT');
        
        logger.info(`💰 ✅ STEP 2 SUCCESS: Direct DB credit complete! User ${userId} new balance: ${newBalance}`);
        
      } catch (dbError) {
        logger.error(`💰 ❌ STEP 2 ERROR: Database error, rolling back:`, {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined
        });
        await client.query('ROLLBACK');
        throw dbError;
      } finally {
        logger.info(`💰 🔧 STEP 2.7: Releasing database connection...`);
        client.release();
      }
      
    } catch (error) {
      logger.error(`💰 ❌ All credit methods failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets an order by ID
   */
  getOrder(orderId: string): WalletOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Creates a new order in the store
   */
  createOrder(orderId: string, order: WalletOrder): void {
    this.orders.set(orderId, {
      ...order,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    logger.info(`Order created in store: ${orderId}`);
  }

  /**
   * Updates order status and payment information
   */
  updateOrderStatus(orderId: string, status: OrderStatus, paymentId?: string): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      if (paymentId) {
        order.paymentId = paymentId;
      }
      this.orders.set(orderId, order);
      logger.info(`Order ${orderId} status updated to ${status}${paymentId ? ` with payment ${paymentId}` : ''}`);
    } else {
      logger.warn(`Attempted to update non-existent order: ${orderId}`);
    }
  }

  /**
   * Checks if a payment has already been processed (idempotency)
   */
  isPaymentProcessed(paymentId: string): boolean {
    return this.processedPayments.has(paymentId);
  }

  /**
   * Marks a payment as processed (idempotency)
   */
  markPaymentProcessed(paymentId: string): void {
    this.processedPayments.add(paymentId);
    logger.debug(`Payment ${paymentId} marked as processed`);
  }

  /**
   * Checks if a webhook event has already been processed (idempotency)
   */
  isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Marks a webhook event as processed (idempotency)
   */
  markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    logger.debug(`Event ${eventId} marked as processed`);
  }

  /**
   * Cleans up expired orders (orders older than 1 hour that are still 'created')
   */
  cleanupExpiredOrders(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let cleanedCount = 0;
    
    for (const [orderId, order] of this.orders.entries()) {
      if (order.status === 'created' && order.createdAt < oneHourAgo) {
        this.updateOrderStatus(orderId, 'expired');
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired orders`);
    }
  }

  /**
   * Gets store statistics for monitoring
   */
  getStats() {
    return {
      totalOrders: this.orders.size,
      processedPayments: this.processedPayments.size,
      processedEvents: this.processedEvents.size
    };
  }
}

// Export singleton instance
export const walletStore: WalletStore = new InMemoryWalletStore();

// Cleanup expired orders every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    walletStore.cleanupExpiredOrders();
  }, 30 * 60 * 1000); // 30 minutes
}

// TODO: Production considerations
// 1. Replace in-memory store with Redis for scalability
// 2. Add database persistence for order history
// 3. Implement proper distributed locks for concurrent operations
// 4. Add metrics and monitoring for payment processing
// 5. Consider using database transactions for atomic operations
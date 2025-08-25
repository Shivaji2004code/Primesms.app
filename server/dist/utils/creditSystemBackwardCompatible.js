"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preCheckCreditsForBulk = exports.calculateCreditCost = exports.getTemplateCategory = exports.addCredits = exports.checkSufficientCredits = exports.getCreditRate = exports.CreditTransactionType = exports.CREDIT_RATES = void 0;
exports.deductCredits = deductCredits;
const db_1 = __importDefault(require("../db"));
exports.CREDIT_RATES = {
    MARKETING: 0.80,
    UTILITY: 0.15,
    AUTHENTICATION: 0.15
};
var CreditTransactionType;
(function (CreditTransactionType) {
    CreditTransactionType["DEDUCTION_QUICKSEND"] = "DEDUCTION_QUICKSEND";
    CreditTransactionType["DEDUCTION_CUSTOMISE_SMS"] = "DEDUCTION_CUSTOMISE_SMS";
    CreditTransactionType["DEDUCTION_API_DELIVERED"] = "DEDUCTION_API_DELIVERED";
    CreditTransactionType["DEDUCTION_DUPLICATE_BLOCKED"] = "DEDUCTION_DUPLICATE_BLOCKED";
    CreditTransactionType["ADMIN_ADD"] = "ADMIN_ADD";
    CreditTransactionType["ADMIN_DEDUCT"] = "ADMIN_DEDUCT";
    CreditTransactionType["REFUND"] = "REFUND";
})(CreditTransactionType || (exports.CreditTransactionType = CreditTransactionType = {}));
async function hasTemplateCategoryColumn() {
    try {
        const result = await db_1.default.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'credit_transactions' 
      AND column_name = 'template_category'
    `);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error checking column existence:', error);
        return false;
    }
}
async function deductCredits(transaction) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const balanceResult = await client.query('SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE', [transaction.userId]);
        if (balanceResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const currentBalance = balanceResult.rows[0].credit_balance;
        if (currentBalance < transaction.amount) {
            await client.query('ROLLBACK');
            return {
                success: false,
                newBalance: currentBalance
            };
        }
        const newBalance = Math.round((currentBalance - transaction.amount) * 100) / 100;
        await client.query('UPDATE users SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, transaction.userId]);
        const hasTemplateCategory = await hasTemplateCategoryColumn();
        let transactionResult;
        if (hasTemplateCategory) {
            console.log('💰 Using NEW schema (with template_category column)');
            transactionResult = await client.query(`INSERT INTO credit_transactions 
         (user_id, amount, transaction_type, template_category, template_name, 
          message_id, campaign_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`, [
                transaction.userId,
                -transaction.amount,
                transaction.transactionType,
                transaction.templateCategory,
                transaction.templateName,
                transaction.messageId,
                transaction.campaignId,
                transaction.description || `Credit deduction for ${transaction.transactionType}`
            ]);
        }
        else {
            console.log('💰 Using OLD schema (without template_category column)');
            transactionResult = await client.query(`INSERT INTO credit_transactions 
         (user_id, amount, transaction_type, template_name, 
          message_id, campaign_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING id`, [
                transaction.userId,
                -transaction.amount,
                transaction.transactionType,
                transaction.templateName,
                transaction.messageId,
                transaction.campaignId,
                transaction.description || `Credit deduction for ${transaction.transactionType} (${transaction.templateCategory})`
            ]);
        }
        await client.query('COMMIT');
        return {
            success: true,
            newBalance,
            transactionId: transactionResult.rows[0].id
        };
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Credit deduction error:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
var creditSystem_1 = require("./creditSystem");
Object.defineProperty(exports, "getCreditRate", { enumerable: true, get: function () { return creditSystem_1.getCreditRate; } });
Object.defineProperty(exports, "checkSufficientCredits", { enumerable: true, get: function () { return creditSystem_1.checkSufficientCredits; } });
Object.defineProperty(exports, "addCredits", { enumerable: true, get: function () { return creditSystem_1.addCredits; } });
Object.defineProperty(exports, "getTemplateCategory", { enumerable: true, get: function () { return creditSystem_1.getTemplateCategory; } });
Object.defineProperty(exports, "calculateCreditCost", { enumerable: true, get: function () { return creditSystem_1.calculateCreditCost; } });
Object.defineProperty(exports, "preCheckCreditsForBulk", { enumerable: true, get: function () { return creditSystem_1.preCheckCreditsForBulk; } });

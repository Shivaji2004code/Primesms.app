"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditTransactionType = exports.CREDIT_RATES = void 0;
exports.getCreditRate = getCreditRate;
exports.getPricingForUser = getPricingForUser;
exports.checkSufficientCredits = checkSufficientCredits;
exports.deductCredits = deductCredits;
exports.addCredits = addCredits;
exports.getTemplateCategory = getTemplateCategory;
exports.calculateCreditCost = calculateCreditCost;
exports.getCostPreview = getCostPreview;
exports.getBulkCostPreview = getBulkCostPreview;
exports.preCheckCreditsForBulk = preCheckCreditsForBulk;
const db_1 = __importDefault(require("../db"));
const pricing_service_1 = require("../services/pricing.service");
const sendApiHelpers_1 = require("./sendApiHelpers");
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
function getCreditRate(category) {
    return exports.CREDIT_RATES[category];
}
async function getPricingForUser(userId, category) {
    try {
        const userPricing = await (0, pricing_service_1.getUserPricing)(userId);
        const priceString = userPricing.effective[category];
        return parseFloat(priceString);
    }
    catch (error) {
        console.error(`Failed to get user pricing for user ${userId}, category ${category}:`, error);
        const templateCategory = category.toUpperCase();
        return exports.CREDIT_RATES[templateCategory];
    }
}
async function checkSufficientCredits(userId, requiredAmount) {
    const result = await db_1.default.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    const currentBalance = result.rows[0].credit_balance;
    return {
        sufficient: currentBalance >= requiredAmount,
        currentBalance
    };
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
        const transactionResult = await client.query(`INSERT INTO credit_transactions 
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
async function addCredits(transaction) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const balanceResult = await client.query('SELECT credit_balance FROM users WHERE id = $1 FOR UPDATE', [transaction.userId]);
        if (balanceResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const currentBalance = balanceResult.rows[0].credit_balance;
        const newBalance = Math.round((currentBalance + transaction.amount) * 100) / 100;
        await client.query('UPDATE users SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, transaction.userId]);
        const transactionResult = await client.query(`INSERT INTO credit_transactions 
       (user_id, amount, transaction_type, template_category, template_name, 
        message_id, campaign_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING id`, [
            transaction.userId,
            transaction.amount,
            transaction.transactionType,
            transaction.templateCategory,
            transaction.templateName,
            transaction.messageId,
            transaction.campaignId,
            transaction.description || `Credit addition: ${transaction.transactionType}`
        ]);
        await client.query('COMMIT');
        return {
            success: true,
            newBalance,
            transactionId: transactionResult.rows[0].id
        };
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Credit addition error:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
async function getTemplateCategory(userId, templateName) {
    try {
        console.log(`💰 DEBUG CREDIT: Getting template category for userId: ${userId}, templateName: "${templateName}"`);
        const result = await db_1.default.query('SELECT category, status FROM templates WHERE user_id = $1 AND name = $2', [userId, templateName]);
        console.log(`💰 DEBUG CREDIT: Template query result:`, {
            rowCount: result.rows.length,
            category: result.rows[0]?.category,
            status: result.rows[0]?.status
        });
        if (result.rows.length === 0) {
            console.log(`❌ DEBUG CREDIT: Template not found for user ${userId}, template "${templateName}"`);
            const availableTemplates = await db_1.default.query('SELECT name, category, status FROM templates WHERE user_id = $1 AND status IN (\'APPROVED\', \'ACTIVE\') ORDER BY name', [userId]);
            console.log(`💡 DEBUG CREDIT: Available approved templates for user:`, availableTemplates.rows.map(t => `${t.name} (${t.category})`).join(', '));
            return null;
        }
        const template = result.rows[0];
        const category = template.category;
        if (!['APPROVED', 'ACTIVE'].includes(template.status)) {
            console.log(`❌ DEBUG CREDIT: Template "${templateName}" found but status is "${template.status}" (not usable)`);
            return null;
        }
        console.log(`✅ DEBUG CREDIT: Template category found: ${category} (status: ${template.status})`);
        return category;
    }
    catch (error) {
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
async function calculateCreditCost(userId, templateName, messageCount = 1) {
    const category = await getTemplateCategory(userId, templateName);
    if (!category) {
        throw new Error(`Template '${templateName}' not found or not accessible for this user. Please ensure the template exists and is approved.`);
    }
    const pricingCategory = category.toLowerCase();
    const ratePerMessage = await getPricingForUser(parseInt(userId), pricingCategory);
    const totalCost = Math.round((ratePerMessage * messageCount) * 100) / 100;
    console.log(`💰 PRICING: User ${userId} - ${category} template "${templateName}" x ${messageCount} = ₹${totalCost} (rate: ₹${ratePerMessage})`);
    return {
        cost: totalCost,
        category
    };
}
async function getCostPreview(userId, templateName, recipientCount = 1) {
    const category = await getTemplateCategory(userId, templateName);
    if (!category) {
        throw new Error(`Template '${templateName}' not found or not accessible for this user.`);
    }
    const pricingCategory = category.toLowerCase();
    try {
        const userPricing = await (0, pricing_service_1.getUserPricing)(parseInt(userId));
        const unitPrice = parseFloat(userPricing.effective[pricingCategory]);
        const totalCost = Math.round((unitPrice * recipientCount) * 100) / 100;
        return {
            unitPrice,
            totalCost,
            currency: 'INR',
            category,
            pricingMode: userPricing.mode
        };
    }
    catch (error) {
        console.error(`Failed to get cost preview for user ${userId}:`, error);
        const unitPrice = exports.CREDIT_RATES[category];
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
async function getBulkCostPreview(userId, templateName, recipientsList) {
    const uniqueRecipients = [...new Set(recipientsList.filter(r => r && r.trim()))];
    const validRecipients = uniqueRecipients.filter(r => (0, sendApiHelpers_1.validatePhoneNumber)(r));
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
async function preCheckCreditsForBulk(userId, templateName, messageCount) {
    const { cost, category } = await calculateCreditCost(userId, templateName, messageCount);
    const { sufficient, currentBalance } = await checkSufficientCredits(userId, cost);
    return {
        sufficient,
        requiredCredits: cost,
        currentBalance,
        category
    };
}

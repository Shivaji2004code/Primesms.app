"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDuplicateCacheStats = exports.checkAndHandleDuplicate = exports.getDuplicateResponse = exports.isDuplicateRequest = exports.duplicateDetectionMiddleware = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../db"));
const duplicateCache = new node_cache_1.default({ stdTTL: 300 });
function generateMessageHash(templateName, phone, variables) {
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const variablesString = variables ? JSON.stringify(variables, Object.keys(variables).sort()) : '';
    const hashInput = `${templateName}|${normalizedPhone}|${variablesString}`;
    return crypto_1.default.createHash('sha256').update(hashInput).digest('hex');
}
async function logDuplicateAttempt(userId, templateName, phone, variables, messageHash, campaignId) {
    try {
        const variablesJson = variables ? JSON.stringify(variables) : null;
        if (campaignId) {
            await db_1.default.query(`UPDATE campaign_logs 
         SET failed_sends = failed_sends + 1, 
             total_recipients = total_recipients + 1,
             status = 'failed',
             error_message = 'duplicate msg',
             sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`, [campaignId]);
        }
        else {
            const campaignResult = await db_1.default.query(`INSERT INTO campaign_logs (user_id, campaign_name, template_used, total_recipients, successful_sends, failed_sends, status, error_message, sent_at, created_at, updated_at) 
         VALUES ($1, $2, $3, 1, 0, 1, 'failed', 'duplicate msg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`, [userId, `Duplicate Block: ${templateName}`, templateName]);
            const newCampaignId = campaignResult.rows[0].id;
            await db_1.default.query(`UPDATE campaign_logs SET 
           recipient_number = $1, 
           message_id = $2,
           campaign_data = jsonb_build_object(
             'duplicate', true, 
             'hash', $3, 
             'variables', $4::jsonb,
             'blocked_at', CURRENT_TIMESTAMP
           ),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`, [phone, `duplicate_${messageHash.substring(0, 8)}`, messageHash, variablesJson || '{}', newCampaignId]);
        }
        console.log(`[DUPLICATE DETECTION] Blocked duplicate message for user ${userId}, template ${templateName}, phone ${phone}, variables: ${variablesJson}, hash: ${messageHash}`);
    }
    catch (error) {
        console.error('[DUPLICATE DETECTION] Error logging duplicate attempt:', error);
    }
}
const duplicateDetectionMiddleware = (req, res, next) => {
    try {
        const payload = req.body;
        const templateName = payload.template_name || req.body.template_name || req.body.templateName;
        const phone = payload.phone || payload.recipient_number || req.body.recipient_number;
        const variables = payload.variables || req.body.variables || {};
        if (!templateName || !phone) {
            return next();
        }
        const messageHash = generateMessageHash(templateName, phone, variables);
        const cacheKey = `msg_${messageHash}`;
        const isDuplicate = duplicateCache.get(cacheKey);
        if (isDuplicate) {
            console.log(`[DUPLICATE DETECTION] Duplicate message detected: ${cacheKey}`);
            if (req.session?.user?.id) {
                logDuplicateAttempt(req.session.user.id, templateName, phone, variables, messageHash);
            }
            req.body._isDuplicate = true;
            req.body._duplicateHash = messageHash;
            res.locals.duplicateResponse = {
                success: false,
                duplicate: true,
                message: 'Duplicate message blocked - same template and variables sent to this number within 5 minutes',
                template: templateName,
                phone: phone,
                hash: messageHash
            };
        }
        else {
            duplicateCache.set(cacheKey, {
                timestamp: Date.now(),
                templateName,
                phone,
                userId: req.session?.user?.id || 'unknown'
            });
            console.log(`[DUPLICATE DETECTION] Message cached for duplicate detection: ${cacheKey}`);
        }
        next();
    }
    catch (error) {
        console.error('[DUPLICATE DETECTION] Error in duplicate detection middleware:', error);
        next();
    }
};
exports.duplicateDetectionMiddleware = duplicateDetectionMiddleware;
const isDuplicateRequest = (req) => {
    return req.body._isDuplicate === true;
};
exports.isDuplicateRequest = isDuplicateRequest;
const getDuplicateResponse = (res) => {
    return res.locals.duplicateResponse;
};
exports.getDuplicateResponse = getDuplicateResponse;
const checkAndHandleDuplicate = async (userId, templateName, phone, variables, campaignId) => {
    try {
        const messageHash = generateMessageHash(templateName, phone, variables);
        const cacheKey = `msg_${messageHash}`;
        const isDuplicate = duplicateCache.get(cacheKey);
        if (isDuplicate) {
            console.log(`[DUPLICATE DETECTION] Duplicate message detected: Template="${templateName}", Phone="${phone}", Variables=${JSON.stringify(variables)}, Hash="${messageHash}"`);
            await logDuplicateAttempt(userId, templateName, phone, variables, messageHash, campaignId);
            return { isDuplicate: true, hash: messageHash };
        }
        else {
            duplicateCache.set(cacheKey, {
                timestamp: Date.now(),
                templateName,
                phone,
                variables,
                userId
            });
            console.log(`[DUPLICATE DETECTION] Message cached: Template="${templateName}", Phone="${phone}", Variables=${JSON.stringify(variables)}, Hash="${messageHash}"`);
            return { isDuplicate: false, hash: messageHash };
        }
    }
    catch (error) {
        console.error('[DUPLICATE DETECTION] Error in duplicate check:', error);
        return { isDuplicate: false, hash: '' };
    }
};
exports.checkAndHandleDuplicate = checkAndHandleDuplicate;
const getDuplicateCacheStats = () => {
    const keys = duplicateCache.keys();
    const stats = duplicateCache.getStats();
    return {
        totalCachedMessages: keys.length,
        cacheHits: stats.hits,
        cacheMisses: stats.misses,
        cacheKeys: keys.slice(0, 10)
    };
};
exports.getDuplicateCacheStats = getDuplicateCacheStats;
//# sourceMappingURL=duplicateDetection.js.map
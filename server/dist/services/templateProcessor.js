"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTemplateStatusChange = handleTemplateStatusChange;
exports.processTemplateWebhookEntry = processTemplateWebhookEntry;
const templatesRepo_1 = require("../repos/templatesRepo");
const waGraph_1 = require("./waGraph");
const sseBroadcaster_1 = require("./sseBroadcaster");
async function handleTemplateStatusChange(value, wabaId) {
    try {
        console.log('📋 [TEMPLATE_PROCESSOR] ===== WEBHOOK RECEIVED =====');
        console.log('📋 [TEMPLATE_PROCESSOR] Processing template status update:', JSON.stringify(value, null, 2));
        console.log('📋 [TEMPLATE_PROCESSOR] WABA ID:', wabaId);
        let userBusiness = null;
        if (wabaId) {
            userBusiness = await templatesRepo_1.userBusinessRepo.getByWabaIdWithCreds(wabaId);
            if (!userBusiness?.userId) {
                console.log(`⚠️  [TEMPLATE_PROCESSOR] No user found for WABA ID: ${wabaId}`);
                return;
            }
            console.log(`✅ [TEMPLATE_PROCESSOR] Resolved WABA ID ${wabaId} -> user ${userBusiness.userId}`);
        }
        else {
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) {
                console.log('⚠️  [TEMPLATE_PROCESSOR] No WABA ID or phone_number_id in webhook payload');
                return;
            }
            userBusiness = await templatesRepo_1.userBusinessRepo.getByPhoneNumberIdWithCreds(phoneNumberId);
            if (!userBusiness?.userId) {
                console.log(`⚠️  [TEMPLATE_PROCESSOR] No user found for phone_number_id: ${phoneNumberId}`);
                return;
            }
            console.log(`✅ [TEMPLATE_PROCESSOR] Resolved phone_number_id ${phoneNumberId} -> user ${userBusiness.userId}`);
        }
        const template = value?.message_template || value?.template || {};
        const name = value?.message_template_name ||
            template?.name ||
            value?.name;
        const language = value?.message_template_language ||
            template?.language?.code ||
            template?.language ||
            'en_US';
        const status = String(value?.event || value?.status || 'UNKNOWN').toUpperCase();
        const reason = (value?.reason || value?.rejected_reason || null);
        const reviewedAt = value?.last_updated_time
            ? new Date(Number(value.last_updated_time) * 1000)
            : new Date();
        if (!name) {
            console.log('⚠️  [TEMPLATE_PROCESSOR] No template name found in webhook payload');
            console.log('📋 [TEMPLATE_PROCESSOR] Available webhook data:', {
                template_keys: Object.keys(template),
                value_keys: Object.keys(value),
                raw_name: value?.name,
                template_name: template?.name
            });
            return;
        }
        console.log('📋 [TEMPLATE_PROCESSOR] ===== PROCESSING TEMPLATE =====');
        console.log('📋 [TEMPLATE_PROCESSOR] Template details:', {
            name,
            language,
            status,
            userId: userBusiness.userId,
            wabaId: wabaId,
            resolvedVia: wabaId ? 'WABA_ID' : 'phone_number_id'
        });
        let category = (template?.category || null);
        if (!category && userBusiness?.wabaId && userBusiness?.accessToken) {
            try {
                console.log(`🔄 [TEMPLATE_PROCESSOR] Category missing from webhook, fetching from Graph API for ${name}`);
                const graphTemplate = await (0, waGraph_1.fetchTemplateFromGraph)(userBusiness.wabaId, userBusiness.accessToken, name, language);
                if (graphTemplate?.category) {
                    category = String(graphTemplate.category).toUpperCase();
                    console.log(`✅ [TEMPLATE_PROCESSOR] Retrieved category from Graph API: ${category}`);
                }
                else {
                    console.log(`⚠️  [TEMPLATE_PROCESSOR] Could not retrieve category from Graph API for ${name}`);
                }
            }
            catch (error) {
                console.error('❌ [TEMPLATE_PROCESSOR] Graph API fallback failed:', {
                    userId: userBusiness.userId,
                    name,
                    language,
                    error: String(error)
                });
            }
        }
        if (category) {
            category = String(category).toUpperCase();
            if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category)) {
                console.log(`⚠️  [TEMPLATE_PROCESSOR] Unknown category: ${category}, keeping as-is`);
            }
        }
        console.log(`📋 [TEMPLATE_PROCESSOR] Updating template: ${name} (${language}) -> ${status}${category ? ` [${category}]` : ''} for user ${userBusiness.userId}`);
        try {
            await templatesRepo_1.templatesRepo.upsertStatusAndCategory({
                userId: userBusiness.userId,
                name,
                language,
                status,
                category: category || undefined,
                reason,
                reviewedAt
            });
            console.log(`✅ [TEMPLATE_PROCESSOR] Database update successful for ${name} (${language})`);
        }
        catch (dbError) {
            console.error(`❌ [TEMPLATE_PROCESSOR] Database update failed for ${name} (${language}):`, dbError);
            throw dbError;
        }
        const ssePayload = {
            type: 'template_update',
            name,
            language,
            status,
            category: category || null,
            reason,
            at: new Date().toISOString(),
            reviewedAt: reviewedAt.toISOString()
        };
        sseBroadcaster_1.sseHub.emitTemplate(userBusiness.userId, ssePayload);
        console.log(`✅ [TEMPLATE_PROCESSOR] Template update completed: ${name} (${language}) for user ${userBusiness.userId}`);
    }
    catch (error) {
        console.error('❌ [TEMPLATE_PROCESSOR] Error processing template status change:', error);
    }
}
async function processTemplateWebhookEntry(entry) {
    try {
        const changes = entry?.changes || [];
        const wabaId = entry?.id;
        for (const change of changes) {
            if (change?.field === 'message_template_status_update') {
                await handleTemplateStatusChange(change.value, wabaId);
            }
        }
    }
    catch (error) {
        console.error('❌ [TEMPLATE_PROCESSOR] Error processing webhook entry:', error);
    }
}
//# sourceMappingURL=templateProcessor.js.map
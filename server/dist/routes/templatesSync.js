"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templatesRepo_1 = require("../repos/templatesRepo");
const waGraph_1 = require("../services/waGraph");
const sseBroadcaster_1 = require("../services/sseBroadcaster");
const router = (0, express_1.Router)();
router.post('/api/templates/sync', async (req, res) => {
    try {
        const { userId, name, language } = req.body || {};
        if (!userId) {
            return res.status(400).json({
                error: 'userId required',
                message: 'Please provide userId in request body'
            });
        }
        console.log(`🔄 [TEMPLATES_SYNC] Starting manual sync for user ${userId}${name ? ` (template: ${name})` : ''}`);
        const creds = await templatesRepo_1.userBusinessRepo.getCredsByUserId(userId);
        if (!creds?.wabaId || !creds?.accessToken) {
            return res.status(400).json({
                error: 'Missing WABA credentials',
                message: 'WhatsApp Business API credentials not configured for this user'
            });
        }
        const changes = [];
        if (name) {
            console.log(`🔍 [TEMPLATES_SYNC] Syncing specific template: ${name}${language ? ` (${language})` : ''}`);
            const templateData = await (0, waGraph_1.fetchTemplateFromGraph)(creds.wabaId, creds.accessToken, name, language);
            if (!templateData) {
                return res.status(404).json({
                    error: 'Template not found',
                    message: `Template '${name}' not found in WhatsApp Business API`
                });
            }
            await templatesRepo_1.templatesRepo.upsertStatusAndCategory({
                userId,
                name: templateData.name,
                language: templateData.language,
                status: String(templateData.status || 'UNKNOWN').toUpperCase(),
                category: templateData.category ? String(templateData.category).toUpperCase() : undefined,
                reason: templateData.reason || null,
                reviewedAt: templateData.reviewedAt || new Date()
            });
            changes.push(templateData);
            sseBroadcaster_1.sseHub.emitTemplate(userId, {
                type: 'template_update',
                name: templateData.name,
                language: templateData.language,
                status: String(templateData.status || 'UNKNOWN').toUpperCase(),
                category: templateData.category ? String(templateData.category).toUpperCase() : null,
                reason: templateData.reason || null,
                at: new Date().toISOString(),
                source: 'manual_sync'
            });
        }
        else {
            console.log(`🔍 [TEMPLATES_SYNC] Syncing all templates for user ${userId}`);
            const allTemplates = await (0, waGraph_1.fetchAllTemplatesFromGraph)(creds.wabaId, creds.accessToken);
            if (allTemplates.length === 0) {
                return res.json({
                    success: true,
                    message: 'No templates found for this user',
                    updated: 0,
                    items: []
                });
            }
            console.log(`📋 [TEMPLATES_SYNC] Processing ${allTemplates.length} templates`);
            for (const templateData of allTemplates) {
                try {
                    await templatesRepo_1.templatesRepo.upsertStatusAndCategory({
                        userId,
                        name: templateData.name,
                        language: templateData.language,
                        status: String(templateData.status || 'UNKNOWN').toUpperCase(),
                        category: templateData.category ? String(templateData.category).toUpperCase() : undefined,
                        reason: templateData.reason || null,
                        reviewedAt: templateData.reviewedAt || new Date()
                    });
                    changes.push(templateData);
                    sseBroadcaster_1.sseHub.emitTemplate(userId, {
                        type: 'template_update',
                        name: templateData.name,
                        language: templateData.language,
                        status: String(templateData.status || 'UNKNOWN').toUpperCase(),
                        category: templateData.category ? String(templateData.category).toUpperCase() : null,
                        reason: templateData.reason || null,
                        at: new Date().toISOString(),
                        source: 'manual_sync'
                    });
                }
                catch (error) {
                    console.error(`❌ [TEMPLATES_SYNC] Error processing template ${templateData.name}:`, error);
                }
            }
        }
        console.log(`✅ [TEMPLATES_SYNC] Completed sync for user ${userId}: ${changes.length} templates updated`);
        res.json({
            success: true,
            message: `Successfully synced ${changes.length} template${changes.length !== 1 ? 's' : ''}`,
            updated: changes.length,
            items: changes.map(t => ({
                name: t.name,
                language: t.language,
                status: t.status,
                category: t.category,
                reason: t.reason,
                reviewedAt: t.reviewedAt
            }))
        });
    }
    catch (error) {
        console.error('❌ [TEMPLATES_SYNC] Sync error:', error?.response?.data || error?.message || error);
        res.status(500).json({
            success: false,
            error: 'Sync failed',
            message: error?.response?.data?.error?.message || error?.message || 'Unknown error occurred',
            details: error?.response?.data || null
        });
    }
});
router.get('/api/templates/sync/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        const creds = await templatesRepo_1.userBusinessRepo.getCredsByUserId(userId);
        const hasCredentials = Boolean(creds?.wabaId && creds?.accessToken);
        const templates = await templatesRepo_1.templatesRepo.getAllByUserId(userId);
        res.json({
            userId,
            hasCredentials,
            templatesCount: templates.length,
            lastSync: templates.length > 0
                ? Math.max(...templates.map(t => new Date(t.updated_at).getTime()))
                : null,
            canSync: hasCredentials
        });
    }
    catch (error) {
        console.error('❌ [TEMPLATES_SYNC] Status check error:', error);
        res.status(500).json({
            error: 'Status check failed',
            message: error?.message || 'Unknown error occurred'
        });
    }
});
exports.default = router;

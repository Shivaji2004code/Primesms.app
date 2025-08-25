"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTemplateFromGraph = fetchTemplateFromGraph;
exports.fetchAllTemplatesFromGraph = fetchAllTemplatesFromGraph;
const axios_1 = __importDefault(require("axios"));
async function fetchTemplateFromGraph(wabaId, accessToken, name, language) {
    try {
        const version = process.env.GRAPH_API_VERSION || 'v22.0';
        const baseUrl = `https://graph.facebook.com/${version}/${wabaId}/message_templates`;
        const params = {
            access_token: accessToken,
            limit: name ? 10 : 50
        };
        if (name) {
            params.name = name;
        }
        console.log(`🔍 [GRAPH] Fetching template${name ? ` ${name}` : 's'} from Graph API`);
        const response = await axios_1.default.get(baseUrl, {
            params,
            timeout: 10000
        });
        const templates = response.data?.data || [];
        if (templates.length === 0) {
            console.log(`⚠️  [GRAPH] No templates found${name ? ` for name ${name}` : ''}`);
            return null;
        }
        let targetTemplate = templates[0];
        if (name && language) {
            const exactMatch = templates.find((t) => t.name === name &&
                (t.language?.code || t.language || '').toLowerCase() === language.toLowerCase());
            if (exactMatch) {
                targetTemplate = exactMatch;
            }
            else {
                const nameMatch = templates.find((t) => t.name === name);
                if (nameMatch) {
                    targetTemplate = nameMatch;
                }
            }
        }
        const templateData = {
            name: targetTemplate.name,
            language: targetTemplate.language?.code || targetTemplate.language || 'en_US',
            status: targetTemplate.status,
            category: targetTemplate.category,
            reason: targetTemplate.rejected_reason || targetTemplate.rejection_reason,
            reviewedAt: targetTemplate.last_updated_time
                ? new Date(Number(targetTemplate.last_updated_time) * 1000)
                : undefined
        };
        console.log(`✅ [GRAPH] Retrieved template data: ${templateData.name} (${templateData.language}) - ${templateData.category} - ${templateData.status}`);
        return templateData;
    }
    catch (error) {
        console.error('❌ [GRAPH] Error fetching template from Graph API:', {
            wabaId,
            name,
            language,
            error: error?.response?.data || error?.message || String(error)
        });
        return null;
    }
}
async function fetchAllTemplatesFromGraph(wabaId, accessToken) {
    try {
        const version = process.env.GRAPH_API_VERSION || 'v22.0';
        const baseUrl = `https://graph.facebook.com/${version}/${wabaId}/message_templates`;
        console.log(`🔍 [GRAPH] Fetching all templates for WABA ${wabaId}`);
        const response = await axios_1.default.get(baseUrl, {
            params: {
                access_token: accessToken,
                limit: 200
            },
            timeout: 15000
        });
        const templates = response.data?.data || [];
        const templateData = templates.map((t) => ({
            name: t.name,
            language: t.language?.code || t.language || 'en_US',
            status: t.status,
            category: t.category,
            reason: t.rejected_reason || t.rejection_reason,
            reviewedAt: t.last_updated_time
                ? new Date(Number(t.last_updated_time) * 1000)
                : undefined
        }));
        console.log(`✅ [GRAPH] Retrieved ${templateData.length} templates from Graph API`);
        return templateData;
    }
    catch (error) {
        console.error('❌ [GRAPH] Error fetching all templates from Graph API:', {
            wabaId,
            error: error?.response?.data || error?.message || String(error)
        });
        return [];
    }
}

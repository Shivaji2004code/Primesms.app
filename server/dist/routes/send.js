"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../db"));
const sendApiHelpers_1 = require("../utils/sendApiHelpers");
const creditSystem_1 = require("../utils/creditSystem");
const duplicateDetection_1 = require("../middleware/duplicateDetection");
const router = express_1.default.Router();
const sendRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(sendRateLimit);
router.get('/template-info/:username/:templatename', async (req, res) => {
    try {
        const { username, templatename } = req.params;
        const authResult = await authenticateAndFetchCredentials(username);
        if (!authResult.success) {
            return res.status(authResult.statusCode || 500).json({
                error: authResult.error,
                message: authResult.message
            });
        }
        const { userId } = authResult.data;
        const templateResult = await fetchTemplate(userId, templatename);
        if (!templateResult.success) {
            return res.status(templateResult.statusCode || 500).json({
                error: templateResult.error,
                message: templateResult.message
            });
        }
        const template = templateResult.data;
        const analysis = analyzeTemplate(template);
        res.json({
            success: true,
            template: {
                name: template.name,
                language: template.language,
                status: template.status
            },
            requirements: analysis
        });
    }
    catch (error) {
        console.error('Template analysis error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to analyze template'
        });
    }
});
router.get('/cost-preview/:username/:templatename', async (req, res) => {
    try {
        const { username, templatename } = req.params;
        const recipientCount = parseInt(req.query.recipients) || 1;
        const authResult = await authenticateAndFetchCredentials(username);
        if (!authResult.success) {
            return res.status(authResult.statusCode || 500).json({
                error: authResult.error,
                message: authResult.message
            });
        }
        const { userId } = authResult.data;
        const costPreview = await (0, creditSystem_1.getCostPreview)(userId, templatename, recipientCount);
        res.json({
            success: true,
            preview: {
                templateName: templatename,
                category: costPreview.category,
                recipientCount: recipientCount,
                unitPrice: costPreview.unitPrice,
                totalCost: costPreview.totalCost,
                currency: costPreview.currency,
                pricingMode: costPreview.pricingMode
            }
        });
    }
    catch (error) {
        console.error('Cost preview error:', error);
        res.status(500).json({
            error: 'Failed to get cost preview',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/cost-preview', async (req, res) => {
    try {
        const { username, templatename, recipients } = req.body;
        if (!username || !templatename) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'username and templatename are required'
            });
        }
        if (!recipients || !Array.isArray(recipients)) {
            return res.status(400).json({
                error: 'Invalid recipients',
                message: 'recipients must be an array of phone numbers'
            });
        }
        const authResult = await authenticateAndFetchCredentials(username);
        if (!authResult.success) {
            return res.status(authResult.statusCode || 500).json({
                error: authResult.error,
                message: authResult.message
            });
        }
        const { userId } = authResult.data;
        const bulkPreview = await (0, creditSystem_1.getBulkCostPreview)(userId, templatename, recipients);
        res.json({
            success: true,
            preview: {
                templateName: templatename,
                category: bulkPreview.category,
                recipientCount: bulkPreview.recipientCount,
                unitPrice: bulkPreview.unitPrice,
                totalCost: bulkPreview.totalCost,
                currency: bulkPreview.currency,
                pricingMode: bulkPreview.pricingMode,
                breakdown: bulkPreview.breakdown
            }
        });
    }
    catch (error) {
        console.error('Bulk cost preview error:', error);
        res.status(500).json({
            error: 'Failed to get bulk cost preview',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.all('/', async (req, res) => {
    try {
        const params = extractParameters(req);
        const validation = validateRequiredParams(params);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Bad Request',
                message: validation.message,
                details: validation.details
            });
        }
        const authResult = await authenticateAndFetchCredentials(params.username);
        if (!authResult.success) {
            return res.status(authResult.statusCode || 500).json({
                error: authResult.error,
                message: authResult.message
            });
        }
        const { userId, businessInfo } = authResult.data;
        const templateResult = await fetchTemplate(userId, params.templatename);
        if (!templateResult.success) {
            return res.status(templateResult.statusCode || 500).json({
                error: templateResult.error,
                message: templateResult.message
            });
        }
        const template = templateResult.data;
        if (!(0, sendApiHelpers_1.validatePhoneNumber)(params.recipient_number)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid recipient phone number format',
                details: 'Phone number must be in Meta WhatsApp API format (country code + number, no + prefix, e.g., 919398424270 for India, 14155552345 for US)'
            });
        }
        const payload = constructMetaAPIPayload(params, template, businessInfo);
        const variables = extractVariablesFromParams(params);
        const duplicateCheck = await (0, duplicateDetection_1.checkAndHandleDuplicate)(userId, template.name, params.recipient_number, variables);
        if (duplicateCheck.isDuplicate) {
            console.log(`❌ DUPLICATE DETECTED: API call blocked for template ${template.name} to ${params.recipient_number}`);
            try {
                const templateCategory = template.category;
                const { cost } = await (0, creditSystem_1.calculateCreditCost)(userId, template.name, 1);
                await (0, creditSystem_1.deductCredits)({
                    userId,
                    amount: cost,
                    transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_DUPLICATE_BLOCKED,
                    templateCategory,
                    templateName: template.name,
                    description: `Duplicate message blocked via API - credits still deducted for ${params.recipient_number}`
                });
                console.log(`[DUPLICATE DETECTION] Deducted ${cost} credits for blocked duplicate API message`);
            }
            catch (creditError) {
                console.error('[DUPLICATE DETECTION] Error deducting credits for duplicate API call:', creditError);
            }
            return res.status(400).json({
                success: false,
                duplicate: true,
                message: 'Duplicate message blocked - same template and variables sent to this number within 5 minutes',
                template: template.name,
                phone: params.recipient_number,
                variables: variables,
                hash: duplicateCheck.hash
            });
        }
        const sendResult = await sendWhatsAppMessage(payload, businessInfo);
        if (!sendResult.success) {
            return res.status(sendResult.statusCode || 500).json({
                error: sendResult.error,
                message: sendResult.message
            });
        }
        try {
            const templateCategory = template.category;
            const { cost } = await (0, creditSystem_1.calculateCreditCost)(userId, template.name, 1);
            const creditResult = await (0, creditSystem_1.deductCredits)({
                userId,
                amount: cost,
                transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_API_DELIVERED,
                templateCategory,
                templateName: template.name,
                messageId: sendResult.data.message_id,
                description: `API message sent successfully to ${params.recipient_number}`
            });
            if (!creditResult.success) {
                console.warn(`[CREDIT SYSTEM] Failed to deduct credits for API delivery: insufficient balance`);
            }
            else {
                console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for API delivery. New balance: ${creditResult.newBalance}`);
            }
        }
        catch (creditError) {
            console.error('Credit deduction error for API delivery:', creditError);
        }
        await logMessageSend(userId, template.id, params.recipient_number, sendResult.data.message_id, template.name, businessInfo.whatsapp_number_id);
        return res.status(200).json({
            success: true,
            message: 'Message sent successfully',
            message_id: sendResult.data.message_id,
            recipient: params.recipient_number,
            template: params.templatename
        });
    }
    catch (error) {
        console.error('Send API Error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while processing your request'
        });
    }
});
function extractVariablesFromParams(params) {
    const variables = {};
    Object.keys(params).forEach(key => {
        if (key.startsWith('var') && params[key]) {
            variables[key] = params[key].toString();
        }
    });
    return variables;
}
function extractParameters(req) {
    const isPost = req.method === 'POST';
    const source = isPost ? req.body : req.query;
    const params = {
        username: (0, sendApiHelpers_1.sanitizeInput)(source.username),
        templatename: (0, sendApiHelpers_1.sanitizeInput)(source.templatename),
        recipient_number: (0, sendApiHelpers_1.sanitizeInput)(source.recipient_number),
        header_text: source.header_text ? (0, sendApiHelpers_1.sanitizeInput)(source.header_text) : undefined,
        button_payload: source.button_payload ? (0, sendApiHelpers_1.sanitizeInput)(source.button_payload) : undefined,
        button_text: source.button_text ? (0, sendApiHelpers_1.sanitizeInput)(source.button_text) : undefined,
        button_url: source.button_url ? (0, sendApiHelpers_1.sanitizeInput)(source.button_url) : undefined
    };
    const variables = (0, sendApiHelpers_1.extractVariables)(source);
    Object.assign(params, variables);
    return params;
}
function validateRequiredParams(params) {
    const required = ['username', 'templatename', 'recipient_number'];
    const missing = [];
    for (const param of required) {
        if (!params[param] || typeof params[param] !== 'string' || params[param].trim() === '') {
            missing.push(param);
        }
    }
    if (missing.length > 0) {
        return {
            isValid: false,
            message: 'Missing required parameters',
            details: missing.map(param => `${param} is required`)
        };
    }
    return { isValid: true };
}
async function authenticateAndFetchCredentials(username) {
    try {
        const query = `
      SELECT 
        u.id as user_id,
        u.username,
        ubi.whatsapp_number_id,
        ubi.access_token,
        ubi.is_active,
        ubi.business_name
      FROM users u
      INNER JOIN user_business_info ubi ON u.id = ubi.user_id
      WHERE u.username = $1 AND ubi.is_active = true
    `;
        const result = await db_1.default.query(query, [username]);
        if (result.rows.length === 0) {
            return {
                success: false,
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid username or inactive WhatsApp Business account'
            };
        }
        const row = result.rows[0];
        if (!row.whatsapp_number_id || !row.access_token) {
            return {
                success: false,
                statusCode: 401,
                error: 'Unauthorized',
                message: 'WhatsApp Business API not properly configured for this user'
            };
        }
        return {
            success: true,
            data: {
                userId: row.user_id,
                businessInfo: {
                    whatsapp_number_id: row.whatsapp_number_id,
                    access_token: row.access_token,
                    business_name: row.business_name
                }
            }
        };
    }
    catch (error) {
        console.error('Authentication error:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Failed to authenticate user'
        };
    }
}
async function fetchTemplate(userId, templateName) {
    try {
        const query = `
      SELECT 
        id,
        name,
        language,
        components,
        status,
        template_id,
        header_media_id,
        header_type,
        media_id,
        category
      FROM templates 
      WHERE user_id = $1 AND name = $2 AND status IN ('APPROVED', 'ACTIVE')
    `;
        const result = await db_1.default.query(query, [userId, templateName]);
        if (result.rows.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Not Found',
                message: `Template '${templateName}' not found or not active`
            };
        }
        return {
            success: true,
            data: result.rows[0]
        };
    }
    catch (error) {
        console.error('Template fetch error:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Failed to fetch template'
        };
    }
}
function constructMetaAPIPayload(params, template, businessInfo) {
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.recipient_number,
        type: "template",
        template: {
            name: template.name,
            language: {
                code: template.language || 'en_US'
            },
            components: []
        }
    };
    const components = [];
    const templateComponents = template.components || [];
    const headerComponent = templateComponents.find((c) => c.type === 'HEADER');
    if (headerComponent) {
        if (headerComponent.format === 'TEXT' && params.header_text) {
            components.push({
                type: "header",
                parameters: [{
                        type: "text",
                        text: params.header_text
                    }]
            });
        }
        else if (headerComponent.format === 'IMAGE') {
            const mediaId = template.media_id || template.header_media_id;
            if (mediaId) {
                components.push({
                    type: "header",
                    parameters: [{
                            type: "image",
                            image: {
                                id: mediaId
                            }
                        }]
                });
            }
        }
        else if (headerComponent.format === 'VIDEO' && headerComponent.example?.header_handle) {
        }
        else if (headerComponent.format === 'DOCUMENT' && headerComponent.example?.header_handle) {
        }
    }
    const bodyComponent = templateComponents.find((c) => c.type === 'BODY');
    if (template.category === 'AUTHENTICATION') {
        const vars = Object.keys(params)
            .filter(k => k.startsWith('var'))
            .sort((a, b) => {
            const numA = parseInt(a.slice(3)) || 0;
            const numB = parseInt(b.slice(3)) || 0;
            return numA - numB;
        })
            .map(k => params[k])
            .filter(v => v !== undefined && v !== null && v.toString().trim() !== '');
        console.log(`🔍 DEBUG: Authentication template detected. Template: ${template.name}, Variables: ${vars.length}`);
        if (vars.length > 0) {
            const otpCode = vars[0];
            console.log(`🔍 DEBUG: Adding authentication template components with OTP: ${otpCode}`);
            components.push({
                type: "body",
                parameters: [{ type: "text", text: otpCode.toString() }]
            });
            components.push({
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: otpCode.toString() }]
            });
        }
        else {
            console.log('🔍 DEBUG: No variables provided for authentication template - sending as static');
        }
    }
    else if (bodyComponent) {
        const vars = Object.keys(params)
            .filter(k => k.startsWith('var'))
            .sort((a, b) => {
            const numA = parseInt(a.slice(3)) || 0;
            const numB = parseInt(b.slice(3)) || 0;
            return numA - numB;
        })
            .map(k => params[k])
            .filter(v => v !== undefined && v !== null && v.toString().trim() !== '');
        if (vars.length > 0) {
            components.push({
                type: "body",
                parameters: vars.map(v => ({ type: "text", text: v.toString() }))
            });
        }
    }
    const buttonComponent = templateComponents.find((c) => c.type === 'BUTTONS');
    if (buttonComponent && buttonComponent.buttons) {
        const buttons = buttonComponent.buttons;
        buttons.forEach((button, index) => {
            if (button.type === 'QUICK_REPLY' && params.button_payload) {
                components.push({
                    type: "button",
                    sub_type: "quick_reply",
                    index: index.toString(),
                    parameters: [{
                            type: "payload",
                            payload: params.button_payload
                        }]
                });
            }
            else if (button.type === 'URL') {
                if (button.url && button.url.includes('{{1}}') && params.button_url) {
                    components.push({
                        type: "button",
                        sub_type: "url",
                        index: index.toString(),
                        parameters: [{
                                type: "text",
                                text: params.button_url
                            }]
                    });
                }
            }
            else if (button.type === 'PHONE_NUMBER') {
            }
        });
    }
    payload.template.components = components;
    console.log(`🔍 DEBUG: Template category: ${template.category}, name: ${template.name}`);
    if (template.category === 'AUTHENTICATION') {
        console.log('🔍 DEBUG: Authentication template payload:', JSON.stringify(payload, null, 2));
    }
    return payload;
}
async function sendWhatsAppMessage(payload, businessInfo) {
    try {
        const isTestToken = !businessInfo.access_token ||
            businessInfo.access_token.startsWith('test_') ||
            businessInfo.access_token === 'test' ||
            businessInfo.access_token === 'mock_token';
        const isTestMode = process.env.NODE_ENV === 'test' || isTestToken;
        if (isTestMode) {
            console.log('🧪 TEST MODE: Mock sending message:', {
                to: payload.to,
                template: payload.template.name,
                components: payload.template.components,
                reason: isTestToken ? 'Invalid/Test Access Token' : 'NODE_ENV=test',
                access_token_preview: businessInfo.access_token ?
                    businessInfo.access_token.substring(0, 10) + '...' : 'undefined'
            });
            return {
                success: true,
                data: {
                    message_id: `test_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                }
            };
        }
        const url = `https://graph.facebook.com/v19.0/${businessInfo.whatsapp_number_id}/messages`;
        const response = await axios_1.default.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${businessInfo.access_token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        if (response.status === 200 && response.data.messages && response.data.messages[0]) {
            return {
                success: true,
                data: {
                    message_id: response.data.messages[0].id
                }
            };
        }
        else {
            throw new Error('Unexpected response format from Meta API');
        }
    }
    catch (error) {
        console.error('Meta API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        if (error.response?.status === 400) {
            return {
                success: false,
                statusCode: 400,
                error: 'Bad Request',
                message: 'Invalid template parameters or recipient number'
            };
        }
        else if (error.response?.status === 401) {
            return {
                success: false,
                statusCode: 502,
                error: 'Bad Gateway',
                message: 'WhatsApp API authentication failed'
            };
        }
        else if (error.response?.status === 403) {
            return {
                success: false,
                statusCode: 502,
                error: 'Bad Gateway',
                message: 'WhatsApp API access forbidden'
            };
        }
        else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return {
                success: false,
                statusCode: 504,
                error: 'Gateway Timeout',
                message: 'WhatsApp API request timed out'
            };
        }
        else {
            return {
                success: false,
                statusCode: 502,
                error: 'Bad Gateway',
                message: 'Failed to send message via WhatsApp API'
            };
        }
    }
}
async function logMessageSend(userId, templateId, recipient, messageId, templateName, whatsappNumberId) {
    try {
        const cleanRecipient = recipient?.toString().trim();
        if (!cleanRecipient) {
            console.error(`⚠️  API send attempted with empty recipient for template: ${templateName}`);
            return;
        }
        const campaignName = `API_SEND_${templateName}_${Date.now()}`;
        const result = await db_1.default.query(`
      INSERT INTO campaign_logs (
        user_id, campaign_name, template_used, phone_number_id, recipient_number, 
        message_id, status, total_recipients, successful_sends, failed_sends,
        sent_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'sent', 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [userId, campaignName, templateName, whatsappNumberId, cleanRecipient, messageId]);
        console.log(`✅ Created campaign_logs entry for API send: ${cleanRecipient} (messageId: ${messageId}, recordId: ${result.rows[0].id})`);
    }
    catch (error) {
        console.error('❌ Failed to log API message send:', error);
        console.error('Error details:', {
            userId, templateName, recipient, messageId, whatsappNumberId
        });
    }
}
function analyzeTemplate(template) {
    const components = template.components || [];
    const analysis = {
        required_params: ['username', 'templatename', 'recipient_number'],
        optional_params: [],
        variable_count: 0,
        has_header: false,
        header_type: null,
        has_buttons: false,
        button_types: [],
        example_request: {
            method: 'POST',
            url: '/api/send',
            body: {
                username: 'your_username',
                templatename: template.name,
                recipient_number: '+1234567890'
            }
        }
    };
    const headerComponent = components.find((c) => c.type === 'HEADER');
    if (headerComponent) {
        analysis.has_header = true;
        analysis.header_type = headerComponent.format;
        if (headerComponent.format === 'TEXT') {
            analysis.optional_params.push({
                name: 'header_text',
                description: 'Text content for the header',
                required: false,
                example: 'Welcome Message'
            });
            analysis.example_request.body.header_text = 'Your header text here';
        }
    }
    const bodyComponent = components.find((c) => c.type === 'BODY');
    if (bodyComponent && bodyComponent.text) {
        const variableMatches = bodyComponent.text.match(/\{\{\d+\}\}/g);
        if (variableMatches) {
            analysis.variable_count = variableMatches.length;
            for (let i = 1; i <= analysis.variable_count; i++) {
                analysis.optional_params.push({
                    name: `var${i}`,
                    description: `Variable ${i} for template body`,
                    required: true,
                    example: `Value ${i}`
                });
                analysis.example_request.body[`var${i}`] = `Value ${i}`;
            }
        }
    }
    const buttonComponent = components.find((c) => c.type === 'BUTTONS');
    if (buttonComponent && buttonComponent.buttons) {
        analysis.has_buttons = true;
        buttonComponent.buttons.forEach((button, index) => {
            analysis.button_types.push({
                type: button.type,
                text: button.text,
                index: index
            });
            if (button.type === 'QUICK_REPLY') {
                analysis.optional_params.push({
                    name: 'button_payload',
                    description: `Payload for quick reply button: "${button.text}"`,
                    required: false,
                    example: 'CONFIRM_ACTION'
                });
                analysis.example_request.body.button_payload = 'YOUR_PAYLOAD_HERE';
            }
            else if (button.type === 'URL' && button.url && button.url.includes('{{1}}')) {
                analysis.optional_params.push({
                    name: 'button_url',
                    description: `Dynamic URL for button: "${button.text}"`,
                    required: false,
                    example: 'https://example.com/order/12345'
                });
                analysis.example_request.body.button_url = 'https://your-url.com/path';
            }
        });
    }
    return analysis;
}
exports.default = router;

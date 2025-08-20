"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const XLSX = require('xlsx');
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const creditSystem_1 = require("../utils/creditSystem");
const duplicateDetection_1 = require("../middleware/duplicateDetection");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        if (allowedMimes.includes(file.mimetype) ||
            file.originalname.match(/\.(xlsx|xls|csv|txt|jpg|jpeg|png|gif)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only Excel (.xlsx, .xls), CSV (.csv), text (.txt), and image (.jpg, .jpeg, .png, .gif) files are allowed'));
        }
    }
});
async function uploadWhatsappMedia(imageUrl, phoneNumberId, accessToken) {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;
    try {
        console.log(`🔄 Downloading image from: ${imageUrl}`);
        const imageResponse = await axios_1.default.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);
        const mimeType = imageResponse.headers['content-type'] || 'image/png';
        console.log(`📁 Downloaded image: ${imageBuffer.length} bytes, type: ${mimeType}`);
        const formData = new form_data_1.default();
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', imageBuffer, {
            contentType: mimeType,
            filename: 'header_image.png'
        });
        console.log(`🚀 Uploading to WhatsApp Media API: ${url}`);
        const response = await axios_1.default.post(url, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (response.data && response.data.id) {
            console.log(`✅ Media uploaded successfully. Received Media ID: ${response.data.id}`);
            return response.data.id;
        }
        console.error('❌ Media upload response did not contain an ID.', response.data);
        return null;
    }
    catch (error) {
        const errorData = error.response?.data || error.message;
        console.error('❌ Failed to upload media to WhatsApp API:', JSON.stringify(errorData, null, 2));
        return null;
    }
}
const router = express_1.default.Router();
const validatePhoneNumber = (phone) => {
    const cleaned = phone.replace(/[^\d]/g, '');
    console.log(`🔍 Phone validation: Original="${phone}", Cleaned="${cleaned}", Length=${cleaned.length}`);
    const isValid = /^[1-9]\d{7,14}$/.test(cleaned);
    console.log(`🔍 Phone validation result: ${isValid} for "${cleaned}"`);
    return isValid;
};
const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/[^\d]/g, '');
    console.log(`🔧 Formatting phone: Original="${phone}", Cleaned="${cleaned}"`);
    cleaned = cleaned.replace(/^0+/, '');
    if (cleaned.length > 0 && cleaned[0] === '0') {
        cleaned = cleaned.substring(1);
    }
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
        cleaned = '91' + cleaned;
        console.log(`🔧 Added India country code: "${cleaned}"`);
    }
    console.log(`🔧 Final formatted phone: "${cleaned}"`);
    return cleaned;
};
router.get('/numbers', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const result = await db_1.default.query(`SELECT 
        id,
        whatsapp_number_id as phone_number_id,
        whatsapp_number as phone_number,
        business_name,
        is_active
      FROM user_business_info 
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC`, [userId]);
        const numbers = result.rows.map(row => ({
            id: row.id,
            phone_number_id: row.phone_number_id,
            phone_number: row.phone_number,
            display_name: row.business_name || 'WhatsApp Business',
            label: `${row.business_name || 'WhatsApp Business'} (${row.phone_number})`
        }));
        res.json({
            success: true,
            data: numbers
        });
    }
    catch (error) {
        console.error('Error fetching WhatsApp numbers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch WhatsApp numbers'
        });
    }
});
router.get('/templates', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { language, exclude_auth } = req.query;
        let query = `
      SELECT 
        id,
        name,
        category,
        language,
        status,
        components
      FROM templates 
      WHERE user_id = $1 AND status IN ('APPROVED', 'ACTIVE')
    `;
        const params = [userId];
        let paramCount = 1;
        if (language) {
            paramCount++;
            query += ` AND language = $${paramCount}`;
            params.push(language);
        }
        if (exclude_auth === 'true') {
            query += ` AND category != 'AUTHENTICATION'`;
        }
        query += ` ORDER BY name, language`;
        const result = await db_1.default.query(query, params);
        const templates = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            language: row.language,
            category: row.category,
            status: row.status,
            components: row.components,
            hasVariables: JSON.stringify(row.components).includes('{{'),
            hasButtons: row.components.some((comp) => comp.type === 'BUTTONS')
        }));
        res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});
router.get('/languages', auth_1.requireAuth, async (req, res) => {
    try {
        const languages = [
            { code: 'af', name: 'Afrikaans' },
            { code: 'sq', name: 'Albanian' },
            { code: 'ar', name: 'Arabic' },
            { code: 'az', name: 'Azerbaijani' },
            { code: 'bn', name: 'Bengali' },
            { code: 'bg', name: 'Bulgarian' },
            { code: 'ca', name: 'Catalan' },
            { code: 'zh_CN', name: 'Chinese (Simplified)' },
            { code: 'zh_HK', name: 'Chinese (Traditional)' },
            { code: 'hr', name: 'Croatian' },
            { code: 'cs', name: 'Czech' },
            { code: 'da', name: 'Danish' },
            { code: 'nl', name: 'Dutch' },
            { code: 'en', name: 'English' },
            { code: 'en_GB', name: 'English (UK)' },
            { code: 'en_US', name: 'English (US)' },
            { code: 'et', name: 'Estonian' },
            { code: 'fil', name: 'Filipino' },
            { code: 'fi', name: 'Finnish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'el', name: 'Greek' },
            { code: 'gu', name: 'Gujarati' },
            { code: 'ha', name: 'Hausa' },
            { code: 'he', name: 'Hebrew' },
            { code: 'hi', name: 'Hindi' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'id', name: 'Indonesian' },
            { code: 'ga', name: 'Irish' },
            { code: 'it', name: 'Italian' },
            { code: 'ja', name: 'Japanese' },
            { code: 'kn', name: 'Kannada' },
            { code: 'kk', name: 'Kazakh' },
            { code: 'ko', name: 'Korean' },
            { code: 'lo', name: 'Lao' },
            { code: 'lv', name: 'Latvian' },
            { code: 'lt', name: 'Lithuanian' },
            { code: 'mk', name: 'Macedonian' },
            { code: 'ms', name: 'Malay' },
            { code: 'ml', name: 'Malayalam' },
            { code: 'mr', name: 'Marathi' },
            { code: 'nb', name: 'Norwegian' },
            { code: 'fa', name: 'Persian' },
            { code: 'pl', name: 'Polish' },
            { code: 'pt_BR', name: 'Portuguese (Brazil)' },
            { code: 'pt_PT', name: 'Portuguese (Portugal)' },
            { code: 'pa', name: 'Punjabi' },
            { code: 'ro', name: 'Romanian' },
            { code: 'ru', name: 'Russian' },
            { code: 'sk', name: 'Slovak' },
            { code: 'sl', name: 'Slovenian' },
            { code: 'es', name: 'Spanish' },
            { code: 'es_AR', name: 'Spanish (Argentina)' },
            { code: 'es_ES', name: 'Spanish (Spain)' },
            { code: 'es_MX', name: 'Spanish (Mexico)' },
            { code: 'sw', name: 'Swahili' },
            { code: 'sv', name: 'Swedish' },
            { code: 'ta', name: 'Tamil' },
            { code: 'te', name: 'Telugu' },
            { code: 'th', name: 'Thai' },
            { code: 'tr', name: 'Turkish' },
            { code: 'uk', name: 'Ukrainian' },
            { code: 'ur', name: 'Urdu' },
            { code: 'uz', name: 'Uzbek' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'zu', name: 'Zulu' }
        ];
        res.json({
            success: true,
            data: languages
        });
    }
    catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch languages'
        });
    }
});
router.post('/template-details', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { template_name, language = 'en_US' } = req.body;
        if (!template_name) {
            return res.status(400).json({
                success: false,
                error: 'template_name is required'
            });
        }
        const result = await db_1.default.query(`SELECT 
        id,
        name,
        language,
        category,
        components,
        status
      FROM templates 
      WHERE user_id = $1 AND name = $2 AND language = $3`, [userId, template_name, language]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const template = result.rows[0];
        const components = template.components;
        const variables = [];
        const buttons = [];
        let hasButtons = false;
        let templateTypeInfo = {
            hasStaticImage: false,
            hasDynamicImage: false,
            hasTextHeader: false,
            imageRequired: false,
            description: ''
        };
        if (template.category === 'AUTHENTICATION') {
            variables.push({
                index: 1,
                component: 'BODY',
                placeholder: 'OTP Code (e.g., 123456)',
                required: true,
                type: 'otp_code'
            });
            templateTypeInfo.description = 'Authentication template (requires OTP code parameter)';
        }
        else {
            for (const component of components) {
                if (component.type === 'HEADER') {
                    if (component.format === 'IMAGE') {
                        const hasHeaderHandle = component.example && component.example.header_handle;
                        const hasVariableInText = component.text && component.text.includes('{{');
                        if (hasVariableInText) {
                            templateTypeInfo.hasDynamicImage = true;
                            templateTypeInfo.imageRequired = true;
                            templateTypeInfo.description = 'Dynamic image template (requires image URL at runtime)';
                            const matches = component.text.match(/\{\{(\d+)\}\}/g);
                            if (matches) {
                                matches.forEach((match) => {
                                    const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                                    variables.push({
                                        index: variableIndex,
                                        component: 'HEADER',
                                        placeholder: 'Image URL (https://example.com/image.jpg)',
                                        required: true,
                                        type: 'image_url'
                                    });
                                });
                            }
                        }
                        else if (hasHeaderHandle) {
                            templateTypeInfo.hasStaticImage = true;
                            templateTypeInfo.imageRequired = false;
                            templateTypeInfo.description = 'Static image template (uses pre-uploaded image - no URL needed)';
                        }
                        else {
                            templateTypeInfo.hasDynamicImage = true;
                            templateTypeInfo.imageRequired = true;
                            templateTypeInfo.description = 'Dynamic image template (requires image URL)';
                            variables.push({
                                index: 1,
                                component: 'HEADER',
                                placeholder: 'Image URL (https://example.com/image.jpg)',
                                required: true,
                                type: 'image_url'
                            });
                        }
                    }
                    else if (component.format === 'TEXT') {
                        templateTypeInfo.hasTextHeader = true;
                        const text = component.text || '';
                        const matches = text.match(/\{\{(\d+)\}\}/g);
                        if (matches) {
                            matches.forEach((match) => {
                                const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                                variables.push({
                                    index: variableIndex,
                                    component: 'HEADER',
                                    placeholder: `Header text for variable ${variableIndex}`,
                                    required: true,
                                    type: 'text'
                                });
                            });
                        }
                    }
                }
                else if (component.type === 'BODY' || component.type === 'FOOTER') {
                    const text = component.text || '';
                    const matches = text.match(/\{\{(\d+)\}\}/g);
                    if (matches) {
                        matches.forEach((match) => {
                            const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                            variables.push({
                                index: variableIndex,
                                component: component.type,
                                placeholder: `${component.type.toLowerCase()} text for variable ${variableIndex}`,
                                required: true,
                                type: 'text'
                            });
                        });
                    }
                }
            }
        }
        for (const component of components) {
            if (component.type === 'BUTTONS') {
                hasButtons = true;
                component.buttons?.forEach((button, index) => {
                    buttons.push({
                        index: index,
                        type: button.type,
                        text: button.text,
                        url: button.url,
                        phone_number: button.phone_number,
                        copy_code: button.copy_code
                    });
                    if (button.type === 'URL' && button.url && button.url.includes('{{')) {
                        const matches = button.url.match(/\{\{(\d+)\}\}/g);
                        if (matches) {
                            matches.forEach((match) => {
                                const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                                variables.push({
                                    index: variableIndex,
                                    component: 'BUTTON',
                                    placeholder: `URL parameter for button: ${button.text}`,
                                    required: true,
                                    type: 'url_param'
                                });
                            });
                        }
                    }
                });
            }
        }
        const uniqueVariables = variables.filter((v, i, arr) => arr.findIndex(item => item.index === v.index && item.component === v.component) === i).sort((a, b) => a.index - b.index);
        res.json({
            success: true,
            data: {
                id: template.id,
                name: template.name,
                language: template.language,
                category: template.category,
                components: components,
                variables: uniqueVariables,
                buttons: buttons,
                hasVariables: uniqueVariables.length > 0,
                hasButtons: hasButtons,
                templateTypeInfo: templateTypeInfo,
                preview: generateTemplatePreview(components, {})
            }
        });
    }
    catch (error) {
        console.error('Error fetching template details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch template details'
        });
    }
});
function generateTemplatePreview(components, variables) {
    let preview = '';
    components.forEach(component => {
        if (component.type === 'HEADER') {
            if (component.format === 'IMAGE') {
                if (variables['1']) {
                    preview += `📷 *Image:* ${variables['1']}\n\n`;
                }
                else {
                    preview += `📷 *[Static Image]*\n\n`;
                }
            }
            else if (component.text) {
                preview += `*${replaceVariables(component.text, variables)}*\n\n`;
            }
        }
        else if (component.type === 'BODY') {
            preview += `${replaceVariables(component.text, variables)}\n\n`;
        }
        else if (component.type === 'FOOTER' && component.text) {
            preview += `_${replaceVariables(component.text, variables)}_\n`;
        }
        else if (component.type === 'BUTTONS') {
            preview += '\n*Buttons:*\n';
            component.buttons?.forEach((button) => {
                preview += `• ${button.text}\n`;
            });
        }
    });
    return preview.trim();
}
function replaceVariables(text, variables) {
    return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
        return variables[index] || `{{${index}}}`;
    });
}
router.post('/preview-excel', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
            return res.status(400).json({
                success: false,
                error: 'Only Excel files (.xlsx, .xls) are supported for preview'
            });
        }
        try {
            console.log(`Previewing Excel file: ${req.file.originalname}`);
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            console.log(`Using sheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            console.log(`Total rows in Excel: ${jsonData.length}`);
            if (jsonData.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Excel file is empty or has no data'
                });
            }
            const headers = (jsonData[0] || []);
            const columns = headers.map((header, index) => header?.toString().trim() || `Column ${String.fromCharCode(65 + index)}`);
            const sampleData = jsonData.slice(1, 6);
            res.json({
                success: true,
                data: {
                    columns: columns,
                    sample_data: sampleData,
                    total_rows: jsonData.length - 1
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing Excel file:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse Excel file. Please ensure it\'s a valid Excel file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error previewing Excel file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to preview Excel file'
        });
    }
});
router.post('/import-excel-column', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        console.log('🔍 DEBUG IMPORT-EXCEL-COLUMN: Request received');
        console.log('🔍 DEBUG IMPORT-EXCEL-COLUMN: File:', req.file?.originalname);
        console.log('🔍 DEBUG IMPORT-EXCEL-COLUMN: Body:', req.body);
        if (!req.file) {
            console.log('❌ DEBUG IMPORT-EXCEL-COLUMN: No file uploaded');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        const { column } = req.body;
        console.log('🔍 DEBUG IMPORT-EXCEL-COLUMN: Column requested:', column);
        if (!column) {
            console.log('❌ DEBUG IMPORT-EXCEL-COLUMN: No column specified');
            return res.status(400).json({
                success: false,
                error: 'Column name is required'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
            return res.status(400).json({
                success: false,
                error: 'Only Excel files (.xlsx, .xls) are supported'
            });
        }
        try {
            console.log(`Importing from column "${column}" in file: ${req.file.originalname}`);
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (jsonData.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Excel file is empty or has no data'
                });
            }
            const headers = (jsonData[0] || []);
            const columnIndex = headers.findIndex((header) => header?.toString().trim() === column);
            if (columnIndex === -1) {
                return res.status(400).json({
                    success: false,
                    error: `Column "${column}" not found in Excel file`
                });
            }
            console.log(`Found column "${column}" at index ${columnIndex}`);
            const phoneNumbers = jsonData.slice(1)
                .map((row, index) => {
                const phone = row[columnIndex]?.toString().trim();
                if (phone) {
                    console.log(`Row ${index + 2}: Found phone number: ${phone}`);
                }
                return phone;
            })
                .filter((phone) => phone && phone !== '');
            console.log(`Extracted ${phoneNumbers.length} phone numbers from column "${column}"`);
            console.log(`Raw phone numbers:`, phoneNumbers);
            console.log(`\n📊 Excel Import - Accepting all values from column "${column}"`);
            console.log(`- Total numbers found: ${phoneNumbers.length}`);
            console.log(`- Numbers:`, phoneNumbers);
            const uniqueNumbers = [...new Set(phoneNumbers)];
            res.json({
                success: true,
                data: {
                    valid_numbers: uniqueNumbers,
                    invalid_numbers: [],
                    total_processed: phoneNumbers.length,
                    valid_count: uniqueNumbers.length,
                    invalid_count: 0
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing Excel file:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse Excel file. Please ensure it\'s a valid Excel file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error importing from Excel column:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import from Excel column'
        });
    }
});
router.post('/import-recipients', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        let phoneNumbers = [];
        try {
            if (fileExtension === '.csv') {
                const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n');
                phoneNumbers = lines
                    .map(line => line.split(',')[0]?.trim())
                    .filter((phone) => phone && phone !== '');
            }
            else {
                console.log(`Processing Excel file: ${req.file.originalname}`);
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                console.log(`Using sheet: ${sheetName}`);
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                console.log(`Total rows in Excel: ${jsonData.length}`);
                phoneNumbers = jsonData
                    .map((row, index) => {
                    const phone = row[0]?.toString().trim();
                    if (phone) {
                        console.log(`Row ${index + 1}: Found phone number: ${phone}`);
                    }
                    return phone;
                })
                    .filter((phone) => phone && phone !== '');
                console.log(`Extracted ${phoneNumbers.length} phone numbers from Excel file`);
            }
            const validNumbers = [];
            const invalidNumbers = [];
            phoneNumbers.forEach(phone => {
                if (validatePhoneNumber(phone)) {
                    validNumbers.push(formatPhoneNumber(phone));
                }
                else {
                    invalidNumbers.push(phone);
                }
            });
            const uniqueValidNumbers = [...new Set(validNumbers)];
            res.json({
                success: true,
                data: {
                    valid_numbers: uniqueValidNumbers,
                    invalid_numbers: invalidNumbers,
                    total_processed: phoneNumbers.length,
                    valid_count: uniqueValidNumbers.length,
                    invalid_count: invalidNumbers.length
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing file:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error importing recipients:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import recipients'
        });
    }
});
router.post('/import-bulk-recipients', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        let phoneNumbers = [];
        try {
            if (fileExtension === '.csv') {
                const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n');
                phoneNumbers = lines
                    .map(line => line.split(',')[0]?.trim())
                    .filter((phone) => phone && phone !== '');
            }
            else {
                console.log(`Processing Excel file for WhatsApp Bulk: ${req.file.originalname}`);
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                console.log(`Using sheet: ${sheetName}`);
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                console.log(`Total rows in Excel: ${jsonData.length}`);
                phoneNumbers = jsonData
                    .map((row, index) => {
                    const phone = row[0]?.toString().trim();
                    if (phone) {
                        console.log(`Row ${index + 1}: Found phone number: ${phone}`);
                    }
                    return phone;
                })
                    .filter((phone) => phone && phone !== '');
                console.log(`Extracted ${phoneNumbers.length} phone numbers from Excel file`);
            }
            const validNumbers = [];
            const invalidNumbers = [];
            phoneNumbers.forEach(phone => {
                if (validatePhoneNumber(phone)) {
                    validNumbers.push(formatPhoneNumber(phone));
                }
                else {
                    invalidNumbers.push(phone);
                }
            });
            const uniqueValidNumbers = [...new Set(validNumbers)];
            res.json({
                success: true,
                data: {
                    valid_numbers: uniqueValidNumbers,
                    invalid_numbers: invalidNumbers,
                    total_processed: phoneNumbers.length,
                    valid_count: uniqueValidNumbers.length,
                    invalid_count: invalidNumbers.length
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing file for WhatsApp Bulk:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error importing bulk recipients:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import recipients'
        });
    }
});
router.post('/preview-campaign', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { template_name, language = 'en_US', variables = {}, recipients_text = '' } = req.body;
        if (!template_name) {
            return res.status(400).json({
                success: false,
                error: 'template_name is required'
            });
        }
        const templateResult = await db_1.default.query('SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, template_name, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const components = templateResult.rows[0].components;
        const lines = recipients_text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        const recipientData = [];
        lines.forEach((line, index) => {
            if (line.includes(',')) {
                const columns = line.split(',').map((col) => col.trim());
                const phone = columns[0];
                const lineVariables = {};
                for (let i = 1; i < columns.length; i++) {
                    lineVariables[i.toString()] = columns[i];
                }
                recipientData.push({ phone, variables: lineVariables });
                console.log(`📊 Preview row ${index + 1}: Phone=${phone}, Variables=`, lineVariables);
            }
            else {
                recipientData.push({ phone: line, variables: {} });
            }
        });
        const phoneNumbers = recipientData.map(item => item.phone);
        const formattedNumbers = phoneNumbers.map((num) => formatPhoneNumber(num));
        const validRecipients = formattedNumbers.filter((num) => validatePhoneNumber(num));
        const invalidRecipients = formattedNumbers.filter((num) => !validatePhoneNumber(num));
        const recipientPreviews = recipientData.slice(0, 3).map((recipient, index) => {
            const recipientVariables = Object.keys(recipient.variables).length > 0
                ? recipient.variables
                : variables;
            const personalizedPreview = generateTemplatePreview(components, recipientVariables);
            return {
                phone: recipient.phone,
                variables: recipientVariables,
                preview: personalizedPreview
            };
        });
        res.json({
            success: true,
            data: {
                template_name,
                language,
                recipient_previews: recipientPreviews,
                components,
                variables,
                recipient_stats: {
                    total_provided: phoneNumbers.length,
                    valid_recipients: validRecipients.length,
                    invalid_recipients: invalidRecipients.length,
                    valid_numbers: validRecipients.slice(0, 5),
                    invalid_numbers: invalidRecipients
                }
            }
        });
    }
    catch (error) {
        console.error('Error generating campaign preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate campaign preview'
        });
    }
});
router.post('/quick-send', auth_1.requireAuth, upload.single('headerImage'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log(`🔍 DEBUG QUICK-SEND: userId from session = ${userId}`);
        let { phone_number_id, template_name, language = 'en_US', variables = {}, recipients_text = '', campaign_name } = req.body;
        if (typeof variables === 'string') {
            try {
                variables = JSON.parse(variables);
            }
            catch (parseError) {
                console.log(`⚠️ DEBUG QUICK-SEND: Failed to parse variables JSON:`, variables);
                variables = {};
            }
        }
        console.log(`🔍 DEBUG QUICK-SEND: Request body:`, { phone_number_id, template_name, language, campaign_name });
        console.log(`🔍 DEBUG QUICK-SEND: Recipients text:`, recipients_text);
        console.log(`🔍 DEBUG QUICK-SEND: Variables:`, variables);
        if (!phone_number_id || !template_name || !recipients_text.trim()) {
            console.log(`❌ DEBUG QUICK-SEND: Validation failed - missing fields`);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone_number_id, template_name, recipients_text'
            });
        }
        console.log(`✅ DEBUG QUICK-SEND: Validation passed`);
        const lines = recipients_text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        const csvLines = lines.filter((line) => line.includes(','));
        if (csvLines.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Quick-send only supports phone numbers. For dynamic variables per recipient, please use the Customize feature instead.',
                details: {
                    csvLinesFound: csvLines.length,
                    suggestion: 'Remove commas and extra columns, or use Customize for dynamic variables'
                }
            });
        }
        const recipientData = [];
        lines.forEach((line) => {
            recipientData.push({ phone: line, variables: variables || {} });
        });
        const phoneNumbers = recipientData.map(item => item.phone);
        const formattedNumbers = phoneNumbers.map((num) => formatPhoneNumber(num));
        const validRecipients = formattedNumbers.filter((num) => validatePhoneNumber(num));
        console.log(`🔍 DEBUG QUICK-SEND: Phone validation - formatted: ${formattedNumbers}, valid: ${validRecipients}`);
        if (validRecipients.length === 0) {
            console.log(`❌ DEBUG QUICK-SEND: No valid phone numbers found`);
            return res.status(400).json({
                success: false,
                error: 'No valid phone numbers found. Please use Meta WhatsApp API format (919398424270, no + prefix)'
            });
        }
        console.log(`✅ DEBUG QUICK-SEND: Phone validation passed`);
        try {
            console.log(`💰 DEBUG QUICK-SEND: Checking credits for template: "${template_name}", recipients: ${validRecipients.length}`);
            const creditCheck = await (0, creditSystem_1.preCheckCreditsForBulk)(userId, template_name, validRecipients.length);
            console.log(`💰 DEBUG QUICK-SEND: Credit check result:`, {
                sufficient: creditCheck.sufficient,
                required: creditCheck.requiredCredits,
                available: creditCheck.currentBalance,
                category: creditCheck.category
            });
            if (!creditCheck.sufficient) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient credits. Required: ${creditCheck.requiredCredits.toFixed(2)}, Available: ${creditCheck.currentBalance.toFixed(2)}`,
                    details: {
                        requiredCredits: creditCheck.requiredCredits,
                        currentBalance: creditCheck.currentBalance,
                        templateCategory: creditCheck.category
                    }
                });
            }
            console.log(`✅ [CREDIT SYSTEM] Pre-check passed: ${creditCheck.requiredCredits} credits required for ${validRecipients.length} ${creditCheck.category} messages`);
        }
        catch (creditError) {
            console.error('❌ QUICK-SEND Credit pre-check error:', {
                error: creditError.message,
                stack: creditError.stack,
                userId,
                template_name,
                recipientCount: validRecipients.length
            });
            return res.status(500).json({
                success: false,
                error: 'Failed to check credit balance',
                debug: {
                    message: creditError.message,
                    userId,
                    template_name
                }
            });
        }
        const numberResult = await db_1.default.query('SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true', [userId, phone_number_id]);
        if (numberResult.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'WhatsApp number not found or access denied'
            });
        }
        const { access_token } = numberResult.rows[0];
        const templateResult = await db_1.default.query('SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, template_name, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const templateDetails = templateResult.rows[0];
        let uploadedImageMediaId = null;
        if (templateDetails.header_type === 'STATIC_IMAGE') {
            console.log('🖼️ Template has image header - checking for uploaded image');
            if (req.file) {
                console.log('📤 Image uploaded for template message, uploading to WhatsApp...');
                try {
                    const FormData = require('form-data');
                    const form = new FormData();
                    form.append('file', fs_1.default.createReadStream(req.file.path));
                    form.append('type', req.file.mimetype);
                    form.append('messaging_product', 'whatsapp');
                    const mediaResponse = await axios_1.default.post(`https://graph.facebook.com/v21.0/${phone_number_id}/media`, form, {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            ...form.getHeaders()
                        }
                    });
                    uploadedImageMediaId = mediaResponse.data.id;
                    console.log('✅ Image uploaded successfully, media_id:', uploadedImageMediaId);
                    fs_1.default.unlinkSync(req.file.path);
                }
                catch (uploadError) {
                    console.error('❌ Image upload failed:', uploadError.response?.data || uploadError.message);
                    if (req.file && fs_1.default.existsSync(req.file.path)) {
                        fs_1.default.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({
                        success: false,
                        error: 'Failed to upload image to WhatsApp',
                        details: uploadError.response?.data || uploadError.message
                    });
                }
            }
            else {
                return res.status(400).json({
                    success: false,
                    error: 'Template requires an image header, but no image was uploaded. Please upload an image.'
                });
            }
        }
        const components = templateDetails.components;
        const requiredVariables = new Set();
        if (templateDetails.category === 'AUTHENTICATION') {
            console.log(`🔍 Authentication template detected: ${template_name}`);
            if (Object.keys(variables).length > 0) {
                requiredVariables.add('1');
            }
        }
        else {
            for (const component of components) {
                if (component.text) {
                    const matches = component.text.match(/\{\{(\d+)\}\}/g) || [];
                    matches.forEach((match) => {
                        const variableIndex = match.replace(/[{}]/g, '');
                        requiredVariables.add(variableIndex);
                    });
                }
                if (component.type === 'BUTTONS' && component.buttons) {
                    component.buttons.forEach((button) => {
                        if (button.url && button.url.includes('{{')) {
                            const matches = button.url.match(/\{\{(\d+)\}\}/g) || [];
                            matches.forEach((match) => {
                                const variableIndex = match.replace(/[{}]/g, '');
                                requiredVariables.add(variableIndex);
                            });
                        }
                    });
                }
            }
        }
        const requiredVariablesList = Array.from(requiredVariables).sort((a, b) => parseInt(a) - parseInt(b));
        const providedVariablesList = Object.keys(variables).sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`🔍 Template "${template_name}" Analysis:`);
        console.log(`   Required variables: [${requiredVariablesList.join(', ')}]`);
        console.log(`   Provided variables: [${providedVariablesList.join(', ')}]`);
        console.log(`   Variables object:`, variables);
        if (requiredVariablesList.length !== providedVariablesList.length) {
            return res.status(400).json({
                success: false,
                error: `Template "${template_name}" requires ${requiredVariablesList.length} variables (${requiredVariablesList.join(', ')}), but ${providedVariablesList.length} were provided (${providedVariablesList.join(', ')})`
            });
        }
        const missingVariables = requiredVariablesList.filter(reqVar => !variables[reqVar]);
        const unexpectedVariables = providedVariablesList.filter(provVar => !requiredVariablesList.includes(provVar));
        if (missingVariables.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required variables for template "${template_name}": ${missingVariables.join(', ')}`
            });
        }
        if (unexpectedVariables.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Template "${template_name}" requires variables [${requiredVariablesList.join(', ')}], but unexpected variables were provided: [${unexpectedVariables.join(', ')}]`
            });
        }
        const campaignName = campaign_name || `Quick Send - ${template_name} - ${new Date().toISOString()}`;
        const campaignEntries = [];
        for (const recipient of validRecipients) {
            const cleanRecipient = recipient?.toString().trim();
            if (!cleanRecipient) {
                console.error(`⚠️  Skipping empty recipient in quick send: ${campaignName}`);
                continue;
            }
            const campaignResult = await db_1.default.query(`INSERT INTO campaign_logs 
         (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`, [
                userId,
                campaignName,
                template_name,
                phone_number_id,
                cleanRecipient,
                language,
                'pending',
                JSON.stringify({ variables, template_components: templateResult.rows[0].components })
            ]);
            campaignEntries.push({
                id: campaignResult.rows[0].id,
                recipient: cleanRecipient
            });
        }
        console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries for recipients`);
        let creditDeductionSuccess = false;
        let creditBalance = 0;
        try {
            const { cost, category } = await (0, creditSystem_1.calculateCreditCost)(userId, template_name, validRecipients.length);
            const creditResult = await (0, creditSystem_1.deductCredits)({
                userId,
                amount: cost,
                transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_QUICKSEND,
                templateCategory: category,
                templateName: template_name,
                description: `Quicksend campaign: ${campaignName} (${validRecipients.length} recipients)`
            });
            if (creditResult.success) {
                creditDeductionSuccess = true;
                creditBalance = creditResult.newBalance;
                console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Quicksend. New balance: ${creditBalance}`);
            }
            else {
                throw new Error('Insufficient credits after pre-check');
            }
        }
        catch (creditError) {
            console.error('Credit deduction error for Quicksend:', creditError);
            await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4', ['failed', 'Credit deduction failed', userId, campaignName]);
            return res.status(400).json({
                success: false,
                error: 'Credit deduction failed',
                details: creditError instanceof Error ? creditError.message : 'Unknown error'
            });
        }
        res.json({
            success: true,
            data: {
                campaign_id: null,
                total_recipients: validRecipients.length,
                status: 'started',
                message: 'Campaign started successfully and is being processed in batches',
                creditInfo: {
                    deducted: creditDeductionSuccess,
                    newBalance: creditBalance
                }
            }
        });
        console.log(`🚀 QUICK-SEND: Starting to send ${campaignEntries.length} messages in batches of 200 (background processing)`);
        setImmediate(async () => {
            let successCount = 0;
            let failCount = 0;
            try {
                const BATCH_SIZE = 200;
                const batches = [];
                for (let i = 0; i < campaignEntries.length; i += BATCH_SIZE) {
                    batches.push(campaignEntries.slice(i, i + BATCH_SIZE));
                }
                console.log(`📦 QUICK-SEND: Processing ${batches.length} batches of up to ${BATCH_SIZE} messages each`);
                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];
                    console.log(`📤 QUICK-SEND: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);
                    const batchPromises = batch.map(campaignEntry => sendTemplateMessage(phone_number_id, access_token, campaignEntry.recipient, template_name, language, variables, templateResult.rows[0].components, campaignEntry.id.toString(), userId, templateResult.rows[0].header_media_id, templateResult.rows[0].header_type, templateResult.rows[0].header_media_url, templateResult.rows[0].header_handle, uploadedImageMediaId || templateResult.rows[0].media_id, templateResult.rows[0].category));
                    const batchResults = await Promise.allSettled(batchPromises);
                    batchResults.forEach((result, index) => {
                        const campaignEntry = batch[index];
                        if (result.status === 'fulfilled') {
                            const response = result.value;
                            if (response?.success === false && response?.duplicate) {
                                console.log(`🚨 QUICK-SEND BATCH ${batchIndex + 1}: Duplicate detected for ${campaignEntry.recipient}`);
                                failCount++;
                            }
                            else if (response?.success) {
                                console.log(`✅ QUICK-SEND BATCH ${batchIndex + 1}: Successfully sent to ${campaignEntry.recipient}`);
                                successCount++;
                            }
                            else {
                                console.log(`⚠️ QUICK-SEND BATCH ${batchIndex + 1}: Unknown response for ${campaignEntry.recipient}:`, response);
                                failCount++;
                            }
                        }
                        else {
                            console.log(`❌ QUICK-SEND BATCH ${batchIndex + 1}: Promise rejected for ${campaignEntry.recipient}:`, result.reason);
                            failCount++;
                        }
                    });
                    console.log(`✅ QUICK-SEND: Batch ${batchIndex + 1}/${batches.length} completed. Running totals: ${successCount} success, ${failCount} failed`);
                    if (batchIndex < batches.length - 1) {
                        console.log(`⏳ QUICK-SEND: Waiting 1 second before next batch...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                console.log(`📊 QUICK-SEND COMPLETED: ${successCount} successful, ${failCount} failed`);
            }
            catch (error) {
                console.error('❌ Background sending error:', error);
            }
        });
    }
    catch (error) {
        console.error('Error in quick send:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send messages'
        });
    }
});
router.post('/send-bulk', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { phone_number_id, template_name, language = 'en_US', variables = {}, recipients = [], buttons = {}, campaign_name } = req.body;
        if (!phone_number_id || !template_name || !recipients || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone_number_id, template_name, recipients'
            });
        }
        const validRecipients = recipients.filter((phone) => validatePhoneNumber(phone));
        if (validRecipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid phone numbers provided'
            });
        }
        try {
            const creditCheck = await (0, creditSystem_1.preCheckCreditsForBulk)(userId, template_name, validRecipients.length);
            if (!creditCheck.sufficient) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient credits. Required: ${creditCheck.requiredCredits.toFixed(2)}, Available: ${creditCheck.currentBalance.toFixed(2)}`,
                    details: {
                        requiredCredits: creditCheck.requiredCredits,
                        currentBalance: creditCheck.currentBalance,
                        templateCategory: creditCheck.category
                    }
                });
            }
            console.log(`[CREDIT SYSTEM] Pre-check passed: ${creditCheck.requiredCredits} credits required for ${validRecipients.length} ${creditCheck.category} messages`);
        }
        catch (creditError) {
            console.error('Credit pre-check error:', creditError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check credit balance'
            });
        }
        const numberResult = await db_1.default.query('SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true', [userId, phone_number_id]);
        if (numberResult.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'WhatsApp number not found or access denied'
            });
        }
        const { access_token } = numberResult.rows[0];
        const templateResult = await db_1.default.query('SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, template_name, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const components = templateResult.rows[0].components;
        const templateCategory = templateResult.rows[0].category;
        const requiredVariables = new Set();
        if (templateCategory === 'AUTHENTICATION') {
            console.log(`🔍 Authentication template detected in bulk send: ${template_name}`);
            if (Object.keys(variables).length > 0) {
                requiredVariables.add('1');
            }
        }
        else {
            for (const component of components) {
                if (component.text) {
                    const matches = component.text.match(/\{\{(\d+)\}\}/g) || [];
                    matches.forEach((match) => {
                        const variableIndex = match.replace(/[{}]/g, '');
                        requiredVariables.add(variableIndex);
                    });
                }
                if (component.type === 'BUTTONS' && component.buttons) {
                    component.buttons.forEach((button) => {
                        if (button.url && button.url.includes('{{')) {
                            const matches = button.url.match(/\{\{(\d+)\}\}/g) || [];
                            matches.forEach((match) => {
                                const variableIndex = match.replace(/[{}]/g, '');
                                requiredVariables.add(variableIndex);
                            });
                        }
                    });
                }
            }
        }
        const requiredVariablesList = Array.from(requiredVariables).sort((a, b) => parseInt(a) - parseInt(b));
        const providedVariablesList = Object.keys(variables).sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`🔍 Bulk Template "${template_name}" Analysis:`);
        console.log(`   Required variables: [${requiredVariablesList.join(', ')}]`);
        console.log(`   Provided variables: [${providedVariablesList.join(', ')}]`);
        console.log(`   Variables object:`, variables);
        const missingVariables = requiredVariablesList.filter(reqVar => !variables[reqVar] && variables[reqVar] !== '');
        if (missingVariables.length > 0) {
            console.log(`⚠️ Missing required variables for template "${template_name}": ${missingVariables.join(', ')}`);
            console.log(`   This will be handled by sendTemplateMessage with placeholder values`);
        }
        console.log(`✅ Bulk validation passed - proceeding with message sending`);
        console.log(`   Required: [${requiredVariablesList.join(', ')}]`);
        console.log(`   Provided: [${providedVariablesList.join(', ')}]`);
        console.log(`   Missing (will use placeholders): [${missingVariables.join(', ')}]`);
        const campaignEntries = [];
        const campaignNameFinal = campaign_name || `Campaign - ${template_name} - ${new Date().toISOString()}`;
        for (const recipient of validRecipients) {
            const cleanRecipient = recipient?.toString().trim();
            if (!cleanRecipient) {
                console.error(`⚠️  Skipping empty recipient in campaign: ${campaignNameFinal}`);
                continue;
            }
            const campaignResult = await db_1.default.query(`INSERT INTO campaign_logs 
         (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`, [
                userId,
                campaignNameFinal,
                template_name,
                phone_number_id,
                cleanRecipient,
                language,
                'pending',
                JSON.stringify({ variables, buttons, template_components: templateResult.rows[0].components })
            ]);
            campaignEntries.push({
                id: campaignResult.rows[0].id,
                recipient: cleanRecipient
            });
        }
        console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries with recipient numbers`);
        let creditDeductionSuccess = false;
        let creditBalance = 0;
        try {
            const { cost, category } = await (0, creditSystem_1.calculateCreditCost)(userId, template_name, validRecipients.length);
            const creditResult = await (0, creditSystem_1.deductCredits)({
                userId,
                amount: cost,
                transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
                templateCategory: category,
                templateName: template_name,
                description: `Customise SMS campaign: ${campaign_name || 'Unnamed'} (${validRecipients.length} recipients)`
            });
            if (creditResult.success) {
                creditDeductionSuccess = true;
                creditBalance = creditResult.newBalance;
                console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Customise SMS. New balance: ${creditBalance}`);
            }
            else {
                throw new Error('Insufficient credits after pre-check');
            }
        }
        catch (creditError) {
            console.error('Credit deduction error for Customise SMS:', creditError);
            await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4', ['failed', 'Credit deduction failed', userId, campaignNameFinal]);
            return res.status(400).json({
                success: false,
                error: 'Credit deduction failed',
                details: creditError instanceof Error ? creditError.message : 'Unknown error'
            });
        }
        let successCount = 0;
        let failCount = 0;
        const messagePromises = [];
        for (const campaignEntry of campaignEntries) {
            const messagePromise = sendTemplateMessage(phone_number_id, access_token, campaignEntry.recipient, template_name, language, variables, templateResult.rows[0].components, campaignEntry.id, userId, templateResult.rows[0].header_media_id, templateResult.rows[0].header_type, templateResult.rows[0].header_media_url, templateResult.rows[0].header_handle, templateResult.rows[0].media_id, templateResult.rows[0].category);
            messagePromises.push(messagePromise);
        }
        const results = await Promise.allSettled(messagePromises);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const response = result.value;
                if (response?.success === false && response?.duplicate) {
                    console.log(`🚨 BULK MESSAGE ${index + 1}: Duplicate detected for ${campaignEntries[index].recipient}`);
                    failCount++;
                }
                else if (response?.success) {
                    console.log(`✅ BULK MESSAGE ${index + 1}: Successfully sent to ${campaignEntries[index].recipient}`);
                    successCount++;
                }
                else {
                    console.log(`⚠️ BULK MESSAGE ${index + 1}: Unknown response for ${campaignEntries[index].recipient}:`, response);
                    failCount++;
                }
            }
            else {
                console.log(`❌ BULK MESSAGE ${index + 1}: Promise rejected for ${campaignEntries[index].recipient}:`, result.reason);
                failCount++;
            }
        });
        res.json({
            success: true,
            data: {
                campaign_id: null,
                total_recipients: validRecipients.length,
                successful_sends: successCount,
                failed_sends: failCount,
                status: 'completed',
                creditInfo: {
                    deducted: creditDeductionSuccess,
                    newBalance: creditBalance
                }
            }
        });
    }
    catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send bulk messages'
        });
    }
});
async function sendTemplateMessage(phoneNumberId, accessToken, recipient, templateName, language, variables, components, campaignId, userId, headerMediaId, headerType, headerMediaUrl, headerHandle, mediaId, templateCategory) {
    try {
        console.log(`🔄 SENDING MESSAGE: Starting sendTemplateMessage for ${recipient} with template ${templateName}`);
        const duplicateCheck = await (0, duplicateDetection_1.checkAndHandleDuplicate)(userId, templateName, recipient, variables, campaignId);
        if (duplicateCheck.isDuplicate) {
            console.log(`❌ DUPLICATE DETECTED: Skipping message to ${recipient} with template ${templateName}`);
            return {
                success: false,
                duplicate: true,
                recipient,
                hash: duplicateCheck.hash,
                message: 'Duplicate message blocked'
            };
        }
        console.log(`✅ DUPLICATE CHECK PASSED: Proceeding to send message to ${recipient}`);
        const templateComponents = [];
        console.log(`🚀 Processing template "${templateName}" with category: ${templateCategory || 'UNKNOWN'}, header_type: ${headerType || 'UNKNOWN'}`);
        if (templateCategory === 'AUTHENTICATION') {
            console.log(`🔐 Authentication template detected - using 2025 format`);
            const otpCode = variables['1'] || variables['var1'] || Object.values(variables)[0];
            if (otpCode) {
                console.log(`🔐 Adding authentication template components with OTP: ${otpCode}`);
                templateComponents.push({
                    type: "body",
                    parameters: [{ type: "text", text: otpCode.toString() }]
                });
                templateComponents.push({
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [{ type: "text", text: otpCode.toString() }]
                });
                console.log(`✅ Added authentication template components (body + button)`);
            }
            else {
                console.log(`⚠️ Authentication template but no OTP code provided in variables:`, variables);
            }
        }
        else {
            for (const component of components) {
                if (component.type === 'HEADER') {
                    if (component.format === 'IMAGE' || headerType === 'STATIC_IMAGE') {
                        console.log(`📸 IMAGE template detected - using fresh uploaded media_id for sending`);
                        console.log(`🔍 Available data:`);
                        console.log(`   media_id (fresh upload): ${mediaId || 'Not set'}`);
                        if (mediaId) {
                            console.log(`✅ Using fresh uploaded media_id for message sending: ${mediaId}`);
                            const headerComponent = {
                                type: "header",
                                parameters: [{
                                        type: "image",
                                        image: {
                                            id: mediaId
                                        }
                                    }]
                            };
                            templateComponents.push(headerComponent);
                            console.log(`✅ Added header component with fresh media_id: ${mediaId}`);
                        }
                        else {
                            throw new Error(`Template '${templateName}' requires image but no fresh media_id provided. Upload image in quick-send.`);
                        }
                    }
                    else if (headerType === 'TEXT' && component.text && component.text.includes('{{')) {
                        console.log(`📝 TEXT header with variables detected`);
                        const headerParams = [];
                        const matches = component.text.match(/\{\{(\d+)\}\}/g);
                        if (matches) {
                            matches.forEach((match) => {
                                const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                                const value = variables[variableIndex.toString()] || `[Header Variable ${variableIndex} not provided]`;
                                headerParams.push({
                                    type: "text",
                                    text: value
                                });
                            });
                            templateComponents.push({
                                type: "header",
                                parameters: headerParams
                            });
                            console.log(`   ✅ Added text header with ${headerParams.length} parameters (${matches.length} required)`);
                        }
                    }
                }
                else if (component.type === 'BODY' && component.text) {
                    const matches = component.text.match(/\{\{(\d+)\}\}/g);
                    if (matches) {
                        const bodyParams = [];
                        matches.forEach((match) => {
                            const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                            const value = variables[variableIndex.toString()] || `[Variable ${variableIndex} not provided]`;
                            console.log(`🔍 META API - Variable ${variableIndex}: "${value}" (from variables object:`, variables, `)`);
                            bodyParams.push({
                                type: "text",
                                text: value
                            });
                        });
                        templateComponents.push({
                            type: "body",
                            parameters: bodyParams
                        });
                        console.log(`   ✅ Sending body component with ${bodyParams.length} parameters (${matches.length} required)`);
                    }
                }
                else if (component.type === 'BUTTONS' && component.buttons) {
                    component.buttons.forEach((button, buttonIndex) => {
                        if (button.type === 'URL' && button.url && button.url.includes('{{')) {
                            const matches = button.url.match(/\{\{(\d+)\}\}/g);
                            if (matches) {
                                const buttonParams = [];
                                matches.forEach((match) => {
                                    const variableIndex = parseInt(match.replace(/[{}]/g, ''));
                                    const value = variables[variableIndex.toString()];
                                    if (value) {
                                        buttonParams.push({
                                            type: "text",
                                            text: value
                                        });
                                    }
                                });
                                if (buttonParams.length > 0) {
                                    templateComponents.push({
                                        type: "button",
                                        sub_type: "url",
                                        index: buttonIndex.toString(),
                                        parameters: buttonParams
                                    });
                                    console.log(`   ✅ Sending button component for button ${buttonIndex}`);
                                }
                            }
                        }
                    });
                }
            }
        }
        const templatePayload = {
            name: templateName,
            language: {
                code: language,
                policy: "deterministic"
            }
        };
        if (templateComponents.length > 0) {
            templatePayload.components = templateComponents;
        }
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient.replace('+', ''),
            type: "template",
            template: templatePayload
        };
        console.log('📤 Sending WhatsApp message payload:', JSON.stringify(payload, null, 2));
        console.log(`🌐 MAKING META API CALL: Sending to ${recipient} via phone_number_id: ${phoneNumberId}`);
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const responseData = await response.json();
        console.log('📥 WhatsApp API response:', JSON.stringify(responseData, null, 2));
        if (!response.ok) {
            const errorCode = responseData.error?.code;
            const errorMessage = responseData.error?.message || 'Unknown error';
            console.error(`❌ WhatsApp API Error [${response.status}]:`, {
                code: errorCode,
                message: errorMessage,
                details: responseData.error?.error_data,
                template: templateName,
                recipient: recipient
            });
            switch (errorCode) {
                case 132012:
                    throw new Error(`Template parameter mismatch: ${errorMessage}`);
                case 131026:
                    throw new Error(`Message undeliverable to ${recipient}: ${errorMessage}`);
                case 131000:
                    throw new Error(`WhatsApp service error: ${errorMessage}`);
                case 368:
                    throw new Error(`Account restriction: ${errorMessage}`);
                default:
                    throw new Error(`WhatsApp API Error [${errorCode}]: ${errorMessage}`);
            }
        }
        if (responseData.messages && responseData.messages[0]) {
            const messageId = responseData.messages[0].id;
            console.log(`✅ Message sent successfully to ${recipient}, ID: ${messageId}`);
            await db_1.default.query(`UPDATE campaign_logs 
         SET message_id = $2, recipient_number = $3, status = 'sent', 
             sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
             campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`, [campaignId, messageId, recipient, JSON.stringify({ api_response: responseData, sent_at: new Date() })]);
            return { success: true, messageId, recipient };
        }
        else {
            const errorMessage = responseData.error?.message || responseData.error?.error_data?.details || JSON.stringify(responseData);
            console.error(`❌ Message failed to ${recipient}:`, errorMessage);
            await db_1.default.query(`UPDATE campaign_logs 
         SET recipient_number = $2, status = 'failed', error_message = $3, updated_at = CURRENT_TIMESTAMP,
             campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`, [campaignId, recipient, errorMessage, JSON.stringify({ api_response: responseData, failed_at: new Date() })]);
            throw new Error(errorMessage);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await db_1.default.query(`UPDATE campaign_logs 
       SET recipient_number = $2, status = 'failed', error_message = $3, updated_at = CURRENT_TIMESTAMP,
           campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
       WHERE id = $1`, [campaignId, recipient, errorMessage, JSON.stringify({ catch_error: errorMessage, failed_at: new Date() })]);
        throw error;
    }
}
router.post('/parse-excel', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        let data = [];
        let columns = [];
        try {
            if (fileExtension === '.csv') {
                const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                    columns = lines[0].split(',').map(col => col.trim());
                    for (let i = 1; i < lines.length; i++) {
                        const row = lines[i].split(',').map(cell => cell.trim());
                        const rowObject = {};
                        columns.forEach((col, index) => {
                            rowObject[col] = row[index] || '';
                        });
                        data.push(rowObject);
                    }
                }
            }
            else {
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                data = XLSX.utils.sheet_to_json(worksheet);
                if (data.length > 0) {
                    columns = Object.keys(data[0]);
                }
            }
            res.json({
                success: true,
                data: {
                    rows: data,
                    columns: columns,
                    totalRows: data.length,
                    totalColumns: columns.length
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing file:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error parsing Excel file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to parse Excel file'
        });
    }
});
router.post('/preview-custom', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { templateName, language = 'en_US', recipientColumn, variableMappings = {}, sampleData = [] } = req.body;
        if (!templateName || !recipientColumn || !sampleData.length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: templateName, recipientColumn, sampleData'
            });
        }
        const templateResult = await db_1.default.query('SELECT components, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, templateName, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const components = templateResult.rows[0].components;
        const previews = sampleData.slice(0, 2).map((row, index) => {
            const recipient = row[recipientColumn];
            if (!recipient) {
                return {
                    recipient: 'No phone number',
                    message: 'No recipient phone number found in this row'
                };
            }
            let message = generateCustomTemplatePreview(components, variableMappings, row);
            return {
                recipient: recipient,
                message: message
            };
        });
        res.json({
            success: true,
            data: {
                templateName,
                language,
                recipientColumn,
                variableMappings,
                previews
            }
        });
    }
    catch (error) {
        console.error('Error generating custom preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate preview'
        });
    }
});
router.post('/custom-send', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { wabaId, templateName, language = 'en_US', recipientColName, variableMappings = '{}', campaignName } = req.body;
        if (!req.file || !recipientColName || !wabaId || !templateName) {
            return res.status(400).json({
                success: false,
                error: 'File, recipient column name, WhatsApp number, and template are required.'
            });
        }
        const filePath = req.file.path;
        const fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
        let data = [];
        try {
            if (fileExtension === '.csv') {
                const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                    const columns = lines[0].split(',').map(col => col.trim());
                    for (let i = 1; i < lines.length; i++) {
                        const row = lines[i].split(',').map(cell => cell.trim());
                        const rowObject = {};
                        columns.forEach((col, index) => {
                            rowObject[col] = row[index] || '';
                        });
                        data.push(rowObject);
                    }
                }
            }
            else {
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                data = XLSX.utils.sheet_to_json(worksheet);
            }
            if (data.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'The uploaded file contains no data.'
                });
            }
            const parsedVariableMappings = JSON.parse(variableMappings);
            try {
                const creditCheck = await (0, creditSystem_1.preCheckCreditsForBulk)(userId, templateName, data.length);
                if (!creditCheck.sufficient) {
                    return res.status(400).json({
                        success: false,
                        error: `Insufficient credits. Required: ${creditCheck.requiredCredits.toFixed(2)}, Available: ${creditCheck.currentBalance.toFixed(2)}`,
                        details: {
                            requiredCredits: creditCheck.requiredCredits,
                            currentBalance: creditCheck.currentBalance,
                            templateCategory: creditCheck.category
                        }
                    });
                }
                console.log(`[CREDIT SYSTEM] Pre-check passed: ${creditCheck.requiredCredits} credits required for ${data.length} ${creditCheck.category} messages`);
            }
            catch (creditError) {
                console.error('Credit pre-check error:', creditError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to check credit balance'
                });
            }
            const numberResult = await db_1.default.query('SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true', [userId, wabaId]);
            if (numberResult.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'WhatsApp number not found or access denied'
                });
            }
            const templateResult = await db_1.default.query('SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, templateName, language]);
            if (templateResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Template not found'
                });
            }
            const campaignNameFinal = campaignName || `Custom Campaign - ${templateName} - ${new Date().toISOString()}`;
            const campaignEntries = [];
            for (const row of data) {
                const recipient = row[recipientColName];
                const rowVariables = {};
                Object.keys(parsedVariableMappings).forEach(templateVar => {
                    const columnName = parsedVariableMappings[templateVar];
                    if (columnName && row[columnName]) {
                        const variableIndex = templateVar.replace(/[{}]/g, '');
                        rowVariables[variableIndex] = row[columnName].toString();
                    }
                });
                const campaignResult = await db_1.default.query(`INSERT INTO campaign_logs 
           (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           RETURNING id`, [
                    userId,
                    campaignNameFinal,
                    templateName,
                    wabaId,
                    recipient,
                    language,
                    'pending',
                    JSON.stringify({
                        variables: rowVariables,
                        variableMappings: parsedVariableMappings,
                        recipientColumn: recipientColName,
                        template_components: templateResult.rows[0].components,
                        rowData: row
                    })
                ]);
                campaignEntries.push({
                    id: campaignResult.rows[0].id,
                    recipient: recipient,
                    variables: rowVariables
                });
            }
            console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries for custom campaign`);
            let creditDeductionSuccess = false;
            let creditBalance = 0;
            try {
                const { cost, category } = await (0, creditSystem_1.calculateCreditCost)(userId, templateName, data.length);
                const creditResult = await (0, creditSystem_1.deductCredits)({
                    userId,
                    amount: cost,
                    transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
                    templateCategory: category,
                    templateName: templateName,
                    description: `Custom Send campaign: ${campaignName || 'Unnamed'} (${data.length} recipients)`
                });
                if (creditResult.success) {
                    creditDeductionSuccess = true;
                    creditBalance = creditResult.newBalance;
                    console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Custom Send. New balance: ${creditBalance}`);
                }
                else {
                    throw new Error('Insufficient credits after pre-check');
                }
            }
            catch (creditError) {
                console.error('Credit deduction error for Custom Send:', creditError);
                await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4', ['failed', 'Credit deduction failed', userId, campaignName || 'Custom Send']);
                return res.status(400).json({
                    success: false,
                    error: 'Credit deduction failed',
                    details: creditError instanceof Error ? creditError.message : 'Unknown error'
                });
            }
            let successCount = 0;
            let failCount = 0;
            const messagePromises = campaignEntries.map((campaignEntry) => {
                return sendTemplateMessage(wabaId, numberResult.rows[0].access_token, formatPhoneNumber(campaignEntry.recipient.toString()), templateName, language, campaignEntry.variables, templateResult.rows[0].components, campaignEntry.id, userId, templateResult.rows[0].header_media_id, templateResult.rows[0].header_type, templateResult.rows[0].header_media_url, templateResult.rows[0].header_handle, templateResult.rows[0].media_id, templateResult.rows[0].category).then(() => {
                    successCount++;
                }).catch(async (error) => {
                    failCount++;
                    console.error(`Failed to send to ${campaignEntry.recipient}:`, error.message);
                    try {
                        await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', ['failed', error.message || 'Unknown error', campaignEntry.id]);
                    }
                    catch (updateError) {
                        console.error(`Failed to update campaign entry ${campaignEntry.id} to failed status:`, updateError);
                    }
                });
            });
            await Promise.allSettled(messagePromises);
            res.status(202).json({
                success: true,
                message: 'Campaign has been processed.',
                data: {
                    campaign_id: null,
                    totalRecipients: data.length,
                    successfulSends: successCount,
                    failedSends: failCount,
                    creditInfo: {
                        deducted: creditDeductionSuccess,
                        newBalance: creditBalance
                    }
                }
            });
        }
        catch (parseError) {
            console.error('Error parsing file:', parseError);
            res.status(400).json({
                success: false,
                error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
            });
        }
        finally {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting temp file:', err);
            });
        }
    }
    catch (error) {
        console.error('Error in custom send:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process custom campaign'
        });
    }
});
function generateCustomTemplatePreview(components, variableMappings, rowData) {
    let preview = '';
    components.forEach(component => {
        if (component.type === 'HEADER') {
            if (component.format === 'IMAGE') {
                preview += `📷 *[Image]*\n\n`;
            }
            else if (component.text) {
                preview += `*${replaceCustomVariables(component.text, variableMappings, rowData)}*\n\n`;
            }
        }
        else if (component.type === 'BODY') {
            preview += `${replaceCustomVariables(component.text, variableMappings, rowData)}\n\n`;
        }
        else if (component.type === 'FOOTER' && component.text) {
            preview += `_${replaceCustomVariables(component.text, variableMappings, rowData)}_\n`;
        }
        else if (component.type === 'BUTTONS') {
            preview += '\n*Buttons:*\n';
            component.buttons?.forEach((button) => {
                preview += `• ${button.text}\n`;
            });
        }
    });
    return preview.trim();
}
function replaceCustomVariables(text, variableMappings, rowData) {
    return text.replace(/{{\s*(\d+)\s*}}/g, (match, index) => {
        const templateVar = `{{${index}}}`;
        const columnName = variableMappings[templateVar];
        if (columnName && rowData[columnName]) {
            return rowData[columnName].toString();
        }
        return match;
    });
}
router.get('/reports', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { page = 1, limit = 50, dateFrom = '', dateTo = '', recipientNumber = '', template = '', status = 'all', export: exportFormat = 'false' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = 'WHERE cl.user_id = $1';
        const params = [userId];
        let paramCount = 1;
        if (dateFrom && dateFrom.toString().trim()) {
            paramCount++;
            whereConditions += ` AND cl.created_at >= $${paramCount}`;
            params.push(dateFrom.toString());
        }
        if (dateTo && dateTo.toString().trim()) {
            paramCount++;
            whereConditions += ` AND cl.created_at <= $${paramCount}::date + interval '1 day'`;
            params.push(dateTo.toString());
        }
        if (recipientNumber && recipientNumber.toString().trim()) {
            paramCount++;
            whereConditions += ` AND cl.recipient_number ILIKE $${paramCount}`;
            params.push(`%${recipientNumber.toString().trim()}%`);
        }
        if (template && template.toString().trim()) {
            paramCount++;
            whereConditions += ` AND cl.template_used = $${paramCount}`;
            params.push(template.toString());
        }
        if (status && status !== 'all') {
            paramCount++;
            whereConditions += ` AND cl.status = $${paramCount}`;
            params.push(status.toString());
        }
        const reportsQuery = `
      SELECT 
        cl.id,
        cl.campaign_name,
        cl.template_used,
        COALESCE(ubi.whatsapp_number, cl.phone_number_id, 'Unknown') as from_number,
        COALESCE(NULLIF(TRIM(cl.recipient_number), ''), 'Not Available') as recipient_number,
        cl.status,
        cl.status as read_status,
        cl.sent_at,
        cl.delivered_at,
        cl.read_at,
        cl.error_message,
        cl.message_id,
        cl.created_at,
        cl.updated_at
      FROM campaign_logs cl
      LEFT JOIN user_business_info ubi ON cl.phone_number_id = ubi.whatsapp_number_id AND cl.user_id = ubi.user_id
      ${whereConditions}
      ORDER BY cl.created_at DESC
      ${exportFormat && exportFormat !== 'false' ? '' : `LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`}
    `;
        if (!exportFormat || exportFormat === 'false') {
            params.push(Number(limit), offset);
        }
        console.log(`🔍 [REPORTS] Executing simplified campaign query for user: ${userId}`);
        const reportsResult = await db_1.default.query(reportsQuery, params);
        console.log(`🔍 [REPORTS] Query returned ${reportsResult.rows.length} campaigns`);
        if (exportFormat && exportFormat !== 'false') {
            const headers = [
                'Campaign Name',
                'Template',
                'From Number',
                'Recipient Number',
                'Status',
                'Sent At',
                'Delivered At',
                'Read At',
                'Message ID',
                'Error Message'
            ];
            const rows = reportsResult.rows.map(row => [
                row.campaign_name || '',
                row.template_used || '',
                row.from_number || '',
                row.recipient_number || '',
                row.status || '',
                row.sent_at || '',
                row.delivered_at || '',
                row.read_at || '',
                row.message_id || '',
                row.error_message || ''
            ]);
            if (exportFormat === 'csv') {
                const csvRows = rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','));
                const csvContent = [headers.join(','), ...csvRows].join('\n');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_reports.csv"');
                return res.send(csvContent);
            }
            else if (exportFormat === 'excel') {
                try {
                    console.log('📊 Creating Excel file with', rows.length, 'rows');
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                    const columnWidths = [
                        { wch: 25 },
                        { wch: 15 },
                        { wch: 15 },
                        { wch: 15 },
                        { wch: 10 },
                        { wch: 18 },
                        { wch: 18 },
                        { wch: 30 }
                    ];
                    worksheet['!cols'] = columnWidths;
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'WhatsApp Reports');
                    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
                    console.log('✅ Excel buffer created, size:', excelBuffer.length, 'bytes');
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_reports.xlsx"');
                    res.setHeader('Content-Length', excelBuffer.length.toString());
                    return res.send(excelBuffer);
                }
                catch (excelError) {
                    console.error('❌ Excel creation failed:', excelError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to create Excel file',
                        details: excelError instanceof Error ? excelError.message : 'Unknown error'
                    });
                }
            }
        }
        const countQuery = `
      SELECT COUNT(*) as total
      FROM campaign_logs cl
      LEFT JOIN user_business_info ubi ON cl.phone_number_id = ubi.whatsapp_number_id AND cl.user_id = ubi.user_id
      ${whereConditions}
    `;
        const countResult = await db_1.default.query(countQuery, params.slice(0, paramCount));
        const total = parseInt(countResult.rows[0].total);
        res.json({
            success: true,
            data: {
                reports: reportsResult.rows,
                total: total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('🔍 [REPORTS] Error fetching reports:', error);
        console.error('🔍 [REPORTS] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reports',
            debug: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/reports/summary', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const summaryQuery = `
      SELECT 
        COUNT(DISTINCT COALESCE(cl.campaign_name, cl.id::text)) as total_campaigns,
        COUNT(cl.id) as total_messages,
        COUNT(CASE WHEN cl.status IN ('sent', 'delivered', 'read') THEN 1 END) as successful_messages,
        COUNT(CASE WHEN cl.status IN ('failed') THEN 1 END) as failed_messages,
        ROUND(
          (COUNT(CASE WHEN cl.status IN ('sent', 'delivered', 'read') THEN 1 END) * 100.0) / 
          NULLIF(COUNT(cl.id), 0), 
          2
        ) as success_rate
      FROM campaign_logs cl
      WHERE cl.user_id = $1
    `;
        const result = await db_1.default.query(summaryQuery, [userId]);
        const summary = result.rows[0];
        res.json({
            success: true,
            data: {
                total_campaigns: parseInt(summary.total_campaigns) || 0,
                total_messages: parseInt(summary.total_messages) || 0,
                successful_messages: parseInt(summary.successful_messages) || 0,
                failed_messages: parseInt(summary.failed_messages) || 0,
                success_rate: parseFloat(summary.success_rate) || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching reports summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reports summary'
        });
    }
});
router.get('/campaigns', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const result = await db_1.default.query(`SELECT 
        id,
        campaign_name,
        template_used,
        total_recipients,
        successful_sends,
        failed_sends,
        status,
        created_at,
        updated_at
      FROM campaign_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: result.rows.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaigns'
        });
    }
});
router.get('/reports/templates', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const templatesQuery = `
      SELECT DISTINCT cl.template_used
      FROM campaign_logs cl
      WHERE cl.user_id = $1
      ORDER BY cl.template_used
    `;
        const result = await db_1.default.query(templatesQuery, [userId]);
        const templates = result.rows.map(row => row.template_used);
        res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        console.error('Error fetching templates for filter:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});
router.post('/send-custom-messages', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { templateName, language = 'en_US', phoneNumberId, recipientColumn, variableMappings = {}, data = [] } = req.body;
        if (!templateName || !phoneNumberId || !recipientColumn || !data.length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: templateName, phoneNumberId, recipientColumn, data'
            });
        }
        try {
            const creditCheck = await (0, creditSystem_1.preCheckCreditsForBulk)(userId, templateName, data.length);
            if (!creditCheck.sufficient) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient credits. Required: ${creditCheck.requiredCredits.toFixed(2)}, Available: ${creditCheck.currentBalance.toFixed(2)}`,
                    details: {
                        requiredCredits: creditCheck.requiredCredits,
                        currentBalance: creditCheck.currentBalance,
                        templateCategory: creditCheck.category
                    }
                });
            }
            console.log(`[CREDIT SYSTEM] Pre-check passed: ${creditCheck.requiredCredits} credits required for ${data.length} ${creditCheck.category} messages`);
        }
        catch (creditError) {
            console.error('Credit pre-check error:', creditError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check credit balance'
            });
        }
        const businessResult = await db_1.default.query('SELECT access_token, whatsapp_number_id FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true', [userId, phoneNumberId]);
        if (businessResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp Business API credentials not configured for this phone number'
            });
        }
        const businessInfo = businessResult.rows[0];
        const templateResult = await db_1.default.query('SELECT components, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, templateName, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const template = templateResult.rows[0];
        let creditDeductionSuccess = false;
        let creditBalance = 0;
        try {
            const { cost, category } = await (0, creditSystem_1.calculateCreditCost)(userId, templateName, data.length);
            const creditResult = await (0, creditSystem_1.deductCredits)({
                userId,
                amount: cost,
                transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
                templateCategory: category,
                templateName: templateName,
                description: `Custom Messages campaign: ${templateName} (${data.length} recipients)`
            });
            if (creditResult.success) {
                creditDeductionSuccess = true;
                creditBalance = creditResult.newBalance;
                console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Custom Messages. New balance: ${creditBalance}`);
            }
            else {
                throw new Error('Insufficient credits after pre-check');
            }
        }
        catch (creditError) {
            console.error('Credit deduction error for Custom Messages:', creditError);
            await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4', ['failed', 'Credit deduction failed', userId, 'Custom Messages']);
            return res.status(400).json({
                success: false,
                error: 'Credit deduction failed',
                details: creditError instanceof Error ? creditError.message : 'Unknown error'
            });
        }
        let successfulSends = 0;
        let failedSends = 0;
        const errors = [];
        const campaignEntries = [];
        for (const row of data) {
            try {
                const recipient = row[recipientColumn];
                if (!recipient) {
                    failedSends++;
                    errors.push(`Missing recipient for row: ${JSON.stringify(row)}`);
                    continue;
                }
                const variables = {};
                Object.keys(variableMappings).forEach(variable => {
                    const columnName = variableMappings[variable];
                    const value = row[columnName];
                    if (value) {
                        variables[variable] = value.toString();
                    }
                });
                const campaignResult = await db_1.default.query(`
          INSERT INTO campaign_logs 
          (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          RETURNING id
        `, [userId, 'Custom Messages', templateName, businessInfo.whatsapp_number_id, recipient, language, 'pending', JSON.stringify({ variables, template_components: template.components })]);
                campaignEntries.push({
                    id: campaignResult.rows[0].id,
                    recipient,
                    variables
                });
            }
            catch (error) {
                failedSends++;
                errors.push(`Failed to create campaign entry for recipient: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        for (const campaignEntry of campaignEntries) {
            try {
                await sendTemplateMessage(businessInfo.whatsapp_number_id, businessInfo.access_token, campaignEntry.recipient, templateName, language, campaignEntry.variables, template.components, campaignEntry.id.toString(), userId, template.header_media_id, template.header_type, template.header_media_url, template.header_handle, template.media_id, template.category);
                successfulSends++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                failedSends++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to send to ${campaignEntry.recipient}: ${errorMsg}`);
                try {
                    await db_1.default.query('UPDATE campaign_logs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', ['failed', errorMsg, campaignEntry.id]);
                }
                catch (updateError) {
                    console.error(`Failed to update campaign entry ${campaignEntry.id} to failed status:`, updateError);
                }
            }
        }
        res.json({
            success: true,
            data: {
                campaign_id: null,
                sent_count: successfulSends,
                failed_count: failedSends,
                total_count: data.length,
                errors: errors.slice(0, 10),
                creditInfo: {
                    deducted: creditDeductionSuccess,
                    newBalance: creditBalance
                }
            }
        });
    }
    catch (error) {
        console.error('Error sending custom messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send custom messages'
        });
    }
});
router.post('/bulk-customize-send', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { templateName, language, phoneNumberId, wabaId, data, campaignName, recipientColumn, variableMappings } = req.body;
        const actualWabaId = wabaId || phoneNumberId;
        console.log(`🚀 BULK-CUSTOMIZE-SEND: Starting custom bulk send for user ${userId}`);
        console.log(`📊 Template: ${templateName}, Language: ${language}, Recipients: ${data?.length || 0}`);
        if (!templateName || !language || !actualWabaId || !data || !Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: templateName, language, phoneNumberId/wabaId, or data array'
            });
        }
        if (data.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No recipient data provided'
            });
        }
        const validRecipients = [];
        const errors = [];
        console.log(`📋 Processing data with recipientColumn: ${recipientColumn}`);
        console.log(`🔄 Variable mappings:`, variableMappings);
        for (const entry of data) {
            const phoneValue = entry[recipientColumn];
            if (!phoneValue) {
                errors.push(`Missing phone number in column '${recipientColumn}' for entry: ${JSON.stringify(entry)}`);
                continue;
            }
            const cleanedPhone = phoneValue.toString().replace(/\D/g, '');
            if (cleanedPhone.length >= 10) {
                const recipientVariables = {};
                Object.keys(variableMappings).forEach(variableIndex => {
                    const columnName = variableMappings[variableIndex];
                    const value = entry[columnName];
                    if (value !== undefined && value !== null) {
                        recipientVariables[variableIndex] = value.toString();
                    }
                });
                validRecipients.push({
                    phone: cleanedPhone,
                    ...recipientVariables
                });
            }
            else {
                errors.push(`Invalid phone number: ${phoneValue} in column '${recipientColumn}'`);
            }
        }
        if (validRecipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid phone numbers provided',
                details: errors
            });
        }
        console.log(`📱 BULK-CUSTOMIZE-SEND: ${validRecipients.length} valid recipients, ${errors.length} errors`);
        try {
            const creditCheck = await (0, creditSystem_1.preCheckCreditsForBulk)(userId, templateName, validRecipients.length);
            if (!creditCheck.sufficient) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient credits. Required: ${creditCheck.requiredCredits.toFixed(2)}, Available: ${creditCheck.currentBalance.toFixed(2)}`,
                    details: {
                        requiredCredits: creditCheck.requiredCredits,
                        currentBalance: creditCheck.currentBalance,
                        templateCategory: creditCheck.category
                    }
                });
            }
            console.log(`[CREDIT SYSTEM] Pre-check passed: ${creditCheck.requiredCredits} credits required for ${validRecipients.length} ${creditCheck.category} messages`);
        }
        catch (creditError) {
            console.error('Credit pre-check error:', creditError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check credit balance'
            });
        }
        const numberResult = await db_1.default.query('SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true', [userId, actualWabaId]);
        if (numberResult.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'WhatsApp number not found or access denied'
            });
        }
        const { access_token } = numberResult.rows[0];
        const templateResult = await db_1.default.query('SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3', [userId, templateName, language]);
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        const campaignNameFinal = campaignName || `Custom Campaign - ${templateName} - ${new Date().toISOString()}`;
        const campaignEntries = [];
        for (const recipientData of validRecipients) {
            try {
                const result = await db_1.default.query(`INSERT INTO campaign_logs 
           (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           RETURNING id`, [
                    userId,
                    campaignNameFinal,
                    templateName,
                    actualWabaId,
                    recipientData.phone,
                    language,
                    'pending',
                    JSON.stringify({ variables: recipientData, template_components: templateResult.rows[0].components })
                ]);
                campaignEntries.push({
                    id: result.rows[0].id,
                    recipient: recipientData.phone,
                    variables: recipientData
                });
            }
            catch (dbError) {
                console.error(`Database error for recipient ${recipientData.phone}:`, dbError);
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
                errors.push(`Database error for ${recipientData.phone}: ${errorMessage}`);
            }
        }
        if (campaignEntries.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Failed to create campaign entries',
                details: errors
            });
        }
        console.log(`💾 BULK-CUSTOMIZE-SEND: Created ${campaignEntries.length} campaign entries`);
        let creditDeductionSuccess = false;
        let creditBalance = 0;
        try {
            const { cost, category } = await (0, creditSystem_1.calculateCreditCost)(userId, templateName, validRecipients.length);
            const creditResult = await (0, creditSystem_1.deductCredits)({
                userId,
                amount: cost,
                transactionType: creditSystem_1.CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
                templateCategory: category,
                templateName: templateName,
                description: `Customize campaign: ${campaignNameFinal} (${validRecipients.length} recipients)`
            });
            if (creditResult.success) {
                creditDeductionSuccess = true;
                creditBalance = creditResult.newBalance;
                console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Customize. New balance: ${creditBalance}`);
            }
            else {
                throw new Error('Credit deduction failed');
            }
        }
        catch (creditError) {
            console.error('Credit deduction error:', creditError);
            return res.status(500).json({
                success: false,
                error: 'Failed to deduct credits'
            });
        }
        console.log(`🚀 BULK-CUSTOMIZE-SEND: Starting to send ${campaignEntries.length} messages in batches of 200`);
        let successCount = 0;
        let failCount = 0;
        const BATCH_SIZE = 200;
        const batches = [];
        for (let i = 0; i < campaignEntries.length; i += BATCH_SIZE) {
            batches.push(campaignEntries.slice(i, i + BATCH_SIZE));
        }
        console.log(`📦 BULK-CUSTOMIZE-SEND: Processing ${batches.length} batches of up to ${BATCH_SIZE} messages each`);
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`📤 BULK-CUSTOMIZE-SEND: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);
            const batchPromises = batch.map(campaignEntry => sendTemplateMessage(actualWabaId, access_token, campaignEntry.recipient, templateName, language, campaignEntry.variables, templateResult.rows[0].components, campaignEntry.id.toString(), userId, templateResult.rows[0].header_media_id, templateResult.rows[0].header_type, templateResult.rows[0].header_media_url, templateResult.rows[0].header_handle, templateResult.rows[0].media_id, templateResult.rows[0].category));
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result, index) => {
                const campaignEntry = batch[index];
                if (result.status === 'fulfilled') {
                    const response = result.value;
                    if (response?.success === false && response?.duplicate) {
                        console.log(`🚨 BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Duplicate detected for ${campaignEntry.recipient}`);
                        failCount++;
                    }
                    else if (response?.success) {
                        console.log(`✅ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Successfully sent to ${campaignEntry.recipient}`);
                        successCount++;
                    }
                    else {
                        console.log(`⚠️ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Unknown response for ${campaignEntry.recipient}:`, response);
                        failCount++;
                    }
                }
                else {
                    console.log(`❌ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Promise rejected for ${campaignEntry.recipient}:`, result.reason);
                    failCount++;
                }
            });
            console.log(`✅ BULK-CUSTOMIZE-SEND: Batch ${batchIndex + 1}/${batches.length} completed. Running totals: ${successCount} success, ${failCount} failed`);
            if (batchIndex < batches.length - 1) {
                console.log(`⏳ BULK-CUSTOMIZE-SEND: Waiting 1 second before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        console.log(`📊 BULK-CUSTOMIZE-SEND COMPLETED: ${successCount} successful, ${failCount} failed`);
        res.json({
            success: true,
            data: {
                campaign_id: null,
                total_recipients: validRecipients.length,
                successful_sends: successCount,
                failed_sends: failCount,
                status: 'completed',
                creditInfo: {
                    deducted: creditDeductionSuccess,
                    newBalance: creditBalance
                }
            }
        });
    }
    catch (error) {
        console.error('Error sending bulk custom messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send bulk custom messages'
        });
    }
});
exports.default = router;
//# sourceMappingURL=whatsapp.js.map
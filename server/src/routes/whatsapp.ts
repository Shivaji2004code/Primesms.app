// [Claude AI] Credit System Enhancement — Aug 2025
import express from 'express';
import multer from 'multer';

// Type definitions
type CampaignId = number; // DB campaign_logs.id is integer
const XLSX = require('xlsx');
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { analyzeTemplate, buildTemplatePayload, validateTemplateVariables } from '../utils/template-helper';
import { 
  deductCredits, 
  CreditTransactionType, 
  preCheckCreditsForBulk, 
  calculateCreditCost,
  TemplateCategory 
} from '../utils/creditSystem';
import { 
  duplicateDetectionMiddleware, 
  isDuplicateRequest, 
  getDuplicateResponse,
  checkAndHandleDuplicate 
} from '../middleware/duplicateDetection';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for Excel files
  },
  fileFilter: (req, file, cb) => {
    // Allow Excel and CSV files for recipient import, and images for template headers
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'text/plain', // .txt
      'image/jpeg', // .jpg, .jpeg
      'image/png', // .png
      'image/gif' // .gif
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|csv|txt|jpg|jpeg|png|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls), CSV (.csv), text (.txt), and image (.jpg, .jpeg, .png, .gif) files are allowed'));
    }
  }
});

/**
 * Uploads a media file to the WhatsApp Cloud API to get a media ID.
 * @param imageUrl The URL to the image file to download and upload.
 * @param phoneNumberId The WhatsApp phone number ID.
 * @param accessToken The WhatsApp access token.
 * @returns The media ID string on success, or null on failure.
 */
async function uploadWhatsappMedia(imageUrl: string, phoneNumberId: string, accessToken: string): Promise<string | null> {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;

  try {
    console.log(`🔄 Downloading image from: ${imageUrl}`);
    
    // Step 1: Download the image from the URL
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    const mimeType = imageResponse.headers['content-type'] || 'image/png';
    
    console.log(`📁 Downloaded image: ${imageBuffer.length} bytes, type: ${mimeType}`);

    // Step 2: Create FormData and upload to WhatsApp
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', imageBuffer, { 
      contentType: mimeType, 
      filename: 'header_image.png' 
    });

    console.log(`🚀 Uploading to WhatsApp Media API: ${url}`);
    
    const response = await axios.post(url, formData, {
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
    
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error('❌ Failed to upload media to WhatsApp API:', JSON.stringify(errorData, null, 2));
    return null;
  }
}

const router = express.Router();

// Upload configuration is defined above with multer.diskStorage

// Utility function to validate phone numbers (Meta WhatsApp API format)
const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters including +, spaces, dashes, etc.
  const cleaned = phone.replace(/[^\d]/g, '');
  
  console.log(`🔍 Phone validation: Original="${phone}", Cleaned="${cleaned}", Length=${cleaned.length}`);
  
  // More flexible validation for international phone numbers
  // Allow 8-15 digits (some countries have shorter numbers)
  // Must start with a digit 1-9 (not 0)
  const isValid = /^[1-9]\d{7,14}$/.test(cleaned);
  
  console.log(`🔍 Phone validation result: ${isValid} for "${cleaned}"`);
  
  return isValid;
};

// Utility function to format phone number for Meta WhatsApp API
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digits, spaces, dashes, + symbols, etc.
  let cleaned = phone.replace(/[^\d]/g, '');
  
  console.log(`🔧 Formatting phone: Original="${phone}", Cleaned="${cleaned}"`);
  
  // Remove leading zeros if present
  cleaned = cleaned.replace(/^0+/, '');
  
  // Ensure it starts with country code (not 0)
  if (cleaned.length > 0 && cleaned[0] === '0') {
    cleaned = cleaned.substring(1);
  }
  
  // Handle common country codes without + prefix
  // If number starts with 91 (India), 1 (US/Canada), etc., keep as is
  // If number is 10 digits and starts with 6-9, assume it's Indian number and add 91
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = '91' + cleaned; // Add India country code
    console.log(`🔧 Added India country code: "${cleaned}"`);
  }
  
  console.log(`🔧 Final formatted phone: "${cleaned}"`);
  
  // Return the cleaned number without any + prefix
  // Format: 919394567890, 1234567890, etc.
  return cleaned;
};

// GET /api/whatsapp/numbers - Fetch all WhatsApp numbers for authenticated user
router.get('/numbers', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;

    const result = await pool.query(
      `SELECT 
        id,
        whatsapp_number_id as phone_number_id,
        whatsapp_number as phone_number,
        business_name,
        is_active
      FROM user_business_info 
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC`,
      [userId]
    );

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

  } catch (error) {
    console.error('Error fetching WhatsApp numbers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch WhatsApp numbers'
    });
  }
});

// GET /api/whatsapp/templates - Fetch templates for authenticated user
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
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
      params.push(language as string);
    }

    if (exclude_auth === 'true') {
      query += ` AND category != 'AUTHENTICATION'`;
    }

    query += ` ORDER BY name, language`;

    const result = await pool.query(query, params);

    const templates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      language: row.language,
      category: row.category,
      status: row.status,
      components: row.components,
      hasVariables: JSON.stringify(row.components).includes('{{'),
      hasButtons: row.components.some((comp: any) => comp.type === 'BUTTONS')
    }));

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

// GET /api/whatsapp/languages - Return supported languages
router.get('/languages', requireAuth, async (req, res) => {
  try {
    // Common WhatsApp Business API supported languages
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

  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch languages'
    });
  }
});

// POST /api/whatsapp/template-details - Get complete template structure
router.post('/template-details', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const { template_name, language = 'en_US' } = req.body;

    if (!template_name) {
      return res.status(400).json({
        success: false,
        error: 'template_name is required'
      });
    }

    const result = await pool.query(
      `SELECT 
        id,
        name,
        language,
        category,
        components,
        status
      FROM templates 
      WHERE user_id = $1 AND name = $2 AND language = $3`,
      [userId, template_name, language]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const template = result.rows[0];
    
    // Parse template components to extract variables and buttons
    const components = template.components;
    const variables: any[] = [];
    const buttons: any[] = [];
    let hasButtons = false;
    let templateTypeInfo = {
      hasStaticImage: false,
      hasDynamicImage: false,
      hasTextHeader: false,
      imageRequired: false,
      description: ''
    };

    // Special handling for AUTHENTICATION templates
    if (template.category === 'AUTHENTICATION') {
      // Authentication templates always need an OTP code parameter
      variables.push({
        index: 1,
        component: 'BODY',
        placeholder: 'OTP Code (e.g., 123456)',
        required: true,
        type: 'otp_code'
      });
      
      templateTypeInfo.description = 'Authentication template (requires OTP code parameter)';
    } else {
      // Standard processing for other template categories
      for (const component of components) {
        if (component.type === 'HEADER') {
          if (component.format === 'IMAGE') {
            const hasHeaderHandle = component.example && component.example.header_handle;
            const hasVariableInText = component.text && component.text.includes('{{');
            
            if (hasVariableInText) {
              // DYNAMIC IMAGE: Template has explicit {{1}} variable in header text
              templateTypeInfo.hasDynamicImage = true;
              templateTypeInfo.imageRequired = true;
              templateTypeInfo.description = 'Dynamic image template (requires image URL at runtime)';
              
              // Extract header variable
              const matches = component.text.match(/\{\{(\d+)\}\}/g);
              if (matches) {
                matches.forEach((match: string) => {
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
            } else if (hasHeaderHandle) {
              // STATIC IMAGE: Template has pre-uploaded media with header_handle
              templateTypeInfo.hasStaticImage = true;
              templateTypeInfo.imageRequired = false;
              templateTypeInfo.description = 'Static image template (uses pre-uploaded image - no URL needed)';
            } else {
              // UNKNOWN: Image template without header_handle or variables - treat as dynamic
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
          } else if (component.format === 'TEXT') {
            templateTypeInfo.hasTextHeader = true;
            const text = component.text || '';
            const matches = text.match(/\{\{(\d+)\}\}/g);
            if (matches) {
              matches.forEach((match: string) => {
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
        } else if (component.type === 'BODY' || component.type === 'FOOTER') {
          const text = component.text || '';
          const matches = text.match(/\{\{(\d+)\}\}/g);
          if (matches) {
            matches.forEach((match: string) => {
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

    // Process buttons for all template types
    for (const component of components) {
      if (component.type === 'BUTTONS') {
        hasButtons = true;
        component.buttons?.forEach((button: any, index: number) => {
          buttons.push({
            index: index,
            type: button.type,
            text: button.text,
            url: button.url,
            phone_number: button.phone_number,
            copy_code: button.copy_code
          });
          
          // Check for dynamic URL buttons
          if (button.type === 'URL' && button.url && button.url.includes('{{')) {
            const matches = button.url.match(/\{\{(\d+)\}\}/g);
            if (matches) {
              matches.forEach((match: string) => {
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

    // Remove duplicates and sort variables
    const uniqueVariables = variables.filter((v, i, arr) => 
      arr.findIndex(item => item.index === v.index && item.component === v.component) === i
    ).sort((a, b) => a.index - b.index);

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

  } catch (error) {
    console.error('Error fetching template details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template details'
    });
  }
});

// Helper function to generate template preview
function generateTemplatePreview(components: any[], variables: Record<string, string>): string {
  let preview = '';
  
  components.forEach(component => {
    if (component.type === 'HEADER') {
      if (component.format === 'IMAGE') {
        if (variables['1']) {
          preview += `📷 *Image:* ${variables['1']}\n\n`;
        } else {
          preview += `📷 *[Static Image]*\n\n`;
        }
      } else if (component.text) {
        preview += `*${replaceVariables(component.text, variables)}*\n\n`;
      }
    } else if (component.type === 'BODY') {
      preview += `${replaceVariables(component.text, variables)}\n\n`;
    } else if (component.type === 'FOOTER' && component.text) {
      preview += `_${replaceVariables(component.text, variables)}_\n`;
    } else if (component.type === 'BUTTONS') {
      preview += '\n*Buttons:*\n';
      component.buttons?.forEach((button: any) => {
        preview += `• ${button.text}\n`;
      });
    }
  });
  
  return preview.trim();
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
    return variables[index] || `{{${index}}}`;
  });
}

// POST /api/whatsapp/preview-excel - Preview Excel file columns
router.post('/preview-excel', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
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

      // Get column headers (first row)
      const headers = (jsonData[0] || []) as any[];
      const columns = headers.map((header: any, index: number) => 
        header?.toString().trim() || `Column ${String.fromCharCode(65 + index)}`
      );
      
      // Get sample data (first 5 rows after header)
      const sampleData = jsonData.slice(1, 6);
      
      res.json({
        success: true,
        data: {
          columns: columns,
          sample_data: sampleData,
          total_rows: jsonData.length - 1 // Exclude header row
        }
      });

    } catch (parseError) {
      console.error('Error parsing Excel file:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse Excel file. Please ensure it\'s a valid Excel file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error previewing Excel file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview Excel file'
    });
  }
});

// POST /api/whatsapp/import-excel-column - Import from specific Excel column
router.post('/import-excel-column', requireAuth, upload.single('file'), async (req, res) => {
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
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
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

      // Get column headers
      const headers = (jsonData[0] || []) as any[];
      const columnIndex = headers.findIndex((header: any) => 
        header?.toString().trim() === column
      );
      
      if (columnIndex === -1) {
        return res.status(400).json({
          success: false,
          error: `Column "${column}" not found in Excel file`
        });
      }

      console.log(`Found column "${column}" at index ${columnIndex}`);
      
      // Extract phone numbers from the selected column
      const phoneNumbers = jsonData.slice(1) // Skip header row
        .map((row: any, index: number) => {
          const phone = row[columnIndex]?.toString().trim();
          if (phone) {
            console.log(`Row ${index + 2}: Found phone number: ${phone}`);
          }
          return phone;
        })
        .filter((phone: any) => phone && phone !== '');
      
      console.log(`Extracted ${phoneNumbers.length} phone numbers from column "${column}"`);
      console.log(`Raw phone numbers:`, phoneNumbers);

      // For Excel import, accept all values from the selected column as-is
      // User can review and edit them in the manual entry field
      console.log(`\n📊 Excel Import - Accepting all values from column "${column}"`);
      console.log(`- Total numbers found: ${phoneNumbers.length}`);
      console.log(`- Numbers:`, phoneNumbers);

      // Remove duplicates but keep all values as-is
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

    } catch (parseError) {
      console.error('Error parsing Excel file:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse Excel file. Please ensure it\'s a valid Excel file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error importing from Excel column:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import from Excel column'
    });
  }
});

// POST /api/whatsapp/import-recipients - Handle Excel file upload
router.post('/import-recipients', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let phoneNumbers: string[] = [];

    try {
      if (fileExtension === '.csv') {
        // Handle CSV files
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        phoneNumbers = lines
          .map(line => line.split(',')[0]?.trim())
          .filter((phone: any) => phone && phone !== '');
      } else {
        // Handle Excel files
        console.log(`Processing Excel file: ${req.file.originalname}`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        console.log(`Using sheet: ${sheetName}`);
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`Total rows in Excel: ${jsonData.length}`);
        
        phoneNumbers = jsonData
          .map((row: any, index: number) => {
            const phone = row[0]?.toString().trim();
            if (phone) {
              console.log(`Row ${index + 1}: Found phone number: ${phone}`);
            }
            return phone;
          })
          .filter((phone: any) => phone && phone !== '');
        
        console.log(`Extracted ${phoneNumbers.length} phone numbers from Excel file`);
      }

      // Validate and format phone numbers
      const validNumbers: string[] = [];
      const invalidNumbers: string[] = [];

      phoneNumbers.forEach(phone => {
        if (validatePhoneNumber(phone)) {
          validNumbers.push(formatPhoneNumber(phone));
        } else {
          invalidNumbers.push(phone);
        }
      });

      // Remove duplicates
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

    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error importing recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import recipients'
    });
  }
});

// POST /api/whatsapp/import-bulk-recipients - Handle Excel file upload for WhatsApp Bulk (Quick Send)
router.post('/import-bulk-recipients', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let phoneNumbers: string[] = [];

    try {
      if (fileExtension === '.csv') {
        // Handle CSV files
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        phoneNumbers = lines
          .map(line => line.split(',')[0]?.trim())
          .filter((phone: any) => phone && phone !== '');
      } else {
        // Handle Excel files
        console.log(`Processing Excel file for WhatsApp Bulk: ${req.file.originalname}`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        console.log(`Using sheet: ${sheetName}`);
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`Total rows in Excel: ${jsonData.length}`);
        
        phoneNumbers = jsonData
          .map((row: any, index: number) => {
            const phone = row[0]?.toString().trim();
            if (phone) {
              console.log(`Row ${index + 1}: Found phone number: ${phone}`);
            }
            return phone;
          })
          .filter((phone: any) => phone && phone !== '');
        
        console.log(`Extracted ${phoneNumbers.length} phone numbers from Excel file`);
      }

      // Validate and format phone numbers
      const validNumbers: string[] = [];
      const invalidNumbers: string[] = [];

      phoneNumbers.forEach(phone => {
        if (validatePhoneNumber(phone)) {
          validNumbers.push(formatPhoneNumber(phone));
        } else {
          invalidNumbers.push(phone);
        }
      });

      // Remove duplicates
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

    } catch (parseError) {
      console.error('Error parsing file for WhatsApp Bulk:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error importing bulk recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import recipients'
    });
  }
});

// POST /api/whatsapp/preview-campaign - Generate campaign preview
router.post('/preview-campaign', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const {
      template_name,
      language = 'en_US',
      variables = {},
      recipients_text = ''
    } = req.body;

    if (!template_name) {
      return res.status(400).json({
        success: false,
        error: 'template_name is required'
      });
    }

    // Get template details including media ID, header type, and media URL
    const templateResult = await pool.query(
      'SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, template_name, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const components = templateResult.rows[0].components;
    
    // Parse recipients with CSV support (same logic as quick-send)
    const lines = recipients_text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    
    // Process each line to extract phone numbers and variables
    const recipientData: Array<{phone: string, variables: Record<string, string>}> = [];
    
    lines.forEach((line: string, index: number) => {
      // Check if line contains comma-separated values (Excel format)
      if (line.includes(',')) {
        const columns = line.split(',').map((col: string) => col.trim());
        const phone = columns[0]; // First column is phone number
        
        // Create variables from remaining columns (1, 2, 3, etc.)
        const lineVariables: Record<string, string> = {};
        for (let i = 1; i < columns.length; i++) {
          lineVariables[i.toString()] = columns[i];
        }
        
        recipientData.push({ phone, variables: lineVariables });
        console.log(`📊 Preview row ${index + 1}: Phone=${phone}, Variables=`, lineVariables);
      } else {
        // Simple phone number format
        recipientData.push({ phone: line, variables: {} });
      }
    });
    
    const phoneNumbers = recipientData.map(item => item.phone);
    const formattedNumbers = phoneNumbers.map((num: string) => formatPhoneNumber(num));
    
    const validRecipients = formattedNumbers.filter((num: string) => validatePhoneNumber(num));
    const invalidRecipients = formattedNumbers.filter((num: string) => !validatePhoneNumber(num));

    // Generate personalized previews for each recipient
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
        recipient_previews: recipientPreviews, // Array of personalized previews
        components,
        variables,
        recipient_stats: {
          total_provided: phoneNumbers.length,
          valid_recipients: validRecipients.length,
          invalid_recipients: invalidRecipients.length,
          valid_numbers: validRecipients.slice(0, 5), // Show first 5 for preview
          invalid_numbers: invalidRecipients
        }
      }
    });

  } catch (error) {
    console.error('Error generating campaign preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate campaign preview'
    });
  }
});

// POST /api/whatsapp/quick-send - Handle quick message sending (with optional image upload)
router.post('/quick-send', requireAuth, upload.single('headerImage'), async (req, res) => {
  try {
    
    const userId = req.session.user!.id;
    console.log(`🔍 DEBUG QUICK-SEND: userId from session = ${userId}`);
    let {
      phone_number_id,
      template_name,
      language = 'en_US',
      variables = {},
      recipients_text = '',
      campaign_name
    } = req.body;

    // Parse variables if it's a JSON string (when sent via FormData)
    if (typeof variables === 'string') {
      try {
        variables = JSON.parse(variables);
      } catch (parseError) {
        console.log(`⚠️ DEBUG QUICK-SEND: Failed to parse variables JSON:`, variables);
        variables = {};
      }
    }

    console.log(`🔍 DEBUG QUICK-SEND: Request body:`, { phone_number_id, template_name, language, campaign_name });
    console.log(`🔍 DEBUG QUICK-SEND: Recipients text:`, recipients_text);
    console.log(`🔍 DEBUG QUICK-SEND: Variables:`, variables);

    // Validation
    if (!phone_number_id || !template_name || !recipients_text.trim()) {
      console.log(`❌ DEBUG QUICK-SEND: Validation failed - missing fields`);
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phone_number_id, template_name, recipients_text'
      });
    }

    console.log(`✅ DEBUG QUICK-SEND: Validation passed`);

    // Parse recipients (quick-send only supports phone numbers, no CSV/dynamic variables)
    const lines = recipients_text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    
    // Check if any line contains CSV format (commas) and reject it
    const csvLines = lines.filter((line: string) => line.includes(','));
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
    
    // Process each line as a simple phone number (all use same static variables)
    const recipientData: Array<{phone: string, variables: Record<string, string>}> = [];
    
    lines.forEach((line: string) => {
      // Quick-send: all recipients use the same static variables from form
      recipientData.push({ phone: line, variables: variables || {} });
    });
    
    const phoneNumbers = recipientData.map(item => item.phone);
    const formattedNumbers = phoneNumbers.map((num: string) => formatPhoneNumber(num));
    
    const validRecipients = formattedNumbers.filter((num: string) => validatePhoneNumber(num));
    
    console.log(`🔍 DEBUG QUICK-SEND: Phone validation - formatted: ${formattedNumbers}, valid: ${validRecipients}`);
    
    if (validRecipients.length === 0) {
      console.log(`❌ DEBUG QUICK-SEND: No valid phone numbers found`);
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers found. Please use Meta WhatsApp API format (919398424270, no + prefix)'
      });
    }

    console.log(`✅ DEBUG QUICK-SEND: Phone validation passed`);
    
    // CREDIT SYSTEM: Pre-check credits before sending
    try {
      console.log(`💰 DEBUG QUICK-SEND: Checking credits for template: "${template_name}", recipients: ${validRecipients.length}`);
      
      const creditCheck = await preCheckCreditsForBulk(userId, template_name, validRecipients.length);
      
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
    } catch (creditError: any) {
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

    // Get WhatsApp number details and verify ownership
    const numberResult = await pool.query(
      'SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true',
      [userId, phone_number_id]
    );

    if (numberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'WhatsApp number not found or access denied'
      });
    }

    const { access_token } = numberResult.rows[0];

    // Get template details including media ID, header type, and media URL
    const templateResult = await pool.query(
      'SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, template_name, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const templateDetails = templateResult.rows[0];
    
    // Check if template has image header and handle image upload
    let uploadedImageMediaId: string | null = null;
    
    if (templateDetails.header_type === 'STATIC_IMAGE') {
      console.log('🖼️ Template has image header - checking for uploaded image');
      
      if (req.file) {
        console.log('📤 Image uploaded for template message, uploading to WhatsApp...');
        
        try {
          // Upload the image to WhatsApp media endpoint
          const FormData = require('form-data');
          const form = new FormData();
          
          form.append('file', fs.createReadStream(req.file.path));
          form.append('type', req.file.mimetype);
          form.append('messaging_product', 'whatsapp');
          
          const mediaResponse = await axios.post(
            `https://graph.facebook.com/v21.0/${phone_number_id}/media`,
            form,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
                ...form.getHeaders()
              }
            }
          );
          
          uploadedImageMediaId = mediaResponse.data.id;
          console.log('✅ Image uploaded successfully, media_id:', uploadedImageMediaId);
          
          // Clean up temporary file
          fs.unlinkSync(req.file.path);
          
        } catch (uploadError: any) {
          console.error('❌ Image upload failed:', uploadError.response?.data || uploadError.message);
          
          // Clean up temporary file
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          return res.status(400).json({
            success: false,
            error: 'Failed to upload image to WhatsApp',
            details: uploadError.response?.data || uploadError.message
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Template requires an image header, but no image was uploaded. Please upload an image.'
        });
      }
    }

    // CRITICAL FIX: Validate template variables match requirements
    const components = templateDetails.components;
    const requiredVariables = new Set<string>();
    
    // Special handling for AUTHENTICATION templates
    if (templateDetails.category === 'AUTHENTICATION') {
      console.log(`🔍 Authentication template detected: ${template_name}`);
      
      // Authentication templates typically require at least one variable (the OTP code)
      // even if their components array doesn't show explicit placeholders
      if (Object.keys(variables).length > 0) {
        // If variables are provided, accept them (usually variable 1 for OTP)
        requiredVariables.add('1');
      }
      // If no variables provided, assume it's a static authentication template
    } else {
      // Standard processing for non-authentication templates
      // Extract all required variables from template components
      for (const component of components) {
        if (component.text) {
          const matches = component.text.match(/\{\{(\d+)\}\}/g) || [];
          matches.forEach((match: string) => {
            const variableIndex = match.replace(/[{}]/g, '');
            requiredVariables.add(variableIndex);
          });
        }
        
        // Check button URLs for variables
        if (component.type === 'BUTTONS' && component.buttons) {
          component.buttons.forEach((button: any) => {
            if (button.url && button.url.includes('{{')) {
              const matches = button.url.match(/\{\{(\d+)\}\}/g) || [];
              matches.forEach((match: string) => {
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
    
    // Log template analysis for debugging
    console.log(`🔍 Template "${template_name}" Analysis:`);
    console.log(`   Required variables: [${requiredVariablesList.join(', ')}]`);
    console.log(`   Provided variables: [${providedVariablesList.join(', ')}]`);
    console.log(`   Variables object:`, variables);
    
    // Check if variables count matches
    if (requiredVariablesList.length !== providedVariablesList.length) {
      return res.status(400).json({
        success: false,
        error: `Template "${template_name}" requires ${requiredVariablesList.length} variables (${requiredVariablesList.join(', ')}), but ${providedVariablesList.length} were provided (${providedVariablesList.join(', ')})`
      });
    }
    
    // Ensure all required variables are provided with correct indices
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

    // Create individual campaign_logs entries for each recipient
    const campaignName = campaign_name || `Quick Send - ${template_name} - ${new Date().toISOString()}`;
    const campaignEntries: Array<{id: string, recipient: string}> = [];
    
    for (const recipient of validRecipients) {
      // Ensure recipient is not empty or null
      const cleanRecipient = recipient?.toString().trim();
      if (!cleanRecipient) {
        console.error(`⚠️  Skipping empty recipient in quick send: ${campaignName}`);
        continue;
      }
      
      const campaignResult = await pool.query(
        `INSERT INTO campaign_logs 
         (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          userId,
          campaignName,
          template_name,
          phone_number_id,
          cleanRecipient,
          language,
          'pending',
          JSON.stringify({ variables, template_components: templateResult.rows[0].components })
        ]
      );
      
      campaignEntries.push({
        id: campaignResult.rows[0].id,
        recipient: cleanRecipient
      });
    }

    console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries for recipients`);
    
    // CREDIT SYSTEM: Deduct credits upfront for Quicksend (deduct on push, not delivery)
    let creditDeductionSuccess = false;
    let creditBalance = 0;
    
    try {
      // Get the credit check result from the earlier pre-check
      const { cost, category } = await calculateCreditCost(userId, template_name, validRecipients.length);
      const creditResult = await deductCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.DEDUCTION_QUICKSEND,
        templateCategory: category,
        templateName: template_name,
        description: `Quicksend campaign: ${campaignName} (${validRecipients.length} recipients)`
      });
      
      if (creditResult.success) {
        creditDeductionSuccess = true;
        creditBalance = creditResult.newBalance;
        console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Quicksend. New balance: ${creditBalance}`);
      } else {
        // This shouldn't happen since we pre-checked, but handle it
        throw new Error('Insufficient credits after pre-check');
      }
    } catch (creditError) {
      console.error('Credit deduction error for Quicksend:', creditError);
      // Update all campaign entries status to failed
      await pool.query(
        'UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4',
        ['failed', 'Credit deduction failed', userId, campaignName]
      );
      
      return res.status(400).json({
        success: false,
        error: 'Credit deduction failed',
        details: creditError instanceof Error ? creditError.message : 'Unknown error'
      });
    }

    // Return immediate response - campaign started successfully
    res.json({
      success: true,
      data: {
        campaign_id: null, // Individual entries created instead
        total_recipients: validRecipients.length,
        status: 'started',
        message: 'Campaign started successfully and is being processed in batches',
        creditInfo: {
          deducted: creditDeductionSuccess,
          newBalance: creditBalance
        }
      }
    });

    // NOW ACTUALLY SEND THE MESSAGES WITH 200-MESSAGE BATCHING ASYNCHRONOUSLY!
    console.log(`🚀 QUICK-SEND: Starting to send ${campaignEntries.length} messages in batches of 200 (background processing)`);
    
    // Process sending in background (fire and forget)
    setImmediate(async () => {
      let successCount = 0;
      let failCount = 0;
      
      try {
        // Split into batches of 200
        const BATCH_SIZE = 200;
        const batches = [];
        for (let i = 0; i < campaignEntries.length; i += BATCH_SIZE) {
          batches.push(campaignEntries.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`📦 QUICK-SEND: Processing ${batches.length} batches of up to ${BATCH_SIZE} messages each`);
        
        // Process each batch sequentially with 1-second delay between batches
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`📤 QUICK-SEND: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);
          
          // Process all messages in this batch concurrently
          const batchPromises = batch.map(campaignEntry => 
            sendTemplateMessage(
              phone_number_id,
              access_token,
              campaignEntry.recipient,
              template_name,
              language,
              variables, // All recipients use same static variables in quick-send
              templateResult.rows[0].components,
              campaignEntry.id.toString(), // Use individual campaign ID
              userId,
              templateResult.rows[0].header_media_id,
              templateResult.rows[0].header_type,
              templateResult.rows[0].header_media_url,
              templateResult.rows[0].header_handle,
              uploadedImageMediaId || templateResult.rows[0].media_id, // Use fresh uploaded media_id if available
              templateResult.rows[0].category
            )
          );
          
          // Execute batch and count results
          const batchResults = await Promise.allSettled(batchPromises);
          
          batchResults.forEach((result, index) => {
            const campaignEntry = batch[index];
            if (result.status === 'fulfilled') {
              const response = result.value;
              if (response?.success === false && response?.duplicate) {
                console.log(`🚨 QUICK-SEND BATCH ${batchIndex + 1}: Duplicate detected for ${campaignEntry.recipient}`);
                failCount++;
              } else if (response?.success) {
                console.log(`✅ QUICK-SEND BATCH ${batchIndex + 1}: Successfully sent to ${campaignEntry.recipient}`);
                successCount++;
              } else {
                console.log(`⚠️ QUICK-SEND BATCH ${batchIndex + 1}: Unknown response for ${campaignEntry.recipient}:`, response);
                failCount++;
              }
            } else {
              console.log(`❌ QUICK-SEND BATCH ${batchIndex + 1}: Promise rejected for ${campaignEntry.recipient}:`, result.reason);
              failCount++;
            }
          });
          
          console.log(`✅ QUICK-SEND: Batch ${batchIndex + 1}/${batches.length} completed. Running totals: ${successCount} success, ${failCount} failed`);
          
          // Add 1-second delay between batches (except for the last batch)
          if (batchIndex < batches.length - 1) {
            console.log(`⏳ QUICK-SEND: Waiting 1 second before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`📊 QUICK-SEND COMPLETED: ${successCount} successful, ${failCount} failed`);
      } catch (error) {
        console.error('❌ Background sending error:', error);
      }
    });

  } catch (error) {
    console.error('Error in quick send:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send messages'
    });
  }
});

// POST /api/whatsapp/send-bulk - Handle bulk message sending
router.post('/send-bulk', requireAuth, async (req, res) => {
  try {
    
    const userId = req.session.user!.id;
    const {
      phone_number_id,
      template_name,
      language = 'en_US',
      variables = {},
      recipients = [],
      buttons = {},
      campaign_name
    } = req.body;

    // Validation
    if (!phone_number_id || !template_name || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phone_number_id, template_name, recipients'
      });
    }

    // Validate recipients are phone numbers
    const validRecipients = recipients.filter((phone: string) => validatePhoneNumber(phone));
    
    if (validRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers provided'
      });
    }
    
    // CREDIT SYSTEM: Pre-check credits before sending
    try {
      const creditCheck = await preCheckCreditsForBulk(userId, template_name, validRecipients.length);
      
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
    } catch (creditError) {
      console.error('Credit pre-check error:', creditError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check credit balance'
      });
    }

    // Get WhatsApp number details and verify ownership
    const numberResult = await pool.query(
      'SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true',
      [userId, phone_number_id]
    );

    if (numberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'WhatsApp number not found or access denied'
      });
    }

    const { access_token } = numberResult.rows[0];

    // Get template details including media ID, header type, and media URL
    const templateResult = await pool.query(
      'SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, template_name, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // CRITICAL FIX: Validate template variables match requirements (same as quick-send)
    const components = templateResult.rows[0].components;
    const templateCategory = templateResult.rows[0].category;
    const requiredVariables = new Set<string>();
    
    // Special handling for AUTHENTICATION templates
    if (templateCategory === 'AUTHENTICATION') {
      console.log(`🔍 Authentication template detected in bulk send: ${template_name}`);
      
      // Authentication templates typically require at least one variable (the OTP code)
      // even if their components array doesn't show explicit placeholders
      if (Object.keys(variables).length > 0) {
        // If variables are provided, accept them (usually variable 1 for OTP)
        requiredVariables.add('1');
      }
      // If no variables provided, assume it's a static authentication template
    } else {
      // Standard processing for non-authentication templates
      // Extract all required variables from template components
      for (const component of components) {
        if (component.text) {
          const matches = component.text.match(/\{\{(\d+)\}\}/g) || [];
          matches.forEach((match: string) => {
            const variableIndex = match.replace(/[{}]/g, '');
            requiredVariables.add(variableIndex);
          });
        }
        
        // Check button URLs for variables
        if (component.type === 'BUTTONS' && component.buttons) {
          component.buttons.forEach((button: any) => {
            if (button.url && button.url.includes('{{')) {
              const matches = button.url.match(/\{\{(\d+)\}\}/g) || [];
              matches.forEach((match: string) => {
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
    
    // Log template analysis for debugging
    console.log(`🔍 Bulk Template "${template_name}" Analysis:`);
    console.log(`   Required variables: [${requiredVariablesList.join(', ')}]`);
    console.log(`   Provided variables: [${providedVariablesList.join(', ')}]`);
    console.log(`   Variables object:`, variables);
    
    // RELAXED VALIDATION FOR BULK: Only check for critical missing variables, allow extra variables
    const missingVariables = requiredVariablesList.filter(reqVar => !variables[reqVar] && variables[reqVar] !== '');
    
    if (missingVariables.length > 0) {
      console.log(`⚠️ Missing required variables for template "${template_name}": ${missingVariables.join(', ')}`);
      console.log(`   This will be handled by sendTemplateMessage with placeholder values`);
    }
    
    console.log(`✅ Bulk validation passed - proceeding with message sending`);
    console.log(`   Required: [${requiredVariablesList.join(', ')}]`);
    console.log(`   Provided: [${providedVariablesList.join(', ')}]`);
    console.log(`   Missing (will use placeholders): [${missingVariables.join(', ')}]`);

    // Create individual campaign entries for each recipient (ensuring recipient_number is always saved)
    const campaignEntries: Array<{id: string, recipient: string}> = [];
    const campaignNameFinal = campaign_name || `Campaign - ${template_name} - ${new Date().toISOString()}`;
    
    for (const recipient of validRecipients) {
      // Ensure recipient is not empty or null
      const cleanRecipient = recipient?.toString().trim();
      if (!cleanRecipient) {
        console.error(`⚠️  Skipping empty recipient in campaign: ${campaignNameFinal}`);
        continue;
      }
      
      const campaignResult = await pool.query(
        `INSERT INTO campaign_logs 
         (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          userId,
          campaignNameFinal,
          template_name,
          phone_number_id,
          cleanRecipient,
          language,
          'pending',
          JSON.stringify({ variables, buttons, template_components: templateResult.rows[0].components })
        ]
      );
      
      campaignEntries.push({
        id: campaignResult.rows[0].id,
        recipient: cleanRecipient
      });
    }
    
    console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries with recipient numbers`);
    
    // CREDIT SYSTEM: Deduct credits upfront for Customise SMS (deduct on push, not delivery)
    let creditDeductionSuccess = false;
    let creditBalance = 0;
    
    try {
      // Get the credit check result from the earlier pre-check
      const { cost, category } = await calculateCreditCost(userId, template_name, validRecipients.length);
      const creditResult = await deductCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
        templateCategory: category,
        templateName: template_name,
        description: `Customise SMS campaign: ${campaign_name || 'Unnamed'} (${validRecipients.length} recipients)`
      });
      
      if (creditResult.success) {
        creditDeductionSuccess = true;
        creditBalance = creditResult.newBalance;
        console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Customise SMS. New balance: ${creditBalance}`);
      } else {
        // This shouldn't happen since we pre-checked, but handle it
        throw new Error('Insufficient credits after pre-check');
      }
    } catch (creditError) {
      console.error('Credit deduction error for Customise SMS:', creditError);
      // Update all campaign entries to failed
      await pool.query(
        'UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4',
        ['failed', 'Credit deduction failed', userId, campaignNameFinal]
      );
      
      return res.status(400).json({
        success: false,
        error: 'Credit deduction failed',
        details: creditError instanceof Error ? creditError.message : 'Unknown error'
      });
    }

    // Campaign entries were already created above - use the existing ones

    // Start sending messages (in a real app, this would be a background job)
    // For demo purposes, we'll simulate the sending process
    let successCount = 0;
    let failCount = 0;

    // Process messages with their individual campaign IDs
    const messagePromises = [];

    for (const campaignEntry of campaignEntries) {
      const messagePromise = sendTemplateMessage(
        phone_number_id,
        access_token,
        campaignEntry.recipient,
        template_name,
        language,
        variables,
        templateResult.rows[0].components,
        campaignEntry.id, // Use individual campaign ID
        userId,
        templateResult.rows[0].header_media_id,
        templateResult.rows[0].header_type,
        templateResult.rows[0].header_media_url,
        templateResult.rows[0].header_handle,
        templateResult.rows[0].media_id,
        templateResult.rows[0].category
      );
      messagePromises.push(messagePromise);
    }

    // Execute all message sending promises
    const results = await Promise.allSettled(messagePromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response?.success === false && response?.duplicate) {
          console.log(`🚨 BULK MESSAGE ${index + 1}: Duplicate detected for ${campaignEntries[index].recipient}`);
          failCount++;
        } else if (response?.success) {
          console.log(`✅ BULK MESSAGE ${index + 1}: Successfully sent to ${campaignEntries[index].recipient}`);
          successCount++;
        } else {
          console.log(`⚠️ BULK MESSAGE ${index + 1}: Unknown response for ${campaignEntries[index].recipient}:`, response);
          failCount++;
        }
      } else {
        console.log(`❌ BULK MESSAGE ${index + 1}: Promise rejected for ${campaignEntries[index].recipient}:`, result.reason);
        failCount++;
      }
    });

    // Individual campaign entries are already updated by sendTemplateMessage
    // No need for aggregate campaign update since we track individuals

    res.json({
      success: true,
      data: {
        campaign_id: null, // Individual entries created instead
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

  } catch (error) {
    console.error('Error sending bulk messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk messages'
    });
  }
});

// Function to send individual template message
async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  recipient: string,
  templateName: string,
  language: string,
  variables: Record<string, string>,
  components: any[],
  campaignId: string,
  userId: string,
  headerMediaId?: string,
  headerType?: string,
  headerMediaUrl?: string,
  headerHandle?: string,
  mediaId?: string,
  templateCategory?: string
): Promise<any> {
  try {
    console.log(`🔄 SENDING MESSAGE: Starting sendTemplateMessage for ${recipient} with template ${templateName}`);
    
    // DUPLICATE DETECTION: Check if this exact message was sent recently
    const duplicateCheck = await checkAndHandleDuplicate(
      userId,
      templateName,
      recipient,
      variables,
      campaignId
    );
    
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
    const templateComponents: any[] = [];

    console.log(`🚀 Processing template "${templateName}" with category: ${templateCategory || 'UNKNOWN'}, header_type: ${headerType || 'UNKNOWN'}`);

    // Special handling for AUTHENTICATION templates (2025 format)
    if (templateCategory === 'AUTHENTICATION') {
      console.log(`🔐 Authentication template detected - using 2025 format`);
      
      // Get OTP code from variables (usually var1)
      const otpCode = variables['1'] || variables['var1'] || Object.values(variables)[0];
      
      if (otpCode) {
        console.log(`🔐 Adding authentication template components with OTP: ${otpCode}`);
        
        // Add body component with OTP code
        templateComponents.push({
          type: "body",
          parameters: [{ type: "text", text: otpCode.toString() }]
        });
        
        // Add button component with OTP code (required for authentication templates)
        templateComponents.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otpCode.toString() }]
        });
        
        console.log(`✅ Added authentication template components (body + button)`);
      } else {
        console.log(`⚠️ Authentication template but no OTP code provided in variables:`, variables);
      }
    } else {
      // SIMPLIFIED LOGIC: Only handle STATIC_IMAGE, TEXT, and NONE for non-auth templates
      for (const component of components) {
      if (component.type === 'HEADER') {
        
        // Handle IMAGE templates - Use fresh uploaded media_id
        if (component.format === 'IMAGE' || headerType === 'STATIC_IMAGE') {
          console.log(`📸 IMAGE template detected - using fresh uploaded media_id for sending`);
          console.log(`🔍 Available data:`);
          console.log(`   media_id (fresh upload): ${mediaId || 'Not set'}`);
          
          // Use the fresh uploaded media_id from quick-send
          if (mediaId) {
            console.log(`✅ Using fresh uploaded media_id for message sending: ${mediaId}`);
            
            const headerComponent = {
              type: "header",
              parameters: [{
                type: "image",
                image: {
                  id: mediaId // Use fresh media_id from upload
                }
              }]
            };

            templateComponents.push(headerComponent);
            console.log(`✅ Added header component with fresh media_id: ${mediaId}`);
          } else {
            throw new Error(`Template '${templateName}' requires image but no fresh media_id provided. Upload image in quick-send.`);
          }
        }
        
        // Handle TEXT headers with variables
        else if (headerType === 'TEXT' && component.text && component.text.includes('{{')) {
          console.log(`📝 TEXT header with variables detected`);
          const headerParams: any[] = [];
          const matches = component.text.match(/\{\{(\d+)\}\}/g);
          if (matches) {
            // CRITICAL FIX: Always send ALL required parameters, even if empty
            matches.forEach((match: string) => {
              const variableIndex = parseInt(match.replace(/[{}]/g, ''));
              const value = variables[variableIndex.toString()] || `[Header Variable ${variableIndex} not provided]`;
              
              headerParams.push({
                type: "text",
                text: value
              });
            });
            
            // Always add header component if template has variables (Meta requirement)
            templateComponents.push({
              type: "header",
              parameters: headerParams
            });
            console.log(`   ✅ Added text header with ${headerParams.length} parameters (${matches.length} required)`);
          }
        }
      } else if (component.type === 'BODY' && component.text) {
        // Handle body variables
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          const bodyParams: any[] = [];
          
          // CRITICAL FIX: Always send ALL required parameters, even if empty
          matches.forEach((match: string) => {
            const variableIndex = parseInt(match.replace(/[{}]/g, ''));
            const value = variables[variableIndex.toString()] || `[Variable ${variableIndex} not provided]`;
            
            console.log(`🔍 META API - Variable ${variableIndex}: "${value}" (from variables object:`, variables, `)`);
            
            bodyParams.push({
              type: "text",
              text: value
            });
          });
          
          // Always add body component if template has variables (Meta requirement)
          templateComponents.push({
            type: "body",
            parameters: bodyParams
          });
          console.log(`   ✅ Sending body component with ${bodyParams.length} parameters (${matches.length} required)`);
        }
      } else if (component.type === 'BUTTONS' && component.buttons) {
        // Handle button variables (dynamic URLs)
        component.buttons.forEach((button: any, buttonIndex: number) => {
          if (button.type === 'URL' && button.url && button.url.includes('{{')) {
            const matches = button.url.match(/\{\{(\d+)\}\}/g);
            if (matches) {
              const buttonParams: any[] = [];
              matches.forEach((match: string) => {
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
      } // End of component processing loop for non-auth templates
    } // End of else block for non-auth templates

    // Build the template payload
    const templatePayload: any = {
      name: templateName,
      language: {
        code: language,
        policy: "deterministic"
      }
    };

    // Only add components if we have variables to populate
    if (templateComponents.length > 0) {
      templatePayload.components = templateComponents;
    }

    // Prepare WhatsApp API request payload
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient.replace('+', ''),
      type: "template",
      template: templatePayload
    };

    console.log('📤 Sending WhatsApp message payload:', JSON.stringify(payload, null, 2));
    console.log(`🌐 MAKING META API CALL: Sending to ${recipient} via phone_number_id: ${phoneNumberId}`);

    // Make actual WhatsApp API call
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData: any = await response.json();
    console.log('📥 WhatsApp API response:', JSON.stringify(responseData, null, 2));
    
    // Enhanced error handling for common WhatsApp API errors
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
      
      // Handle specific error codes
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
      
      // Update campaign_logs with successful message details (no more message_logs table)
      await pool.query(
        `UPDATE campaign_logs 
         SET message_id = $2, recipient_number = $3, status = 'sent', 
             sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
             campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`,
        [campaignId, messageId, recipient, JSON.stringify({api_response: responseData, sent_at: new Date()})]
      );
      
      return { success: true, messageId, recipient };
    } else {
      const errorMessage = responseData.error?.message || responseData.error?.error_data?.details || JSON.stringify(responseData);
      
      console.error(`❌ Message failed to ${recipient}:`, errorMessage);
      
      // Update campaign_logs with failed message details (no more message_logs table)
      await pool.query(
        `UPDATE campaign_logs 
         SET recipient_number = $2, status = 'failed', error_message = $3, updated_at = CURRENT_TIMESTAMP,
             campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`,
        [campaignId, recipient, errorMessage, JSON.stringify({api_response: responseData, failed_at: new Date()})]
      );
      
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update campaign_logs with catch error details (no more message_logs table)  
    await pool.query(
      `UPDATE campaign_logs 
       SET recipient_number = $2, status = 'failed', error_message = $3, updated_at = CURRENT_TIMESTAMP,
           campaign_data = COALESCE(campaign_data, '{}'::jsonb) || $4::jsonb
       WHERE id = $1`,
      [campaignId, recipient, errorMessage, JSON.stringify({catch_error: errorMessage, failed_at: new Date()})]
    );
    
    throw error;
  }
}

// POST /api/whatsapp/parse-excel - Parse Excel file and return columns and sample data
router.post('/parse-excel', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let data: any[] = [];
    let columns: string[] = [];

    try {
      if (fileExtension === '.csv') {
        // Handle CSV files
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          columns = lines[0].split(',').map(col => col.trim());
          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(cell => cell.trim());
            const rowObject: any = {};
            columns.forEach((col, index) => {
              rowObject[col] = row[index] || '';
            });
            data.push(rowObject);
          }
        }
      } else {
        // Handle Excel files
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

    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse Excel file'
    });
  }
});

// POST /api/whatsapp/preview-custom - Generate preview for custom campaign
router.post('/preview-custom', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const {
      templateName,
      language = 'en_US',
      recipientColumn,
      variableMappings = {},
      sampleData = []
    } = req.body;

    if (!templateName || !recipientColumn || !sampleData.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: templateName, recipientColumn, sampleData'
      });
    }

    // Get template details
    const templateResult = await pool.query(
      'SELECT components, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, templateName, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const components = templateResult.rows[0].components;
    
    // Generate previews for sample data
    const previews = sampleData.slice(0, 2).map((row: any, index: number) => {
      const recipient = row[recipientColumn];
      if (!recipient) {
        return {
          recipient: 'No phone number',
          message: 'No recipient phone number found in this row'
        };
      }

      // Replace variables in template
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

  } catch (error) {
    console.error('Error generating custom preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
});

// POST /api/whatsapp/custom-send - Handle custom campaign submission
router.post('/custom-send', requireAuth, upload.single('file'), async (req, res) => {
  try {
    
    const userId = req.session.user!.id;
    const {
      wabaId,
      templateName,
      language = 'en_US',
      recipientColName,
      variableMappings = '{}',
      campaignName
    } = req.body;

    // Validation
    if (!req.file || !recipientColName || !wabaId || !templateName) {
      return res.status(400).json({
        success: false,
        error: 'File, recipient column name, WhatsApp number, and template are required.'
      });
    }

    // Parse the uploaded file
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let data: any[] = [];

    try {
      if (fileExtension === '.csv') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          const columns = lines[0].split(',').map(col => col.trim());
          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(cell => cell.trim());
            const rowObject: any = {};
            columns.forEach((col, index) => {
              rowObject[col] = row[index] || '';
            });
            data.push(rowObject);
          }
        }
      } else {
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

      // Parse variable mappings
      const parsedVariableMappings = JSON.parse(variableMappings);
      
      // CREDIT SYSTEM: Pre-check credits before sending
      try {
        const creditCheck = await preCheckCreditsForBulk(userId, templateName, data.length);
        
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
      } catch (creditError) {
        console.error('Credit pre-check error:', creditError);
        return res.status(500).json({
          success: false,
          error: 'Failed to check credit balance'
        });
      }

      // Get WhatsApp number details and verify ownership
      const numberResult = await pool.query(
        'SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true',
        [userId, wabaId]
      );

      if (numberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'WhatsApp number not found or access denied'
        });
      }

      // Get template details
      const templateResult = await pool.query(
        'SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
        [userId, templateName, language]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Create individual campaign_logs entries for each recipient
      const campaignNameFinal = campaignName || `Custom Campaign - ${templateName} - ${new Date().toISOString()}`;
      const campaignEntries = [];
      
      for (const row of data) {
        const recipient = row[recipientColName];
        
        // Build variables object for this row
        const rowVariables: Record<string, string> = {};
        Object.keys(parsedVariableMappings).forEach(templateVar => {
          const columnName = parsedVariableMappings[templateVar];
          if (columnName && row[columnName]) {
            // Extract the number from the template variable (e.g., "{{1}}" -> "1")
            const variableIndex = templateVar.replace(/[{}]/g, '');
            rowVariables[variableIndex] = row[columnName].toString();
          }
        });
        
        const campaignResult = await pool.query(
          `INSERT INTO campaign_logs 
           (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
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
          ]
        );
        
        campaignEntries.push({
          id: campaignResult.rows[0].id,
          recipient: recipient,
          variables: rowVariables
        });
      }

      console.log(`✅ Created ${campaignEntries.length} individual campaign_logs entries for custom campaign`);
      
      // CREDIT SYSTEM: Deduct credits upfront for Custom Send (deduct on push, not delivery)
      let creditDeductionSuccess = false;
      let creditBalance = 0;
      
      try {
        // Get the credit check result from the earlier pre-check
        const { cost, category } = await calculateCreditCost(userId, templateName, data.length);
        const creditResult = await deductCredits({
          userId,
          amount: cost,
          transactionType: CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
          templateCategory: category,
          templateName: templateName,
          description: `Custom Send campaign: ${campaignName || 'Unnamed'} (${data.length} recipients)`
        });
        
        if (creditResult.success) {
          creditDeductionSuccess = true;
          creditBalance = creditResult.newBalance;
          console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Custom Send. New balance: ${creditBalance}`);
        } else {
          // This shouldn't happen since we pre-checked, but handle it
          throw new Error('Insufficient credits after pre-check');
        }
      } catch (creditError) {
        console.error('Credit deduction error for Custom Send:', creditError);
        // Update all campaign entries to failed
        await pool.query(
          'UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4',
          ['failed', 'Credit deduction failed', userId, campaignName || 'Custom Send']
        );
        
        return res.status(400).json({
          success: false,
          error: 'Credit deduction failed',
          details: creditError instanceof Error ? creditError.message : 'Unknown error'
        });
      }

      // Send messages using individual campaign IDs
      let successCount = 0;
      let failCount = 0;

      const messagePromises = campaignEntries.map((campaignEntry) => {
        return sendTemplateMessage(
          wabaId,
          numberResult.rows[0].access_token,
          formatPhoneNumber(campaignEntry.recipient.toString()),
          templateName,
          language,
          campaignEntry.variables,
          templateResult.rows[0].components,
          campaignEntry.id, // Use individual campaign ID
          userId,
          templateResult.rows[0].header_media_id,
          templateResult.rows[0].header_type,  
          templateResult.rows[0].header_media_url,
          templateResult.rows[0].header_handle,
          templateResult.rows[0].media_id,
          templateResult.rows[0].category
        ).then(() => {
          successCount++;
        }).catch(async (error) => {
          failCount++;
          console.error(`Failed to send to ${campaignEntry.recipient}:`, error.message);
          
          // Update individual campaign entry to failed status with recipient details
          try {
            await pool.query(
              'UPDATE campaign_logs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              ['failed', error.message || 'Unknown error', campaignEntry.id]
            );
          } catch (updateError) {
            console.error(`Failed to update campaign entry ${campaignEntry.id} to failed status:`, updateError);
          }
        });
      });

      await Promise.allSettled(messagePromises);

      // Update all campaign entries status (individual entries don't need aggregate status)
      // Each individual entry will have its own status from sendTemplateMessage

      res.status(202).json({
        success: true,
        message: 'Campaign has been processed.',
        data: {
          campaign_id: null, // Individual entries created instead
          totalRecipients: data.length,
          successfulSends: successCount,
          failedSends: failCount,
          creditInfo: {
            deducted: creditDeductionSuccess,
            newBalance: creditBalance
          }
        }
      });

    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      res.status(400).json({
        success: false,
        error: 'Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'
      });
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

  } catch (error) {
    console.error('Error in custom send:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process custom campaign'
    });
  }
});

// Helper function to generate custom template preview
function generateCustomTemplatePreview(components: any[], variableMappings: Record<string, string>, rowData: any): string {
  let preview = '';
  
  components.forEach(component => {
    if (component.type === 'HEADER') {
      if (component.format === 'IMAGE') {
        preview += `📷 *[Image]*\n\n`;
      } else if (component.text) {
        preview += `*${replaceCustomVariables(component.text, variableMappings, rowData)}*\n\n`;
      }
    } else if (component.type === 'BODY') {
      preview += `${replaceCustomVariables(component.text, variableMappings, rowData)}\n\n`;
    } else if (component.type === 'FOOTER' && component.text) {
      preview += `_${replaceCustomVariables(component.text, variableMappings, rowData)}_\n`;
    } else if (component.type === 'BUTTONS') {
      preview += '\n*Buttons:*\n';
      component.buttons?.forEach((button: any) => {
        preview += `• ${button.text}\n`;
      });
    }
  });
  
  return preview.trim();
}

function replaceCustomVariables(text: string, variableMappings: Record<string, string>, rowData: any): string {
  return text.replace(/{{\s*(\d+)\s*}}/g, (match, index) => {
    const templateVar = `{{${index}}}`;
    const columnName = variableMappings[templateVar];
    if (columnName && rowData[columnName]) {
      return rowData[columnName].toString();
    }
    return match; // Keep original if no mapping found
  });
}

// GET /api/whatsapp/reports - Get detailed message reports
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const { 
      page = 1, 
      limit = 50, 
      dateFrom = '',
      dateTo = '',
      recipientNumber = '',
      template = '',
      status = 'all',
      export: exportFormat = 'false' 
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    // Build WHERE conditions for campaign_logs - handle both old and new data structures
    let whereConditions = 'WHERE cl.user_id = $1';
    const params: any[] = [userId];
    let paramCount = 1;
    
    // Date range filter
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
    
    // Recipient number filter
    if (recipientNumber && recipientNumber.toString().trim()) {
      paramCount++;
      whereConditions += ` AND cl.recipient_number ILIKE $${paramCount}`;
      params.push(`%${recipientNumber.toString().trim()}%`);
    }
    
    // Template filter
    if (template && template.toString().trim()) {
      paramCount++;
      whereConditions += ` AND cl.template_used = $${paramCount}`;
      params.push(template.toString());
    }
    
    // Status filter
    if (status && status !== 'all') {
      paramCount++;
      whereConditions += ` AND cl.status = $${paramCount}`;
      params.push(status.toString());
    }
    
    // Updated campaign_logs query with all required fields for frontend
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
    
    // Add pagination parameters if not exporting
    if (!exportFormat || exportFormat === 'false') {
      params.push(Number(limit), offset);
    }
    
    console.log(`🔍 [REPORTS] Executing simplified campaign query for user: ${userId}`);
    const reportsResult = await pool.query(reportsQuery, params);
    console.log(`🔍 [REPORTS] Query returned ${reportsResult.rows.length} campaigns`);
    
    // If exporting data
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
        const csvRows = rows.map(row => 
          row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
        );
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_reports.csv"');
        return res.send(csvContent);
      } else if (exportFormat === 'excel') {
        try {
          console.log('📊 Creating Excel file with', rows.length, 'rows');
          
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          
          // Set column widths
          const columnWidths = [
            { wch: 25 }, // Campaign Name
            { wch: 15 }, // Template
            { wch: 15 }, // From Number
            { wch: 15 }, // Recipient Number
            { wch: 10 }, // Status
            { wch: 18 }, // Sent At
            { wch: 18 }, // Delivered At
            { wch: 30 }  // Error Message
          ];
          worksheet['!cols'] = columnWidths;
          
          XLSX.utils.book_append_sheet(workbook, worksheet, 'WhatsApp Reports');
          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
          
          console.log('✅ Excel buffer created, size:', excelBuffer.length, 'bytes');
          
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_reports.xlsx"');
          res.setHeader('Content-Length', excelBuffer.length.toString());
          
          return res.send(excelBuffer);
        } catch (excelError) {
          console.error('❌ Excel creation failed:', excelError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create Excel file',
            details: excelError instanceof Error ? excelError.message : 'Unknown error'
          });
        }
      }
    }
    
    // Get total count for pagination - simple campaign_logs only
    const countQuery = `
      SELECT COUNT(*) as total
      FROM campaign_logs cl
      LEFT JOIN user_business_info ubi ON cl.phone_number_id = ubi.whatsapp_number_id AND cl.user_id = ubi.user_id
      ${whereConditions}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, paramCount));
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

  } catch (error) {
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

// GET /api/whatsapp/reports/summary - Get campaign summary statistics
router.get('/reports/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    
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
    
    const result = await pool.query(summaryQuery, [userId]);
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

  } catch (error) {
    console.error('Error fetching reports summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports summary'
    });
  }
});

// GET /api/whatsapp/campaigns - Get user's campaigns
router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const result = await pool.query(
      `SELECT 
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
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
});

// GET /api/whatsapp/reports/templates - Get available templates for filter dropdown
router.get('/reports/templates', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    
    const templatesQuery = `
      SELECT DISTINCT cl.template_used
      FROM campaign_logs cl
      WHERE cl.user_id = $1
      ORDER BY cl.template_used
    `;
    
    const result = await pool.query(templatesQuery, [userId]);
    const templates = result.rows.map(row => row.template_used);
    
    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Error fetching templates for filter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

// POST /api/whatsapp/send-custom-messages - Send personalized messages using Excel data
router.post('/send-custom-messages', requireAuth, async (req, res) => {
  try {
    
    const userId = req.session.user!.id;
    const {
      templateName,
      language = 'en_US',
      phoneNumberId,
      recipientColumn,
      variableMappings = {},
      data = []
    } = req.body;

    if (!templateName || !phoneNumberId || !recipientColumn || !data.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: templateName, phoneNumberId, recipientColumn, data'
      });
    }

    // CREDIT SYSTEM: Pre-check credits before sending
    try {
      const creditCheck = await preCheckCreditsForBulk(userId, templateName, data.length);
      
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
    } catch (creditError) {
      console.error('Credit pre-check error:', creditError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check credit balance'
      });
    }

    // Get user's business info
    const businessResult = await pool.query(
      'SELECT access_token, whatsapp_number_id FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true',
      [userId, phoneNumberId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp Business API credentials not configured for this phone number'
      });
    }

    const businessInfo = businessResult.rows[0];

    // Get template details
    const templateResult = await pool.query(
      'SELECT components, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, templateName, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const template = templateResult.rows[0];

    // Individual campaign entries will be created below for each recipient
    // This ensures recipient_number is always saved for each message
    
    // CREDIT SYSTEM: Deduct credits upfront for Custom Messages (deduct on push, not delivery)
    let creditDeductionSuccess = false;
    let creditBalance = 0;
    
    try {
      // Get the credit check result from the earlier pre-check
      const { cost, category } = await calculateCreditCost(userId, templateName, data.length);
      const creditResult = await deductCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
        templateCategory: category,
        templateName: templateName,
        description: `Custom Messages campaign: ${templateName} (${data.length} recipients)`
      });
      
      if (creditResult.success) {
        creditDeductionSuccess = true;
        creditBalance = creditResult.newBalance;
        console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Custom Messages. New balance: ${creditBalance}`);
      } else {
        // This shouldn't happen since we pre-checked, but handle it
        throw new Error('Insufficient credits after pre-check');
      }
    } catch (creditError) {
      console.error('Credit deduction error for Custom Messages:', creditError);
      // Update all campaign entries to failed (if any exist)
      await pool.query(
        'UPDATE campaign_logs SET status = $1, error_message = $2 WHERE user_id = $3 AND campaign_name = $4',
        ['failed', 'Credit deduction failed', userId, 'Custom Messages']
      );
      
      return res.status(400).json({
        success: false,
        error: 'Credit deduction failed',
        details: creditError instanceof Error ? creditError.message : 'Unknown error'
      });
    }

    let successfulSends = 0;
    let failedSends = 0;
    const errors: string[] = [];
    const campaignEntries: any[] = [];

    // First create individual campaign entries for each recipient
    for (const row of data) {
      try {
        const recipient = row[recipientColumn];
        if (!recipient) {
          failedSends++;
          errors.push(`Missing recipient for row: ${JSON.stringify(row)}`);
          continue;
        }

        // Prepare variables for this recipient
        const variables: Record<string, string> = {};
        Object.keys(variableMappings).forEach(variable => {
          const columnName = variableMappings[variable];
          const value = row[columnName];
          if (value) {
            variables[variable] = value.toString();
          }
        });

        // Create individual campaign entry for this recipient
        const campaignResult = await pool.query(`
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
      } catch (error) {
        failedSends++;
        errors.push(`Failed to create campaign entry for recipient: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process each recipient with their individual campaign IDs
    for (const campaignEntry of campaignEntries) {
      try {
        // Send the message using the individual campaign ID
        await sendTemplateMessage(
          businessInfo.whatsapp_number_id,
          businessInfo.access_token,
          campaignEntry.recipient,
          templateName,
          language,
          campaignEntry.variables,
          template.components,
          campaignEntry.id.toString(),
          userId,
          template.header_media_id,
          template.header_type,
          template.header_media_url,
          template.header_handle,
          template.media_id,
          template.category
        );

        successfulSends++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failedSends++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to send to ${campaignEntry.recipient}: ${errorMsg}`);
        
        // Update individual campaign entry to failed status with recipient details
        try {
          await pool.query(
            'UPDATE campaign_logs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['failed', errorMsg, campaignEntry.id]
          );
        } catch (updateError) {
          console.error(`Failed to update campaign entry ${campaignEntry.id} to failed status:`, updateError);
        }
      }
    }

    // Individual campaign entries are already updated by sendTemplateMessage
    // No need for aggregate campaign update since we track individuals

    res.json({
      success: true,
      data: {
        campaign_id: null, // Individual entries created instead
        sent_count: successfulSends,
        failed_count: failedSends,
        total_count: data.length,
        errors: errors.slice(0, 10), // Return first 10 errors
        creditInfo: {
          deducted: creditDeductionSuccess,
          newBalance: creditBalance
        }
      }
    });

  } catch (error) {
    console.error('Error sending custom messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send custom messages'
    });
  }
});

// POST /api/whatsapp/bulk-customize-send - Handle bulk custom message sending with 200-batch logic
router.post('/bulk-customize-send', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const {
      templateName,
      language,
      phoneNumberId,
      wabaId,
      data, // Array of recipient data with custom variables
      campaignName,
      recipientColumn,
      variableMappings
    } = req.body;

    // Use phoneNumberId if wabaId is not provided (frontend compatibility)
    const actualWabaId = wabaId || phoneNumberId;

    console.log(`🚀 BULK-CUSTOMIZE-SEND: Starting custom bulk send for user ${userId}`);
    console.log(`📊 Template: ${templateName}, Language: ${language}, Recipients: ${data?.length || 0}`);

    // Validate required fields
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

    // Process Excel data to extract phone numbers and create variable mappings
    const validRecipients = [];
    const errors = [];

    console.log(`📋 Processing data with recipientColumn: ${recipientColumn}`);
    console.log(`🔄 Variable mappings:`, variableMappings);

    for (const entry of data) {
      // Extract phone number from the specified recipient column
      const phoneValue = entry[recipientColumn];
      if (!phoneValue) {
        errors.push(`Missing phone number in column '${recipientColumn}' for entry: ${JSON.stringify(entry)}`);
        continue;
      }

      const cleanedPhone = phoneValue.toString().replace(/\D/g, '');
      if (cleanedPhone.length >= 10) {
        // Create variables object for this recipient based on variable mappings
        const recipientVariables: Record<string, string> = {};
        
        // Map each variable from the Excel data
        Object.keys(variableMappings).forEach(variableIndex => {
          const columnName = variableMappings[variableIndex];
          const value = entry[columnName];
          if (value !== undefined && value !== null) {
            recipientVariables[variableIndex] = value.toString();
          }
        });

        validRecipients.push({
          phone: cleanedPhone,
          ...recipientVariables // Spread the variables directly
        });
      } else {
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

    // CREDIT SYSTEM: Pre-check credits
    try {
      const creditCheck = await preCheckCreditsForBulk(userId, templateName, validRecipients.length);
      
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
    } catch (creditError) {
      console.error('Credit pre-check error:', creditError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check credit balance'
      });
    }

    // Get WhatsApp number details and verify ownership
    const numberResult = await pool.query(
      'SELECT access_token, business_name FROM user_business_info WHERE user_id = $1 AND whatsapp_number_id = $2 AND is_active = true',
      [userId, actualWabaId]
    );

    if (numberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'WhatsApp number not found or access denied'
      });
    }

    const { access_token } = numberResult.rows[0];

    // Get template details
    const templateResult = await pool.query(
      'SELECT components, header_media_id, header_type, header_media_url, header_handle, media_id, category FROM templates WHERE user_id = $1 AND name = $2 AND language = $3',
      [userId, templateName, language]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Create individual campaign_logs entries for each recipient
    const campaignNameFinal = campaignName || `Custom Campaign - ${templateName} - ${new Date().toISOString()}`;
    const campaignEntries = [];

    for (const recipientData of validRecipients) {
      try {
        const result = await pool.query(
          `INSERT INTO campaign_logs 
           (user_id, campaign_name, template_used, phone_number_id, recipient_number, language_code, status, campaign_data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            userId,
            campaignNameFinal,
            templateName,
            actualWabaId,
            recipientData.phone,
            language,
            'pending',
            JSON.stringify({ variables: recipientData, template_components: templateResult.rows[0].components })
          ]
        );
        
        campaignEntries.push({
          id: result.rows[0].id,
          recipient: recipientData.phone,
          variables: recipientData
        });
      } catch (dbError) {
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
    
    // CREDIT SYSTEM: Deduct credits upfront for Customize (same as quicksend - deduct on push, not delivery)
    let creditDeductionSuccess = false;
    let creditBalance = 0;
    
    try {
      // Get the credit check result from the earlier pre-check
      const { cost, category } = await calculateCreditCost(userId, templateName, validRecipients.length);
      const creditResult = await deductCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.DEDUCTION_CUSTOMISE_SMS,
        templateCategory: category,
        templateName: templateName,
        description: `Customize campaign: ${campaignNameFinal} (${validRecipients.length} recipients)`
      });
      
      if (creditResult.success) {
        creditDeductionSuccess = true;
        creditBalance = creditResult.newBalance;
        console.log(`[CREDIT SYSTEM] Deducted ${cost} credits for Customize. New balance: ${creditBalance}`);
      } else {
        throw new Error('Credit deduction failed');
      }
    } catch (creditError) {
      console.error('Credit deduction error:', creditError);
      return res.status(500).json({
        success: false,
        error: 'Failed to deduct credits'
      });
    }

    // NOW SEND MESSAGES WITH 200-MESSAGE BATCHING (same as quick-send)
    console.log(`🚀 BULK-CUSTOMIZE-SEND: Starting to send ${campaignEntries.length} messages in batches of 200`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Split into batches of 200
    const BATCH_SIZE = 200;
    const batches = [];
    for (let i = 0; i < campaignEntries.length; i += BATCH_SIZE) {
      batches.push(campaignEntries.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 BULK-CUSTOMIZE-SEND: Processing ${batches.length} batches of up to ${BATCH_SIZE} messages each`);
    
    // Process each batch sequentially with 1-second delay between batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📤 BULK-CUSTOMIZE-SEND: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);
      
      // Process all messages in this batch concurrently
      const batchPromises = batch.map(campaignEntry => 
        sendTemplateMessage(
          actualWabaId,
          access_token,
          campaignEntry.recipient,
          templateName,
          language,
          campaignEntry.variables, // Use individual custom variables for each recipient
          templateResult.rows[0].components,
          campaignEntry.id.toString(),
          userId,
          templateResult.rows[0].header_media_id,
          templateResult.rows[0].header_type,
          templateResult.rows[0].header_media_url,
          templateResult.rows[0].header_handle,
          templateResult.rows[0].media_id,
          templateResult.rows[0].category
        )
      );
      
      // Execute batch and count results
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const campaignEntry = batch[index];
        if (result.status === 'fulfilled') {
          const response = result.value;
          if (response?.success === false && response?.duplicate) {
            console.log(`🚨 BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Duplicate detected for ${campaignEntry.recipient}`);
            failCount++;
          } else if (response?.success) {
            console.log(`✅ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Successfully sent to ${campaignEntry.recipient}`);
            successCount++;
          } else {
            console.log(`⚠️ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Unknown response for ${campaignEntry.recipient}:`, response);
            failCount++;
          }
        } else {
          console.log(`❌ BULK-CUSTOMIZE-SEND BATCH ${batchIndex + 1}: Promise rejected for ${campaignEntry.recipient}:`, result.reason);
          failCount++;
        }
      });
      
      console.log(`✅ BULK-CUSTOMIZE-SEND: Batch ${batchIndex + 1}/${batches.length} completed. Running totals: ${successCount} success, ${failCount} failed`);
      
      // Add 1-second delay between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ BULK-CUSTOMIZE-SEND: Waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`📊 BULK-CUSTOMIZE-SEND COMPLETED: ${successCount} successful, ${failCount} failed`);

    res.json({
      success: true,
      data: {
        campaign_id: null, // Individual entries created instead
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

  } catch (error) {
    console.error('Error sending bulk custom messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk custom messages'
    });
  }
});

export default router;
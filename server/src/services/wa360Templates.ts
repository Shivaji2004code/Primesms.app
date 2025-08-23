// 360dialog WhatsApp Template Management Service
import axios from 'axios';

export interface Template360DialogData {
  name: string;
  language: string;
  status?: string;
  category?: string;
  reason?: string;
  components?: any[];
  id?: string;
  namespace?: string;
  quality_score?: {
    score: string;
    reasons?: string[];
  };
  created_at?: string;
  updated_at?: string;
  rejected_reason?: string;
}

/**
 * Fetch all templates from 360dialog API
 * Uses the endpoint: GET https://waba-v2.360dialog.io/v1/configs/templates
 */
export async function fetchAllTemplatesFrom360Dialog(
  apiKey: string
): Promise<Template360DialogData[]> {
  try {
    console.log('🔍 [360DIALOG] Fetching all templates from 360dialog API');
    
    const response = await axios.get(
      'https://waba-v2.360dialog.io/v1/configs/templates',
      {
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('🔍 [360DIALOG] Raw API response:', JSON.stringify(response.data, null, 2));
    
    // Handle different possible response formats from 360dialog
    let templates = [];
    
    if (response.data?.templates && Array.isArray(response.data.templates)) {
      templates = response.data.templates;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      templates = response.data.data;
    } else if (Array.isArray(response.data)) {
      templates = response.data;
    } else if (response.data?.waba_templates && Array.isArray(response.data.waba_templates)) {
      templates = response.data.waba_templates;
    } else {
      console.log('⚠️ [360DIALOG] Unexpected response format, treating as empty array');
      templates = [];
    }
    
    console.log(`✅ [360DIALOG] Successfully fetched ${templates.length} templates from 360dialog`);
    
    // Ensure templates is an array before mapping
    if (!Array.isArray(templates)) {
      console.error('❌ [360DIALOG] Templates is not an array:', typeof templates, templates);
      return [];
    }
    
    // Transform 360dialog format to our standard format
    return templates.map((template: any) => ({
      id: template.id,
      name: template.name,
      language: template.language || 'en_US',
      status: template.status?.toUpperCase() || 'UNKNOWN',
      category: template.category?.toUpperCase(),
      reason: template.rejected_reason || template.reason,
      components: template.components || [],
      namespace: template.namespace,
      quality_score: template.quality_score,
      created_at: template.created_time || template.created_at,
      updated_at: template.updated_time || template.updated_at
    }));
    
  } catch (error: any) {
    console.error('❌ [360DIALOG] Failed to fetch templates from 360dialog API:', error.response?.data || error.message);
    throw new Error(`360dialog API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Fetch a specific template from 360dialog API by name and language
 */
export async function fetchTemplateFrom360Dialog(
  apiKey: string,
  name: string,
  language?: string
): Promise<Template360DialogData | null> {
  try {
    console.log(`🔍 [360DIALOG] Fetching template ${name}${language ? ` (${language})` : ''} from 360dialog API`);
    
    // Get all templates and filter by name and language
    const allTemplates = await fetchAllTemplatesFrom360Dialog(apiKey);
    
    const matchingTemplates = allTemplates.filter(template => {
      const nameMatch = template.name === name;
      const langMatch = !language || template.language === language;
      return nameMatch && langMatch;
    });
    
    if (matchingTemplates.length === 0) {
      console.log(`⚠️ [360DIALOG] No template found with name ${name}${language ? ` and language ${language}` : ''}`);
      return null;
    }
    
    // If multiple matches, prefer exact language match or return first
    const exactMatch = matchingTemplates.find(t => t.language === language) || matchingTemplates[0];
    
    console.log(`✅ [360DIALOG] Found template: ${exactMatch.name} (${exactMatch.language}) - Status: ${exactMatch.status}`);
    
    return exactMatch;
    
  } catch (error: any) {
    console.error(`❌ [360DIALOG] Failed to fetch template ${name}:`, error.message);
    throw error;
  }
}

/**
 * Get template status from 360dialog by template ID
 */
export async function getTemplateStatusFrom360Dialog(
  apiKey: string,
  templateId: string
): Promise<{ status: string; category?: string; reason?: string } | null> {
  try {
    console.log(`🔍 [360DIALOG] Getting template status for ID: ${templateId}`);
    
    const response = await axios.get(
      `https://waba-v2.360dialog.io/v1/configs/templates/${templateId}`,
      {
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const template = response.data;
    
    if (!template) {
      console.log(`⚠️ [360DIALOG] Template not found with ID: ${templateId}`);
      return null;
    }
    
    const result = {
      status: template.status?.toUpperCase() || 'UNKNOWN',
      category: template.category?.toUpperCase(),
      reason: template.rejected_reason || template.reason
    };
    
    console.log(`✅ [360DIALOG] Template ${templateId} status: ${result.status}`);
    
    return result;
    
  } catch (error: any) {
    console.error(`❌ [360DIALOG] Failed to get template status for ${templateId}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Map 360dialog status to our internal status format
 */
export function normalize360DialogStatus(status: string): string {
  if (!status) return 'UNKNOWN';
  
  const normalizedStatus = status.toUpperCase();
  
  // Map 360dialog specific statuses to our standard ones
  switch (normalizedStatus) {
    case 'PENDING':
    case 'IN_REVIEW':
    case 'PENDING_REVIEW':
      return 'PENDING';
      
    case 'APPROVED':
    case 'ACTIVE':
      return 'APPROVED';
      
    case 'REJECTED':
    case 'DISABLED':
      return 'REJECTED';
      
    case 'PAUSED':
      return 'PAUSED';
      
    default:
      return normalizedStatus;
  }
}

export default {
  fetchAllTemplatesFrom360Dialog,
  fetchTemplateFrom360Dialog,
  getTemplateStatusFrom360Dialog,
  normalize360DialogStatus
};
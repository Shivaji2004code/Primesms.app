// 360dialog Template Sync Endpoint - Production Ready
import { Router } from 'express';
import { templatesRepo } from '../repos/templatesRepo';
import { resolve360DialogCredentials } from '../utils/360dialogCredentials';
import { 
  fetchAllTemplatesFrom360Dialog, 
  fetchTemplateFrom360Dialog, 
  normalize360DialogStatus 
} from '../services/wa360Templates';
import { sseHub } from '../services/sseBroadcaster';

const router = Router();

/**
 * POST /api/templates/sync-360dialog
 * Manually sync template data from 360dialog API
 * Body: { userId, name?, language? }
 * - If name provided: sync specific template
 * - If only userId: sync all templates for user
 */
router.post('/api/templates/sync-360dialog', async (req, res) => {
  try {
    const { userId, name, language } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'userId required',
        message: 'Please provide userId in request body'
      });
    }

    console.log(`🔄 [360DIALOG_SYNC] Starting manual sync for user ${userId}${name ? ` (template: ${name})` : ''}`);

    // Get user's 360dialog API credentials
    const creds = await resolve360DialogCredentials(userId);
    if (!creds?.apiKey) {
      return res.status(400).json({ 
        error: 'Missing 360dialog credentials',
        message: '360dialog API key not configured for this user'
      });
    }

    const changes: any[] = [];

    if (name) {
      // Sync specific template
      console.log(`🔍 [360DIALOG_SYNC] Syncing specific template: ${name}${language ? ` (${language})` : ''}`);
      
      const templateData = await fetchTemplateFrom360Dialog(
        creds.apiKey, 
        name, 
        language
      );

      if (!templateData) {
        return res.status(404).json({
          error: 'Template not found',
          message: `Template '${name}' not found in 360dialog API`
        });
      }

      // Update database
      await templatesRepo.upsertStatusAndCategory({
        userId,
        name: templateData.name,
        language: templateData.language,
        status: normalize360DialogStatus(templateData.status || 'UNKNOWN'),
        category: templateData.category,
        reason: templateData.reason || null,
        reviewedAt: templateData.updated_at ? new Date(templateData.updated_at) : new Date()
      });

      changes.push(templateData);

      // Emit SSE event
      sseHub.emitTemplate(userId, {
        type: 'template_update',
        name: templateData.name,
        language: templateData.language,
        status: normalize360DialogStatus(templateData.status || 'UNKNOWN'),
        category: templateData.category || null,
        reason: templateData.reason || null,
        at: new Date().toISOString(),
        source: '360dialog_manual_sync'
      });

    } else {
      // Sync all templates for user
      console.log(`🔍 [360DIALOG_SYNC] Syncing all templates for user ${userId}`);
      
      const allTemplates = await fetchAllTemplatesFrom360Dialog(creds.apiKey);
      
      if (allTemplates.length === 0) {
        return res.json({
          success: true,
          message: 'No templates found for this user in 360dialog',
          updated: 0,
          items: []
        });
      }

      console.log(`📋 [360DIALOG_SYNC] Processing ${allTemplates.length} templates from 360dialog`);

      // Process each template
      for (const templateData of allTemplates) {
        try {
          await templatesRepo.upsertStatusAndCategory({
            userId,
            name: templateData.name,
            language: templateData.language,
            status: normalize360DialogStatus(templateData.status || 'UNKNOWN'),
            category: templateData.category,
            reason: templateData.reason || null,
            reviewedAt: templateData.updated_at ? new Date(templateData.updated_at) : new Date()
          });

          changes.push(templateData);

          // Emit SSE event for each updated template
          sseHub.emitTemplate(userId, {
            type: 'template_update',
            name: templateData.name,
            language: templateData.language,
            status: normalize360DialogStatus(templateData.status || 'UNKNOWN'),
            category: templateData.category || null,
            reason: templateData.reason || null,
            at: new Date().toISOString(),
            source: '360dialog_manual_sync'
          });

        } catch (error) {
          console.error(`❌ [360DIALOG_SYNC] Error processing template ${templateData.name}:`, error);
          // Continue processing other templates
        }
      }
    }

    console.log(`✅ [360DIALOG_SYNC] Completed sync for user ${userId}: ${changes.length} templates updated`);

    res.json({
      success: true,
      message: `Successfully synced ${changes.length} template${changes.length !== 1 ? 's' : ''} from 360dialog`,
      updated: changes.length,
      provider: '360dialog',
      items: changes.map(t => ({
        name: t.name,
        language: t.language,
        status: normalize360DialogStatus(t.status || 'UNKNOWN'),
        category: t.category,
        reason: t.reason,
        id: t.id,
        namespace: t.namespace,
        updated_at: t.updated_at
      }))
    });

  } catch (error: any) {
    console.error('❌ [360DIALOG_SYNC] Sync error:', error?.response?.data || error?.message || error);
    
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error?.response?.data?.error?.message || error?.message || 'Unknown error occurred',
      details: error?.response?.data || null,
      provider: '360dialog'
    });
  }
});

/**
 * GET /api/templates/sync-360dialog/status/:userId
 * Check sync status and get current template count for a user (360dialog version)
 */
router.get('/api/templates/sync-360dialog/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Check if user has 360dialog credentials
    const creds = await resolve360DialogCredentials(userId);
    const hasCredentials = Boolean(creds?.apiKey);

    // Get current template count from database
    const templates = await templatesRepo.getAllByUserId(userId);
    
    res.json({
      userId,
      provider: '360dialog',
      hasCredentials,
      templatesCount: templates.length,
      lastSync: templates.length > 0 
        ? Math.max(...templates.map(t => new Date(t.updated_at).getTime()))
        : null,
      canSync: hasCredentials
    });

  } catch (error: any) {
    console.error('❌ [360DIALOG_SYNC] Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error?.message || 'Unknown error occurred',
      provider: '360dialog'
    });
  }
});

/**
 * GET /api/templates/360dialog/list/:userId
 * Fetch all templates directly from 360dialog API (without saving to DB)
 * Useful for comparing local vs remote templates
 */
router.get('/api/templates/360dialog/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    console.log(`🔍 [360DIALOG_LIST] Fetching templates directly from 360dialog for user ${userId}`);

    // Get user's 360dialog API credentials
    const creds = await resolve360DialogCredentials(userId);
    if (!creds?.apiKey) {
      return res.status(400).json({ 
        error: 'Missing 360dialog credentials',
        message: '360dialog API key not configured for this user'
      });
    }

    // Fetch all templates from 360dialog
    const templates = await fetchAllTemplatesFrom360Dialog(creds.apiKey);
    
    console.log(`✅ [360DIALOG_LIST] Found ${templates.length} templates in 360dialog for user ${userId}`);

    res.json({
      success: true,
      provider: '360dialog',
      count: templates.length,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        language: t.language,
        status: normalize360DialogStatus(t.status || 'UNKNOWN'),
        category: t.category,
        reason: t.reason,
        namespace: t.namespace,
        quality_score: t.quality_score,
        components_count: t.components?.length || 0,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    });

  } catch (error: any) {
    console.error('❌ [360DIALOG_LIST] Error fetching templates:', error?.response?.data || error?.message || error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates from 360dialog',
      message: error?.response?.data?.error?.message || error?.message || 'Unknown error occurred',
      provider: '360dialog'
    });
  }
});

export default router;
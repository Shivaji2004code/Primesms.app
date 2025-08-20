import express from 'express';
import pool from '../db';
import { requireAdmin } from '../middleware/auth';
import type { User, UserBusinessInfo, UserWithBusinessInfo, CreateBusinessInfoRequest } from '../types';

const router = express.Router();

// All admin routes require admin authentication
router.use(requireAdmin);

// Get all users with pagination
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users
    const result = await pool.query(
      'SELECT id, name, email, username, phone_number, role, credit_balance, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const users = result.rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      phoneNumber: user.phone_number,
      role: user.role,
      creditBalance: user.credit_balance,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page < Math.ceil(totalUsers / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, name, email, username, phone_number, role, credit_balance, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phoneNumber: user.phone_number,
        role: user.role,
        creditBalance: user.credit_balance,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user manually (admin only)
router.post('/users', async (req, res) => {
  try {
    const { name, email, username, password, phoneNumber, role, creditBalance } = req.body;

    // Validation
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Role validation
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Create user
    const result = await pool.query(
      'INSERT INTO users (name, email, username, password, phone_number, role, credit_balance) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, username, phone_number, role, credit_balance, created_at',
      [name, email, username, password, phoneNumber, role || 'user', creditBalance || 1000]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        phoneNumber: newUser.phone_number,
        role: newUser.role,
        creditBalance: newUser.credit_balance,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, password, phoneNumber, role, creditBalance } = req.body;

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build dynamic query based on provided fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (email !== undefined) {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already taken by another user
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email is already taken by another user' });
      }

      updateFields.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (username !== undefined) {
      // Check if username is already taken by another user
      const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
      if (usernameCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Username is already taken by another user' });
      }

      updateFields.push(`username = $${paramCount++}`);
      values.push(username);
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      updateFields.push(`password = $${paramCount++}`);
      values.push(password);
    }

    if (phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramCount++}`);
      values.push(phoneNumber);
    }

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
      }

      updateFields.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (creditBalance !== undefined) {
      const creditAmount = parseFloat(creditBalance.toString());
      if (creditAmount < 0) {
        return res.status(400).json({ error: 'Credit balance cannot be negative' });
      }
      
      // Properly handle decimal precision for credit balance
      const roundedCreditBalance = Math.round(creditAmount * 100) / 100;
      updateFields.push(`credit_balance = $${paramCount++}`);
      values.push(roundedCreditBalance);
      
      console.log(`💰 ADMIN UPDATE: Setting credit_balance to ${roundedCreditBalance} (from ${creditBalance})`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, name, email, username, phone_number, role, credit_balance, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    const updatedUser = result.rows[0];

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        phoneNumber: updatedUser.phone_number,
        role: updatedUser.role,
        creditBalance: updatedUser.credit_balance,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the current admin user
    if (req.session.user!.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, name, username', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = result.rows[0];

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: deletedUser.id,
        name: deletedUser.name,
        username: deletedUser.username
      }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const queries = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as admins FROM users WHERE role = $1', ['admin']),
      pool.query('SELECT COUNT(*) as regular_users FROM users WHERE role = $1', ['user']),
      pool.query('SELECT SUM(credit_balance) as total_credits FROM users'),
      pool.query('SELECT COUNT(*) as new_users_today FROM users WHERE created_at >= CURRENT_DATE'),
    ]);

    const stats = {
      totalUsers: parseInt(queries[0].rows[0].total),
      adminUsers: parseInt(queries[1].rows[0].admins),
      regularUsers: parseInt(queries[2].rows[0].regular_users),
      totalCredits: parseInt(queries[3].rows[0].total_credits) || 0,
      newUsersToday: parseInt(queries[4].rows[0].new_users_today)
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user details with business info
router.get('/users/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user basic info
    const userResult = await pool.query(
      'SELECT id, name, email, username, phone_number, role, credit_balance, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get business info
    const businessResult = await pool.query(
      `SELECT id, user_id, business_name, whatsapp_number, whatsapp_number_id, 
       waba_id, access_token, webhook_url, webhook_verify_token, is_active, 
       app_id, app_secret, created_at, updated_at 
       FROM user_business_info WHERE user_id = $1`,
      [id]
    );

    const userWithBusiness: UserWithBusinessInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      password: user.password,
      phone_number: user.phone_number,
      role: user.role,
      credit_balance: user.credit_balance,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    if (businessResult.rows.length > 0) {
      const business = businessResult.rows[0];
      userWithBusiness.businessInfo = {
        id: business.id,
        userId: business.user_id,
        businessName: business.business_name,
        whatsappNumber: business.whatsapp_number,
        whatsappNumberId: business.whatsapp_number_id,
        wabaId: business.waba_id,
        accessToken: business.access_token,
        webhookUrl: business.webhook_url,
        webhookVerifyToken: business.webhook_verify_token,
        appSecret: business.app_secret,
        isActive: business.is_active,
        createdAt: business.created_at,
        updatedAt: business.updated_at,
      };
    }

    // Convert to frontend-friendly format
    const responseUser = {
      id: userWithBusiness.id,
      name: userWithBusiness.name,
      email: userWithBusiness.email,
      username: userWithBusiness.username,
      phoneNumber: userWithBusiness.phone_number,
      role: userWithBusiness.role,
      creditBalance: userWithBusiness.credit_balance,
      createdAt: userWithBusiness.created_at,
      updatedAt: userWithBusiness.updated_at,
      businessInfo: userWithBusiness.businessInfo ? {
        id: userWithBusiness.businessInfo.id,
        userId: userWithBusiness.businessInfo.userId,
        businessName: userWithBusiness.businessInfo.businessName,
        whatsappNumber: userWithBusiness.businessInfo.whatsappNumber,
        whatsappNumberId: userWithBusiness.businessInfo.whatsappNumberId,
        wabaId: userWithBusiness.businessInfo.wabaId,
        accessToken: userWithBusiness.businessInfo.accessToken,
        webhookUrl: userWithBusiness.businessInfo.webhookUrl,
        webhookVerifyToken: userWithBusiness.businessInfo.webhookVerifyToken,
        appSecret: userWithBusiness.businessInfo.appSecret,
        isActive: userWithBusiness.businessInfo.isActive,
        createdAt: userWithBusiness.businessInfo.createdAt,
        updatedAt: userWithBusiness.businessInfo.updatedAt,
      } : undefined
    };

    res.json({ user: responseUser });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's business info
router.get('/users/:id/business-info', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT id, user_id, business_name, whatsapp_number, whatsapp_number_id, 
       waba_id, access_token, webhook_url, webhook_verify_token, is_active, 
       app_id, app_secret, created_at, updated_at 
       FROM user_business_info WHERE user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ businessInfo: null });
    }

    const business = result.rows[0];
    const businessInfo: UserBusinessInfo = {
      id: business.id,
      userId: business.user_id,
      businessName: business.business_name,
      whatsappNumber: business.whatsapp_number,
      whatsappNumberId: business.whatsapp_number_id,
      wabaId: business.waba_id,
      accessToken: business.access_token,
      webhookUrl: business.webhook_url,
      webhookVerifyToken: business.webhook_verify_token,
      isActive: business.is_active,
      appId: business.app_id,
      appSecret: business.app_secret,
      createdAt: business.created_at,
      updatedAt: business.updated_at,
    };

    res.json({ businessInfo });

  } catch (error) {
    console.error('Get business info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update/Create user's business info
router.put('/users/:id/business-info', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      businessName,
      whatsappNumber,
      whatsappNumberId,
      wabaId,
      accessToken,
      webhookUrl,
      webhookVerifyToken,
      isActive,
      appId,
      appSecret
    }: CreateBusinessInfoRequest = req.body;

    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validation
    if (whatsappNumber && !/^\+?[\d\s-()]+$/.test(whatsappNumber)) {
      return res.status(400).json({ error: 'Invalid WhatsApp number format' });
    }

    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
      return res.status(400).json({ error: 'Webhook URL must be a valid HTTP/HTTPS URL' });
    }

    // Check if business info already exists
    const existingResult = await pool.query(
      'SELECT id FROM user_business_info WHERE user_id = $1',
      [id]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing record
      result = await pool.query(
        `UPDATE user_business_info 
         SET business_name = $2, whatsapp_number = $3, whatsapp_number_id = $4,
             waba_id = $5, access_token = $6, webhook_url = $7, 
             webhook_verify_token = $8, is_active = $9, app_id = $10, app_secret = $11, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING id, user_id, business_name, whatsapp_number, whatsapp_number_id, 
                   waba_id, access_token, webhook_url, webhook_verify_token, is_active, 
                   app_id, app_secret, created_at, updated_at`,
        [id, businessName, whatsappNumber, whatsappNumberId, wabaId, accessToken, 
         webhookUrl, webhookVerifyToken, isActive ?? true, appId, appSecret]
      );
    } else {
      // Create new record
      result = await pool.query(
        `INSERT INTO user_business_info 
         (user_id, business_name, whatsapp_number, whatsapp_number_id, waba_id, 
          access_token, webhook_url, webhook_verify_token, is_active, app_id, app_secret)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, user_id, business_name, whatsapp_number, whatsapp_number_id, 
                   waba_id, access_token, webhook_url, webhook_verify_token, is_active, 
                   app_id, app_secret, created_at, updated_at`,
        [id, businessName, whatsappNumber, whatsappNumberId, wabaId, accessToken, 
         webhookUrl, webhookVerifyToken, isActive ?? true, appId, appSecret]
      );
    }

    const business = result.rows[0];
    const businessInfo: UserBusinessInfo = {
      id: business.id,
      userId: business.user_id,
      businessName: business.business_name,
      whatsappNumber: business.whatsapp_number,
      whatsappNumberId: business.whatsapp_number_id,
      wabaId: business.waba_id,
      accessToken: business.access_token,
      webhookUrl: business.webhook_url,
      webhookVerifyToken: business.webhook_verify_token,
      isActive: business.is_active,
      appId: business.app_id,
      appSecret: business.app_secret,
      createdAt: business.created_at,
      updatedAt: business.updated_at,
    };

    res.json({
      message: 'Business information updated successfully',
      businessInfo
    });

  } catch (error) {
    console.error('Update business info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's templates for admin management
router.get('/users/:id/templates', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get templates with stats
    const templatesResult = await pool.query(
      `SELECT id, name, category, language, status, components, created_at, updated_at 
       FROM templates WHERE user_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Get template stats
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
         COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
       FROM templates WHERE user_id = $1`,
      [id]
    );

    const templates = templatesResult.rows.map(template => ({
      id: template.id,
      name: template.name,
      category: template.category,
      language: template.language,
      status: template.status,
      components: template.components,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }));

    const stats = {
      total: parseInt(statsResult.rows[0].total),
      pending: parseInt(statsResult.rows[0].pending),
      approved: parseInt(statsResult.rows[0].approved),
      rejected: parseInt(statsResult.rows[0].rejected)
    };

    res.json({ templates, stats });

  } catch (error) {
    console.error('Get user templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update template status (approve/reject)
router.put('/templates/:templateId/status', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED, REJECTED, or PENDING' });
    }

    // Check if template exists
    const templateCheck = await pool.query(
      'SELECT id, name, user_id FROM templates WHERE id = $1',
      [templateId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateCheck.rows[0];

    // Update template status
    const updateResult = await pool.query(
      'UPDATE templates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, templateId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update template status' });
    }

    // Log the admin action (optional - for audit trail)
    const adminUserId = (req as any).user?.id;
    if (adminUserId) {
      try {
        await pool.query(
          `INSERT INTO admin_actions (admin_user_id, action_type, target_type, target_id, details, created_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            adminUserId,
            'template_status_update',
            'template',
            templateId,
            JSON.stringify({
              templateName: template.name,
              userId: template.user_id,
              oldStatus: template.status || 'PENDING',
              newStatus: status
            })
          ]
        );
      } catch (logError) {
        // Log error but don't fail the main operation
        console.error('Failed to log admin action:', logError);
      }
    }

    const updatedTemplate = updateResult.rows[0];

    res.json({
      message: `Template ${status.toLowerCase()} successfully`,
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        status: updatedTemplate.status,
        updatedAt: updatedTemplate.updated_at
      }
    });

  } catch (error) {
    console.error('Update template status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all pending templates across all users (for admin overview)
router.get('/templates/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.category, t.language, t.status, t.created_at,
              u.name as user_name, u.username, u.id as user_id
       FROM templates t
       JOIN users u ON t.user_id = u.id
       WHERE t.status = 'PENDING'
       ORDER BY t.created_at ASC`
    );

    const pendingTemplates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      language: row.language,
      status: row.status,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        username: row.username
      }
    }));

    res.json({ templates: pendingTemplates });

  } catch (error) {
    console.error('Get pending templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin password change endpoint - allows admin to change any user's password
router.post('/users/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminUser = req.session.user!;

    // Validation
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if target user exists
    const userCheck = await pool.query(
      'SELECT id, username, name, email FROM users WHERE id = $1', 
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userCheck.rows[0];

    // Update password in database (stored as plain text as per current system design)
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPassword, id]
    );

    // Log the password change action for security audit
    console.log(`🔒 ADMIN PASSWORD CHANGE: Admin ${adminUser.username} (ID: ${adminUser.id}) changed password for user ${targetUser.username} (ID: ${targetUser.id}) at ${new Date().toISOString()}`);

    // Insert audit log into database for production security tracking
    try {
      await pool.query(
        `INSERT INTO admin_actions (admin_user_id, action_type, target_type, target_id, details, created_at) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          adminUser.id,
          'PASSWORD_CHANGE',
          'USER',
          id,
          JSON.stringify({
            admin_username: adminUser.username,
            target_username: targetUser.username,
            target_email: targetUser.email,
            target_name: targetUser.name,
            timestamp: new Date().toISOString(),
            action: 'Admin changed user password'
          })
        ]
      );
    } catch (auditError) {
      // Continue even if audit logging fails, but log the error
      console.error('⚠️  Failed to create audit log entry:', auditError);
    }

    res.json({
      success: true,
      message: `Password successfully changed for user ${targetUser.name}`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    console.error('Admin password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
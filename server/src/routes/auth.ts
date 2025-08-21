import express from 'express';
import pool from '../db';
import { CreateUserRequest, LoginRequest, User, SessionUser } from '../types';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

// In-memory OTP store (username -> {otp, phone, expires, lastSent})
interface OtpRecord {
  otp: string;
  phone: string;
  expires: number;
  lastSent: number;
}

const otpStore = new Map<string, OtpRecord>();

// Clean expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [username, record] of otpStore.entries()) {
    if (record.expires < now) {
      otpStore.delete(username);
    }
  }
}, 5 * 60 * 1000);

// Optional: constant-time compare helper
function constantTimeEqual(a: string, b: string) {
  const ab = Buffer.from(a ?? '', 'utf8');
  const bb = Buffer.from(b ?? '', 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// API Response interface
interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

// Helper function to send OTP via WhatsApp using authentication template
async function sendOtpToUser(phone: string, otp: string, username: string, req: express.Request): Promise<boolean> {
  try {
    console.log(`🔐 Sending OTP ${otp} to phone: ${phone} for user: ${username}`);
    
    // Use the "forget_password" template with shivaji2004 admin credentials
    const sendRequest = {
      username: 'shivaji2004', // Use shivaji2004 as admin for forgot password
      templatename: 'forget_password', // Forgot password template
      recipient_number: phone,
      var1: otp // OTP code as first variable
    };

    console.log(`📤 Making WhatsApp API call with:`, JSON.stringify(sendRequest, null, 2));

    // Make internal API call to send the OTP
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}` 
      : 'http://localhost:5050';
    
    const response = await fetch(`${apiBaseUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendRequest)
    });

    const result = await response.json() as ApiResponse;
    
    if (response.ok && result.success) {
      console.log(`✅ OTP sent successfully to ${phone}: ${otp}`);
      console.log(`📱 WhatsApp API Response:`, result.message || 'Message sent');
      return true;
    } else {
      console.error(`❌ WhatsApp API Error (${response.status}):`, result.error || result.message || 'Unknown error');
      console.error(`📤 Failed request details:`, JSON.stringify(sendRequest, null, 2));
      
      // If template not found, try with a fallback approach
      if (result.error && result.error.includes('not found')) {
        console.log(`🔄 Template 'forget_password' not found, this needs to be created in WhatsApp Business API`);
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to send OTP via WhatsApp:', error);
    return false;
  }
}

const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { name, email, username, password, confirmPassword, phoneNumber }: CreateUserRequest = req.body;

    // Validation
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Phone number validation (optional) - format: country code + number (e.g., 919398424270)
    if (phoneNumber) {
      const phoneRegex = /^[1-9]\d{10,14}$/; // Country code + number, 11-15 digits total
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ error: 'Invalid phone number format. Use format: country code + number (e.g., 919398424270)' });
      }
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Create user (storing password as plain text for simplicity as per requirements)
    const result = await pool.query(
      'INSERT INTO users (name, email, username, password, phone_number, credit_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, username, role, credit_balance, created_at',
      [name, email, username, password, phoneNumber, 1000] // Default 1000 credits for new users
    );

    const newUser = result.rows[0];

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        creditBalance: newUser.credit_balance,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TEMP: narrow helper to send errors with a code (remove later)
function sendErr(res: any, status: number, code: string, extra: any = {}) {
  return res.status(status).json({ error: code, ...extra });
}

// Login route - DIAGNOSTIC VERSION
router.post('/login', async (req, res) => {
  const started = Date.now();
  try {
    // 1) Input
    const { username, password } = req.body ?? {};
    console.log('[AUTH] input:', { username, hasPassword: Boolean(password) });
    if (!username || !password) return sendErr(res, 400, 'MISSING_CREDENTIALS');

    // 2) DB query
    let rows;
    try {
      const sql = 'SELECT id, username, password, name, email, role, credit_balance FROM users WHERE username = $1 LIMIT 1';
      rows = (await pool.query(sql, [username])).rows;
      console.log('[AUTH] db rows:', { rowsLen: rows.length, keys: rows[0] ? Object.keys(rows[0]) : [] });
    } catch (dbErr) {
      console.error('[AUTH] DB_QUERY_FAILED:', dbErr);
      return sendErr(res, 500, 'DB_QUERY_FAILED');
    }

    // 3) Direct compare (no hashing)
    const user = rows[0];
    if (!user) return sendErr(res, 401, 'USER_NOT_FOUND');
    if (typeof user.password !== 'string') {
      console.error('[AUTH] PASSWORD_FIELD_INVALID:', { keys: Object.keys(user), passwordType: typeof user.password });
      return sendErr(res, 500, 'PASSWORD_FIELD_INVALID');
    }
    
    // Use constant-time comparison
    const passwordMatch = constantTimeEqual(password, user.password);
    if (!passwordMatch) return sendErr(res, 401, 'INVALID_PASSWORD');

    // 4) Session save
    try {
      const sessionData = req.session as any;
      sessionData.userId = user.id;
      sessionData.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      };
      // Initialize last activity timestamp for auto-logout tracking
      sessionData.lastActivity = Date.now();
      
      req.session.save((err: any) => {
        if (err) {
          console.error('[AUTH] SESSION_SAVE_FAILED:', err);
          return sendErr(res, 500, 'SESSION_SAVE_FAILED');
        }
        console.log('[AUTH] login ok:', { userId: user.id, username: user.username, ms: Date.now() - started });
        console.log('🔐 Session initialized with auto-logout tracking');
        return res.status(200).json({ 
          ok: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            creditBalance: user.credit_balance
          }
        });
      });
    } catch (sessErr) {
      console.error('[AUTH] SESSION_BLOCK_THROW:', sessErr);
      return sendErr(res, 500, 'SESSION_BLOCK_THROW');
    }
  } catch (err) {
    console.error('[AUTH] UNCAUGHT:', err);
    return sendErr(res, 500, 'UNCAUGHT');
  }
});

// Get current user (protected route)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const session = req.session as any;
    const userId = session.userId;
    const timestamp = req.query.t || Date.now();

    console.log(`💰 🔍 AUTH /ME: Fetching user data for userId=${userId}, timestamp=${timestamp}`);

    // Add cache-busting headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const result = await pool.query(
      'SELECT id, name, email, username, role, credit_balance, created_at FROM users WHERE id = $1',
      [userId]
    );

    console.log(`💰 📊 AUTH /ME: Database query result:`, {
      rowCount: result.rows.length,
      userId: userId,
      creditBalance: result.rows[0]?.credit_balance
    });

    if (result.rows.length === 0) {
      console.log(`💰 ❌ AUTH /ME: User ${userId} not found in database`);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        creditBalance: user.credit_balance,
        createdAt: user.created_at
      }
    };

    console.log(`💰 ✅ AUTH /ME: Returning fresh user data:`, {
      userId: user.id,
      username: user.username,
      creditBalance: user.credit_balance,
      timestamp: timestamp
    });

    res.json(responseData);

  } catch (error) {
    console.error('💰 ❌ AUTH /ME: Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout route
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    
    res.clearCookie('psid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Reset activity endpoint for auto-logout system
router.post('/reset-activity', requireAuth, (req, res) => {
  try {
    const sessionData = req.session as any;
    
    // Update last activity timestamp
    sessionData.lastActivity = Date.now();
    
    // Reset the cookie maxAge to extend the session
    req.session.cookie.maxAge = 10 * 60 * 1000; // Reset to 10 minutes
    
    // Save the session with updated activity
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session activity:', err);
        return res.status(500).json({ error: 'Could not reset activity' });
      }
      
      console.log(`🔄 Activity manually reset for user ${sessionData.user?.username || 'unknown'}`);
      res.json({ 
        success: true, 
        message: 'Activity reset successfully',
        lastActivity: sessionData.lastActivity
      });
    });
  } catch (error) {
    console.error('Reset activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password - send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, phone } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and phone number are required' 
      });
    }

    // Validate phone format (country code + number without +)
    const phoneRegex = /^[1-9]\d{10,14}$/; // Country code + number, 11-15 digits total
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid phone number format. Use format: country code + number (e.g., 919398424270)' 
      });
    }

    console.log(`🔍 Looking up user: ${username}`);
    
    // Find user by username and verify phone number
    const result = await pool.query(
      'SELECT id, username, phone_number FROM users WHERE username = $1',
      [username]
    );

    console.log(`📊 User lookup result: ${result.rows.length} rows found`);

    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${username}`);
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];
    console.log(`👤 Found user: ${user.username}, stored phone: ${user.phone_number}`);
    
    // Check if phone number matches (exact match required)
    const userPhone = user.phone_number;
    if (userPhone !== phone) {
      console.log(`❌ Phone mismatch - provided: ${phone}, stored: ${userPhone}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Phone number does not match our records' 
      });
    }
    
    console.log(`✅ Phone number matches for user: ${username}`);
    
    // Check if shivaji2004 admin user has business info configured for sending OTP
    const adminBusinessCheck = await pool.query(
      'SELECT u.id, ubi.business_name, ubi.is_active FROM users u JOIN user_business_info ubi ON u.id = ubi.user_id WHERE u.username = $1',
      ['shivaji2004']
    );
    
    if (adminBusinessCheck.rows.length === 0) {
      console.error(`❌ Admin user 'shivaji2004' has no business info configured`);
      return res.status(500).json({
        success: false,
        error: 'System configuration error. Admin WhatsApp Business account not configured.'
      });
    }
    
    const adminBusiness = adminBusinessCheck.rows[0];
    if (!adminBusiness.is_active) {
      console.error(`❌ Admin user 'shivaji2004' business info is not active`);
      return res.status(500).json({
        success: false,
        error: 'System configuration error. Admin WhatsApp Business account is not active.'
      });
    }
    
    console.log(`✅ Admin user 'shivaji2004' has configured business: ${adminBusiness.business_name}`);

    // Check rate limiting (prevent resend within 60 seconds)
    const existingRecord = otpStore.get(username);
    const now = Date.now();
    
    if (existingRecord && (now - existingRecord.lastSent) < 60000) {
      const remainingTime = Math.ceil((60000 - (now - existingRecord.lastSent)) / 1000);
      return res.status(429).json({ 
        success: false, 
        error: `Please wait ${remainingTime} seconds before requesting a new OTP` 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = now + 5 * 60 * 1000; // 5 minutes

    // Store OTP
    otpStore.set(username, {
      otp,
      phone: phone,
      expires,
      lastSent: now
    });

    // Send OTP via WhatsApp
    const otpSent = await sendOtpToUser(phone, otp, username, req);
    
    if (!otpSent) {
      // Remove OTP from store if sending failed
      otpStore.delete(username);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send OTP. Please try again.' 
      });
    }

    console.log(`🔐 OTP generated for user ${username}: ${otp} (expires in 5 minutes)`);

    return res.json({ 
      success: true, 
      otpSent: true,
      message: 'OTP sent to your WhatsApp number'
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP. Please try again.' 
    });
  }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and OTP are required' 
      });
    }

    const record = otpStore.get(username);
    const now = Date.now();

    if (!record) {
      return res.status(400).json({ 
        success: false, 
        error: 'No OTP found. Please request a new OTP.' 
      });
    }

    if (record.expires < now) {
      // Clean up expired OTP
      otpStore.delete(username);
      return res.status(400).json({ 
        success: false, 
        error: 'OTP has expired. Please request a new one.' 
      });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid OTP. Please try again.' 
      });
    }

    // OTP is valid - extend expiry for password reset (10 minutes)
    record.expires = now + 10 * 60 * 1000;
    
    console.log(`✅ OTP verified successfully for user: ${username}`);

    return res.json({ 
      success: true, 
      resetAllowed: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Update profile route (name and email only)
router.put('/update-profile', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const session = req.session as any;
    const userId = session.userId;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Check if email is already taken by another user
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email is already in use' 
      });
    }

    // Update user profile
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, username, role, credit_balance, created_at',
      [name, email, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const updatedUser = result.rows[0];

    return res.json({ 
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        creditBalance: updatedUser.credit_balance,
        createdAt: updatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Reset password after OTP verification
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user has verified OTP
    const record = otpStore.get(username);
    const now = Date.now();

    if (!record || record.expires < now) {
      return res.status(400).json({ 
        success: false, 
        error: 'OTP verification required or expired. Please start the process again.' 
      });
    }

    // Update password in database (storing as plain text as per requirements)
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
      [newPassword, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Clean up OTP record
    otpStore.delete(username);

    console.log(`🔐 Password reset successfully for user: ${username}`);

    return res.json({ 
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Debug probe (temporary - remove after testing)
router.get('/__ping', (_req, res) => res.json({ok: true, route: '/api/auth/__ping'}));

export default router;
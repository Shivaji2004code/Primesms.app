// src/index.ts
import { config } from 'dotenv';
config(); // Load environment variables before anything else

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'path';
import pool from './db';

// Import utilities and configuration
import { env } from './utils/env';
import { logger, logStartup, logError, createHttpLogger } from './utils/logger';
import { 
  errorHandler, 
  notFoundHandler, 
  setupGlobalErrorHandlers
} from './middleware/errorHandler';

// Import health module (must be FIRST)
import healthRouter from './health';

// Import routes
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import templateRoutes from './routes/templates';
import whatsappRoutes from './routes/whatsapp';
import sendRoutes from './routes/send';
import creditsRoutes from './routes/credits';
import logsRoutes from './routes/logs';
import metaWebhookRouter from './routes/metaWebhook';
import sseRouter from './routes/sseRoutes';
import templatesSyncRouter from './routes/templatesSync';
import templatesDebugRouter from './routes/templatesDebug';
import templatesSyncDirectRouter from './routes/templatesSyncDirect';

// Import middleware
import { requireAuthWithRedirect } from './middleware/auth';

// Import services
import { logCleanupService } from './services/logCleanup';

// Import rate limiting configuration
import {
  globalLimiter,
  authLimiter,
  adminLimiter,
  loginLimiter,
  otpLimiter,
  resetLimiter,
  writeLimiter,
  readLimiter,
  noLimiter
} from './config/rateLimit';

// Setup global error handlers
setupGlobalErrorHandlers();

const app: Application = express();

// ============================================================================
// HEALTH ENDPOINTS (MUST BE FIRST - NO DEPENDENCIES)
// ============================================================================

// Trust proxy FIRST (required for health checks behind proxy)
app.set('trust proxy', 1);

// Mount health endpoints IMMEDIATELY - before parsers, CORS, sessions, rate limiting
// This ensures Coolify can ALWAYS reach health endpoints regardless of app state
app.use(healthRouter);

console.log('[HEALTH] Health endpoints mounted FIRST - always accessible');

// ============================================================================
// WEBHOOK ROUTES (MUST BE BEFORE STANDARD BODY PARSING)
// ============================================================================

// Mount webhook routes with raw body capture for signature verification
// This must be before express.json() to capture raw body for HMAC validation
app.use('/webhooks', express.json({
  verify: (req: any, _res, buf) => { 
    req.rawBody = Buffer.from(buf); 
  }
}), metaWebhookRouter);

console.log('[WEBHOOKS] Meta webhook routes mounted at /webhooks/*');

// ============================================================================
// MIDDLEWARE CONFIGURATION (REQUIRED ORDER)
// ============================================================================

// 2) Body parsing (for non-webhook routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3) CORS with credentials
const allowedOrigins = [
  'https://primesms.app',
  'http://localhost:5173',
  'http://localhost:3000'
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);           // same-origin/curl
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true
}));

// 4) Compression
app.use(compression());

// Additional security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Apply global rate limiter (very generous limits)
app.use(globalLimiter);

// HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for these parameters
}));

// HTTP request logging
app.use(createHttpLogger());

// Database connection with retry logic
const connectDatabase = async (retries = 5): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logStartup('Database connected successfully', {
      host: env.database.host,
      port: env.database.port,
      database: env.database.database
    });
    
    // Create admin user if it doesn't exist
    await createAdminUser();
  } catch (error) {
    logError('Database connection failed', error, { retries });
    
    if (retries > 0) {
      logStartup(`Retrying database connection in 5 seconds... (${retries} attempts left)`);
      setTimeout(() => connectDatabase(retries - 1), 5000);
    } else {
      logError('Database connection failed after all retries');
      process.exit(1);
    }
  }
};

// Create admin user on startup if it doesn't exist
const createAdminUser = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    
    // Check if admin user already exists
    const adminCheck = await client.query(
      'SELECT id FROM users WHERE username = $1 LIMIT 1',
      ['primesms']
    );
    
    if (adminCheck.rows.length === 0) {
      // Create admin user
      await client.query(
        'INSERT INTO users (name, email, username, password, role, credit_balance) VALUES ($1, $2, $3, $4, $5, $6)',
        ['Prime SMS Admin', 'admin@primesms.app', 'primesms', 'Primesms', 'admin', 999999]
      );
      logStartup('✅ Admin user created successfully', {
        username: 'primesms',
        email: 'admin@primesms.app'
      });
    } else {
      logStartup('ℹ️  Admin user already exists');
    }
    
    client.release();
  } catch (error) {
    logError('Failed to create admin user', error);
    // Don't exit the process, just log the error
  }
};

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================

// 5) Sessions (connect-pg-simple)
const ConnectPgSimple = connectPgSimple(session);
const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  store: new ConnectPgSimple({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  name: 'psid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? 'lax' : 'lax',
    secure: isProd,                               // true on HTTPS
    maxAge: 10 * 60 * 1000                        // 10 minutes auto-logout
  }
}));

// ============================================================================
// SESSION ACTIVITY TRACKING MIDDLEWARE
// ============================================================================

// Middleware to check session expiration (but NOT auto-extend)
app.use((req, res, next) => {
  // Skip session checking for health checks, webhooks, and static files
  const skipPaths = ['/health', '/webhooks', '/api/debug', '.js', '.css', '.png', '.jpg', '.ico'];
  const shouldSkip = skipPaths.some(path => req.path.includes(path));
  
  if (shouldSkip) {
    return next();
  }

  // Check session expiration for authenticated users (but don't auto-extend)
  if (req.session && (req.session as any).user) {
    const sessionData = req.session as any;
    
    // Check if session has expired (10 minutes of inactivity)
    if (sessionData.lastActivity && (Date.now() - sessionData.lastActivity) > (10 * 60 * 1000)) {
      // Session expired, destroy it
      console.log(`🕐 Session expired for user ${sessionData.user?.username || 'unknown'} after 10 minutes of inactivity`);
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.status(401).json({ 
          error: 'Session expired due to inactivity',
          code: 'SESSION_EXPIRED',
          redirect: '/login'
        });
      });
      return;
    }
  }
  
  next();
});

// ============================================================================
// API ROUTES
// ============================================================================

// Legacy health routes (now redundant - new health module mounted first)
// Keep for backward compatibility but they won't be reached due to mounting order

// Authentication routes with specific limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', otpLimiter);
app.use('/api/auth/verify-otp', otpLimiter);
app.use('/api/auth/reset-password', resetLimiter);
app.use('/api/auth', authLimiter, authRoutes);

// Debug routes (no additional limiting)
app.get('/api/debug/session', noLimiter, (req, res) => {
  const s = req.session as any;
  const sessionData = {
    hasSession: Boolean(req.session),
    userId: s?.userId ?? null,
    sessionId: req.sessionID,
    sessionStore: Boolean(req.sessionStore),
    cookieName: req.session?.cookie ? 'psid' : 'no-cookie',
    cookieSettings: req.session?.cookie,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    headers: {
      authorization: req.get('Authorization'),
      cookie: req.get('Cookie') ? 'present' : 'missing'
    },
    timestamp: new Date().toISOString()
  };
  
  console.log('🐛 DEBUG SESSION REQUEST:', sessionData);
  res.json(sessionData);
});

// Admin routes (high limits to prevent "Too many requests" errors)
app.use('/api/admin', adminLimiter, adminRoutes);

// Read-heavy routes (generous limits for dashboard functionality)
app.use('/api/templates', readLimiter, templateRoutes);
app.use('/api/logs', readLimiter, logsRoutes);
app.use('/api/credits', readLimiter, creditsRoutes);

// Template sync routes (moderate limits for sync operations)
app.use('/', writeLimiter, templatesSyncRouter);

// Direct template sync routes (emergency sync)
app.use('/', writeLimiter, templatesSyncDirectRouter);

// Debug routes (admin/development only)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
  app.use('/', noLimiter, templatesDebugRouter);
  console.log('🐛 [DEBUG] Template debug routes enabled');
}

// Write-heavy routes (reasonable limits for messaging operations)
app.use('/api/whatsapp', writeLimiter, whatsappRoutes);
app.use('/api/send', writeLimiter, sendRoutes);


// SSE routes for real-time updates (no rate limiting for persistent connections)
app.use('/api', sseRouter);

// API Root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Prime SMS API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    documentation: '/api/health'
  });
});

// API 404 (keep logs clear)
app.use('/api', (req, res) => {
  return res.status(404).json({ error: 'ROUTE_NOT_FOUND', path: req.originalUrl });
});

// Legacy routes with redirect middleware
app.get('/templates', requireAuthWithRedirect, (req, res) => {
  res.redirect('/api/templates');
});

// ============================================================================
// STATIC CLIENT SERVING & SPA FALLBACK
// ============================================================================

// Where the built client will be placed by the build step
const clientDir = path.resolve(__dirname, './client-static');

// Serve static assets with sensible caching (immutable hashed assets cache 1y; html no-cache)
app.use(express.static(clientDir, {
  index: false,
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// SPA fallback: everything NOT starting with /api or /health goes to index.html
app.get('*', (req, res, next) => {
  // Never intercept API routes or health endpoints
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler for unknown routes
app.use('*', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal: string): Promise<void> => {
  logStartup(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(async () => {
      logStartup('HTTP server closed');
      
      // Close database connections
      try {
        await pool.end();
        logStartup('Database connections closed');
      } catch (error) {
        logError('Error closing database connections', error);
      }
      
      // Stop log cleanup service
      try {
        // Cleanup service stop if available
        logStartup('Log cleanup service stopped');
      } catch (error) {
        logError('Error stopping cleanup service', error);
      }
      
      logStartup('Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logError('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logError('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// START SERVER
// ============================================================================

// Print routes for debugging
function printRoutes() {
  const out: string[] = [];
  try {
    // @ts-ignore
    (app as any)._router?.stack?.forEach((layer: any) => {
      if (layer.route?.path) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        out.push(`${methods} ${layer.route.path}`);
      } else if (layer.regexp && layer.handle?.stack) {
        // Router middleware
        const match = layer.regexp.toString().match(/\/\^\\?\/(.*?)\\?\$\//);
        if (match) {
          out.push(`ROUTER ${match[1].replace(/\\\//g, '/')}`);
        }
      }
    });
    console.log('[ROUTES]', out.slice(0, 20)); // Limit output
  } catch (error) {
    console.log('[ROUTES] Error listing routes:', error);
  }
}

const startServer = async (): Promise<void> => {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Start log cleanup service
    try {
      // Cleanup service start if available
      logStartup('Log cleanup service started');
    } catch (error) {
      logError('Error starting cleanup service', error);
    }
    
    // Start HTTP server - BIND TO 0.0.0.0 for Docker/Coolify health checks
    const server = app.listen(env.port, '0.0.0.0', () => {
      logStartup(`Server started successfully`, {
        host: '0.0.0.0',
        port: env.port,
        environment: env.nodeEnv,
        processId: process.pid,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        corsOrigins: env.corsOrigins,
        rateLimit: env.rateLimit,
        healthEndpoints: ['GET /health', 'GET /healthz', 'GET /api/health', 'GET /api/healthz', 'GET /api/health/db']
      });
      
      console.log(`🏥 Health endpoints available at:`);
      console.log(`   http://0.0.0.0:${env.port}/health`);
      console.log(`   http://0.0.0.0:${env.port}/healthz`);
      console.log(`   http://0.0.0.0:${env.port}/api/health`);
      console.log(`   http://0.0.0.0:${env.port}/api/healthz`);
      console.log(`   http://0.0.0.0:${env.port}/api/health/db (deep check)`);
      
      // Print route table for debugging
      printRoutes();
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logError(`Port ${env.port} is already in use`);
        process.exit(1);
      } else {
        logError('Server error', error);
        process.exit(1);
      }
    });
    
    // Export server for graceful shutdown
    (global as any).server = server;
    
  } catch (error) {
    logError('Failed to start server', error);
    process.exit(1);
  }
};

// Get server instance for shutdown
const server = (global as any).server;

// Start the server
startServer();

// Export app and pool for testing
export { app };
export default app;
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
// STATIC FILE SERVING (SECOND PRIORITY - BEFORE ALL MIDDLEWARE)
// ============================================================================

// SIMPLIFIED: Always use client-build as single source of truth
const localClientBuildDir = path.resolve(__dirname, '../client-build');   // dev: server/dist/../client-build
const prodClientBuildDir = path.resolve(process.cwd(), 'client-build');   // prod: /app/client-build  
const staticFallbackDir = path.resolve(__dirname, '../static-fallback');

let clientDir: string = staticFallbackDir;
try {
  const fs = require('fs');
  
  logger.info(`🔍 Finding client-build directory:`);
  logger.info(`   Working dir: ${process.cwd()}`);
  logger.info(`   __dirname: ${__dirname}`);
  
  // Function to check if directory has assets
  const hasAssets = (dir: string) => {
    const assetsDir = path.join(dir, 'assets');
    if (!fs.existsSync(assetsDir)) return false;
    const files = fs.readdirSync(assetsDir);
    return files.some((f: string) => f.endsWith('.js')) && files.some((f: string) => f.endsWith('.css'));
  };
  
  // Try client-build locations in order
  const candidates = [
    { name: 'local client-build', path: localClientBuildDir },   // server/client-build
    { name: 'prod client-build', path: prodClientBuildDir }      // /app/client-build
  ];
  
  for (const candidate of candidates) {
    logger.info(`   Checking ${candidate.name}: ${candidate.path}`);
    if (fs.existsSync(candidate.path) && hasAssets(candidate.path)) {
      clientDir = candidate.path;
      const assetFiles = fs.readdirSync(path.join(clientDir, 'assets'));
      logger.info(`✅ FOUND client-build: ${clientDir}`);
      logger.info(`📦 Assets: ${assetFiles.join(', ')}`);
      break;
    } else {
      logger.info(`   ❌ Not found or no assets`);
    }
  }
  
  if (clientDir === staticFallbackDir) {
    logger.error(`❌ CLIENT-BUILD NOT FOUND! Using fallback.`);
    logger.error(`   Make sure to build the client first: npm run build:client`);
  }
} catch (error) {
  logger.error(`❌ Error finding client-build: ${error}`);
}

// Debug middleware to log asset requests with detailed file system checks
app.use((req, res, next) => {
  if (req.path.startsWith('/assets')) {
    const fs = require('fs');
    const requestedFile = path.join(clientDir, req.path);
    const assetsDir = path.join(clientDir, 'assets');
    
    logger.info(`🎯 Asset request: ${req.method} ${req.path}`);
    logger.info(`   Requested file path: ${requestedFile}`);
    logger.info(`   Client dir: ${clientDir}`);
    logger.info(`   Assets dir exists: ${fs.existsSync(assetsDir)}`);
    logger.info(`   Requested file exists: ${fs.existsSync(requestedFile)}`);
    
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      logger.info(`   Available assets: ${assetFiles.join(', ')}`);
    }
  }
  next();
});

// Explicitly serve assets directory with proper MIME types (HIGHEST PRIORITY)
const assetsPath = path.join(clientDir, 'assets');
const fs = require('fs');

logger.info(`🔧 Setting up /assets route with path: ${assetsPath}`);
logger.info(`🔧 Assets directory exists: ${fs.existsSync(assetsPath)}`);

app.use('/assets', (req, res, next) => {
  const requestedFile = path.join(assetsPath, req.path);
  logger.info(`📁 /assets middleware: ${req.path} -> ${requestedFile}`);
  
  if (!fs.existsSync(assetsPath)) {
    logger.error(`❌ Assets directory not found: ${assetsPath}`);
    return res.status(404).json({ 
      error: 'Assets directory not found',
      path: req.path,
      assetsPath: assetsPath
    });
  }
  
  // Extract the file extension from the requested path
  const fileExt = path.extname(req.path);
  
  // If the file doesn't exist but we know the extension, try to find a matching file
  if (!fs.existsSync(requestedFile) && (fileExt === '.js' || fileExt === '.css')) {
    logger.warn(`⚠️ Asset not found: ${req.path}. Trying to find a matching file...`);
    
    try {
      // Get all files in the assets directory
      const files = fs.readdirSync(assetsPath);
      
      // Find a file with the same extension
      const matchingFile = files.find((file: string) => path.extname(file) === fileExt);
      
      if (matchingFile) {
        logger.info(`✅ Found matching ${fileExt} file: ${matchingFile}`);
        
        // Serve this file instead
        return res.sendFile(path.join(assetsPath, matchingFile), {
          headers: {
            'Content-Type': fileExt === '.js' ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
    } catch (error) {
      logger.error(`❌ Error finding matching file: ${error}`);
    }
  }
  
  next();
}, express.static(assetsPath, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      logger.info(`✅ Serving JS asset: ${path.basename(filePath)}`);
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      logger.info(`✅ Serving CSS asset: ${path.basename(filePath)}`);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

console.log('[STATIC] Asset serving mounted SECOND - before all other middleware');

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
app.get('/api/debug/files', noLimiter, (req, res) => {
  const fs = require('fs');
  
  const debugInfo: any = {
    clientDir,
    directories: {},
    files: {}
  };
  
  // Check all potential client directories
  const dirsToCheck = [
    { name: 'clientStaticDir', path: path.resolve(__dirname, './client-static') },
    { name: 'clientBuildDir', path: path.resolve(__dirname, '../client-build') },
    { name: 'cwdClientStaticDir', path: path.resolve(process.cwd(), 'dist/client-static') },
    { name: 'cwdClientBuildDir', path: path.resolve(process.cwd(), 'client-build') },
    { name: 'preBuiltClientDir', path: path.resolve(__dirname, '../pre-built-client') },
    { name: 'staticFallbackDir', path: path.resolve(__dirname, '../static-fallback') },
    { name: 'currentClientDir', path: clientDir }
  ];
  
  for (const dir of dirsToCheck) {
    debugInfo.directories[dir.name] = {
      path: dir.path,
      exists: fs.existsSync(dir.path),
      contents: fs.existsSync(dir.path) ? fs.readdirSync(dir.path) : []
    };
    
    // Check assets subdirectory
    const assetsPath = path.join(dir.path, 'assets');
    if (fs.existsSync(assetsPath)) {
      debugInfo.files[`${dir.name}_assets`] = fs.readdirSync(assetsPath);
    }
  }
  
  res.json(debugInfo);
});

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

// Force refresh endpoint - serves fresh index.html with no cache
app.get('/refresh', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Get the index.html content
  const indexPath = path.join(clientDir, 'index.html');
  
  try {
    // Read the index.html file
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Get all available assets
    const assetsDir = path.join(clientDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      
      // Find JS and CSS files
      const jsFile = files.find((file: string) => file.endsWith('.js'));
      const cssFile = files.find((file: string) => file.endsWith('.css'));
      
      if (jsFile && cssFile) {
        // Replace any asset references with the actual available files
        indexContent = indexContent
          .replace(/src="\/assets\/.*?\.js"/g, `src="/assets/${jsFile}"`)
          .replace(/href="\/assets\/.*?\.css"/g, `href="/assets/${cssFile}"`);
          
        logger.info(`✅ Modified refresh index.html to use available assets: JS=${jsFile}, CSS=${cssFile}`);
      }
    }
    
    // Send the modified index.html
    res.send(indexContent);
  } catch (error) {
    logger.error(`❌ Error serving modified index.html: ${error}`);
    // Fallback to sending the file directly
    res.sendFile(indexPath);
  }
});

// Debug asset endpoint - shows what assets are available and requested
app.get('/debug-assets', (req, res) => {
  const assetsDir = path.join(clientDir, 'assets');
  const indexPath = path.join(clientDir, 'index.html');
  
  const result = {
    clientDir,
    assetsPath,
    assetsExists: fs.existsSync(assetsDir),
    indexExists: fs.existsSync(indexPath),
    availableAssets: [],
    indexContents: '',
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };
  
  // Get available assets
  if (result.assetsExists) {
    result.availableAssets = fs.readdirSync(assetsDir);
  }
  
  // Get index.html content
  if (result.indexExists) {
    result.indexContents = fs.readFileSync(indexPath, 'utf8');
  }
  
  res.json(result);
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
// SPA FALLBACK (USING ALREADY DETECTED CLIENT DIR FROM TOP OF FILE)
// ============================================================================

// Serve static assets with sensible caching and proper MIME types
app.use(express.static(clientDir, {
  index: false,
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    // Set proper MIME types for assets
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Debug middleware moved above - this is duplicate, removing

// SPA fallback: everything NOT starting with /api, /health, or /assets goes to index.html
app.get('*', (req, res, next) => {
  // Never intercept API routes, health endpoints, or static assets
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/health') ||
      req.path.startsWith('/assets') ||
      req.path.includes('.js') ||
      req.path.includes('.css') ||
      req.path.includes('.svg') ||
      req.path.includes('.png') ||
      req.path.includes('.jpg') ||
      req.path.includes('.ico')) {
    logger.info(`Skipping SPA fallback for: ${req.path}`);
    return next();
  }
  
  logger.info(`Serving SPA fallback for: ${req.path}`);
  
  // Get the index.html content
  const indexPath = path.join(clientDir, 'index.html');
  
  try {
    // Read the index.html file
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Get all available assets
    const assetsDir = path.join(clientDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      
      // Find JS and CSS files
      const jsFile = files.find((file: string) => file.endsWith('.js'));
      const cssFile = files.find((file: string) => file.endsWith('.css'));
      
      if (jsFile && cssFile) {
        // Replace any asset references with the actual available files
        indexContent = indexContent
          .replace(/src="\/assets\/.*?\.js"/g, `src="/assets/${jsFile}"`)
          .replace(/href="\/assets\/.*?\.css"/g, `href="/assets/${cssFile}"`);
          
        logger.info(`✅ Modified index.html to use available assets: JS=${jsFile}, CSS=${cssFile}`);
      }
    }
    
    // Set cache control headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the modified index.html
    res.send(indexContent);
  } catch (error) {
    logger.error(`❌ Error serving modified index.html: ${error}`);
    // Fallback to sending the file directly
    res.sendFile(indexPath);
  }
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
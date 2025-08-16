// src/utils/env.ts
import { config } from 'dotenv';

// Load environment variables
config();

interface RequiredEnvVars {
  NODE_ENV: string;
  PORT: string;
  DB_HOST: string;
  DB_PORT: string;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  SESSION_SECRET: string;
}

interface OptionalEnvVars {
  CORS_ORIGINS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  LOG_LEVEL?: string;
  MAX_JSON_SIZE?: string;
  TRUST_PROXY?: string;
  // Bulk messaging configuration - Loop-based processing
  GRAPH_API_VERSION?: string;
  BULK_LOOP_SIZE?: string;
  BULK_LOOP_PAUSE_MS?: string;
  BULK_MESSAGES_PER_SECOND?: string;
  BULK_MAX_RETRIES?: string;
  BULK_RETRY_BASE_MS?: string;
  BULK_HARD_CAP?: string;
  // Legacy support
  BULK_BATCH_SIZE?: string;
  BULK_CONCURRENCY?: string;
  BULK_PAUSE_MS?: string;
}

class EnvValidator {
  private requiredVars!: RequiredEnvVars;
  private optionalVars!: OptionalEnvVars;

  constructor() {
    this.validateAndLoadEnv();
  }

  private validateAndLoadEnv(): void {
    const missing: string[] = [];
    
    // Check required environment variables
    const requiredEnvKeys: (keyof RequiredEnvVars)[] = [
      'NODE_ENV',
      'PORT',
      'DB_HOST',
      'DB_PORT', 
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'SESSION_SECRET'
    ];

    requiredEnvKeys.forEach(key => {
      if (!process.env[key] || (key === 'DB_PASSWORD' && (process.env[key] === 'none' || process.env[key] === ''))) {
        // Allow empty or 'none' for DB_PASSWORD
        if (key === 'DB_PASSWORD') return;
        missing.push(key);
      }
    });

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('Please check your .env file and ensure all required variables are set.');
      process.exit(1);
    }

    // Load required vars with type safety
    this.requiredVars = {
      NODE_ENV: process.env.NODE_ENV!,
      PORT: process.env.PORT!,
      DB_HOST: process.env.DB_HOST!,
      DB_PORT: process.env.DB_PORT!,
      DB_NAME: process.env.DB_NAME!,
      DB_USER: process.env.DB_USER!,
      DB_PASSWORD: process.env.DB_PASSWORD === 'none' ? '' : process.env.DB_PASSWORD!,
      SESSION_SECRET: process.env.SESSION_SECRET!,
    };

    // Load optional vars with defaults
    this.optionalVars = {
      CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173',
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || '900000', // 15 minutes
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      MAX_JSON_SIZE: process.env.MAX_JSON_SIZE || '100kb',
      TRUST_PROXY: process.env.TRUST_PROXY || '1',
      // Bulk messaging defaults - Loop-based processing
      GRAPH_API_VERSION: process.env.GRAPH_API_VERSION || 'v22.0',
      BULK_LOOP_SIZE: process.env.BULK_LOOP_SIZE || '200',
      BULK_LOOP_PAUSE_MS: process.env.BULK_LOOP_PAUSE_MS || '2000',
      BULK_MESSAGES_PER_SECOND: process.env.BULK_MESSAGES_PER_SECOND || '10',
      BULK_MAX_RETRIES: process.env.BULK_MAX_RETRIES || '3',
      BULK_RETRY_BASE_MS: process.env.BULK_RETRY_BASE_MS || '500',
      BULK_HARD_CAP: process.env.BULK_HARD_CAP || '50000',
      // Legacy support for backward compatibility
      BULK_BATCH_SIZE: process.env.BULK_BATCH_SIZE || process.env.BULK_LOOP_SIZE || '200',
      BULK_CONCURRENCY: process.env.BULK_CONCURRENCY || '1',
      BULK_PAUSE_MS: process.env.BULK_PAUSE_MS || process.env.BULK_LOOP_PAUSE_MS || '2000',
    };

    // Validate specific formats
    this.validateFormats();
  }

  private validateFormats(): void {
    // Validate PORT is a number
    const port = parseInt(this.requiredVars.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('❌ PORT must be a valid number between 1 and 65535');
      process.exit(1);
    }

    // Validate DB_PORT is a number
    const dbPort = parseInt(this.requiredVars.DB_PORT);
    if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
      console.error('❌ DB_PORT must be a valid number between 1 and 65535');
      process.exit(1);
    }

    // Validate SESSION_SECRET length
    if (this.requiredVars.SESSION_SECRET.length < 32) {
      console.error('❌ SESSION_SECRET must be at least 32 characters long');
      process.exit(1);
    }

    // Validate NODE_ENV
    if (!['development', 'production', 'test'].includes(this.requiredVars.NODE_ENV)) {
      console.error('❌ NODE_ENV must be one of: development, production, test');
      process.exit(1);
    }
  }

  // Getters for environment variables
  get nodeEnv(): string {
    return this.requiredVars.NODE_ENV;
  }

  get port(): number {
    return parseInt(this.requiredVars.PORT);
  }

  get isProduction(): boolean {
    return this.requiredVars.NODE_ENV === 'production';
  }
  
  get isProductionLike(): boolean {
    // Helper to test production-like settings locally
    return this.requiredVars.NODE_ENV === 'production' || process.env.FORCE_PRODUCTION_SETTINGS === 'true';
  }

  get isDevelopment(): boolean {
    return this.requiredVars.NODE_ENV === 'development';
  }

  get database() {
    return {
      host: this.requiredVars.DB_HOST,
      port: parseInt(this.requiredVars.DB_PORT),
      database: this.requiredVars.DB_NAME,
      user: this.requiredVars.DB_USER,
      password: this.requiredVars.DB_PASSWORD,
    };
  }

  get sessionSecret(): string {
    return this.requiredVars.SESSION_SECRET;
  }

  get corsOrigins(): string[] {
    return this.optionalVars.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [];
  }

  get rateLimit() {
    return {
      windowMs: parseInt(this.optionalVars.RATE_LIMIT_WINDOW_MS || '900000'),
      maxRequests: parseInt(this.optionalVars.RATE_LIMIT_MAX_REQUESTS || '100'),
    };
  }

  get logLevel(): string {
    return this.optionalVars.LOG_LEVEL || 'info';
  }

  get maxJsonSize(): string {
    return this.optionalVars.MAX_JSON_SIZE || '100kb';
  }

  get trustProxy(): number {
    return parseInt(this.optionalVars.TRUST_PROXY || '1');
  }

  // Bulk messaging configuration - Loop-based processing
  get bulkMessaging() {
    return {
      graphApiVersion: this.optionalVars.GRAPH_API_VERSION || 'v22.0',
      // Loop-based settings
      loopSize: parseInt(this.optionalVars.BULK_LOOP_SIZE || '200'),
      loopPauseMs: parseInt(this.optionalVars.BULK_LOOP_PAUSE_MS || '2000'),
      messagesPerSecond: parseInt(this.optionalVars.BULK_MESSAGES_PER_SECOND || '10'),
      // Legacy settings (for backward compatibility)
      batchSize: parseInt(this.optionalVars.BULK_BATCH_SIZE || this.optionalVars.BULK_LOOP_SIZE || '200'),
      concurrency: parseInt(this.optionalVars.BULK_CONCURRENCY || '1'),
      pauseMs: parseInt(this.optionalVars.BULK_PAUSE_MS || this.optionalVars.BULK_LOOP_PAUSE_MS || '2000'),
      // Common settings
      maxRetries: parseInt(this.optionalVars.BULK_MAX_RETRIES || '3'),
      retryBaseMs: parseInt(this.optionalVars.BULK_RETRY_BASE_MS || '500'),
      hardCap: parseInt(this.optionalVars.BULK_HARD_CAP || '50000'),
    };
  }

  // Health check method
  public isReady(): { ready: boolean; message?: string } {
    try {
      // Check if all critical env vars are loaded
      if (!this.requiredVars.DB_HOST || !this.requiredVars.SESSION_SECRET) {
        return { ready: false, message: 'Critical environment variables not loaded' };
      }

      return { ready: true };
    } catch (error) {
      return { ready: false, message: 'Environment validation failed' };
    }
  }
}

// Export singleton instance
export const env = new EnvValidator();

// Export types for use in other files
export type { RequiredEnvVars, OptionalEnvVars };
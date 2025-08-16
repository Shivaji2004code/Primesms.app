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
    GRAPH_API_VERSION?: string;
    BULK_LOOP_SIZE?: string;
    BULK_LOOP_PAUSE_MS?: string;
    BULK_MESSAGES_PER_SECOND?: string;
    BULK_MAX_RETRIES?: string;
    BULK_RETRY_BASE_MS?: string;
    BULK_HARD_CAP?: string;
    BULK_BATCH_SIZE?: string;
    BULK_CONCURRENCY?: string;
    BULK_PAUSE_MS?: string;
}
declare class EnvValidator {
    private requiredVars;
    private optionalVars;
    constructor();
    private validateAndLoadEnv;
    private validateFormats;
    get nodeEnv(): string;
    get port(): number;
    get isProduction(): boolean;
    get isProductionLike(): boolean;
    get isDevelopment(): boolean;
    get database(): {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    get sessionSecret(): string;
    get corsOrigins(): string[];
    get rateLimit(): {
        windowMs: number;
        maxRequests: number;
    };
    get logLevel(): string;
    get maxJsonSize(): string;
    get trustProxy(): number;
    get bulkMessaging(): {
        graphApiVersion: string;
        loopSize: number;
        loopPauseMs: number;
        messagesPerSecond: number;
        batchSize: number;
        concurrency: number;
        pauseMs: number;
        maxRetries: number;
        retryBaseMs: number;
        hardCap: number;
    };
    isReady(): {
        ready: boolean;
        message?: string;
    };
}
export declare const env: EnvValidator;
export type { RequiredEnvVars, OptionalEnvVars };
//# sourceMappingURL=env.d.ts.map
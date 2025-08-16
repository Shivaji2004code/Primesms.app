import { WhatsAppMessage, WhatsAppTemplate, BulkMessageVariables } from './waSender';
export type BulkMessage = WhatsAppMessage | WhatsAppTemplate;
export interface BulkJobInput {
    userId: string;
    campaignId?: string | null;
    recipients: string[];
    message: BulkMessage;
    variables?: BulkMessageVariables;
    recipientVariables?: Array<{
        recipient: string;
        variables: BulkMessageVariables;
    }>;
}
export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
export interface BulkJob {
    jobId: string;
    userId: string;
    campaignId?: string | null;
    totalRecipients: number;
    batchSize: number;
    totalBatches: number;
    createdAt: string;
    state: JobState;
    sent: number;
    failed: number;
    results: Array<{
        to: string;
        ok: boolean;
        messageId?: string | null;
        error?: any;
    }>;
}
export interface TenantCreds {
    phoneNumberId: string;
    accessToken: string;
}
export interface CredsProvider {
    getCredsByUserId(userId: string): Promise<TenantCreds>;
}
export interface CampaignLogsRepo {
    upsertOnSendAck(userId: string, messageId: string, to: string, campaignId?: string | null, meta?: any): Promise<void>;
    createCampaignLogEntry(userId: string, to: string, campaignId: string, templateName: string, phoneNumberId: string, language: string, variables?: any, components?: any): Promise<string>;
    updateCampaignLogStatus(logId: string, status: 'sent' | 'failed', messageId?: string, errorMessage?: string): Promise<void>;
}
export type SSEEmitter = (jobId: string, payload: any) => void;
export declare class BulkQueue {
    private creds;
    private logs;
    private emitSSE;
    private jobs;
    constructor(creds: CredsProvider, logs: CampaignLogsRepo, emitSSE: SSEEmitter);
    enqueue(input: BulkJobInput): BulkJob;
    getJob(jobId: string): BulkJob | null;
    private processJob;
    private processLoop;
    private sendSingleMessage;
}
//# sourceMappingURL=bulkQueue.d.ts.map
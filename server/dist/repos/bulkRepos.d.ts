import { CredsProvider, CampaignLogsRepo, TenantCreds } from '../services/bulkQueue';
export declare class UserBusinessRepo implements CredsProvider {
    getCredsByUserId(userId: string): Promise<TenantCreds>;
}
export declare class BulkCampaignLogsRepo implements CampaignLogsRepo {
    createCampaignLogEntry(userId: string, to: string, campaignId: string, templateName: string, phoneNumberId: string, language: string, variables?: any, components?: any): Promise<string>;
    updateCampaignLogStatus(logId: string, status: 'sent' | 'failed', messageId?: string, errorMessage?: string): Promise<void>;
    updateCampaignLogByMessageId(userId: string, messageId: string, status: 'sent' | 'delivered' | 'read' | 'failed', timestamp?: Date, errorMessage?: string): Promise<boolean>;
    upsertOnSendAck(userId: string, messageId: string, to: string, campaignId?: string | null, meta?: any): Promise<void>;
    private extractTemplateName;
}
export declare const userBusinessRepo: UserBusinessRepo;
export declare const bulkCampaignLogsRepo: BulkCampaignLogsRepo;
//# sourceMappingURL=bulkRepos.d.ts.map
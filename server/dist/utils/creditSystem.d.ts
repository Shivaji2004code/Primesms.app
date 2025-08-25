export declare const CREDIT_RATES: {
    readonly MARKETING: 0.8;
    readonly UTILITY: 0.15;
    readonly AUTHENTICATION: 0.15;
};
export type TemplateCategory = keyof typeof CREDIT_RATES;
export declare enum CreditTransactionType {
    DEDUCTION_QUICKSEND = "DEDUCTION_QUICKSEND",
    DEDUCTION_CUSTOMISE_SMS = "DEDUCTION_CUSTOMISE_SMS",
    DEDUCTION_API_DELIVERED = "DEDUCTION_API_DELIVERED",
    DEDUCTION_DUPLICATE_BLOCKED = "DEDUCTION_DUPLICATE_BLOCKED",
    ADMIN_ADD = "ADMIN_ADD",
    ADMIN_DEDUCT = "ADMIN_DEDUCT",
    REFUND = "REFUND"
}
interface CreditTransaction {
    userId: string;
    amount: number;
    transactionType: CreditTransactionType;
    templateCategory?: TemplateCategory;
    templateName?: string;
    messageId?: string;
    campaignId?: string;
    description?: string;
}
export declare function getCreditRate(category: TemplateCategory): number;
export declare function getPricingForUser(userId: number, category: 'marketing' | 'utility' | 'authentication'): Promise<number>;
export declare function checkSufficientCredits(userId: string, requiredAmount: number): Promise<{
    sufficient: boolean;
    currentBalance: number;
}>;
export declare function deductCredits(transaction: CreditTransaction): Promise<{
    success: boolean;
    newBalance: number;
    transactionId?: string;
}>;
export declare function addCredits(transaction: CreditTransaction): Promise<{
    success: boolean;
    newBalance: number;
    transactionId?: string;
}>;
export declare function getTemplateCategory(userId: string, templateName: string): Promise<TemplateCategory | null>;
export declare function calculateCreditCost(userId: string, templateName: string, messageCount?: number): Promise<{
    cost: number;
    category: TemplateCategory;
}>;
export declare function getCostPreview(userId: string, templateName: string, recipientCount?: number): Promise<{
    unitPrice: number;
    totalCost: number;
    currency: string;
    category: TemplateCategory;
    pricingMode: 'custom' | 'default';
}>;
export declare function getBulkCostPreview(userId: string, templateName: string, recipientsList: string[]): Promise<{
    unitPrice: number;
    totalCost: number;
    currency: string;
    category: TemplateCategory;
    pricingMode: 'custom' | 'default';
    recipientCount: number;
    breakdown: {
        validRecipients: number;
        invalidRecipients: number;
        duplicatesRemoved: number;
    };
}>;
export declare function preCheckCreditsForBulk(userId: string, templateName: string, messageCount: number): Promise<{
    sufficient: boolean;
    requiredCredits: number;
    currentBalance: number;
    category: TemplateCategory;
}>;
export {};
//# sourceMappingURL=creditSystem.d.ts.map
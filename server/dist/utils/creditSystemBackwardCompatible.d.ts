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
export declare function deductCredits(transaction: CreditTransaction): Promise<{
    success: boolean;
    newBalance: number;
    transactionId?: string;
}>;
export { getCreditRate, checkSufficientCredits, addCredits, getTemplateCategory, calculateCreditCost, preCheckCreditsForBulk } from './creditSystem';
//# sourceMappingURL=creditSystemBackwardCompatible.d.ts.map
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
interface ValidationSchemas {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
}
export declare const validateRequest: (schemas: ValidationSchemas) => (req: Request, res: Response, next: NextFunction) => void;
export declare const commonSchemas: {
    uuidParam: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    paginationQuery: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>, {
        page: number;
        limit: number;
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>, {
        page: number;
        limit: number;
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    email: z.ZodString;
    password: z.ZodString;
    username: z.ZodString;
    phoneNumber: z.ZodString;
    templateName: z.ZodString;
    templateCategory: z.ZodEnum<["UTILITY", "MARKETING", "AUTHENTICATION"]>;
    languageCode: z.ZodDefault<z.ZodString>;
    creditAmount: z.ZodNumber;
};
export declare const authSchemas: {
    login: z.ZodObject<{
        username: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        username: string;
    }, {
        password: string;
        username: string;
    }>;
    signup: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        username: z.ZodString;
        password: z.ZodString;
        phoneNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        password: string;
        username: string;
        name: string;
        email: string;
        phoneNumber?: string | undefined;
    }, {
        password: string;
        username: string;
        name: string;
        email: string;
        phoneNumber?: string | undefined;
    }>;
    updateProfile: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        email?: string | undefined;
    }, {
        name?: string | undefined;
        email?: string | undefined;
    }>;
    changePassword: z.ZodObject<{
        currentPassword: z.ZodString;
        newPassword: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        newPassword: string;
        currentPassword: string;
    }, {
        newPassword: string;
        currentPassword: string;
    }>;
};
export declare const templateSchemas: {
    create: z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["UTILITY", "MARKETING", "AUTHENTICATION"]>;
        language: z.ZodDefault<z.ZodString>;
        headerText: z.ZodOptional<z.ZodString>;
        bodyText: z.ZodString;
        footerText: z.ZodOptional<z.ZodString>;
        buttons: z.ZodOptional<z.ZodString>;
        variableExamples: z.ZodOptional<z.ZodString>;
        submit_to_whatsapp: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
        language: string;
        bodyText: string;
        submit_to_whatsapp: boolean;
        buttons?: string | undefined;
        headerText?: string | undefined;
        footerText?: string | undefined;
        variableExamples?: string | undefined;
    }, {
        name: string;
        category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
        bodyText: string;
        language?: string | undefined;
        buttons?: string | undefined;
        headerText?: string | undefined;
        footerText?: string | undefined;
        variableExamples?: string | undefined;
        submit_to_whatsapp?: boolean | undefined;
    }>;
    update: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["UTILITY", "MARKETING", "AUTHENTICATION"]>>;
        language: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        headerText: z.ZodOptional<z.ZodString>;
        bodyText: z.ZodOptional<z.ZodString>;
        footerText: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        category?: "UTILITY" | "MARKETING" | "AUTHENTICATION" | undefined;
        language?: string | undefined;
        headerText?: string | undefined;
        bodyText?: string | undefined;
        footerText?: string | undefined;
    }, {
        name?: string | undefined;
        category?: "UTILITY" | "MARKETING" | "AUTHENTICATION" | undefined;
        language?: string | undefined;
        headerText?: string | undefined;
        bodyText?: string | undefined;
        footerText?: string | undefined;
    }>;
    filter: z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<["DRAFT", "PENDING", "APPROVED", "REJECTED"]>>;
        category: z.ZodOptional<z.ZodEnum<["UTILITY", "MARKETING", "AUTHENTICATION"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | undefined;
        category?: "UTILITY" | "MARKETING" | "AUTHENTICATION" | undefined;
        language?: string | undefined;
    }, {
        status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | undefined;
        category?: "UTILITY" | "MARKETING" | "AUTHENTICATION" | undefined;
        language?: string | undefined;
    }>;
};
export declare const messageSchemas: {
    send: z.ZodObject<{
        templateName: z.ZodString;
        language: z.ZodDefault<z.ZodString>;
        phoneNumberId: z.ZodString;
        recipients: z.ZodArray<z.ZodObject<{
            number: z.ZodString;
            variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            number: string;
            variables?: Record<string, string> | undefined;
        }, {
            number: string;
            variables?: Record<string, string> | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        templateName: string;
        language: string;
        recipients: {
            number: string;
            variables?: Record<string, string> | undefined;
        }[];
        phoneNumberId: string;
    }, {
        templateName: string;
        recipients: {
            number: string;
            variables?: Record<string, string> | undefined;
        }[];
        phoneNumberId: string;
        language?: string | undefined;
    }>;
    quickSend: z.ZodObject<{
        templateName: z.ZodString;
        language: z.ZodDefault<z.ZodString>;
        phoneNumberId: z.ZodString;
        variableMapping: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        templateName: string;
        language: string;
        phoneNumberId: string;
        variableMapping?: string | undefined;
    }, {
        templateName: string;
        phoneNumberId: string;
        language?: string | undefined;
        variableMapping?: string | undefined;
    }>;
};
export declare const adminSchemas: {
    createUser: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        username: z.ZodString;
        password: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["user", "admin"]>>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        creditBalance: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        password: string;
        username: string;
        name: string;
        email: string;
        role: "user" | "admin";
        creditBalance: number;
        phoneNumber?: string | undefined;
    }, {
        password: string;
        username: string;
        name: string;
        email: string;
        phoneNumber?: string | undefined;
        role?: "user" | "admin" | undefined;
        creditBalance?: number | undefined;
    }>;
    updateUser: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodEnum<["user", "admin"]>>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        creditBalance: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        email?: string | undefined;
        phoneNumber?: string | undefined;
        role?: "user" | "admin" | undefined;
        creditBalance?: number | undefined;
    }, {
        name?: string | undefined;
        email?: string | undefined;
        phoneNumber?: string | undefined;
        role?: "user" | "admin" | undefined;
        creditBalance?: number | undefined;
    }>;
    creditOperation: z.ZodObject<{
        userId: z.ZodString;
        amount: z.ZodNumber;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
        amount: number;
        description: string;
    }, {
        userId: string;
        amount: number;
        description: string;
    }>;
};
export declare const createCustomValidator: (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validateRequest.d.ts.map
export interface User {
    id: string;
    name: string;
    email: string;
    username: string;
    password: string;
    phone_number?: string;
    role: 'user' | 'admin';
    credit_balance: number;
    created_at: Date;
    updated_at: Date;
}
export interface CreateUserRequest {
    name: string;
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
    phoneNumber?: string;
}
export interface LoginRequest {
    username: string;
    password: string;
}
export interface SessionUser {
    id: string;
    name: string;
    email: string;
    username: string;
    role: 'user' | 'admin';
}
export interface UserBusinessInfo {
    id: string;
    userId: string;
    businessName?: string;
    whatsappNumber?: string;
    whatsappNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    webhookUrl?: string;
    webhookVerifyToken?: string;
    isActive: boolean;
    appId?: string;
    appSecret?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserWithBusinessInfo extends User {
    businessInfo?: UserBusinessInfo;
}
export interface CreateBusinessInfoRequest {
    businessName?: string;
    whatsappNumber?: string;
    whatsappNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    webhookUrl?: string;
    webhookVerifyToken?: string;
    isActive?: boolean;
    appId?: string;
    appSecret?: string;
}
export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'PAUSED' | 'DISABLED';
export type QualityRating = 'HIGH' | 'MEDIUM' | 'LOW' | 'QUALITY_PENDING';
export type ComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'OTP' | 'CATALOG' | 'ORDER_DETAILS';
export interface TemplateParameter {
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: {
        fallback_value: string;
        code: string;
        amount_1000: number;
    };
    date_time?: {
        fallback_value: string;
    };
}
export interface TemplateExample {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
}
export interface TemplateButton {
    type: ButtonType;
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
    otp_type?: 'COPY_CODE' | 'ONE_TAP';
}
export interface TemplateComponent {
    type: ComponentType;
    format?: HeaderFormat;
    text?: string;
    parameters?: TemplateParameter[];
    example?: TemplateExample;
    buttons?: TemplateButton[];
    add_security_recommendation?: boolean;
    code_expiration_minutes?: number;
    media?: {
        id: string;
    };
    image?: {
        id: string;
    };
    video?: {
        id: string;
    };
    document?: {
        id: string;
    };
}
export interface Template {
    id: string;
    user_id: string;
    name: string;
    category: TemplateCategory;
    language: string;
    status: TemplateStatus;
    components: TemplateComponent[];
    template_id?: string;
    message_send_ttl_seconds?: number;
    allow_category_change?: boolean;
    quality_rating?: QualityRating;
    whatsapp_response?: any;
    rejection_reason?: string;
    created_at: Date;
    updated_at: Date;
}
export interface CreateTemplateRequest {
    name: string;
    category: TemplateCategory;
    language?: string;
    components: TemplateComponent[];
    message_send_ttl_seconds?: number;
    allow_category_change?: boolean;
    submit_to_whatsapp?: boolean;
}
export interface UpdateTemplateRequest {
    name?: string;
    category?: TemplateCategory;
    language?: string;
    components?: TemplateComponent[];
    message_send_ttl_seconds?: number;
    allow_category_change?: boolean;
}
export interface WhatsAppTemplateResponse {
    id: string;
    status: string;
    category: string;
    name: string;
    language: string;
    quality_score?: {
        score: string;
        reasons?: string[];
    };
}
export interface TemplateVariable {
    name: string;
    example: string;
    description?: string;
}
declare module 'express-session' {
    interface SessionData {
        user?: SessionUser;
    }
}
//# sourceMappingURL=index.d.ts.map
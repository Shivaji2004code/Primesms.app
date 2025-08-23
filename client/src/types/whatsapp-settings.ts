// WhatsApp Settings Types - 360dialog Migration
import { z } from 'zod';

// Provider type - standardizing on 360dialog
export type WabaProvider = "360dialog";

// View model for the admin settings form
export interface WhatsAppSettingsViewModel {
  userId: string;
  businessName: string;
  whatsappNumber: string;
  provider: WabaProvider;         // always "360dialog" in UI now
  channelId: string | null;       // null if not set
  apiKeySet: boolean;             // true if encrypted key exists in DB
  webhookUrl: string;             // read-only, provided by app
  updatedAt: string;              // ISO timestamp
}

// Input payload for saving settings
export interface SaveWhatsAppSettingsInput {
  channelId: string;              // required
  apiKey?: string;                // optional; if present, replace stored secret
  providerMeta?: Record<string, unknown> | null; // optional future settings
}

// Response from save operation
export interface SaveWhatsAppSettingsResponse {
  success: true;
  updatedAt: string;
  apiKeySet: boolean;
}

// Zod validation schemas
export const saveWhatsAppSettingsSchema = z.object({
  channelId: z
    .string()
    .min(2, "Channel ID must be at least 2 characters")
    .max(128, "Channel ID must be less than 128 characters")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Channel ID can only contain letters, numbers, dots, underscores, and hyphens"
    )
    .transform((val) => val.trim()),
  
  apiKey: z
    .string()
    .optional()
    .refine((val) => {
      // Only validate if apiKey is provided (for replacement)
      if (!val) return true;
      return val.length >= 10 && val.length <= 4096;
    }, "API Key must be between 10 and 4096 characters")
    .refine((val) => {
      // Check for leading/trailing spaces only if provided
      if (!val) return true;
      return val === val.trim();
    }, "API Key cannot have leading or trailing spaces"),
  
  providerMeta: z.record(z.unknown()).nullable().optional()
});

// Form validation schema (for React Hook Form)
export const whatsAppSettingsFormSchema = z.object({
  channelId: z
    .string()
    .min(1, "Channel ID is required")
    .min(2, "Channel ID must be at least 2 characters")
    .max(128, "Channel ID must be less than 128 characters")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Channel ID can only contain letters, numbers, dots, underscores, and hyphens"
    )
    .transform((val) => val.trim()),
  
  apiKey: z
    .string()
    .optional()
    .refine((val) => {
      // API key is only required if the user is typing something
      if (!val || val.length === 0) return true;
      return val.length >= 10 && val.length <= 4096;
    }, "API Key must be between 10 and 4096 characters when provided")
    .refine((val) => {
      if (!val) return true;
      return val === val.trim();
    }, "API Key cannot have leading or trailing spaces")
});

// Form data type
export type WhatsAppSettingsFormData = z.infer<typeof whatsAppSettingsFormSchema>;

// Component props interface
export interface UserWhatsAppSettingsFormProps {
  initialData: WhatsAppSettingsViewModel;
  onSave: (data: SaveWhatsAppSettingsInput) => Promise<SaveWhatsAppSettingsResponse>;
  onCancel?: () => void;
  loading?: boolean;
}

// Error types for better error handling
export interface WhatsAppSettingsError {
  field?: 'channelId' | 'apiKey' | 'general';
  message: string;
  code?: string;
}

// Utility type for form state
export interface FormState {
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  showApiKeyReveal: boolean;
}
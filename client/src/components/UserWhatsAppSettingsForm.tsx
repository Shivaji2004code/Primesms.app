// User WhatsApp Settings Form - 360dialog Migration
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  WhatsAppSettingsFormData,
  UserWhatsAppSettingsFormProps,
  whatsAppSettingsFormSchema,
  SaveWhatsAppSettingsInput,
  WhatsAppSettingsError
} from '../types/whatsapp-settings';
import { usePressHoldReveal, getSecretDisplayValue } from '../utils/press-hold-reveal';
import { useToast } from './ui/use-toast';

// UI Components - using existing UI components or fallback to Tailwind
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AlertCircle, Eye, EyeOff, Copy, Check } from 'lucide-react';

/**
 * 360dialog WhatsApp Business Settings Form
 * 
 * Replaces legacy Meta fields (Phone Number ID, WABA ID, Access Token) 
 * with 360dialog Channel ID and API Key
 */
const UserWhatsAppSettingsForm: React.FC<UserWhatsAppSettingsFormProps> = ({
  initialData,
  onSave,
  onCancel,
  loading: externalLoading = false
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(initialData.updatedAt);
  const [apiKeySetStatus, setApiKeySetStatus] = useState(initialData.apiKeySet);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Form setup with React Hook Form + Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    reset,
    watch,
    setValue,
    getValues
  } = useForm<WhatsAppSettingsFormData>({
    resolver: zodResolver(whatsAppSettingsFormSchema),
    defaultValues: {
      channelId: initialData.channelId || '',
      apiKey: '' // Always start empty for write-only behavior
    },
    mode: 'onChange'
  });

  const currentApiKeyValue = watch('apiKey');
  
  // Press-and-hold reveal for the current API key input (not stored key)
  const [revealState, revealHandlers] = usePressHoldReveal(currentApiKeyValue, {
    holdDurationMs: 800
  });

  // Update form when initialData changes
  useEffect(() => {
    reset({
      channelId: initialData.channelId || '',
      apiKey: ''
    });
    setLastUpdated(initialData.updatedAt);
    setApiKeySetStatus(initialData.apiKeySet);
  }, [initialData, reset]);

  // Handle form submission
  const onSubmit = async (data: WhatsAppSettingsFormData) => {
    try {
      setIsSubmitting(true);

      const payload: SaveWhatsAppSettingsInput = {
        channelId: data.channelId
      };

      // Only include apiKey if the user typed something
      if (data.apiKey && data.apiKey.trim().length > 0) {
        payload.apiKey = data.apiKey.trim();
      }

      const response = await onSave(payload);

      if (response.success) {
        // Update local state with response
        setLastUpdated(response.updatedAt);
        setApiKeySetStatus(response.apiKeySet);
        
        // Clear the API key input (write-only behavior)
        setValue('apiKey', '');
        
        // Show success toast
        toast({
          title: "Settings saved successfully",
          description: "Your 360dialog WhatsApp settings have been updated.",
          variant: "default"
        });

        // Reset form dirty state
        reset({
          channelId: data.channelId,
          apiKey: ''
        });
      }
    } catch (error: any) {
      console.error('Failed to save WhatsApp settings:', error);
      
      // Parse error for user-friendly message
      let errorMessage = 'Failed to save settings. Please try again.';
      let errorTitle = 'Save Failed';
      
      if (error?.message) {
        errorMessage = error.message;
      }
      
      if (error?.field) {
        errorTitle = `Invalid ${error.field}`;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reset/cancel
  const handleReset = () => {
    reset({
      channelId: initialData.channelId || '',
      apiKey: ''
    });
    onCancel?.();
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(initialData.webhookUrl);
      setCopiedToClipboard(true);
      toast({
        title: "Copied to clipboard",
        description: "Webhook URL copied successfully.",
        variant: "default"
      });
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const isLoading = isSubmitting || externalLoading;
  const canSubmit = isDirty && isValid && !isLoading;
  const canReset = isDirty && !isLoading;

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            WhatsApp Business Settings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure your 360dialog integration for WhatsApp messaging
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Read-only Business Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Business Name
              </Label>
              <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                {initialData.businessName}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                WhatsApp Number
              </Label>
              <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                {initialData.whatsappNumber}
              </div>
            </div>
          </div>

          {/* 360dialog Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              360dialog Configuration
            </h3>

            {/* Channel ID */}
            <div>
              <Label htmlFor="channelId" className="text-sm font-medium text-gray-700">
                Channel ID *
              </Label>
              <Input
                {...register('channelId')}
                id="channelId"
                type="text"
                autoComplete="off"
                placeholder="your-channel-id"
                className={`mt-1 ${errors.channelId ? 'border-red-500 focus:border-red-500' : ''}`}
                aria-invalid={errors.channelId ? 'true' : 'false'}
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-600">
                Your 360dialog Channel ID (per-number identifier).
              </p>
              {errors.channelId && (
                <div className="flex items-center gap-1 mt-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-xs">{errors.channelId.message}</span>
                </div>
              )}
            </div>

            {/* API Key */}
            <div>
              <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                API Key
                {apiKeySetStatus && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    API key set
                  </Badge>
                )}
              </Label>
              
              <div className="relative">
                <Input
                  {...register('apiKey')}
                  id="apiKey"
                  type={revealState.isRevealed ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={apiKeySetStatus ? "Enter new API key to replace" : "Enter your 360dialog API key"}
                  className={`mt-1 pr-10 ${errors.apiKey ? 'border-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.apiKey ? 'true' : 'false'}
                  disabled={isLoading}
                />
                
                {/* Reveal button for current input */}
                {currentApiKeyValue && currentApiKeyValue.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    {...revealHandlers}
                    aria-label="Press and hold to reveal API key"
                  >
                    {revealState.isRevealed ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              <p className="mt-1 text-xs text-gray-600">
                Generated in 360dialog dashboard. Write-only; not displayed after saving.
              </p>
              
              {revealState.isHolding && (
                <p className="mt-1 text-xs text-blue-600">
                  Hold to reveal current input...
                </p>
              )}
              
              {errors.apiKey && (
                <div className="flex items-center gap-1 mt-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-xs">{errors.apiKey.message}</span>
                </div>
              )}
            </div>

            {/* Webhook URL (Read-only) */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Webhook URL
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900 font-mono overflow-hidden">
                  {initialData.webhookUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyWebhookUrl}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  {copiedToClipboard ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Use this URL when configuring your 360dialog webhook.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={!canReset}
            >
              {onCancel ? 'Cancel' : 'Reset'}
            </Button>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </form>

        {/* Provider Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                360dialog Integration
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                <p>
                  Prime SMS now uses 360dialog as the WhatsApp Business API provider. 
                  Your Channel ID and API Key can be found in your 360dialog dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UserWhatsAppSettingsForm;
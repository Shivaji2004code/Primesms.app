// WhatsApp 360dialog Settings - Admin Integration Wrapper
import React, { useState, useEffect } from 'react';
import UserWhatsAppSettingsForm from './UserWhatsAppSettingsForm';
import { WhatsAppSettingsViewModel, SaveWhatsAppSettingsInput, SaveWhatsAppSettingsResponse } from '../types/whatsapp-settings';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WhatsApp360DialogSettingsProps {
  userId: string;
}

/**
 * Admin wrapper component for 360dialog WhatsApp settings
 * Fetches data from admin API and saves directly to database
 */
export default function WhatsApp360DialogSettings({ userId }: WhatsApp360DialogSettingsProps) {
  const [initialData, setInitialData] = useState<WhatsAppSettingsViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's 360dialog settings from admin API
  const fetchSettings = async () => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/whatsapp/settings/${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch settings`);
      }

      const data = await response.json();
      
      // Transform API response to component format
      const viewModel: WhatsAppSettingsViewModel = {
        userId: data.userId,
        businessName: data.businessName || 'Not Set',
        whatsappNumber: data.whatsappNumber || 'Not Configured',
        provider: '360dialog',
        channelId: data.channelId,
        apiKeySet: data.apiKeySet || false,
        webhookUrl: data.webhookUrl || '',
        updatedAt: data.updatedAt || new Date().toISOString()
      };

      setInitialData(viewModel);

    } catch (err) {
      console.error('Failed to fetch 360dialog settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      
      // Create default data if fetch fails (for new users)
      const defaultData: WhatsAppSettingsViewModel = {
        userId,
        businessName: 'Not Set',
        whatsappNumber: 'Not Configured',
        provider: '360dialog',
        channelId: null,
        apiKeySet: false,
        webhookUrl: '',
        updatedAt: new Date().toISOString()
      };
      setInitialData(defaultData);
    } finally {
      setLoading(false);
    }
  };

  // Save settings to database via admin API
  const handleSave = async (data: SaveWhatsAppSettingsInput): Promise<SaveWhatsAppSettingsResponse> => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      console.log(`Saving 360dialog settings for user ${userId}:`, data);

      const response = await fetch(`/api/admin/whatsapp/settings/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to save settings`);
      }

      const result = await response.json();
      
      console.log(`360dialog settings saved successfully for user ${userId}:`, result);

      // Update local data with the response
      if (initialData) {
        setInitialData(prev => prev ? {
          ...prev,
          channelId: data.channelId,
          apiKeySet: result.apiKeySet,
          updatedAt: result.updatedAt
        } : prev);
      }

      return {
        success: true,
        updatedAt: result.updatedAt,
        apiKeySet: result.apiKeySet
      };

    } catch (err) {
      console.error('Failed to save 360dialog settings:', err);
      throw err;
    }
  };

  // Load settings on component mount and userId change
  useEffect(() => {
    fetchSettings();
  }, [userId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading 360dialog settings...</p>
        </div>
      </div>
    );
  }

  // Error state (still show form with retry option)
  if (error && !initialData) {
    return (
      <div className="text-center py-12">
        <div className="flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Settings</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchSettings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show warning if there was an error but we have default data
  if (error && initialData) {
    console.warn('Using default data due to fetch error:', error);
  }

  // Main form
  if (!initialData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No settings data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show warning if we're using default data */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Warning</p>
              <p className="text-yellow-700">
                Could not load existing settings. Using defaults. Changes will still be saved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 360dialog Settings Form */}
      <UserWhatsAppSettingsForm
        initialData={initialData}
        onSave={handleSave}
        onCancel={() => {
          // Refresh data on cancel
          fetchSettings();
        }}
      />

      {/* Additional Admin Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Admin Notes</h3>
            <div className="mt-1 text-sm text-blue-700 space-y-1">
              <p>• Settings are saved directly to the database</p>
              <p>• API keys are stored as plaintext for easy retrieval</p>
              <p>• User will need to register their webhook with 360dialog</p>
              <p>• Channel ID should be obtained from 360dialog dashboard</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
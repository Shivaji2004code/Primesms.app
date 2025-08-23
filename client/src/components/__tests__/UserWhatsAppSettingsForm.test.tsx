// UserWhatsAppSettingsForm Tests
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import UserWhatsAppSettingsForm from '../UserWhatsAppSettingsForm';
import { WhatsAppSettingsViewModel, SaveWhatsAppSettingsResponse } from '../../types/whatsapp-settings';

// Mock the hooks
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock UI components
vi.mock('../ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('../ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

vi.mock('../ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

vi.mock('../ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>
}));

vi.mock('../ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>
}));

// Mock lucide icons
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-circle" />,
  Eye: () => <div data-testid="eye" />,
  EyeOff: () => <div data-testid="eye-off" />,
  Copy: () => <div data-testid="copy" />,
  Check: () => <div data-testid="check" />
}));

// Test data
const mockInitialData: WhatsAppSettingsViewModel = {
  userId: 'user-123',
  businessName: 'Test Business',
  whatsappNumber: '+1234567890',
  provider: '360dialog',
  channelId: 'test-channel-id',
  apiKeySet: true,
  webhookUrl: 'https://example.com/webhooks/360dialog',
  updatedAt: '2025-08-23T10:00:00Z'
};

const mockInitialDataNoApiKey: WhatsAppSettingsViewModel = {
  ...mockInitialData,
  channelId: null,
  apiKeySet: false
};

describe('UserWhatsAppSettingsForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with initial data correctly', () => {
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Check read-only fields
    expect(screen.getByText('Test Business')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    
    // Check form fields
    expect(screen.getByDisplayValue('test-channel-id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter new API key to replace/)).toBeInTheDocument();
    
    // Check API key badge
    expect(screen.getByText('API key set')).toBeInTheDocument();
    
    // Check webhook URL
    expect(screen.getByDisplayValue('https://example.com/webhooks/360dialog')).toBeInTheDocument();
  });

  it('shows placeholder when no API key is set', () => {
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialDataNoApiKey}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByPlaceholderText(/Enter your 360dialog API key/)).toBeInTheDocument();
    expect(screen.queryByText('API key set')).not.toBeInTheDocument();
  });

  it('validates channel ID correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialDataNoApiKey}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    
    // Test empty channel ID
    await user.clear(channelIdInput);
    await user.tab(); // Trigger validation
    
    await waitFor(() => {
      expect(screen.getByText(/Channel ID is required/)).toBeInTheDocument();
    });

    // Test invalid characters
    await user.type(channelIdInput, 'invalid@channel!');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.getByText(/can only contain letters, numbers, dots, underscores, and hyphens/)).toBeInTheDocument();
    });

    // Test valid channel ID
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'valid-channel_123.test');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.queryByText(/can only contain letters/)).not.toBeInTheDocument();
    });
  });

  it('validates API key when provided', async () => {
    const user = userEvent.setup();
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialDataNoApiKey}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const apiKeyInput = screen.getByLabelText(/API Key/);
    
    // API key is optional, so empty should be valid
    expect(screen.queryByText(/API Key must be between/)).not.toBeInTheDocument();

    // Test too short API key
    await user.type(apiKeyInput, 'short');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.getByText(/API Key must be between 10 and 4096 characters/)).toBeInTheDocument();
    });

    // Test valid API key
    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'valid-api-key-1234567890');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.queryByText(/API Key must be between/)).not.toBeInTheDocument();
    });
  });

  it('disables submit button when form is invalid or pristine', async () => {
    const user = userEvent.setup();
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Save Settings/ });
    const channelIdInput = screen.getByLabelText(/Channel ID/);
    
    // Initially pristine - submit should be disabled
    expect(submitButton).toBeDisabled();
    
    // Make form dirty but invalid
    await user.clear(channelIdInput);
    await user.tab();
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
    
    // Make form dirty and valid
    await user.type(channelIdInput, 'new-channel-id');
    
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('calls onSave with correct payload', async () => {
    const user = userEvent.setup();
    const mockResponse: SaveWhatsAppSettingsResponse = {
      success: true,
      updatedAt: '2025-08-23T11:00:00Z',
      apiKeySet: true
    };
    
    mockOnSave.mockResolvedValue(mockResponse);
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    const apiKeyInput = screen.getByLabelText(/API Key/);
    const submitButton = screen.getByRole('button', { name: /Save Settings/ });
    
    // Modify both fields
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'updated-channel');
    await user.type(apiKeyInput, 'new-api-key-1234567890');
    
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        channelId: 'updated-channel',
        apiKey: 'new-api-key-1234567890'
      });
    });
  });

  it('clears API key input after successful save', async () => {
    const user = userEvent.setup();
    const mockResponse: SaveWhatsAppSettingsResponse = {
      success: true,
      updatedAt: '2025-08-23T11:00:00Z',
      apiKeySet: true
    };
    
    mockOnSave.mockResolvedValue(mockResponse);
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    const apiKeyInput = screen.getByLabelText(/API Key/);
    const submitButton = screen.getByRole('button', { name: /Save Settings/ });
    
    // Add API key
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'updated-channel');
    await user.type(apiKeyInput, 'new-api-key-1234567890');
    
    expect(apiKeyInput).toHaveValue('new-api-key-1234567890');
    
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(apiKeyInput).toHaveValue(''); // Should be cleared after save
    });
  });

  it('does not include API key in payload when empty', async () => {
    const user = userEvent.setup();
    const mockResponse: SaveWhatsAppSettingsResponse = {
      success: true,
      updatedAt: '2025-08-23T11:00:00Z',
      apiKeySet: false
    };
    
    mockOnSave.mockResolvedValue(mockResponse);
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    const submitButton = screen.getByRole('button', { name: /Save Settings/ });
    
    // Only modify channel ID, leave API key empty
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'updated-channel');
    
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        channelId: 'updated-channel'
        // No apiKey property should be included
      });
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: SaveWhatsAppSettingsResponse) => void;
    
    const mockPromise = new Promise<SaveWhatsAppSettingsResponse>((resolve) => {
      resolvePromise = resolve;
    });
    
    mockOnSave.mockReturnValue(mockPromise);
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    const submitButton = screen.getByRole('button', { name: /Save Settings/ });
    
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'updated-channel');
    await user.click(submitButton);
    
    // Should show loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    
    // Resolve the promise
    resolvePromise!({
      success: true,
      updatedAt: '2025-08-23T11:00:00Z',
      apiKeySet: false
    });
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
      expect(submitButton).toBeDisabled(); // Should be disabled again (pristine)
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const channelIdInput = screen.getByLabelText(/Channel ID/);
    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    
    // Make form dirty
    await user.clear(channelIdInput);
    await user.type(channelIdInput, 'changed-channel');
    
    await user.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
    
    // Form should be reset
    expect(channelIdInput).toHaveValue('test-channel-id');
  });

  it('copies webhook URL to clipboard', async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    });
    
    render(
      <UserWhatsAppSettingsForm
        initialData={mockInitialData}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const copyButton = screen.getByRole('button', { name: /Copy/ });
    await user.click(copyButton);
    
    expect(mockWriteText).toHaveBeenCalledWith('https://example.com/webhooks/360dialog');
  });
});
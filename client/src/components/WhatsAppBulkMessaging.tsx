import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus,
  Trash2,
  FileText,
  Phone,
  Globe,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  Sparkles,
  Target,
  MessageSquare,
  Settings,
  Info,
  RefreshCw,
  Copy,
  DollarSign,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { useStore } from '../store/useStore';
import { useNotifier } from '../contexts/NotificationContext';
import { apiRequest } from '../lib/api';

interface WhatsAppNumber {
  id: string;
  phone_number_id: string;
  phone_number: string;
  display_name: string;
  label: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  hasVariables: boolean;
  hasButtons: boolean;
}

interface TemplateVariable {
  index: number;
  component: string;
  placeholder: string;
  required: boolean;
  type?: string;
}

interface TemplateButton {
  index: number;
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

interface Language {
  code: string;
  name: string;
}

interface ImportResult {
  valid_numbers: string[];
  invalid_numbers: string[];
  total_processed: number;
  valid_count: number;
  invalid_count: number;
}


// Pricing constants
const PRICING = {
  MARKETING: 0.80,
  UTILITY: 0.15,
  AUTHENTICATION: 0.15,
};

export default function WhatsAppBulkMessaging() {
  const notifier = useNotifier();
  
  // Form state
  const [selectedNumber, setSelectedNumber] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en_US');
  const [campaignName, setCampaignName] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templatePreview, setTemplatePreview] = useState<string>('');
  const [campaignPreview, setCampaignPreview] = useState<any>(null);
  
  // Pricing modal state
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [calculatedCost, setCalculatedCost] = useState<number>(0);
  
  // Excel import state (for future customize feature)
  
  // Image upload state for template headers
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  
  // Recipients selection state
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
  
  // Data state
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [templateDetails, setTemplateDetails] = useState<{
    variables: TemplateVariable[];
    buttons: TemplateButton[];
    hasVariables: boolean;
    hasButtons: boolean;
    templateTypeInfo?: {
      hasStaticImage: boolean;
      hasDynamicImage: boolean;
      hasVideo: boolean;
      hasDocument: boolean;
    };
  }>({
    variables: [],
    buttons: [],
    hasVariables: false,
    hasButtons: false
  });
  
  // Loading states
  const [loading, setLoading] = useState({
    numbers: false,
    templates: false,
    languages: false,
    preview: false,
    sending: false,
  });
  
  // Alert state
  const [alertState, setAlertState] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Form progress tracking
  const totalSteps = 4;

  // Load initial data
  useEffect(() => {
    fetchWhatsAppNumbers();
    fetchLanguages();
  }, []);

  // Clear recipient selection when recipients array changes
  useEffect(() => {
    setSelectedRecipients([]);
  }, [recipients]);

  // Load templates when language changes
  useEffect(() => {
    if (selectedLanguage) {
      fetchTemplates();
    }
  }, [selectedLanguage]);

  // Load template details when template or language changes
  useEffect(() => {
    if (selectedTemplate && selectedLanguage) {
      fetchTemplateDetails();
    }
  }, [selectedTemplate, selectedLanguage]);

  // Data URLs don't need cleanup like blob URLs

  // Calculate form completion percentage
  const getFormProgress = () => {
    let completed = 0;
    if (selectedNumber) completed++;
    if (selectedTemplate) completed++;
    if (recipients && recipients.length > 0) completed++;
    if (templateDetails.hasVariables ? Object.keys(templateVariables).length === templateDetails.variables.length : true) completed++;
    return (completed / totalSteps) * 100;
  };

  const getStepStatus = (step: number) => {
    if (step === 1) return selectedNumber ? 'completed' : 'current';
    if (step === 2) return selectedTemplate ? 'completed' : selectedNumber ? 'current' : 'pending';
    if (step === 3) return recipients && recipients.length > 0 ? 'completed' : selectedTemplate ? 'current' : 'pending';
    if (step === 4) return templateDetails.hasVariables ? Object.keys(templateVariables).length === templateDetails.variables.length : true ? 'completed' : recipients && recipients.length > 0 ? 'current' : 'pending';
    return 'pending';
  };

  const fetchWhatsAppNumbers = async () => {
    setLoading(prev => ({ ...prev, numbers: true }));
    try {
      const response = await apiRequest('/api/whatsapp/numbers');
      
      if (response.ok) {
        const data = await response.json();
        setWhatsappNumbers(data.data || []);
      } else {
        console.error('Failed to load WhatsApp numbers:', response.status);
        notifier.error('Error loading WhatsApp numbers. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching WhatsApp numbers:', error);
      notifier.error('Connection error. Please check your connection and try again.');
    } finally {
      setLoading(prev => ({ ...prev, numbers: false }));
    }
  };

  const fetchLanguages = async () => {
    setLoading(prev => ({ ...prev, languages: true }));
    try {
      const response = await fetch('/api/whatsapp/languages', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLanguages(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
    } finally {
      setLoading(prev => ({ ...prev, languages: false }));
    }
  };

  const fetchTemplates = async () => {
    setLoading(prev => ({ ...prev, templates: true }));
    try {
      const response = await fetch(`/api/whatsapp/templates?language=${selectedLanguage}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(prev => ({ ...prev, templates: false }));
    }
  };

  const fetchTemplateDetails = async () => {
    if (!selectedTemplate) return;
    
    try {
      console.log('Fetching template details for:', selectedTemplate);
      
      // Use the correct endpoint
      const response = await fetch(`/api/whatsapp/template-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          template_name: selectedTemplate,
          language: selectedLanguage || 'en_US'
        })
      });
      
      console.log('Template details response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Template details data:', data);
        setTemplateDetails(data.data);
        setTemplatePreview(data.data.preview || '');
      } else {
        console.error('Failed to fetch template details:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching template details:', error);
    }
  };

  // Handle header image upload
  const handleHeaderImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'Invalid file type',
        message: 'Please upload a JPG or PNG image file.'
      });
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'File too large',
        message: 'Please upload an image smaller than 5MB.'
      });
      return;
    }

    setHeaderImage(file);
    
    // Create preview using FileReader to avoid CSP blob URL issues
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreviewUrl(dataUrl);
      console.log('🖼️ Image uploaded:', file.name, 'Preview URL type:', dataUrl?.substring(0, 30) + '...');
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedExtensions = ['.txt', '.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'Invalid file type',
        message: `Please upload a supported file type: ${allowedExtensions.join(', ')}`
      });
      return;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'File too large',
        message: 'File size must be less than 10MB'
      });
      return;
    }

    // For Excel files in Quick-Send: automatically import from first column only
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      try {
        console.log('Importing Excel file for Quick-Send (first column only):', file.name);
        
        // Quick-Send: Import directly from first column, no column selection needed
        await importRecipientsFromFile(file);
      } catch (error) {
        console.error('Error importing Excel file:', error);
        setAlertState({
          show: true,
          type: 'error',
          title: 'Import failed',
          message: error instanceof Error ? error.message : 'Please check your Excel file format'
        });
      }
    } else {
      // For CSV/TXT files, use simple client-side import
      handleSimpleFileImport(file);
    }
    
    // Reset the file input
    event.target.value = '';
  };

  const importRecipientsFromFile = async (file: File) => {
    try {
      console.log('Importing recipients from file:', file.name);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/whatsapp/import-bulk-recipients', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Import response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Import response data:', result);
        
        // Handle the nested data structure from backend
        const data = result.data || result;
        
        if (data.valid_numbers && data.valid_numbers.length > 0) {
          // Put numbers in manual entry field line by line
          const numbersText = data.valid_numbers.join('\n');
          console.log('Setting manual recipients:', numbersText);
          setManualRecipients(numbersText);
          
          setAlertState({
            show: true,
            type: 'success',
            title: 'Numbers imported to manual entry',
            message: `Imported ${data.valid_count} numbers from first column to manual entry field${data.invalid_count > 0 ? `. ${data.invalid_count} invalid numbers skipped` : ''}. Ready to send!`
          });
        } else {
          setAlertState({
            show: true,
            type: 'warning',
            title: 'No valid numbers found',
            message: 'Please check your file format. Excel files should have phone numbers in the first column.'
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Import failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error importing recipients:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'Please check your file format and try again'
      });
    }
  };


  // Simple CSV file reader for client-side processing
  const handleSimpleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      // Simple parsing for CSV/TXT files
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length === 0) {
        setAlertState({
          show: true,
          type: 'warning',
          title: 'Empty file',
          message: 'The file appears to be empty or contains no valid data.'
        });
        return;
      }
      
      // Join all lines and put in manual entry field
      setManualRecipients(lines.join('\n'));
      
      setAlertState({
        show: true,
        type: 'success',
        title: 'File imported successfully',
        message: `Imported ${lines.length} entries to manual entry field. Review and edit as needed.`
      });
    };
    
    reader.onerror = () => {
      setAlertState({
        show: true,
        type: 'error',
        title: 'File read error',
        message: 'Failed to read the file. Please try again.'
      });
    };
    
    reader.readAsText(file);
  };

  const handleManualRecipientsChange = (value: string) => {
    setManualRecipients(value);
    
    // Auto-add recipients as they're typed/pasted
    if (value.trim()) {
      const numbers = value
        .split(/[,\n]/)
        .map(num => num.trim())
        .filter(num => num.length > 0);
      
      // Update recipients list in real-time
      const newRecipients = [...new Set([...numbers])];
      setRecipients(newRecipients);
    } else {
      setRecipients([]);
    }
  };

  const handleVariableChange = (index: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [index]: value
    }));
  };

  // Auto-generate preview when template and recipients are available
  useEffect(() => {
    if (selectedTemplate && recipients.length > 0) {
      // Auto-generate simple preview for first 3 recipients
      const previewData = recipients.slice(0, 3).map((recipient, index) => ({
        phone: recipient,
        recipient: recipient,
        variables: templateVariables,
        preview: generateLivePreview(),
        message: generateLivePreview()
      }));
      setCampaignPreview(previewData);
    } else {
      setCampaignPreview(null);
    }
  }, [selectedTemplate, recipients, templateVariables, templatePreview]);

  const handleQuickSend = async () => {
    if (!selectedNumber || !selectedTemplate || recipients.length === 0) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'Missing information',
        message: 'Please fill in all required fields'
      });
      return;
    }

    // Check if template requires image but no image uploaded
    if (templateDetails.templateTypeInfo?.hasStaticImage && !headerImage) {
      setAlertState({
        show: true,
        type: 'error',
        title: 'Image required',
        message: 'This template requires an image header. Please upload an image.'
      });
      return;
    }

    // Calculate cost and show pricing modal
    const cost = calculateCampaignCost();
    setCalculatedCost(cost);
    setShowPricingModal(true);
  };

  const confirmAndSend = async () => {
    setShowPricingModal(false);

    // Check if we should use bulk messaging (more than 50 recipients)
    if (recipients.length > 50) {
      return handleBulkQuickSend();
    }

    setLoading(prev => ({ ...prev, sending: true }));
    try {
      // Use FormData when image is present, otherwise use JSON
      let response;
      
      if (headerImage) {
        // Use FormData for image upload
        const formData = new FormData();
        formData.append('phone_number_id', selectedNumber);
        formData.append('template_name', selectedTemplate);
        formData.append('language', selectedLanguage);
        formData.append('recipients_text', recipients.join('\n'));
        formData.append('variables', JSON.stringify(templateVariables));
        formData.append('campaign_name', campaignName || `Quick Send - ${selectedTemplate} - ${new Date().toISOString()}`);
        formData.append('headerImage', headerImage);

        response = await fetch('/api/whatsapp/quick-send', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      } else {
        // Use JSON for text-only templates
        const payload = {
          phone_number_id: selectedNumber,
          template_name: selectedTemplate,
          language: selectedLanguage,
          recipients_text: recipients.join('\n'),
          variables: templateVariables,
          campaign_name: campaignName || `Quick Send - ${selectedTemplate} - ${new Date().toISOString()}`
        };

        response = await fetch('/api/whatsapp/quick-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        await response.json();
        
        setAlertState({
          show: true,
          type: 'success',
          title: 'Campaign started successfully',
          message: `Sending ${recipients.length} messages. You can track progress in the reports section.`
        });
        
        // Reset form
        resetForm();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Send failed');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: 'Send failed',
        message: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setLoading(prev => ({ ...prev, sending: false }));
    }
  };

  const handleBulkQuickSend = async () => {
    setLoading(prev => ({ ...prev, sending: true }));
    try {
      const payload = {
        phone_number_id: selectedNumber,
        template_name: selectedTemplate,
        language: selectedLanguage,
        recipients_text: recipients.join('\n'),
        variables: templateVariables,
        campaign_name: campaignName || `Bulk Quick Send - ${selectedTemplate} - ${new Date().toISOString()}`
      };

      const response = await fetch('/api/whatsapp/bulk-quick-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        
        setAlertState({
          show: true,
          type: 'success',
          title: 'Bulk campaign started successfully',
          message: `Processing ${recipients.length} recipients in batches of ${data.batchSize || 50}. Job ID: ${data.jobId}. You can track progress in real-time.`
        });
        
        // Reset form
        resetForm();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Bulk send failed');
      }
    } catch (error) {
      console.error('Error with bulk quick send:', error);
      setAlertState({
        show: true,
        type: 'error',
        title: 'Bulk send failed',
        message: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setLoading(prev => ({ ...prev, sending: false }));
    }
  };

  const resetForm = () => {
    setSelectedNumber('');
    setSelectedTemplate('');
    setCampaignName('');
    setRecipients([]);
    setManualRecipients('');
    setTemplateVariables({});
    setHeaderImage(null);
    setImagePreviewUrl('');
    setCampaignPreview(null);
    setSelectedRecipients([]);
    setTemplateDetails({
      variables: [],
      buttons: [],
      hasVariables: false,
      hasButtons: false
    });
  };

  const removeRecipient = (index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index);
    setRecipients(newRecipients);
  };

  const copyRecipientsToClipboard = async () => {
    const recipientsText = recipients.join('\n');
    
    try {
      await navigator.clipboard.writeText(recipientsText);
      setAlertState({
        show: true,
        type: 'success',
        title: 'Recipients copied!',
        message: `Copied ${recipients.length} phone numbers to clipboard.`
      });
    } catch (error) {
      // Fallback: put recipients in manual entry field
      setManualRecipients(recipientsText);
      setAlertState({
        show: true,
        type: 'success',
        title: 'Recipients added to manual entry',
        message: `Added ${recipients.length} phone numbers to manual entry field.`
      });
    }
  };

  const copySelectedRecipientsToClipboard = async () => {
    const selectedNumbers = selectedRecipients.map(index => recipients[index]);
    const recipientsText = selectedNumbers.join('\n');
    
    try {
      await navigator.clipboard.writeText(recipientsText);
      setAlertState({
        show: true,
        type: 'success',
        title: 'Selected recipients copied!',
        message: `Copied ${selectedNumbers.length} selected phone numbers to clipboard.`
      });
    } catch (error) {
      // Fallback: put recipients in manual entry field
      setManualRecipients(prev => prev ? `${prev}\n${recipientsText}` : recipientsText);
      setAlertState({
        show: true,
        type: 'success',
        title: 'Selected recipients added to manual entry',
        message: `Added ${selectedNumbers.length} selected phone numbers to manual entry field.`
      });
    }
  };

  const toggleRecipientSelection = (index: number) => {
    setSelectedRecipients(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAllRecipients = () => {
    setSelectedRecipients(recipients.map((_, index) => index));
  };

  const clearRecipientSelection = () => {
    setSelectedRecipients([]);
  };

  const calculateCampaignCost = () => {
    const selectedTemplateObj = templates.find(t => t.name === selectedTemplate);
    if (!selectedTemplateObj || recipients.length === 0) return 0;

    const category = selectedTemplateObj.category.toUpperCase();
    const pricePerMessage = PRICING[category as keyof typeof PRICING] || PRICING.UTILITY;
    
    return recipients.length * pricePerMessage;
  };

  const getSelectedTemplateCategory = () => {
    const selectedTemplateObj = templates.find(t => t.name === selectedTemplate);
    return selectedTemplateObj?.category || 'UTILITY';
  };

  const generateLivePreview = () => {
    if (!templatePreview) return templatePreview;
    
    // If no variables have been filled, use the original preview
    if (Object.keys(templateVariables).length === 0 || Object.values(templateVariables).every(v => !v)) {
      return templatePreview;
    }
    
    // Replace variables in the original preview
    let livePreview = templatePreview;
    Object.keys(templateVariables).forEach(index => {
      const value = templateVariables[index];
      if (value) {
        livePreview = livePreview.replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), value);
      }
    });
    
    return livePreview;
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Campaign Setup Progress</h2>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {Math.round(getFormProgress())}% Complete
            </Badge>
          </div>
          <Progress value={getFormProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>WhatsApp Number</span>
            <span>Template</span>
            <span>Recipients</span>
            <span>Variables</span>
          </div>
        </CardContent>
      </Card>

      {/* Alert Display */}
      {alertState?.show && (
        <Alert
          variant={
            alertState.type === 'success' 
              ? 'default' 
              : alertState.type === 'warning' 
              ? 'default' 
              : 'destructive'
          }
          className="border-l-4 shadow-lg"
        >
          {alertState.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
          {alertState.type === 'error' && <AlertCircle className="h-4 w-4" />}
          {alertState.type === 'warning' && <AlertCircle className="h-4 w-4" />}
          <AlertTitle className="text-base font-semibold mb-2">
            {alertState.title}
          </AlertTitle>
          <AlertDescription className="whitespace-pre-line text-sm leading-relaxed">
            {alertState.message}
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlertState(null)}
            className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-gray-100"
          >
            ×
          </Button>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: WhatsApp Configuration */}
          <Card className={`border-2 ${getStepStatus(1) === 'completed' ? 'border-green-200 bg-green-50' : getStepStatus(1) === 'current' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepStatus(1) === 'completed' ? 'bg-green-500' : getStepStatus(1) === 'current' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    {getStepStatus(1) === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-semibold">1</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Phone className="h-5 w-5 mr-2 text-emerald-600" />
                      WhatsApp Configuration
                    </CardTitle>
                    <CardDescription>Select your WhatsApp Business number and template</CardDescription>
                  </div>
                </div>
                {getStepStatus(1) === 'completed' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whatsapp-number" className="text-sm font-medium">WhatsApp Business Number *</Label>
                  <Select 
                    value={selectedNumber} 
                    onValueChange={setSelectedNumber}
                    disabled={loading.numbers}
                  >
                  <SelectTrigger className="mt-1">
                      <SelectValue placeholder={loading.numbers ? "Loading numbers..." : "Select WhatsApp number"} />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappNumbers.map((number) => (
                        <SelectItem key={number.id} value={number.phone_number_id}>
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" />
                            {number.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="language" className="text-sm font-medium">Language *</Label>
                  <Select 
                    value={selectedLanguage} 
                    onValueChange={(value) => {
                      setSelectedLanguage(value);
                      setSelectedTemplate(''); // Reset template when language changes
                    }}
                    disabled={loading.languages}
                  >
                      <SelectTrigger className="mt-1">
                      <SelectValue placeholder={loading.languages ? "Loading languages..." : "Select language"} />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          <div className="flex items-center">
                              <Globe className="h-4 w-4 mr-2 text-emerald-600" />
                            {language.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

                              <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="template" className="text-sm font-medium flex items-center">
                      Template *
                      {loading.templates && <Loader2 className="h-4 w-4 ml-2 animate-spin text-emerald-600" />}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchTemplates}
                      disabled={loading.templates || !selectedLanguage}
                      className="h-6 px-2 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <Select 
                    value={selectedTemplate || ''} 
                    onValueChange={(value) => {
                      setSelectedTemplate(value);
                    }}
                    disabled={loading.templates}
                  >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loading.templates ? "Loading templates..." : "Select template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        {template.name.replace(/_(UTILITY|MARKETING|AUTHENTICATION)$/, '').replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Campaign Details */}
          <Card className={`border-2 ${getStepStatus(2) === 'completed' ? 'border-green-200 bg-green-50' : getStepStatus(2) === 'current' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepStatus(2) === 'completed' ? 'bg-green-500' : getStepStatus(2) === 'current' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    {getStepStatus(2) === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-semibold">2</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Target className="h-5 w-5 mr-2 text-emerald-600" />
                      Campaign Details
                    </CardTitle>
                    <CardDescription>Set campaign name and recipient list</CardDescription>
                  </div>
                </div>
                {getStepStatus(2) === 'completed' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="campaign-name" className="text-sm font-medium">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name (optional)"
                  className="mt-1"
                />
              </div>

              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  <TabsTrigger value="file">File Upload</TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual" className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="manual-recipients" className="text-sm font-medium">Phone Numbers *</Label>
                      {recipients.length > 0 && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                          {recipients.length} numbers detected
                        </Badge>
                      )}
                    </div>
                    <Textarea
                      id="manual-recipients"
                      value={manualRecipients}
                      onChange={(e) => handleManualRecipientsChange(e.target.value)}
                      placeholder="Type or paste phone numbers here:&#10;919876543210&#10;918765432109&#10;917654321098&#10;...&#10;&#10;Numbers are processed automatically as you type!"
                      className="mt-1"
                      rows={6}
                    />
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      ⚡ Auto-processing: Numbers are detected and ready as you type or paste!
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Format: Include country code (91 for India, 1 for US). Separate with commas or new lines.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="file" className="space-y-4">
                  {/* File Upload */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                    <input
                      type="file"
                      accept=".txt,.csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <div className="text-lg font-medium text-gray-900 mb-2">Upload Phone Numbers</div>
                      <div className="text-sm text-gray-500 mb-4">
                        Upload .txt, .csv, .xlsx, or .xls file with phone numbers
                      </div>
                      <div className="text-xs text-gray-400 mb-4">
                        • Excel/CSV files: Auto-import phone numbers from first column to manual entry<br/>
                        • Phone numbers will be auto-populated line by line<br/>
                        • Include country code (e.g., 919394567890, 1234567890)
                      </div>
                      <Button variant="outline" className="bg-white">
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </label>
                  </div>

                  
                  {/* File Upload Instructions */}
                   <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                       <Info className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                       <div className="text-sm text-emerald-800">
                        <div className="font-medium mb-2">📱 Quick-Send File Import:</div>
                        <ul className="space-y-1 text-xs">
                          <li>• Excel/CSV: Phone numbers auto-imported from first column</li>
                          <li>• Numbers populate directly into manual entry field</li>
                          <li>• Example: 919398424270, 918765432109, 917654321098</li>
                          <li>• All recipients use the same static template variables</li>
                          <li>• For dynamic variables per recipient, use the Customize feature</li>
                          <li>• Maximum file size: 10MB</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Recipients Summary - No individual list */}
              {recipients.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium">Recipients ({recipients.length})</Label>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {recipients.length} numbers ready
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyRecipientsToClipboard}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRecipients([]);
                          setManualRecipients('');
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-800">
                      ✅ <strong>{recipients.length} phone numbers</strong> are ready to receive your message.
                      {recipients.length > 50 && (
                        <span className="block mt-1 text-green-700">
                          📊 Large batch detected - will use optimized bulk delivery.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Image Upload (for image templates) */}
          {templateDetails.templateTypeInfo?.hasStaticImage && (
            <Card className={`border-2 ${headerImage ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${headerImage ? 'bg-green-500' : 'bg-orange-500'}`}>
                      {headerImage ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <Upload className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="flex items-center text-lg">
                        <Upload className="h-5 w-5 mr-2 text-purple-600" />
                        Template Image Header
                      </CardTitle>
                      <CardDescription>Upload an image for your template header</CardDescription>
                    </div>
                  </div>
                  {headerImage && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Image Ready
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Upload Header Image <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleHeaderImageUpload}
                      className="hidden"
                      id="header-image-upload"
                    />
                    <label
                      htmlFor="header-image-upload"
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Image
                    </label>
                    {headerImage && (
                      <span className="text-sm text-gray-600">
                        {headerImage.name} ({(headerImage.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                  {imagePreviewUrl && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Preview:</Label>
                      <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                        <img
                          src={imagePreviewUrl}
                          alt="Header preview"
                          className="max-w-full h-32 object-contain rounded"
                        />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Supported formats: JPG, PNG • Max size: 5MB
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Template Variables */}
          {templateDetails.hasVariables && templateDetails.variables.length > 0 && (
            <Card className={`border-2 ${getStepStatus(4) === 'completed' ? 'border-green-200 bg-green-50' : getStepStatus(4) === 'current' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepStatus(4) === 'completed' ? 'bg-green-500' : getStepStatus(4) === 'current' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      {getStepStatus(4) === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-white font-semibold">3</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="flex items-center text-lg">
                        <Settings className="h-5 w-5 mr-2 text-emerald-600" />
                        Template Variables
                      </CardTitle>
                      <CardDescription>Fill in the template variables for your message</CardDescription>
                    </div>
                  </div>
                  {getStepStatus(4) === 'completed' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {templateDetails.variables.map((variable) => (
                  <div key={variable.index} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {variable.placeholder} {variable.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={templateVariables[variable.index.toString()] || ''}
                      onChange={(e) => handleVariableChange(variable.index.toString(), e.target.value)}
                      placeholder={`Enter ${variable.placeholder.toLowerCase()}`}
                      required={variable.required}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleQuickSend}
              disabled={!selectedNumber || !selectedTemplate || recipients.length === 0 || loading.sending}
              className="w-full h-14 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {loading.sending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              {recipients.length > 50 ? 'Bulk Send' : 'Quick Send'} ({recipients.length})
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Preview & Info */}
        <div className="space-y-6">
          {/* Campaign Summary */}
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Sparkles className="h-5 w-5 mr-2 text-emerald-600" />
                Campaign Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-600">{recipients.length}</div>
                  <div className="text-sm text-gray-600">Recipients</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-emerald-200">
                  <div className="text-2xl font-bold text-green-600">{templateDetails.variables.length}</div>
                  <div className="text-sm text-gray-600">Variables</div>
                </div>
              </div>
              
              {selectedTemplate && (
                <div className="p-3 bg-white rounded-lg border border-emerald-200">
                  <div className="text-sm font-medium text-gray-900 mb-2">Selected Template</div>
                  <div className="text-sm text-gray-600">{selectedTemplate}</div>
                  <Badge variant="outline" className="mt-1">
                    {templates.find(t => t.name === selectedTemplate)?.category || 'Unknown'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Preview */}
          {templatePreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <MessageSquare className="h-5 w-5 mr-2 text-emerald-600" />
                  Template Preview
                </CardTitle>
                <CardDescription>Live preview of your message</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-gray-50 rounded-lg border text-sm whitespace-pre-wrap">
                  {generateLivePreview()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Preview */}
          {campaignPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Eye className="h-5 w-5 mr-2 text-emerald-600" />
                  Campaign Preview
                </CardTitle>
                <CardDescription>Preview of your campaign messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaignPreview.map((preview: any, index: number) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      To: {preview.phone || preview.recipient}
                    </div>
                    {preview.variables && Object.keys(preview.variables).length > 0 && (
                      <div className="text-xs text-blue-600 mb-2">
                        Variables: {JSON.stringify(preview.variables)}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">
                      {preview.preview || preview.message}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Help & Tips */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Info className="h-5 w-5 mr-2 text-emerald-600" />
                Tips & Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-2">📱 Phone Numbers:</div>
                <ul className="space-y-1 text-xs">
                  <li>• Include country code (1, 91, etc.)</li>
                  <li>• One number per line in files</li>
                  <li>• Separate with commas manually</li>
                </ul>
              </div>
              
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-2">⚡ Quick Send vs Campaign:</div>
                <ul className="space-y-1 text-xs">
                  <li>• Quick Send: Immediate delivery</li>
                  <li>• Campaign: Scheduled & tracked</li>
                  <li>• Both support variables</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Simple Cost Preview Modal - Matching Customize Message Design */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Simple Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Send className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Campaign Cost Preview</h3>
                    <p className="text-sm text-gray-600">Review campaign details and cost</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPricingModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-8 w-8 p-0 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Simple Cards Layout */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{recipients.length}</div>
                  <div className="text-sm text-blue-800">Recipients</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-lg font-bold text-purple-600">{getSelectedTemplateCategory()}</div>
                  <div className="text-sm text-purple-800">Template Type</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">₹{calculatedCost.toFixed(2)}</div>
                  <div className="text-sm text-green-800">Total Cost</div>
                </div>
              </div>

              {/* Simple Pricing Breakdown */}
              <div className="p-4 bg-gray-50 rounded-lg border mb-6">
                <div className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <DollarSign className="h-5 w-5 text-gray-600 mr-2" />
                  Pricing Breakdown
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Cost per message:</span>
                    <span className="font-medium">₹{PRICING[getSelectedTemplateCategory().toUpperCase() as keyof typeof PRICING] || PRICING.UTILITY}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Number of recipients:</span>
                    <span className="font-medium">{recipients.length}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span className="text-gray-900">Total Cost:</span>
                      <span className="text-green-600">₹{calculatedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* First Recipient Preview */}
              {recipients.length > 0 && templatePreview && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
                  <div className="text-sm font-semibold text-yellow-800 mb-2">First Recipient Preview</div>
                  <div className="text-sm text-yellow-700">
                    <div className="font-medium">To: {recipients[0]}</div>
                    <div className="mt-2 whitespace-pre-wrap">{generateLivePreview()}</div>
                  </div>
                </div>
              )}

              {/* Simple Action Buttons */}
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPricingModal(false)}
                  className="flex-1"
                  disabled={loading.sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAndSend}
                  disabled={loading.sending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading.sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Confirm & Send (₹{calculatedCost.toFixed(2)})
                    </>
                  )}
                </Button>
              </div>

              {/* Simple Footer */}
              <div className="text-center mt-4">
                <p className="text-xs text-gray-500">
                  By confirming, you agree to send {recipients.length} messages at ₹{PRICING[getSelectedTemplateCategory().toUpperCase() as keyof typeof PRICING] || PRICING.UTILITY} each
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
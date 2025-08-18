import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  Download,
  FileSpreadsheet,
  Eye,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  FileText,
  Globe,
  Users,
  Settings,
  Sparkles,
  ChevronRight,
  Info,
  Zap,
  Target,
  Star,
  Crown,
  RefreshCw,
  DollarSign,
  X
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { useNotifier } from '../contexts/NotificationContext';
import { apiRequest } from '../lib/api';
import { useToast } from '../components/ui/use-toast';

// Pricing constants per message in INR
const PRICING = {
  MARKETING: 0.80,
  UTILITY: 0.15,
  AUTHENTICATION: 0.15
} as const;

interface WhatsAppNumber {
  id: string;
  phone_number_id: string;
  phone_number: string;
  display_name: string;
  label: string;
}

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  hasVariables: boolean;
  hasButtons: boolean;
}

interface Language {
  code: string;
  name: string;
}

export default function CustomizeMessage() {
  const navigate = useNavigate();
  const notifier = useNotifier();
  const { toast } = useToast();

  // Form state
  const [selectedWabaId, setSelectedWabaId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en_US');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [recipientColumn, setRecipientColumn] = useState('');
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [useVariables, setUseVariables] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Data state
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);

  // Loading states
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingLoading, setSendingLoading] = useState(false);

  // Pricing modal state
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Form progress tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Load initial data
  useEffect(() => {
    loadWhatsAppNumbers();
    loadLanguages();
  }, []);

  // Load templates when language changes
  useEffect(() => {
    if (selectedLanguage) {
      loadTemplates();
    }
  }, [selectedLanguage]);

  // Parse template variables when template is selected
  useEffect(() => {
    if (selectedTemplate?.components) {
      const foundVariables: string[] = [];
      
      console.log('Template components:', selectedTemplate.components);
      
      selectedTemplate.components.forEach(component => {
        console.log('Processing component:', component);
        
        // Check BODY component text
        if (component.type === 'BODY' && component.text) {
          // Look for both {{1}} and {{variable_name}} patterns
          const matches = component.text.match(/{{\s*(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g) || [];
          console.log('BODY variables found:', matches);
          matches.forEach((match: string) => {
            if (!foundVariables.includes(match)) {
              foundVariables.push(match);
            }
          });
        }
        
        // Check HEADER component text
        if (component.type === 'HEADER' && component.text) {
          const matches = component.text.match(/{{\s*(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g) || [];
          console.log('HEADER variables found:', matches);
          matches.forEach((match: string) => {
            if (!foundVariables.includes(match)) {
              foundVariables.push(match);
            }
          });
        }
        
        // Check button URLs and text for variables
        if (component.type === 'BUTTONS' && component.buttons) {
          component.buttons.forEach((button: any) => {
            if (button.url) {
              const matches = button.url.match(/{{\s*(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g) || [];
              console.log('BUTTON URL variables found:', matches);
              matches.forEach((match: string) => {
                if (!foundVariables.includes(match)) {
                  foundVariables.push(match);
                }
              });
            }
            if (button.text) {
              const matches = button.text.match(/{{\s*(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g) || [];
              console.log('BUTTON TEXT variables found:', matches);
              matches.forEach((match: string) => {
                if (!foundVariables.includes(match)) {
                  foundVariables.push(match);
                }
              });
            }
          });
        }
      });
      
      // Sort variables naturally ({{1}}, {{2}}, {{3}}, etc.)
      foundVariables.sort((a, b) => {
        const numA = parseInt(a.replace(/{|}/g, ''));
        const numB = parseInt(b.replace(/{|}/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
      
      console.log('Total variables found:', foundVariables);
      setTemplateVariables(foundVariables);
      setUseVariables(foundVariables.length > 0);
    } else {
      setTemplateVariables([]);
      setUseVariables(false);
    }
  }, [selectedTemplate]);

  // Calculate form completion percentage
  const getFormProgress = () => {
    let completed = 0;
    if (selectedWabaId) completed++;
    if (selectedTemplate) completed++;
    if (uploadedFile && recipientColumn) completed++;
    if (useVariables ? Object.keys(variableMappings).length === templateVariables.length : true) completed++;
    return (completed / totalSteps) * 100;
  };

  // Get selected template category for pricing
  const getSelectedTemplateCategory = () => {
    if (!selectedTemplate) return 'UTILITY';
    return selectedTemplate.category?.toUpperCase() || 'UTILITY';
  };

  // Calculate campaign cost
  const calculateCampaignCost = () => {
    const category = getSelectedTemplateCategory() as keyof typeof PRICING;
    const pricePerMessage = PRICING[category] || PRICING.UTILITY;
    const totalMessages = excelData.length;
    return {
      pricePerMessage,
      totalMessages,
      totalCost: (pricePerMessage * totalMessages).toFixed(2)
    };
  };

  const loadWhatsAppNumbers = async () => {
    try {
      console.log('Loading WhatsApp numbers...');
      console.log('Current user from localStorage:', localStorage.getItem('user'));
      
      const response = await apiRequest('/api/whatsapp/numbers', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('WhatsApp numbers response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('WhatsApp numbers loaded:', data);
        setWhatsappNumbers(data.data || []);
      } else {
        console.error('Failed to load WhatsApp numbers:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        notifier.error(`Error loading WhatsApp numbers. Status: ${response.status}. Please try again.`);
      }
    } catch (error) {
      console.error('Error loading WhatsApp numbers:', error);
      notifier.error("Connection error: Please check your connection and try again");
    }
  };

  const loadTemplates = async () => {
    if (!selectedLanguage) return;
    
    setTemplatesLoading(true);
    try {
      console.log('Loading templates for language:', selectedLanguage);
      console.log('Current user from localStorage:', localStorage.getItem('user'));
      
      const response = await apiRequest(`/api/whatsapp/templates?language=${selectedLanguage}&exclude_auth=true`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Templates response status:', response.status);
      console.log('Templates response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Templates loaded:', data);
        setTemplates(data.data || []);
      } else {
        console.error('Failed to load templates:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        toast({
          title: "Error loading templates",
          description: `Status: ${response.status}. Please try again.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      notifier.error("Error loading templates: Please check your connection");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadLanguages = async () => {
    try {
      const response = await apiRequest('/api/whatsapp/languages');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Languages loaded:', data.data);
        setLanguages(data.data || []);
      } else {
        console.error('Failed to load languages:', response.status);
        notifier.error("Error loading languages: Please try again");
      }
    } catch (error) {
      console.error('Error loading languages:', error);
      notifier.error("Error loading languages: Please check your connection");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      notifier.error("Invalid file type: Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)");
      return;
    }

    setUploadedFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      const response = await fetch('/api/whatsapp/parse-excel', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Upload response status:', response.status);
      console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Upload response data:', data);
        
        if (data.success && data.data) {
          const rows = data.data.rows || [];
          const columns = data.data.columns || [];
          
          console.log('Parsed rows:', rows.length);
          console.log('Parsed columns:', columns);
          
          setExcelData(rows);
          setColumnNames(columns);
          
          toast({
            title: "File uploaded successfully",
            description: `Processed ${rows.length} rows with ${columns.length} columns`,
            variant: "default"
          });
        } else {
          console.error('Invalid response format:', data);
          throw new Error(data.error || 'Invalid response format');
        }
      } else {
        const responseText = await response.text();
        console.error('Upload error response:', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText };
        }
        
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again with a valid file",
        variant: "destructive"
      });
      
      // Reset the file input on error
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      setUploadedFile(null);
    }
  };

  const handleMappingChange = (variable: string, columnName: string) => {
    setVariableMappings(prev => ({
      ...prev,
      [variable]: columnName
    }));
  };

  const generatePreview = async () => {
    if (!selectedTemplate || !excelData.length) return;

    setPreviewLoading(true);
    try {
      console.log('Generating preview for template:', selectedTemplate.name);
      console.log('Sample data:', excelData.slice(0, 3));
      
      // Generate actual preview using template and data
      const sampleData = excelData.slice(0, 3);
      const previewMessages = sampleData.map((row, index) => {
        let messageText = '';
        
        // Replace variables in template components
        if (selectedTemplate.components) {
          selectedTemplate.components.forEach(component => {
            if (component.type === 'BODY' && component.text) {
              let text = component.text;
              // Replace variables with actual data from Excel
              console.log('🔍 Template text before replacement:', text);
              console.log('🔍 Available variable mappings:', variableMappings);
              console.log('🔍 Row data:', row);
              
              // Use Object.keys to iterate through variable mappings
              Object.keys(variableMappings).forEach(variable => {
                const columnName = variableMappings[variable];
                const value = row[columnName];
                console.log(`🔍 Replacing ${variable} with "${value}" from column "${columnName}"`);
                
                if (value !== undefined && value !== null) {
                  // Replace the variable placeholder with the actual value
                  text = text.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value.toString());
                }
              });
              
              console.log('🔍 Template text after replacement:', text);
              messageText += text + '\n';
            }
          });
        }
        
        return {
          recipient: row[recipientColumn] || 'Unknown',
          message: messageText.trim(),
          index
        };
      });
      
      setPreviewData(previewMessages);
      
      toast({
        title: "Preview generated",
        description: `Showing preview for ${previewMessages.length} recipients`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      notifier.error("Preview failed: Please check your data and try again");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendCustomMessages = async () => {
    if (!selectedWabaId || !selectedTemplate || !uploadedFile || !recipientColumn) {
      notifier.error("Missing information: Please fill in all required fields");
      return;
    }

    if (excelData.length === 0) {
      notifier.error("No recipients found in Excel file");
      return;
    }

    // Show pricing modal first
    setShowPricingModal(true);
  };

  const actualSendCustomMessages = async () => {
    // Check if we should use bulk messaging (more than 50 recipients)
    if (excelData.length > 50) {
      return handleBulkCustomSend();
    }

    setSendingLoading(true);
    try {
      console.log('Sending custom messages...');
      console.log('Template:', selectedTemplate?.name);
      console.log('Recipients:', excelData.length);
      
      // Prepare the payload for sending
      // Convert variable mappings from {{1}} format to 1 format for backend
      const convertedMappings: Record<string, string> = {};
      Object.keys(variableMappings).forEach(variable => {
        // Extract number from {{1}} format
        const match = variable.match(/\{\{(\d+)\}\}/);
        if (match) {
          const variableIndex = match[1];
          convertedMappings[variableIndex] = variableMappings[variable];
        }
      });
      
      const payload = {
        templateName: selectedTemplate?.name,
        language: selectedLanguage,
        phoneNumberId: selectedWabaId,
        recipientColumn: recipientColumn,
        variableMappings: convertedMappings,
        data: excelData
      };
      
      console.log('Converted variable mappings:', convertedMappings);
      
      console.log('Sending payload:', payload);
      
      const response = await fetch('/api/whatsapp/send-custom-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Send result:', result);
        
        toast({
          title: "Messages sent successfully",
          description: `Sent ${result.sent_count || excelData.length} personalized messages`,
          variant: "default"
        });
        
        // Reset form
        setSelectedWabaId('');
        setSelectedTemplate(null);
        setUploadedFile(null);
        setRecipientColumn('');
        setVariableMappings({});
        setPreviewData(null);
        setExcelData([]);
        setColumnNames([]);
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Sending failed with status ${response.status}`);
      }
      
    } catch (error) {
      console.error('Error sending messages:', error);
      toast({
        title: "Sending failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSendingLoading(false);
    }
  };

  const handleBulkCustomSend = async () => {
    setSendingLoading(true);
    try {
      console.log('Sending bulk custom messages...');
      console.log('Template:', selectedTemplate?.name);
      console.log('Recipients:', excelData.length);
      
      // Convert variable mappings from {{1}} format to 1 format for backend
      const convertedMappings: Record<string, string> = {};
      Object.keys(variableMappings).forEach(variable => {
        // Extract number from {{1}} format
        const match = variable.match(/\{\{(\d+)\}\}/);
        if (match) {
          const variableIndex = match[1];
          convertedMappings[variableIndex] = variableMappings[variable];
        }
      });
      
      const payload = {
        templateName: selectedTemplate?.name,
        language: selectedLanguage,
        phoneNumberId: selectedWabaId,
        recipientColumn: recipientColumn,
        variableMappings: convertedMappings,
        data: excelData
      };
      
      console.log('Bulk custom payload:', payload);
      
      const response = await fetch('/api/whatsapp/bulk-customize-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Bulk send result:', result);
        
        toast({
          title: "Bulk custom messages sent successfully",
          description: `Processed ${excelData.length} personalized messages using 200-message batching with 1-second delays. ${result.data?.successful_sends || 0} successful, ${result.data?.failed_sends || 0} failed.`,
          variant: "default"
        });
        
        // Reset form
        setSelectedWabaId('');
        setSelectedTemplate(null);
        setUploadedFile(null);
        setRecipientColumn('');
        setVariableMappings({});
        setPreviewData(null);
        setExcelData([]);
        setColumnNames([]);
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Bulk sending failed with status ${response.status}`);
      }
      
    } catch (error) {
      console.error('Error sending bulk custom messages:', error);
      toast({
        title: "Bulk sending failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSendingLoading(false);
    }
  };

  const getStepStatus = (step: number) => {
    if (step === 1) return selectedWabaId ? 'completed' : 'current';
    if (step === 2) return selectedTemplate ? 'completed' : selectedWabaId ? 'current' : 'pending';
    if (step === 3) return uploadedFile && recipientColumn ? 'completed' : selectedTemplate ? 'current' : 'pending';
    if (step === 4) return useVariables ? Object.keys(variableMappings).length === templateVariables.length : true ? 'completed' : uploadedFile ? 'current' : 'pending';
    return 'pending';
  };

  // Generate first recipient preview for pricing modal
  const generateFirstRecipientPreview = () => {
    if (!selectedTemplate || !excelData.length || !recipientColumn) return null;

    const firstRow = excelData[0];
    let messageText = '';
    
    // Replace variables in template components
    if (selectedTemplate.components) {
      selectedTemplate.components.forEach(component => {
        if (component.type === 'BODY' && component.text) {
          let text = component.text;
          
          // Replace variables with actual data from Excel
          Object.keys(variableMappings).forEach(variable => {
            const columnName = variableMappings[variable];
            const value = firstRow[columnName];
            
            if (value !== undefined && value !== null) {
              text = text.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value.toString());
            }
          });
          
          messageText += text + '\n';
        }
      });
    }
    
    return {
      recipient: firstRow[recipientColumn] || 'Unknown',
      message: messageText.trim()
    };
  };

  const confirmAndSend = async () => {
    setShowPricingModal(false);
    await actualSendCustomMessages();
  };

  return (
    <>
      {/* Simple Cost Preview Modal - Matching Quick Send Design */}
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
                  <div className="text-2xl font-bold text-blue-600">{excelData.length}</div>
                  <div className="text-sm text-blue-800">Recipients</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm font-bold text-purple-600 truncate">{getSelectedTemplateCategory()}</div>
                  <div className="text-xs text-purple-800">Template Type</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">₹{calculateCampaignCost().totalCost}</div>
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
                    <span className="font-medium">₹{calculateCampaignCost().pricePerMessage}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Number of recipients:</span>
                    <span className="font-medium">{excelData.length}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span className="text-gray-900">Total Cost:</span>
                      <span className="text-green-600">₹{calculateCampaignCost().totalCost}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simple Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={confirmAndSend}
                  disabled={sendingLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {sendingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Campaign
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPricingModal(false)}
                  className="w-full"
                  disabled={sendingLoading}
                >
                  Review Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    <DashboardLayout
      title="Customize Message"
      subtitle="Send personalized WhatsApp messages using Excel data with dynamic variables"
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/user/dashboard')}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Authentication Notice */}
        {!localStorage.getItem('user') && (
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Authentication Required</h2>
                  <p className="text-yellow-100">Please log in to access WhatsApp functionality</p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="bg-white text-orange-600 hover:bg-yellow-50 font-semibold"
              >
                Go to Login
              </Button>
            </div>
          </div>
        )}



        {/* Progress Indicator */}
        <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Setup Progress</h2>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                {Math.round(getFormProgress())}% Complete
              </Badge>
            </div>
            <Progress value={getFormProgress()} className="h-3 bg-emerald-100" />
            <div className="flex justify-between mt-3 text-sm text-gray-600">
              <span className="flex items-center">
                <Target className="h-4 w-4 mr-1" />
                WhatsApp Number
              </span>
              <span className="flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                Template
              </span>
              <span className="flex items-center">
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel Data
              </span>
              <span className="flex items-center">
                <Settings className="h-4 w-4 mr-1" />
                Variables
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: WhatsApp Configuration */}
            <Card className={`border-2 shadow-lg transition-all duration-300 ${getStepStatus(1) === 'completed' ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : getStepStatus(1) === 'current' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' : 'border-gray-200 bg-white'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${getStepStatus(1) === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : getStepStatus(1) === 'current' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gray-300'}`}>
                      {getStepStatus(1) === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      ) : (
                        <span className="text-white font-bold text-lg">1</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="flex items-center text-xl">
                        <Phone className="h-6 w-6 mr-3 text-emerald-600" />
                        WhatsApp Configuration
                      </CardTitle>
                      <CardDescription className="text-base">Select your WhatsApp Business number and template</CardDescription>
                    </div>
                  </div>
                  {getStepStatus(1) === 'completed' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp-number" className="text-sm font-semibold text-gray-700">WhatsApp Business Number *</Label>
                    <Select value={selectedWabaId} onValueChange={setSelectedWabaId}>
                      <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-emerald-300 focus:border-emerald-500 transition-colors">
                        <SelectValue placeholder="Select WhatsApp number" />
                      </SelectTrigger>
                      <SelectContent>
                        {whatsappNumbers.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            <Phone className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <div className="text-sm font-medium mb-1">No WhatsApp numbers configured</div>
                            <div className="text-xs text-gray-400">
                              Configure your WhatsApp Business API first
                            </div>
                          </div>
                        ) : (
                          whatsappNumbers.map((number) => (
                            <SelectItem key={number.id} value={number.phone_number_id}>
                              <div className="flex items-center py-1">
                                <Phone className="h-5 w-5 mr-3 text-green-600" />
                                <div className="font-medium">{number.label}</div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-sm font-semibold text-gray-700">Language *</Label>
                    <Select 
                      value={selectedLanguage} 
                      onValueChange={(value) => {
                        setSelectedLanguage(value);
                        setSelectedTemplate(null); // Reset template when language changes
                      }}
                    >
                      <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-emerald-300 focus:border-emerald-500 transition-colors">
                        <SelectValue placeholder={languages.length === 0 ? "Loading languages..." : "Select language"} />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            {language.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="template" className="text-sm font-semibold text-gray-700 flex items-center">
                      Template *
                      {templatesLoading && <Loader2 className="h-4 w-4 ml-2 animate-spin text-emerald-600" />}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadTemplates}
                      disabled={templatesLoading || !selectedLanguage}
                      className="h-6 px-2 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <Select 
                    value={selectedTemplate ? selectedTemplate.name : ''} 
                    onValueChange={(value) => {
                      const template = templates.find(t => t.name === value);
                      setSelectedTemplate(template || null);
                    }}
                    disabled={templatesLoading}
                  >
                    <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-emerald-300 focus:border-emerald-500 transition-colors">
                      <SelectValue placeholder={templatesLoading ? "Loading templates..." : templates.length === 0 ? "No templates available" : "Select template"} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {templatesLoading ? (
                            <div className="flex items-center justify-center">
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Loading templates...
                            </div>
                          ) : (
                            <div>
                              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <div className="text-sm font-medium mb-1">No templates available</div>
                              <div className="text-xs text-gray-400">
                                Create a template first in the Templates section
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        templates.map((template) => (
                          <SelectItem key={template.id} value={template.name}>
                            {template.name.replace(/_(UTILITY|MARKETING|AUTHENTICATION)$/, '').replace(/_/g, ' ')}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Excel Data Upload */}
            <Card className={`border-2 shadow-lg transition-all duration-300 ${getStepStatus(3) === 'completed' ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : getStepStatus(3) === 'current' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' : 'border-gray-200 bg-white'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${getStepStatus(3) === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : getStepStatus(3) === 'current' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gray-300'}`}>
                      {getStepStatus(3) === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      ) : (
                        <span className="text-white font-bold text-lg">2</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="flex items-center text-xl">
                        <FileSpreadsheet className="h-6 w-6 mr-3 text-green-600" />
                        Excel Data Upload
                      </CardTitle>
                      <CardDescription className="text-base">Upload your Excel file with recipient data</CardDescription>
                    </div>
                  </div>
                  {getStepStatus(3) === 'completed' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition-all duration-300 bg-gradient-to-br from-gray-50 to-white">
                                     <input
                     type="file"
                     accept=".xlsx,.xls,.csv"
                     onChange={handleFileUpload}
                     className="hidden"
                     id="file-upload"
                   />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4 hover:text-green-500 transition-colors" />
                    <div className="text-xl font-semibold text-gray-900 mb-2">
                      {uploadedFile ? uploadedFile.name : 'Upload Excel File'}
                    </div>
                    <div className="text-sm text-gray-500 mb-6">
                      {uploadedFile ? `${excelData.length} rows processed` : 'Drag and drop or click to browse'}
                    </div>
                    {!uploadedFile && (
                       <Button variant="outline" className="bg-white border-2 border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300">
                        <Upload className="h-5 w-5 mr-2" />
                        Choose File
                      </Button>
                    )}
                  </label>
                </div>

                {uploadedFile && columnNames.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="recipient-column" className="text-sm font-semibold text-gray-700">Recipient Phone Number Column *</Label>
                    <Select value={recipientColumn} onValueChange={setRecipientColumn}>
                       <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-emerald-300 focus:border-emerald-500 transition-colors">
                        <SelectValue placeholder="Select column containing phone numbers" />
                      </SelectTrigger>
                      <SelectContent>
                        {columnNames.map((column) => (
                          <SelectItem key={column} value={column}>
                            <div className="flex items-center py-1">
                              <Users className="h-5 w-5 mr-3 text-blue-600" />
                              {column}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Variable Mapping */}
            {useVariables && templateVariables.length > 0 && (
              <Card className={`border-2 shadow-lg transition-all duration-300 ${getStepStatus(4) === 'completed' ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : getStepStatus(4) === 'current' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' : 'border-gray-200 bg-white'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${getStepStatus(4) === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : getStepStatus(4) === 'current' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gray-300'}`}>
                        {getStepStatus(4) === 'completed' ? (
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        ) : (
                          <span className="text-white font-bold text-lg">3</span>
                        )}
                      </div>
                      <div>
                        <CardTitle className="flex items-center text-xl">
                          <Settings className="h-6 w-6 mr-3 text-orange-600" />
                          Variable Mapping
                        </CardTitle>
                        <CardDescription className="text-base">Map template variables to Excel columns</CardDescription>
                      </div>
                    </div>
                    {getStepStatus(4) === 'completed' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {templateVariables.map((variable) => (
                    <div key={variable} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Template Variable</Label>
                        <div className="p-3 bg-gray-100 rounded-lg border-2 border-gray-200 text-sm font-mono">
                          {variable}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Excel Column</Label>
                        <Select 
                          value={variableMappings[variable] || ''} 
                          onValueChange={(value) => handleMappingChange(variable, value)}
                        >
                          <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-emerald-300 focus:border-emerald-500 transition-colors">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {columnNames.map((column) => (
                              <SelectItem key={column} value={column}>
                                <div className="flex items-center py-1">
                                  <FileSpreadsheet className="h-5 w-5 mr-3 text-green-600" />
                                  {column}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={generatePreview}
                disabled={!selectedTemplate || !uploadedFile || !recipientColumn || previewLoading}
                className="flex-1 h-14 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {previewLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-5 w-5 mr-2" />
                )}
                Generate Preview
              </Button>
              
              <Button
                onClick={handleSendCustomMessages}
                disabled={!selectedWabaId || !selectedTemplate || !uploadedFile || !recipientColumn || sendingLoading}
                className="flex-1 h-14 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {sendingLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                {excelData.length > 50 ? 'Bulk Send' : 'Send Messages'} ({excelData.length})
              </Button>
            </div>
          </div>

          {/* Right Sidebar - Preview & Info */}
          <div className="space-y-6">
            {/* Campaign Summary */}
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Sparkles className="h-5 w-5 mr-2 text-emerald-600" />
                  Campaign Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg border border-emerald-200 shadow-sm">
                    <div className="text-3xl font-bold text-emerald-600">{excelData.length}</div>
                    <div className="text-sm text-gray-600">Recipients</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border border-emerald-200 shadow-sm">
                    <div className="text-3xl font-bold text-green-600">{templateVariables.length}</div>
                    <div className="text-sm text-gray-600">Variables</div>
                  </div>
                </div>
                
                {selectedTemplate && (
                  <div className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Selected Template</div>
                    <div className="text-sm text-gray-600 mb-2">{selectedTemplate.name.replace(/_(UTILITY|MARKETING|AUTHENTICATION)$/, '').replace(/_/g, ' ')}</div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {selectedTemplate.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        {languages.find(l => l.code === selectedTemplate.language)?.name || selectedTemplate.language}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Section */}
            {previewData && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Eye className="h-5 w-5 mr-2 text-blue-600" />
                    Message Preview
                  </CardTitle>
                  <CardDescription>Preview of your personalized messages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {previewData.map((preview: any, index: number) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                      <div className="text-sm font-semibold text-gray-900 mb-2">
                        To: {preview.recipient}
                      </div>
                      <div className="text-sm text-gray-600 whitespace-pre-wrap">
                        {preview.message}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Help & Tips */}
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Info className="h-5 w-5 mr-2 text-emerald-600" />
                  Tips & Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-700">
                  <div className="font-semibold mb-2 flex items-center">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                    Excel Format:
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>• First row should contain column headers</li>
                    <li>• Phone numbers should include country code (e.g., 1, 91)</li>
                    <li>• Variables will be replaced automatically</li>
                  </ul>
                </div>
                
                <div className="text-sm text-gray-700">
                  <div className="font-semibold mb-2 flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                    Quick Tips:
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>• Test with a small file first</li>
                    <li>• Ensure phone numbers are valid</li>
                    <li>• Check template approval status</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
    </>
  );
}
import WhatsAppBulkMessaging from '../components/WhatsAppBulkMessaging';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function WhatsAppBulkMessagingPage() {
  return (
    <DashboardLayout 
      title="WhatsApp Quick Send"
      subtitle="Send messages to multiple recipients using approved templates with automatic 200-message batching."
    >
      <WhatsAppBulkMessaging />
    </DashboardLayout>
  );
}
import WhatsAppBulkMessaging from '../components/WhatsAppBulkMessaging';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function WhatsAppBulkMessagingPage() {
  return (
    <DashboardLayout 
      title="WhatsApp Quick Send"
      subtitle="Send messages instantly to multiple recipients using approved templates. Choose Quick Send for immediate delivery or Bulk for large campaigns."
    >
      <WhatsAppBulkMessaging />
    </DashboardLayout>
  );
}
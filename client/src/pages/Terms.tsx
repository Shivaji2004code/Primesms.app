import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-lg">💬</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-emerald-700 bg-clip-text text-transparent">Prime SMS</span>
          </div>
          <nav className="hidden lg:flex items-center space-x-8">
            <Link to="/" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">Home</Link>
            <Link to="/docs" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">Docs</Link>
            <Link to="/login" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="py-8 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>📋</span>
              <span>Terms & Conditions</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Terms & Conditions - FAQ
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4">
              Everything you need to know about using Prime SMS services
            </p>
            <p className="text-sm text-gray-500">
              <strong>Last updated:</strong> January 15, 2025
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-4 sm:p-8 lg:p-12">
            <div className="space-y-8">
              {/* Question 1 */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                  What is your service?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  We provide WhatsApp Business API messaging services through our cloud-based platform. Users can send bulk messages, manage templates, and track campaign performance digitally through our web-based dashboard.
                </p>
              </div>

              {/* Question 2 */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                  How does pricing and payment work?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Our service operates on a prepaid credit system. You can top up your wallet using UPI, cards, net banking, or bank transfer. Credits are deducted per conversation based on message category and recipient country. All payments are processed securely through our payment gateway.
                </p>
              </div>

              {/* Question 3 */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                  What is your refund and cancellation policy?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Unused credits can be refunded within 30 days of purchase, subject to a processing fee. Once messages are sent, those credits cannot be refunded. You may cancel your account anytime, and remaining credits will be processed according to our refund policy.
                </p>
              </div>

              {/* Question 4 */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
                  How are services delivered?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  All services are delivered digitally through our web platform. No physical products are shipped. Access is provided immediately upon account setup and payment confirmation through your web browser.
                </p>
              </div>

              {/* Question 5 */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">5</span>
                  How do you handle my data and privacy?
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  We protect your data with industry-standard security measures. Personal information is used only for service delivery and is not shared with third parties without consent. Message data is processed according to WhatsApp Business policies and Indian data protection laws.
                </p>
              </div>

              {/* Question 6 */}
              <div className="pb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">6</span>
                  How can I contact support or file complaints?
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  For support or grievances, contact us using the details below. We respond to queries within 24-48 hours during business days.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-gray-800">
                    <strong>Business:</strong> M/S PRIME SMS
                  </p>
                  <p className="text-sm text-gray-800">
                    <strong>Address:</strong> 16-11-477/6/3, #101, Sneha Prashanth Residency, Dilsukh Nagar, Hyderabad-500036
                  </p>
                  <p className="text-sm text-gray-800">
                    <strong>Phone:</strong> +91 9160352125
                  </p>
                  <p className="text-sm text-gray-800">
                    <strong>Email:</strong> shivaji@primesms.app
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Legal Notice */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 leading-relaxed">
                By using Prime SMS services, you agree to these terms and conditions. We reserve the right to update these terms at any time. 
                Continued use of our services after changes indicates your acceptance of the updated terms. 
                For any legal disputes, the jurisdiction will be Hyderabad, Telangana, India.
              </p>
            </div>
            {/* Back links */}
            <div className="mt-10 text-sm text-gray-600">
              <Link to="/" className="text-emerald-700">← Back to home</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
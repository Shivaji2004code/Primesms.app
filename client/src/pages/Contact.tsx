import { Link } from 'react-router-dom'

export default function Contact() {
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

      <main className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>📞</span>
              <span>Get in Touch</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Contact Us
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Ready to transform your WhatsApp messaging? Reach out to our team for support and inquiries.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Main Contact Card */}
            <div className="lg:col-span-2">
              <div className="group relative">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-400/10 via-emerald-500/10 to-cyan-500/10 blur-xl transition-all duration-500 group-hover:blur-2xl"></div>
                <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 sm:p-12 transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-2xl">
                  <div className="space-y-6 text-left">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl">🏢</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Office Address</h3>
                        </div>
                      </div>
                      <div className="pl-15 space-y-2">
                        <p className="text-gray-900 font-semibold text-lg">M/S PRIME SMS,</p>
                        <p className="text-gray-700">16-11-477/6/3,#101</p>
                        <p className="text-gray-700">SNEHA PRASHANTH RESIDENCY, DILSUKH NAGAR ,HYDERABAD-500036</p>
                      </div>
                    </div>
                    
                    <div className="h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl">📞</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Phone</h3>
                          <p className="text-gray-900 font-medium text-lg">+91 9160352125</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl">✉️</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Email</h3>
                          <p className="text-gray-900 font-medium text-lg">shivaji@primesms.app</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Info Card */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <h3 className="text-xl font-semibold">Ready to Start?</h3>
                  <p className="text-emerald-100 text-sm">
                    Get started with Prime SMS today and transform your WhatsApp business messaging.
                  </p>
                  <Link to="/signup" className="inline-block bg-white text-emerald-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

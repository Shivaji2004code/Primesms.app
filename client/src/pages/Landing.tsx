import { MessageSquare, Code, Check, ArrowRight, Shield, Zap, Target, BarChart3, Wallet, Smartphone, FileText, DollarSign } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Prime SMS</span>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-emerald-600 font-medium">Features</a>
              <Link to="/docs" className="text-gray-600 hover:text-emerald-600 font-medium">Docs</Link>
              <Link to="/contact" className="text-gray-600 hover:text-emerald-600 font-medium">Contact Us</Link>
            </nav>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link to="/login">
                <Button variant="ghost" className="text-emerald-600 hover:text-emerald-700">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
                <MessageSquare className="h-4 w-4" />
                <span>WhatsApp Business API</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                WhatsApp Business API
                <span className="text-emerald-500 block mt-2">Turn WhatsApp conversations into customers.</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Send bulk messages, OTPs, and campaigns through WhatsApp Business API with powerful automation, template builder, and real-time analytics.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/signup">
                  <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 text-base font-medium">
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Start Free Trial
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <div className="flex text-yellow-400 mr-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="font-medium">4.9/5 rating</span>
                </div>
              </div>
            </div>
            
            {/* Mobile WhatsApp-Style Chat Interface */}
            <div className="relative lg:ml-8">
              {/* Subtle floating animation for phone */}
              <div className="bg-black rounded-[2.2rem] p-2 shadow-2xl max-w-[320px] w-full mx-auto ring-1 ring-black/10">
                <div className="bg-white rounded-[1.8rem] overflow-hidden h-[600px] sm:h-[640px] flex flex-col">
                  {/* Status Bar */}
                  <div className="bg-emerald-500 px-4 pt-2 pb-1">
                    <div className="flex justify-between items-center text-white text-xs font-medium">
                      <span>9:41 AM</span>
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-white opacity-60 rounded-full"></div>
                        </div>
                        <span className="ml-1">📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Chat Header */}
                  <div className="bg-emerald-500 px-3 py-2 flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden">
                          <div className="w-full h-full bg-emerald-400 flex items-center justify-center">
                            <span className="text-white text-lg">💬</span>
                          </div>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium text-sm">Prime SMS</div>
                        <div className="text-emerald-100 text-xs">Online</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-white">
                      <span className="text-lg">📹</span>
                      <span className="text-lg">📞</span>
                      <span className="text-lg">⋮</span>
                    </div>
                  </div>
                  
                  {/* Chat Background Pattern */}
                  <div className="flex-1 relative text-[12px]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.1'%3E%3Cpath d='M0 0h20v20H0z'/%3E%3Cpath d='M10 0L0 10v10h10L20 10V0H10z' fill='%23d1d5db' fill-opacity='0.05'/%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundColor: '#f0f2f5'
                  }}>
                    {/* Chat Messages with reveal animations (kept fully visible) */}
                    <div className="p-2 space-y-1.5 h-full overflow-hidden">
                      {/* Date Separator */}
                      <div className="flex justify-center mb-2">
                        <div className="bg-white bg-opacity-90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                          <span className="text-xs text-gray-600 font-medium">Today</span>
                        </div>
                      </div>
                      
                      {/* Automated Welcome */}
                      <div className="flex justify-center mb-2">
                        <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                          <span className="font-medium">Automated</span>
                        </div>
                      </div>
                      
                      {/* Bot Message (reveal) */}
                      <div className="wa-reveal" style={{ ['--reveal-delay' as any]: '.4s' }}>
                        <div className="flex items-end space-x-2 mb-1">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">🎧</span>
                        </div>
                          <div className="max-w-[85%]">
                            {/* skeleton then content */}
                            <div className="wa-skeleton h-6 w-48 mb-1"></div>
                            <div className="bg-white rounded-lg rounded-bl-none px-2.5 py-1.5 shadow-sm wa-content">
                              <p className="text-[12px] text-gray-800">Hi! welcome to Prime SMS. How can we help?</p>
                            </div>
                            <div className="flex items-center mt-1 space-x-1 wa-content">
                              <span className="text-[10px] text-gray-500">9:41 AM</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* User Message (typing dots then reveal) */}
                      <div className="flex justify-end mb-1 wa-reveal" style={{ ['--reveal-delay' as any]: '.9s' }}>
                        <div className="max-w-[85%] text-right">
                          <div className="bg-emerald-500/10 rounded-lg rounded-br-none px-2.5 py-1.5 shadow-sm wa-skeleton h-6 w-52 mb-1"></div>
                          <div className="bg-emerald-500 text-white rounded-lg rounded-br-none px-2.5 py-1.5 shadow-sm wa-content">
                            <p className="text-[12px]">I need help with my account</p>
                          </div>
                          <div className="flex items-center justify-end mt-1 space-x-1 wa-content">
                            <span className="text-[10px] text-gray-500">9:41 AM</span>
                            <span className="text-emerald-500 text-[10px]">✓✓</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Bot Verification Code (reveal) */}
                      <div className="wa-reveal" style={{ ['--reveal-delay' as any]: '1.4s' }}>
                        <div className="flex items-end space-x-2 mb-1">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">🎧</span>
                        </div>
                          <div className="max-w-[85%]">
                            <div className="wa-skeleton h-14 w-56 mb-1"></div>
                            <div className="bg-white rounded-lg rounded-bl-none px-2.5 py-1.5 shadow-sm wa-content">
                              <p className="text-[12px] text-gray-800 mb-1.5">Your Prime SMS verification code is</p>
                              <div className="bg-gray-100 rounded-md px-2.5 py-1.5 text-center">
                                <span className="text-sm font-mono font-bold text-emerald-600 tracking-wider">123456</span>
                              </div>
                            </div>
                            <div className="flex items-center mt-1 space-x-1 wa-content">
                              <span className="text-[10px] text-gray-500">9:42 AM</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* User Response (reveal) */}
                      <div className="flex justify-end mb-1 wa-reveal" style={{ ['--reveal-delay' as any]: '2s' }}>
                        <div className="max-w-[85%]">
                          <div className="wa-skeleton h-6 w-60 mb-1"></div>
                          <div className="bg-emerald-500 text-white rounded-lg rounded-br-none px-2.5 py-1.5 shadow-sm wa-content">
                            <p className="text-[12px]">Thanks! That worked perfectly</p>
                          </div>
                          <div className="flex items-center justify-end mt-1 space-x-1 wa-content">
                            <span className="text-[10px] text-gray-500">9:42 AM</span>
                            <span className="text-blue-500 text-[10px]">✓✓</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* System Status (reveal) */}
                      <div className="flex justify-center pt-2 wa-reveal" style={{ ['--reveal-delay' as any]: '2.6s' }}>
                        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs flex items-center shadow-sm wa-content">
                          <Check className="h-3 w-3 mr-1" />
                          <span className="font-medium">Webhook delivered successfully</span>
                        </div>
                      </div>
                      
                      <div className="text-center pt-1">
                        <span className="text-xs text-gray-400">9:43 AM</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Input Area (compact) */}
                  <div className="bg-gray-100 px-2 py-1.5 flex items-center space-x-2">
                    <div className="flex-1 bg-white rounded-full flex items-center px-2.5 py-1.5">
                      <span className="text-gray-400 text-base mr-2">😊</span>
                      <input 
                        type="text" 
                        placeholder="Type a message..."
                        className="flex-1 text-[12px] bg-transparent outline-none"
                      />
                      <span className="text-gray-400 text-base ml-2">📎</span>
                      <span className="text-gray-400 text-base ml-1">📷</span>
                    </div>
                    <button className="bg-emerald-500 text-white p-1.5 rounded-full shadow-md">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful WhatsApp Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to scale your WhatsApp messaging with advanced tools and real-time insights.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* WhatsApp Bulk Messaging */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  WhatsApp Bulk Messaging
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Send thousands of messages instantly
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Bulk messaging dashboard:</span>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>Campaign: Flash Sale</span>
                      <span className="text-green-600 font-medium">✓ 2,450 sent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic SMS Variables */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Dynamic SMS Variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Excel mapping with custom variables
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-2">Excel mapping preview:</div>
                  <div className="text-sm space-y-1">
                    <div>Hi {'{'}{'{'} name {'}'}{'}'},  your order {'{'}{'{'}order_id{'}'}{'}'}  is ready!</div>
                    <div className="text-emerald-600">→ Hi John, your order #1234 is ready!</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real-time Reports */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Real-time Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Live delivery and read status
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-2">Real-time analytics:</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Delivered</span><span className="text-emerald-600 font-medium">98.5%</span></div>
                    <div className="flex justify-between"><span>Read</span><span className="text-blue-600 font-medium">87.2%</span></div>
                    <div className="flex justify-between"><span>Failed</span><span className="text-red-600 font-medium">1.5%</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template Builder */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Template Builder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Custom message templates
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-2">Template components:</div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>Header</div>
                    <div className="flex items-center"><div className="w-3 h-3 bg-gray-500 rounded mr-2"></div>Body Text</div>
                    <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded mr-2"></div>CTA Button</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet System */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Wallet System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Credit-based billing system
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-2">Wallet balance:</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Current Balance</span><span className="text-emerald-600 font-medium">₹2,450</span></div>
                    <div className="flex justify-between"><span>Messages Sent</span><span>1,250</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Integration */}
            <Card className="border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg bg-white">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  API Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  RESTful APIs for any platform
                </p>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-xs text-green-400 mb-1">API endpoints:</div>
                  <div className="text-xs text-white space-y-1">
                    <div><span className="text-emerald-400">POST</span> /api/send-message</div>
                    <div><span className="text-blue-400">GET</span> /api/delivery-status</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Billing Section */}
      <section className="py-20 bg-emerald-500 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-400" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Zap className="h-8 w-8 mr-3" />
            <h2 className="text-3xl md:text-4xl font-bold">
              Simple billing: Wallet System. Pay as you go.
            </h2>
          </div>
          
          <p className="text-xl text-emerald-50 mb-10 max-w-3xl mx-auto">
            No monthly fees, no hidden costs. Load credits to your wallet and only pay for messages sent with transparent pricing.
          </p>
          
          <div className="flex justify-center">
            <Link to="/signup">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-50 px-8 py-4 text-lg font-semibold">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Brand */}
            <div className="col-span-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">Prime SMS</span>
              </div>
              <p className="text-gray-400 text-sm">
                WhatsApp Business API platform for modern businesses.
              </p>
            </div>
            
            {/* Features */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">Features</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>WhatsApp API</li>
                <li>Bulk Messaging</li>
                <li>Template Builder</li>
                <li>Real-time Reports</li>
              </ul>
            </div>
            
            {/* Resources */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Support</li>
              </ul>
            </div>
            
            {/* Company */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/contact" className="hover:text-emerald-400 transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2025 Prime SMS. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">Privacy</Link>
              <Link to="/refund-policy" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
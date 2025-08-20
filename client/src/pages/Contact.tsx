import { Link } from 'react-router-dom'

export default function Contact() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Prime SMS</span>
          </div>
          <nav className="hidden lg:flex items-center space-x-8">
            <Link to="/" className="text-gray-600 hover:text-emerald-600 font-medium">Home</Link>
            <Link to="/docs" className="text-gray-600 hover:text-emerald-600 font-medium">Docs</Link>
            <Link to="/login" className="text-gray-600 hover:text-emerald-600 font-medium">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
            <p className="text-gray-600">Get in touch with our team</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="space-y-4 text-left">
              <div>
                <p className="text-gray-900 font-medium">M/S PRIME SMS,</p>
                <p className="text-gray-700">16-11-477/6/3,#101</p>
                <p className="text-gray-700">SNEHA PRASHANTH RESIDENCY, DILSUKH NAGAR ,HYDERABAD-500036</p>
              </div>
              
              <div>
                <p className="text-gray-900 font-medium">Phone : +91 9160352125</p>
              </div>
              
              <div>
                <p className="text-gray-900 font-medium">E-Mail : shivaji@primesms.app</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

import { Link } from 'react-router-dom'

export default function Docs() {
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
            <a href="#" className="text-gray-600 hover:text-emerald-600 font-medium">Docs</a>
            <Link to="/login" className="text-gray-600 hover:text-emerald-600 font-medium">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Prime SMS — WhatsApp-Only Feature Guide</h1>
            <p className="text-sm text-gray-500">Last updated: August 20, 2025 • Product: Prime SMS (Business messaging over WhatsApp)</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-4 mb-8">
            <p className="text-sm">This guide presents Prime SMS features focused exclusively on WhatsApp. It’s concise, practical, and professional for quick onboarding and day‑to‑day use.</p>
          </div>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Table of Contents</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li><a href="#quick-send" className="text-emerald-600 hover:underline">Quick Send & Bulk Send (WhatsApp)</a></li>
              <li><a href="#customize-message" className="text-emerald-600 hover:underline">Customize Message</a></li>
              <li><a href="#manage-templates" className="text-emerald-600 hover:underline">Manage Templates</a></li>
              <li><a href="#manage-reports" className="text-emerald-600 hover:underline">Manage Reports</a></li>
              <li><a href="#dashboards" className="text-emerald-600 hover:underline">Dashboards</a></li>
              <li><a href="#wallet" className="text-emerald-600 hover:underline">Wallet-Based Billing</a></li>
              <li><a href="#wa-overview" className="text-emerald-600 hover:underline">WhatsApp Messaging — Overview & Rules</a></li>
              <li><a href="#security" className="text-emerald-600 hover:underline">Security & Compliance</a></li>
              <li><a href="#glossary" className="text-emerald-600 hover:underline">Glossary</a></li>
              <li><a href="#faqs" className="text-emerald-600 hover:underline">FAQs</a></li>
            </ol>
          </section>

          <section id="quick-send" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">1) Quick Send & Bulk Send (WhatsApp)</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Launch WhatsApp messages fast (Quick Send) or at scale (Bulk) using approved templates.</p>
            <div className="space-y-2 text-gray-700">
              <p className="font-semibold">Key points</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Templates only for business‑initiated outreach (Marketing, Utility, Authentication).</li>
                <li>Audience input: paste numbers or upload CSV/XLSX with variables.</li>
                <li>Scheduling: now, later, or recurring; timezone‑aware.</li>
                <li>Throughput control: throttle sends to protect quality and avoid Meta rate caps.</li>
                <li>Preview & estimate: verify personalization and see conversation cost before sending.</li>
                <li>Real‑time status: queued → sent → delivered → read (when available) → failed.</li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-gray-700 font-semibold mb-2">CSV Example</p>
              <div className="bg-gray-900 text-gray-100 rounded-md overflow-x-auto">
                <pre className="p-4 text-sm"><code>{`phone,first_name,order_id
\+919876543210,Anaya,ODR-10234
\+14155550123,John,ODR-55510`}</code></pre>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700 font-semibold mb-1">Best practices</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Send only to opted‑in contacts; keep copy concise and action‑oriented.</li>
                <li>Keep variable counts minimal; verify with preview.</li>
                <li>Respect local quiet hours where your policy requires.</li>
              </ul>
            </div>
          </section>

          <section id="customize-message" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">2) Customize Message</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Personalize approved WhatsApp templates with variables, media headers, and interactive buttons.</p>
            <div className="space-y-2 text-gray-700">
              <p className="font-semibold">What you can customize</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Header: text, image, or document.</li>
                <li>Body: short, clear text with {`{{placeholders}}`}.</li>
                <li>Footer: brief legal/help text.</li>
                <li>Buttons: Quick Reply, URL, or OTP (where template allows).</li>
                <li>Language: manage multiple locales per template; set default + fallbacks.</li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-gray-700 font-semibold mb-2">Minimal body example</p>
              <div className="bg-gray-100 rounded-md overflow-x-auto">
                <pre className="p-4 text-sm"><code>{`Hi {{first_name}}, your order {{order_id}} is on the way.`}</code></pre>
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-700 mt-3">
                <li>Avoid sensitive data in free text; use IDs/refs.</li>
                <li>Use branded short links for tracking clicks.</li>
                <li>Keep media lightweight; follow Meta size limits.</li>
              </ul>
            </div>
          </section>

          <section id="manage-templates" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">3) Manage Templates</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Central library for WhatsApp templates with review and compliance controls.</p>
            <p className="text-gray-700 font-semibold">Lifecycle</p>
            <p className="text-gray-700">Draft → Review → Active → Archived (versioned with changelog).</p>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Key controls</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Define variables; validate with sample data.</li>
                <li>Add languages; keep naming consistent.</li>
                <li>Configure header/body/footer and interactive buttons.</li>
                <li>Track Meta approval and quality rating (green/yellow/red).</li>
                <li>Role‑based permissions for create/edit/approve/publish.</li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-gray-700 font-semibold mb-2">Template structure (illustrative)</p>
              <div className="bg-gray-900 text-gray-100 rounded-md overflow-x-auto">
                <pre className="p-4 text-sm"><code>{`{
  "name": "order_update",
  "language": { "code": "en_US" },
  "components": [
    { "type": "header", "format": "TEXT", "text": "Order {{1}}" },
    { "type": "body", "text": "Hi {{1}}, your order {{2}} is now {{3}}." },
    { "type": "button", "sub_type": "url", "index": "0", "parameters": [{ "type": "text", "text": "track" }] }
  ],
  "category": "UTILITY"
}`}</code></pre>
              </div>
            </div>
          </section>

          <section id="manage-reports" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">4) Manage Reports</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Measure performance and troubleshoot WhatsApp messaging.</p>
            <p className="text-gray-700 font-semibold">Core metrics</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Volume: queued, sent, delivered, read, failed.</li>
              <li>Engagement: link clicks (via short links), reply counts.</li>
              <li>Conversations: starts by category (Authentication/Utility/Marketing) and country.</li>
              <li>Quality: template quality rating, phone number quality, error codes.</li>
            </ul>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Drill‑down</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Per‑message timeline with timestamps and WhatsApp error reasons.</li>
                <li>Export CSV/XLSX; schedule email exports.</li>
              </ul>
            </div>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Webhooks (optional)</p>
              <p className="text-gray-700">Delivery/read updates and click events to your system with HMAC verification.</p>
            </div>
          </section>

          <section id="dashboards" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">5) Dashboards</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Real‑time, WhatsApp‑only operational and business insights.</p>
            <p className="text-gray-700 font-semibold">Widgets</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Today’s WhatsApp traffic (sent/delivered/read/failed).</li>
              <li>Conversation breakdown by category and country.</li>
              <li>Top templates by volume and success rate.</li>
              <li>Quality signals: template quality trend, phone number quality.</li>
              <li>Cost & wallet: balance, burn rate, low‑balance alerts.</li>
            </ul>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Controls</p>
              <p className="text-gray-700">Date filters, segment filters, saveable views.</p>
            </div>
          </section>

          <section id="wallet" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">6) Wallet-Based Billing</h3>
            <p className="text-gray-700 mb-3"><span className="font-semibold">Purpose:</span> Prepaid wallet used for WhatsApp conversation‑based billing.</p>
            <p className="text-gray-700 font-semibold">How it works</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Top‑ups: UPI/cards/net banking/bank transfer (region‑dependent); auto‑recharge at threshold.</li>
              <li>Deductions: per conversation window by category and country.</li>
              <li>Visibility: real‑time balance, cost preview before send, invoice downloads.</li>
              <li>Protections: low‑balance alerts and auto‑pause/resume.</li>
            </ul>
          </section>

          <section id="wa-overview" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">7) WhatsApp Messaging — Overview & Rules</h3>
            <p className="text-gray-700 font-semibold">Prerequisites</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Active WABA, approved phone number and display name.</li>
              <li>Opt‑in captured and stored (web form, WhatsApp thread, POS, etc.).</li>
              <li>Approved templates for business‑initiated messages.</li>
            </ul>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Message types</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Template messages (business‑initiated): use approved templates; variables only.</li>
                <li>Session messages (customer‑initiated): free‑form replies within 24‑hour window.</li>
              </ul>
            </div>
            <div className="mt-3">
              <p className="text-gray-700 font-semibold">Rules</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Respect the 24‑hour customer‑service window.</li>
                <li>Comply with WhatsApp Commerce & Business Policies.</li>
                <li>Provide clear help/opt‑out paths.</li>
                <li>Monitor quality; adjust frequency/content if ratings drop.</li>
              </ul>
            </div>
          </section>

          <section id="security" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">8) Security & Compliance</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>TLS in transit; restricted access and audit trails in Prime SMS.</li>
              <li>Role‑based permissions for sends, templates, and wallet.</li>
              <li>Opt‑in storage and retrieval for audits.</li>
              <li>Content and commerce policy checks prior to publishing templates.</li>
            </ul>
          </section>

          <section id="glossary" className="mb-10">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">9) Glossary</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><span className="font-semibold">WABA</span>: WhatsApp Business Account.</li>
              <li><span className="font-semibold">Template</span>: Pre‑approved, parameterized message for business‑initiated outreach.</li>
              <li><span className="font-semibold">Conversation</span>: 24‑hour billing window started by a template or user message.</li>
              <li><span className="font-semibold">Quality Rating</span>: Health score affecting reach and limits.</li>
              <li><span className="font-semibold">24‑hour window</span>: Period for free‑form service replies.</li>
            </ul>
          </section>

          <section id="faqs" className="mb-12">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">10) FAQs</h3>
            <div className="space-y-4 text-gray-700">
              <div>
                <p className="font-semibold">Can I send without a template?</p>
                <p>Yes, only when replying within the 24‑hour window.</p>
              </div>
              <div>
                <p className="font-semibold">How do I handle opt‑outs on WhatsApp?</p>
                <p>Respect blocks and provide quick‑reply options like “Stop”. Suppress future outreach.</p>
              </div>
              <div>
                <p className="font-semibold">Can I pause a bulk send?</p>
                <p>Yes. Pause/resume; unsent messages remain queued.</p>
              </div>
              <div>
                <p className="font-semibold">Do you support media?</p>
                <p>Yes. Use headers for images or documents in approved templates.</p>
              </div>
              <div>
                <p className="font-semibold">What if a template’s quality drops?</p>
                <p>You’ll see alerts; iterate copy, reduce frequency, or segment better before re‑sending.</p>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-6 text-gray-600 text-sm">
            <p>Prime SMS — WhatsApp messaging made simple, compliant, and scalable.</p>
          </div>
        </div>
      </main>
    </div>
  )
}



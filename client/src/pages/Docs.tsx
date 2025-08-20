import { FeatureSection } from '../components/FeatureSection';
import { BottomNav } from '../components/BottomNav';

export default function Docs() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 safe-top">
        <div className="mx-auto max-w-screen-md px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-sm">💬</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Prime SMS</h1>
          </div>
        </div>
      </header>

      <main id="content" className="flex-1 mx-auto w-full max-w-screen-md px-4 pb-24 safe-bottom">
        <div className="py-4">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">WhatsApp Business API</h2>
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 mb-4">
              <p className="text-sm">
                Mobile-optimized guide for Prime SMS WhatsApp features. Tap sections to expand.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <FeatureSection id="quick-bulk" title="Quick Send & Bulk Send (WhatsApp)">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Launch template-based messages instantly or at scale with preview, scheduling, and throttling.</p>
                
                <div>
                  <p className="font-semibold mb-2">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Templates only for business-initiated outreach (Marketing, Utility, Authentication)</li>
                    <li>Audience input: paste numbers or upload CSV/XLSX with variables</li>
                    <li>Scheduling: now, later, or recurring; timezone-aware</li>
                    <li>Real-time status: queued → sent → delivered → read → failed</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">CSV Example:</p>
                  <div className="bg-gray-100 rounded p-2 text-xs font-mono overflow-x-auto">
                    phone,first_name,order_id<br/>
                    +919876543210,Anaya,ODR-10234<br/>
                    +14155550123,John,ODR-55510
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Best Practices:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Send only to opted-in contacts</li>
                    <li>Keep variable counts minimal; verify with preview</li>
                    <li>Respect local quiet hours</li>
                  </ul>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="customize" title="Customize Message">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Personalize header/body/buttons and languages using approved placeholders.</p>
                
                <div>
                  <p className="font-semibold mb-2">What you can customize:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Header: text, image, or document</li>
                    <li>Body: short, clear text with {`{{placeholders}}`}</li>
                    <li>Footer: brief legal/help text</li>
                    <li>Buttons: Quick Reply, URL, or OTP (where template allows)</li>
                    <li>Language: manage multiple locales per template</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Example:</p>
                  <div className="bg-gray-100 rounded p-2 text-xs font-mono">
                    Hi {`{{first_name}}`}, your order {`{{order_id}}`} is on the way.
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Best Practices:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Avoid sensitive data in free text; use IDs/refs</li>
                    <li>Use branded short links for tracking clicks</li>
                    <li>Keep media lightweight; follow Meta size limits</li>
                  </ul>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="templates" title="Manage Templates">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Versioned WhatsApp templates with approval status and quality rating.</p>
                
                <div>
                  <p className="font-semibold mb-2">Lifecycle:</p>
                  <p className="text-sm">Draft → Review → Active → Archived (versioned with changelog)</p>
                </div>

                <div>
                  <p className="font-semibold mb-2">Key Controls:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Define variables; validate with sample data</li>
                    <li>Add languages; keep naming consistent</li>
                    <li>Configure header/body/footer and interactive buttons</li>
                    <li>Track Meta approval and quality rating (green/yellow/red)</li>
                    <li>Role-based permissions for create/edit/approve/publish</li>
                  </ul>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="reports" title="Manage Reports">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Track sent/delivered/read, clicks, and conversation categories.</p>
                
                <div>
                  <p className="font-semibold mb-2">Core Metrics:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Volume: queued, sent, delivered, read, failed</li>
                    <li>Engagement: link clicks (via short links), reply counts</li>
                    <li>Conversations: starts by category (Authentication/Utility/Marketing) and country</li>
                    <li>Quality: template quality rating, phone number quality, error codes</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Drill-down:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Per-message timeline with timestamps and WhatsApp error reasons</li>
                    <li>Export CSV/XLSX; schedule email exports</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Webhooks (optional):</p>
                  <p className="text-sm">Delivery/read updates and click events to your system with HMAC verification.</p>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="dashboards" title="Dashboards">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Realtime widgets for volume, quality, and wallet balance.</p>
                
                <div>
                  <p className="font-semibold mb-2">Widgets:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Today's WhatsApp traffic (sent/delivered/read/failed)</li>
                    <li>Conversation breakdown by category and country</li>
                    <li>Top templates by volume and success rate</li>
                    <li>Quality signals: template quality trend, phone number quality</li>
                    <li>Cost & wallet: balance, burn rate, low-balance alerts</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Controls:</p>
                  <p className="text-sm">Date filters, segment filters, saveable views.</p>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="wallet" title="Wallet-Based Billing">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Prepaid wallet; conversation-based charges by category & country.</p>
                
                <div>
                  <p className="font-semibold mb-2">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Top-ups: UPI/cards/net banking/bank transfer (region-dependent)</li>
                    <li>Deductions: per conversation window by category and country</li>
                    <li>Visibility: real-time balance, cost preview before send</li>
                    <li>Protections: low-balance alerts and auto-pause/resume</li>
                  </ul>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="wa-rules" title="WhatsApp Overview & Rules">
              <div className="space-y-3">
                <p><strong>Purpose:</strong> Opt-in, approved templates for outreach, and 24-hour service window.</p>
                
                <div>
                  <p className="font-semibold mb-2">Prerequisites:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Active WABA, approved phone number and display name</li>
                    <li>Opt-in captured and stored (web form, WhatsApp thread, POS, etc.)</li>
                    <li>Approved templates for business-initiated messages</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Message Types:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Template messages (business-initiated): use approved templates; variables only</li>
                    <li>Session messages (customer-initiated): free-form replies within 24-hour window</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Rules:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Respect the 24-hour customer-service window</li>
                    <li>Comply with WhatsApp Commerce & Business Policies</li>
                    <li>Provide clear help/opt-out paths</li>
                    <li>Monitor quality; adjust frequency/content if ratings drop</li>
                  </ul>
                </div>
              </div>
            </FeatureSection>
          </div>

          <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>Prime SMS — WhatsApp messaging made simple, compliant, and scalable.</p>
          </footer>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}



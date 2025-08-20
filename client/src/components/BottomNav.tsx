import { NavLink } from "react-router-dom";

interface NavItem {
  href: string;
  label: string;
  isHash?: boolean;
}

const items: NavItem[] = [
  { href: "#quick-bulk", label: "Send", isHash: true },
  { href: "#templates", label: "Templates", isHash: true },
  { href: "#reports", label: "Reports", isHash: true },
  { href: "/contact", label: "Contact", isHash: false },
];

export function BottomNav() {
  return (
    <nav 
      className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm safe-bottom"
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="mx-auto max-w-screen-md px-2 py-2 grid grid-cols-4 gap-1">
        {items.map((item) => (
          <li key={item.href}>
            {item.isHash ? (
              <a
                href={item.href}
                className="block text-center text-xs p-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors min-h-[44px] flex flex-col items-center justify-center"
              >
                <span className="font-medium text-gray-700">
                  {item.label}
                </span>
              </a>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) => 
                  `block text-center text-xs p-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors min-h-[44px] flex flex-col items-center justify-center ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                  }`
                }
              >
                <span className="font-medium">
                  {item.label}
                </span>
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
import { useState, type PropsWithChildren } from "react";

export interface FeatureSectionProps {
  id: string;
  title: string;
}

export function FeatureSection({ 
  id, 
  title, 
  children 
}: PropsWithChildren<FeatureSectionProps>) {
  const [open, setOpen] = useState(false);

  return (
    <section id={id} className="border border-gray-200 rounded-2xl p-3 bg-white shadow-sm">
      <button
        className="w-full text-left flex items-center justify-between gap-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg p-1"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        type="button"
      >
        <span className="text-base font-medium text-gray-900 flex-1 min-w-0">
          {title}
        </span>
        <span 
          className="shrink-0 text-lg w-6 h-6 flex items-center justify-center text-gray-600" 
          aria-hidden="true"
        >
          {open ? "−" : "+"}
        </span>
      </button>
      
      <div 
        id={`${id}-panel`} 
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          open ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="pt-3 text-gray-700 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}
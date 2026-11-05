import { ChevronDown } from 'lucide-react';

// The one build for a period or filter dropdown, so they cannot drift apart again: same height,
// same text, the app's thin chevron instead of the system's heavy arrow.
//
// It used to be several builds. A bordered box with a select inside got the phone's 44px minimum
// on the select PLUS its own padding (56px tall), the date pill was taller than the pills beside
// it, and the system arrow differed from every other chevron. 16px text on a phone because iOS
// zooms into a field under 16px; `compact` is for rows whose neighbours are 12px on larger screens,
// `tall` for a row whose neighbour is 42px (Billing's status tabs).
export const FilterSelect = ({ value, onChange, children, label, icon: Icon, compact = false, tall = false, className = '' }) => (
  <div className={`relative ${className}`}>
    {Icon && <Icon size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none" />}
    <select value={value} onChange={onChange} aria-label={label}
      className={`h-11 ${tall ? 'sm:h-[42px]' : 'sm:h-9'} w-full appearance-none ${Icon ? 'pl-9' : 'pl-3'} pr-9 bg-white border border-kt-line rounded-lg font-medium text-base ${compact ? 'sm:text-xs' : 'sm:text-sm'} text-kt-ink outline-none focus:border-kt-ink cursor-pointer`}>
      {children}
    </select>
    <ChevronDown size={14} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none" />
  </div>
);

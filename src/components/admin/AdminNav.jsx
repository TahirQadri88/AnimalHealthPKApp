// Admin navigation, grouped: what you read (Insights), what you spend (Money), what you set up.
//
// It replaced one horizontal bar of eleven tabs, of which a phone showed two and a half. On a
// desktop the groups are a rail beside the screen; on a phone and tablet one button names the
// screen you are on and opens a sheet with all eleven, so any screen is two taps away and
// Analytics, the default, needs none. The adminView keys are unchanged: the Dashboard's links
// into Admin and AuditView's load-on-open read them.
import { useState, useEffect } from 'react';
import { BarChart3, Wallet, Archive, Upload, Globe, Users, Settings, Truck, Activity, ChevronDown, X, Receipt } from 'lucide-react';
import { makeArrowNav } from '../../lib/a11y';

export const ADMIN_GROUPS = [
  { title: 'Insights', items: [['analytics', BarChart3, 'Analytics'], ['receivables', Receipt, 'Receivables'], ['audit', Activity, 'Activity']] },
  { title: 'Money', items: [['expenses', Wallet, 'Expenses']] },
  { title: 'Setup', items: [['masters', Archive, 'Masters'], ['segments', Globe, 'Segments'], ['users', Users, 'Users'], ['riders', Truck, 'Riders'], ['transportCos', Truck, 'Transport Cos'], ['settings', Settings, 'Settings'], ['bulk', Upload, 'Bulk Ops']] },
];
const ALL = ADMIN_GROUPS.flatMap(g => g.items);
const KEYS = ALL.map(([k]) => k);

const Item = ({ k, Icon, label, active, onPick, tabbable }) => (
  <button type="button" data-admintab={k} tabIndex={tabbable ? (active ? 0 : -1) : undefined}
    aria-current={active ? 'page' : undefined} onClick={() => onPick(k)}
    className={`w-full min-h-11 px-3 rounded-lg text-sm flex items-center gap-2.5 text-left transition-colors ${active ? 'bg-kt-yellow text-black font-medium' : 'text-kt-sub hover:bg-kt-raised hover:text-kt-ink'}`}>
    <Icon size={16} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />{label}
  </button>
);

/** Desktop rail (lg and up). */
export const AdminRail = ({ adminView, setAdminView }) => (
  <nav aria-label="Admin" className="hidden lg:flex flex-col gap-4 w-52 shrink-0 p-3 overflow-y-auto">
    {ADMIN_GROUPS.map(g => (
      <div key={g.title}>
        <p className="px-3 mb-1 text-xs font-medium text-kt-muted">{g.title}</p>
        <div className="space-y-0.5" onKeyDown={makeArrowNav(KEYS, adminView, setAdminView, 'data-admintab')}>
          {g.items.map(([k, Icon, label]) => <Item key={k} k={k} Icon={Icon} label={label} active={adminView === k} onPick={setAdminView} tabbable />)}
        </div>
      </div>
    ))}
  </nav>
);

/** Phone and tablet: the current screen's name, opening a sheet with every screen. */
export const AdminSwitcher = ({ adminView, setAdminView }) => {
  const [open, setOpen] = useState(false);
  const current = ALL.find(([k]) => k === adminView) || ALL[0];
  const [, CurIcon, curLabel] = current;
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [open]);
  const pick = (k) => { setAdminView(k); setOpen(false); };
  return (
    <div className="lg:hidden">
      <button type="button" data-admin-switcher="1" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        className="w-full h-11 px-3 bg-white border border-kt-line rounded-xl flex items-center gap-2.5 text-sm font-medium text-kt-ink">
        <CurIcon size={16} strokeWidth={1.5} aria-hidden="true" />{curLabel}
        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-kt-sub">All admin screens <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /></span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Admin screens" className="font-ui bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-4 pb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-2xl text-kt-ink">Admin</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-kt-sub hover:bg-kt-raised"><X size={18} strokeWidth={1.5} /></button>
            </div>
            {ADMIN_GROUPS.map(g => (
              <div key={g.title} className="mb-3">
                <p className="px-3 mb-1 text-xs font-medium text-kt-muted">{g.title}</p>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map(([k, Icon, label]) => <Item key={k} k={k} Icon={Icon} label={label} active={adminView === k} onPick={pick} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

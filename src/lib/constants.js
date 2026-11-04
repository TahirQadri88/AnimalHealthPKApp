// Fixed lists the UI groups by. Not settings — these are structural: an expense category
// belongs to one of these groups, and the colour is how the group reads at a glance in the
// expenses list. Adding a group means adding a colour, which is why they sit together.
export const EXPENSE_GROUPS = ['Transportation', 'Salary', 'Utilities', 'Office', 'Other'];
// Khyber Traders tokens; each pair measured at WCAG AA in the expense list.
export const EXPENSE_GROUP_COLORS = { Transportation: 'bg-kt-blue/10 text-kt-blue border-kt-blue/30', Salary: 'bg-kt-amber/10 text-kt-amber border-kt-amber/30', Utilities: 'bg-kt-green/10 text-kt-green border-kt-green/30', Office: 'bg-kt-red/10 text-kt-red border-kt-red/30', Other: 'bg-white text-kt-sub border-kt-line' };

// The vehicle types that carry one of our own riders, used as the fallback before the
// vehicleTypes registry has loaded. The registry is the source of truth once it exists.
export const RIDER_VEHICLE_TYPES = ['Rider', 'Rickshaw', 'Suzuki'];

// One bounded page of the activity log. auditLogs grows forever and must never get a
// listener — AuditView reads it once per visit, newest first, with this limit.
export const LOG_PAGE = 200;

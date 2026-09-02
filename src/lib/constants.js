// Fixed lists the UI groups by. Not settings — these are structural: an expense category
// belongs to one of these groups, and the colour is how the group reads at a glance in the
// expenses list. Adding a group means adding a colour, which is why they sit together.
export const EXPENSE_GROUPS = ['Transportation', 'Salary', 'Utilities', 'Office', 'Other'];
export const EXPENSE_GROUP_COLORS = { Transportation: 'bg-indigo-50 text-indigo-600 border-indigo-100', Salary: 'bg-amber-50 text-amber-600 border-amber-100', Utilities: 'bg-teal-50 text-teal-600 border-teal-100', Office: 'bg-purple-50 text-purple-600 border-purple-100', Other: 'bg-slate-100 text-slate-500 border-slate-200' };

// The vehicle types that carry one of our own riders, used as the fallback before the
// vehicleTypes registry has loaded. The registry is the source of truth once it exists.
export const RIDER_VEHICLE_TYPES = ['Rider', 'Rickshaw', 'Suzuki'];

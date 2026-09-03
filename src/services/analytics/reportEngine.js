// The analytics report engine.
//
// Roughly two hundred lines of money maths that lived inside a useMemo in AnalyticsView,
// where nothing could reach it. It is the largest piece of financial code in this project
// and it was the last piece with no tests — a bug in its credit-note handling was found on
// 2026-09-01 by reading it, not by anything failing.
//
// The body below is BYTE-IDENTICAL to the useMemo it came from. Only the wrapper changed:
// what were closure variables are now named parameters. That is what makes this a
// verifiable extraction rather than a rewrite of the numbers the business runs on.
//
// checkCustomFilter is passed in rather than rebuilt here, so the body needed no edit at
// all — it stays a closure over the component's date filter state.
//
// The parameter list was not guessed: it is exactly what `no-undef` reported once the body
// was on its own, which is an exhaustive answer rather than a careful one.
import { getPKTDate, getLocalDateStr } from '../../helpers';
import { computePnL } from './profitAndLoss';
import { buildAgingReport } from './receivables';

// buildAgingReport's bucket keys, mapped to the names the Analytics screen has always used.
const BUCKET_LISTS = [
  { from: 'current', to: 'current' },
  { from: 'd31_60', to: 'days30' },
  { from: 'd61_90', to: 'days60' },
  { from: 'd90plus', to: 'days90plus' },
];

export const buildReport = ({
  invoices, expenses, payments, products, customers,
  filterCompanies, filterCustomers, filterSalespersons,
  checkCustomFilter, getCustomerBalance, getPaymentStatus,
  dateFilter, customStart, customEnd,
}) => {
  let billedForPnL = invoices.filter(o => o.status === 'Billed' && checkCustomFilter(o.date));
  if(filterCustomers.size > 0) billedForPnL = billedForPnL.filter(o => filterCustomers.has(String(o.customerId)));
  if(filterSalespersons.size > 0) billedForPnL = billedForPnL.filter(o => filterSalespersons.has(String(o.salespersonId)));
  const kpis = { productRevenue: 0, totalCOGS: 0, grossMargin: 0, deliveryBilled: 0, transportExpense: 0, totalReceivables: 0 };
  const byProduct = {}; const byCompany = {}; const byCustomer = {}; const receivablesList = [];
  const bySalesperson = {};
  const byCity = {}; const byArea = {}; const byType = {};
  // Build customer segment lookup
  const custSegment = {};
  customers.forEach(c => { custSegment[c.name] = { city: c.city || '', area: c.area || '', type: c.customerType || '' }; });
  customers.forEach(c => { const bal = getCustomerBalance(c.id); if(bal > 0) { kpis.totalReceivables += bal; receivablesList.push({ name: c.name, id: c.id, amount: bal, phone: c.phone || '' }); } });
  billedForPnL.forEach(o => {
    kpis.deliveryBilled += Number(o.deliveryBilled || 0);
    kpis.transportExpense += Number(o.transportExpense || 0);
    if(!byCustomer[o.customerName]) byCustomer[o.customerName] = { productRevenue: 0, cost: 0, profit: 0, orders: 0 };
    byCustomer[o.customerName].orders += 1;
    const spName = o.salespersonName || 'Unknown';
    if(!bySalesperson[spName]) bySalesperson[spName] = { revenue: 0, profit: 0, orders: 0 };
    bySalesperson[spName].orders += 1;
    let orderItemRevenue = 0; let orderItemCost = 0;
    (o.items || []).forEach(item => {
      const itemCompanyId = products.find(p=>p.id===item.productId)?.companyId;
      if(filterCompanies.size > 0 && !filterCompanies.has(String(itemCompanyId))) return;
      const itemRev = item.price * item.quantity;
      const itemCost = (item.costPrice || 0) * item.quantity;
      orderItemRevenue += itemRev; orderItemCost += itemCost;
      if(!byProduct[item.name]) byProduct[item.name] = { qty: 0, revenue: 0, cost: 0, profit: 0, company: item.company || '' };
      byProduct[item.name].qty += item.quantity; byProduct[item.name].revenue += itemRev; byProduct[item.name].cost += itemCost; byProduct[item.name].profit += (itemRev - itemCost);
      if(!byCompany[item.company || 'Unknown']) byCompany[item.company || 'Unknown'] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
      byCompany[item.company || 'Unknown'].qty += item.quantity; byCompany[item.company || 'Unknown'].revenue += itemRev; byCompany[item.company || 'Unknown'].cost += itemCost; byCompany[item.company || 'Unknown'].profit += (itemRev - itemCost);
    });
    kpis.productRevenue += orderItemRevenue; kpis.totalCOGS += orderItemCost;
    byCustomer[o.customerName].productRevenue += orderItemRevenue; byCustomer[o.customerName].cost += orderItemCost; byCustomer[o.customerName].profit += (orderItemRevenue - orderItemCost);
    bySalesperson[spName].revenue += orderItemRevenue; bySalesperson[spName].profit += (orderItemRevenue - orderItemCost);
    const seg = custSegment[o.customerName] || {};
    const gp = orderItemRevenue - orderItemCost;
    ['city','area','type'].forEach(k => {
      const val = seg[k] || 'Unknown';
      const map = k === 'city' ? byCity : k === 'area' ? byArea : byType;
      if (!map[val]) map[val] = { revenue: 0, profit: 0, orders: 0 };
      map[val].revenue += orderItemRevenue; map[val].profit += gp; map[val].orders += 1;
    });
  });
  kpis.grossMargin = kpis.productRevenue - kpis.totalCOGS;
  const filteredExpenses = expenses.filter(e => checkCustomFilter(e.date));
  kpis.totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  kpis.netProfit = kpis.grossMargin + (kpis.deliveryBilled - kpis.transportExpense) - kpis.totalExpenses;
  // Expense breakdown by category
  const byExpenseCategory = {};
  filteredExpenses.forEach(e => { if(!byExpenseCategory[e.category]) byExpenseCategory[e.category] = 0; byExpenseCategory[e.category] += Number(e.amount); });
  // Previous period for comparison
  const getPrevDates = () => {
    const now = getPKTDate(); let days = 30;
    if (dateFilter === 'Today') days = 1; else if (dateFilter === 'This Week') days = 7; else if (dateFilter === 'This Month') days = 30; else if (dateFilter === 'This Year') days = 365;
    else if (dateFilter === 'Custom' && customStart) { const ms = new Date(customEnd) - new Date(customStart); days = Math.ceil(ms / 86400000) + 1; }
    const end = new Date(now); end.setDate(end.getDate() - days);
    const start = new Date(end); start.setDate(start.getDate() - days);
    return { start: getLocalDateStr(start), end: getLocalDateStr(end) };
  };
  const prevPeriod = getPrevDates();
  let prevRevenue = 0, prevProfit = 0;
  invoices.filter(o => o.status === 'Billed' && o.date >= prevPeriod.start && o.date <= prevPeriod.end).forEach(o => {
    (o.items || []).forEach(item => { prevRevenue += item.price * item.quantity; prevProfit += (item.price - (item.costPrice||0)) * item.quantity; });
  });
  const trends = {
    revenue: prevRevenue > 0 ? ((kpis.productRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null,
    profit: prevProfit > 0 ? ((kpis.grossMargin - prevProfit) / prevProfit * 100).toFixed(1) : null
  };
  // Daily breakdown with both revenue and profit
  const dailyBreakdown = {};
  billedForPnL.forEach(o => {
    if (!dailyBreakdown[o.date]) dailyBreakdown[o.date] = { revenue: 0, profit: 0, orders: 0 };
    let dayRevenue = 0, dayCost = 0;
    (o.items || []).forEach(item => { dayRevenue += item.price * item.quantity; dayCost += (item.costPrice||0) * item.quantity; });
    dailyBreakdown[o.date].revenue += dayRevenue; dailyBreakdown[o.date].profit += (dayRevenue - dayCost); dailyBreakdown[o.date].orders += 1;
  });
  // Receivables aging — buildAgingReport, not a second implementation.
  //
  // This used to age a customer's whole balance by the date of their most recent INVOICE,
  // which is the age of the last sale, not of the debt. Anything a customer bought reset
  // their entire outstanding balance to "current": on the same data, the Receivables screen
  // put Rs 118,500 in 90+ while this one put Rs 120,000 in current.
  //
  // buildAgingReport settles each debt oldest-first with the same rule as payment status,
  // and receivables.test.js asserts its totals equal the ledger exactly. Using it means the
  // two screens cannot disagree — and a customer's debt now SPLITS across buckets, because
  // an old unpaid bill and a fresh one are different ages.
  const today = getLocalDateStr();
  const aging = buildAgingReport({ customers, invoices, payments, asOf: today });
  const agingBuckets = { current: [], days30: [], days60: [], days90plus: [] };
  aging.rows.forEach(row => {
    BUCKET_LISTS.forEach(({ from, to }) => {
      const amount = row.buckets[from] || 0;
      if (amount <= 0.5) return;
      // Age the portion by the oldest debt sitting in THAT bucket, so the label under a
      // customer's name says how overdue this slice is rather than how long since they
      // last bought something.
      const ageDays = row.open.filter(d => d.bucket === from)
        .reduce((max, d) => Math.max(max, d.ageDays), 0);
      agingBuckets[to].push({
        id: row.customerId, name: row.name, phone: row.phone || '',
        amount, ageDays, oldestAgeDays: row.oldestAgeDays,
      });
    });
  });
  Object.values(agingBuckets).forEach(list => list.sort((a, b) => b.amount - a.amount));
  // All-time monthly breakdown (last 24 months, ignores current date filter)
  const monthlyData = {};
  invoices.filter(o => o.status === 'Billed').forEach(o => {
    const month = o.date.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0, orders: 0, cost: 0 };
    (o.items || []).forEach(item => { monthlyData[month].revenue += item.price * item.quantity; monthlyData[month].cost += (item.costPrice||0) * item.quantity; monthlyData[month].profit += (item.price - (item.costPrice||0)) * item.quantity; });
    monthlyData[month].orders += 1;
  });
  // Credit Note impact — subtract returned values from all metrics (after monthlyData is built)
  const creditNotes = invoices.filter(o => o.status === 'CreditNote' && checkCustomFilter(o.date) && (filterCustomers.size === 0 || filterCustomers.has(String(o.customerId))) && (filterSalespersons.size === 0 || filterSalespersons.has(String(o.salespersonId))));
  creditNotes.forEach(cn => {
    let cnRev = 0, cnCost = 0;
    (cn.items || []).forEach(item => {
      // Bonus lines are NOT skipped. Free stock carries a real costPrice and no price, so
      // giving it away is a loss of its cost — the billed loop above counts it that way —
      // and taking it back must return that cost. Skipping it here expensed returned free
      // stock forever, and left these breakdowns disagreeing with the headline P&L, which
      // computePnL derives symmetrically a few lines below.
      const rev = (item.price || 0) * (item.quantity || 0);
      const cost = (item.costPrice || 0) * (item.quantity || 0);
      const gp = rev - cost;
      cnRev += rev; cnCost += cost;
      kpis.productRevenue -= rev; kpis.totalCOGS -= cost; kpis.grossMargin -= gp;
      kpis.netProfit -= gp;
      const pKey = item.name;
      if (!byProduct[pKey]) byProduct[pKey] = { qty: 0, revenue: 0, cost: 0, profit: 0, company: item.company || '' };
      byProduct[pKey].qty -= (item.quantity || 0); byProduct[pKey].revenue -= rev; byProduct[pKey].cost -= cost; byProduct[pKey].profit -= gp;
      const cmpKey = item.company || 'Unknown';
      if (!byCompany[cmpKey]) byCompany[cmpKey] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
      byCompany[cmpKey].revenue -= rev; byCompany[cmpKey].cost -= cost; byCompany[cmpKey].profit -= gp;
    });
    const cnGP = cnRev - cnCost;
    // Customer breakdown
    if (!byCustomer[cn.customerName]) byCustomer[cn.customerName] = { productRevenue: 0, cost: 0, profit: 0, orders: 0 };
    byCustomer[cn.customerName].productRevenue -= cnRev;
    byCustomer[cn.customerName].cost -= cnCost;
    byCustomer[cn.customerName].profit -= cnGP;
    // Salesperson breakdown
    const cnSp = cn.salespersonName || 'Unknown';
    if (!bySalesperson[cnSp]) bySalesperson[cnSp] = { revenue: 0, profit: 0, orders: 0 };
    bySalesperson[cnSp].revenue -= cnRev; bySalesperson[cnSp].profit -= cnGP;
    // Segment breakdowns
    const cnSeg = custSegment[cn.customerName] || {};
    ['city', 'area', 'type'].forEach(k => {
      const val = cnSeg[k] || 'Unknown';
      const map = k === 'city' ? byCity : k === 'area' ? byArea : byType;
      if (map[val]) { map[val].revenue -= cnRev; map[val].profit -= cnGP; }
    });
    // Monthly trend
    const month = cn.date.slice(0, 7);
    if (monthlyData[month]) { monthlyData[month].revenue -= cnRev; monthlyData[month].cost -= cnCost; monthlyData[month].profit -= cnGP; }
    // Daily breakdown
    if (dailyBreakdown[cn.date]) { dailyBreakdown[cn.date].revenue -= cnRev; dailyBreakdown[cn.date].profit -= cnGP; }
  });
  kpis.creditNotesCount = creditNotes.length;

  // Sales returns, corrected. See services/analytics/profitAndLoss.js.
  //
  // Revenue above comes only from Billed invoices, so a credit note reduced nothing. The
  // P&L then showed "Gross Sales = revenue + returns" and subtracted the returns back off,
  // which cancelled out: a fully returned sale still reported profit, and the cost of the
  // goods that came back stayed in COGS.
  //
  // productRevenue and totalCOGS are reassigned to the NET figures. Every display already
  // adds returns back for its "Gross Sales" line and derives gross profit as
  // productRevenue − totalCOGS, so correcting the two inputs makes those lines right
  // without touching a thousand lines of presentation.
  //
  // Per-product, per-customer and per-company breakdowns further up remain gross; they are
  // adjusted separately by the credit-note loop above.
  const pnl = computePnL({
    billedInvoices: billedForPnL,
    creditNotes,
    expenses: filteredExpenses,
    includeItem: (item) => {
      if (filterCompanies.size === 0) return true;
      const cid = products.find(p => p.id === item.productId)?.companyId;
      return filterCompanies.has(String(cid));
    },
  });
  kpis.creditNotesTotal = pnl.salesReturns;
  kpis.productRevenue  = pnl.netSales;
  kpis.totalCOGS       = pnl.cogs;
  kpis.grossMargin     = pnl.grossProfit;
  kpis.netProfit       = pnl.netProfit;
  // All-time collection rate: (total ever billed − currently outstanding) / total ever billed
  // Period-filtered billing vs period-filtered payments is misleading (cross-period collections inflate to 100%)
  const allTimeBilled = invoices.filter(o => o.status === 'Billed').reduce((s, o) => s + o.total, 0);
  const allTimeOutstanding = receivablesList.reduce((s, r) => s + r.amount, 0);
  const collectionRate = allTimeBilled > 0 ? Math.max(0, Math.min(((allTimeBilled - allTimeOutstanding) / allTimeBilled) * 100, 100)).toFixed(1) : '0.0';
  const totalBilledAmt = billedForPnL.reduce((s, o) => s + o.total, 0);
  // Payment velocity: avg days from invoice date to first payment received for that customer
  let velDays = 0, velCount = 0;
  invoices.filter(o => o.status === 'Billed' && getPaymentStatus(o) === 'Paid').forEach(inv => {
    const pmt = payments.filter(p => String(p.customerId) === String(inv.customerId) && p.date >= inv.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (pmt) { const d = Math.floor((new Date(pmt.date) - new Date(inv.date)) / 86400000); if (d >= 0) { velDays += d; velCount++; } }
  });
  const avgDaysToPay = velCount > 0 ? Math.round(velDays / velCount) : null;
  // New vs repeat customers in period
  const custFirstOrderDate = {};
  invoices.filter(o => o.status === 'Billed').sort((a,b)=>a.date.localeCompare(b.date)).forEach(o => { if (!custFirstOrderDate[o.customerId]) custFirstOrderDate[o.customerId] = o.date; });
  const periodCustIds = [...new Set(billedForPnL.map(o => o.customerId))];
  let newCustCount = 0, repeatCustCount = 0;
  periodCustIds.forEach(id => { if (billedForPnL.some(o => o.customerId === id && o.date === custFirstOrderDate[id])) newCustCount++; else repeatCustCount++; });
  return { kpis, byProduct, byCompany, byCustomer, bySalesperson, byCity, byArea, byType, receivablesList: receivablesList.sort((a,b)=>b.amount-a.amount), trends, dailyBreakdown, byExpenseCategory, aging, agingBuckets, monthlyData, collectionRate, newCustCount, repeatCustCount, totalBilledAmt, avgDaysToPay };
};

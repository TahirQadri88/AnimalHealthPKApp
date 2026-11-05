import { useState, useEffect, useMemo, useContext } from 'react';
import { Search, Calendar, ChevronDown, Download, Printer, Share2, Users, Package, Zap, PhoneCall,
         AlertCircle, CheckCircle2, X,
         Award, Clock, DollarSign, Filter, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import { MultiPicker } from '../ui/MultiPicker';
import { FilterSelect } from '../ui/FilterSelect';

// Meaning colours as whole class strings, so Tailwind can find them. Analytics used to build
// names like `bg-${color}-50` at run time, which only rendered when the same class happened to
// be used somewhere else in the app.
const KT_TONE = {
  emerald: { border: 'border-kt-green/30', head: 'bg-kt-green/10 border-kt-green/30 text-kt-green' },
  amber:   { border: 'border-kt-amber/30', head: 'bg-kt-amber/10 border-kt-amber/30 text-kt-amber' },
  orange:  { border: 'border-kt-amber/30', head: 'bg-kt-amber/10 border-kt-amber/30 text-kt-amber' },
  rose:    { border: 'border-kt-red/30',   head: 'bg-kt-red/10 border-kt-red/30 text-kt-red' },
  indigo:  { border: 'border-kt-blue/30',  head: 'bg-kt-blue/10 border-kt-blue/30 text-kt-blue' },
};
import { APP_NAME, getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV } from '../../helpers';
import { makeArrowNav } from '../../lib/a11y';
import { buildReport } from '../../services/analytics/reportEngine';
import { drillDown, marginTrend } from '../../services/analytics/drilldown';
import { buildCollections } from '../../services/analytics/collections';
import { buildReturns } from '../../services/analytics/returns';
import { buildItemSales } from '../../services/analytics/itemSales';
import { buildExpenses } from '../../services/analytics/expenses';
import { previousPeriod } from '../../services/analytics/periods';
import { DrillDownModal } from '../modals/DrillDownModal';

export const AnalyticsView = () => {
const { getPaymentStatus, isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, cities, areas, customerTypes, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, analyticsView, setAnalyticsView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [view, setView] = useState(analyticsView || 'Overview');
useEffect(() => { if (analyticsView) { setView(analyticsView); setAnalyticsView(''); } }, [analyticsView]);
const [dateFilter, setDateFilter] = useState('This Month');
const [customStart, setCustomStart] = useState('');
const [customEnd, setCustomEnd] = useState(getLocalDateStr());
const [filterCompanies, setFilterCompanies] = useState(new Set());
const [filterCustomers, setFilterCustomers] = useState(new Set());
const [filterSalespersons, setFilterSalespersons] = useState(new Set());
const toggleFilter = (setter, id) => setter(prev => { const next = new Set(prev); next.has(String(id)) ? next.delete(String(id)) : next.add(String(id)); return next; });
const clearFilter = (setter) => setter(new Set());
const [sortBy, setSortBy] = useState('profit');
const [itemProdFilter, setItemProdFilter] = useState('');
const [itemCustFilter, setItemCustFilter] = useState('');
// Which breakdown row the drill-down is open on: { dimension, key, label }. Every table row
// is a button now — the figure and the documents behind it are one click apart.
const [drill, setDrill] = useState(null);
const openDrill = (dimension, key, label) => setDrill({ dimension, key, label: label ?? key });

const checkCustomFilter = (dateStr) => {
  if (dateFilter !== 'Custom') return checkDateFilter(dateStr, dateFilter);
  if (!customStart) return dateStr <= customEnd;
  return dateStr >= customStart && dateStr <= customEnd;
};

// The engine itself is src/services/analytics/reportEngine.js — extracted with its body
// byte-identical so the figures could not move, and tested there. The dependency array is
// unchanged: what it closes over is exactly what is now passed in.
const reportEngine = useMemo(() => buildReport({
  invoices, expenses, payments, products, customers,
  filterCompanies, filterCustomers, filterSalespersons,
  checkCustomFilter, getCustomerBalance, getPaymentStatus,
  dateFilter, customStart, customEnd,
}), [invoices, expenses, payments, dateFilter, customStart, customEnd, ...[...filterCompanies], ...[...filterCustomers], ...[...filterSalespersons], products, customers]);

// Money in. Deliberately its own service rather than another slab inside the engine above:
// it reads payments and the cash taken at billing, and none of the P&L inputs.
const collections = useMemo(() => buildCollections({
  invoices, payments, customers, checkCustomFilter, filterCustomers,
}), [invoices, payments, customers, dateFilter, customStart, customEnd, ...[...filterCustomers]]);

// Item Sales, lifted out of the view's own IIFE so an export can reach it. It could not
// before, so `getSortedExportData` returned null for this tab while the CSV and WhatsApp
// buttons stayed on screen — both threw on `null.some` / `null.forEach` when pressed.
const itemSalesRows = useMemo(() => buildItemSales({
  invoices, productQuery: itemProdFilter, customerQuery: itemCustFilter, checkCustomFilter,
}), [invoices, itemProdFilter, itemCustFilter, dateFilter, customStart, customEnd]);

// Where the money goes. The previous period comes from the same helper reportEngine uses
// for the revenue trend, so the two cannot mean different things by "vs previous period".
const expenseReport = useMemo(() => buildExpenses({
  expenses, expenseCategories, checkCustomFilter,
  prevPeriod: previousPeriod(dateFilter, customStart, customEnd),
}), [expenses, expenseCategories, dateFilter, customStart, customEnd]);

// What is coming back, and why. The reason is typed onto every credit note and was never
// read by anything.
const returns = useMemo(() => buildReturns({
  invoices, products, customers, checkCustomFilter,
  filterCompanies, filterCustomers, filterSalespersons,
}), [invoices, products, customers, dateFilter, customStart, customEnd, ...[...filterCompanies], ...[...filterCustomers], ...[...filterSalespersons]]);

const getSortedExportData = () => {
   if (view === 'Item Sales') return itemSalesRows.map(r => ({
     'Date': r.date, 'Invoice': r.invoiceId, 'Customer': r.customerName,
     'Product': r.name, 'Qty': r.qty, 'Rate (Rs)': r.rate, 'Amount (Rs)': r.sub,
   }));
   // Overview shows the same P&L as Insights, so it exports the same rows rather than
   // refusing with a toast — which is what "cannot export Overview as CSV" really meant.
   if (view === 'Insights' || view === 'Overview') {
     const kpis = reportEngine.kpis;
     const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
     const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
     const rows = [{ 'P&L Item': 'Gross Product Sales', 'Amount (Rs)': kpis.productRevenue + kpis.creditNotesTotal, 'Notes': '' }];
     if (kpis.creditNotesTotal > 0) rows.push({ 'P&L Item': 'Sales Returns', 'Amount (Rs)': -kpis.creditNotesTotal, 'Notes': `${kpis.creditNotesCount} credit notes` });
     rows.push({ 'P&L Item': 'Net Product Sales', 'Amount (Rs)': kpis.productRevenue, 'Notes': '' });
     rows.push({ 'P&L Item': 'Total COGS', 'Amount (Rs)': -kpis.totalCOGS, 'Notes': '' });
     rows.push({ 'P&L Item': 'Gross Profit', 'Amount (Rs)': kpis.grossMargin, 'Notes': `${gpMargin}% margin` });
     rows.push({ 'P&L Item': 'Delivery Revenue', 'Amount (Rs)': kpis.deliveryBilled, 'Notes': '' });
     rows.push({ 'P&L Item': 'Transport Expense', 'Amount (Rs)': -kpis.transportExpense, 'Notes': '' });
     rows.push({ 'P&L Item': 'Operational Expenses', 'Amount (Rs)': -kpis.totalExpenses, 'Notes': '' });
     rows.push({ 'P&L Item': 'Net Profit', 'Amount (Rs)': kpis.netProfit, 'Notes': `${netMargin}% net margin` });
     rows.push({ 'P&L Item': 'Billed This Period', 'Amount (Rs)': reportEngine.totalBilledAmt, 'Notes': 'invoice totals, delivery included' });
     rows.push({ 'P&L Item': 'Outstanding Receivables', 'Amount (Rs)': kpis.totalReceivables, 'Notes': `${reportEngine.collectionRate}% collected` });
     if (reportEngine.avgDaysToPay !== null) rows.push({ 'P&L Item': 'Avg Days to Pay', 'Amount (Rs)': '', 'Notes': `${reportEngine.avgDaysToPay} days` });
     rows.push({ 'P&L Item': `Active Customers: ${reportEngine.newCustCount + reportEngine.repeatCustCount}`, 'Amount (Rs)': '', 'Notes': `${reportEngine.newCustCount} new · ${reportEngine.repeatCustCount} repeat` });
     return rows;
   }
   // Aged by the debt, not by the last sale — and split, because an old unpaid bill and a
   // fresh one are different ages. Same figures as the Receivables admin screen.
   if (view === 'Receivables') return reportEngine.aging.rows.map(r => ({
     'Customer Name': r.name, 'Phone': r.phone || '',
     'Outstanding (Rs)': r.totalOutstanding, 'Oldest Debt (days)': r.oldestAgeDays,
     'Current 0-30 (Rs)': r.buckets.current || 0, '31-60 (Rs)': r.buckets.d31_60 || 0,
     '61-90 (Rs)': r.buckets.d61_90 || 0, '90+ (Rs)': r.buckets.d90plus || 0,
   }));
   if (view === 'Collections') return collections.rows.map(r => ({
     'Date': r.date, 'Reference': r.id, 'Customer': r.customerName,
     'Received (Rs)': r.received, 'Discount (Rs)': r.discount,
     'Method': r.method, 'Note': r.note, 'Collected By': r.collectedBy,
   }));
   if (view === 'Returns') return returns.rows.map(r => ({
     'Date': r.date, 'Credit Note': r.id, 'Original Invoice': r.originalInvoiceId,
     'Customer': r.customerName, 'Reason': r.reason,
     'Units': r.units, 'Value (Rs)': r.value, 'Cost (Rs)': r.cost,
     'Days Since Sale': r.daysSinceSale ?? '',
   }));
   if (view === 'Expenses') return expenseReport.rows.map(r => ({
     'Date': r.date, 'Category': r.category, 'Group': r.group,
     'Amount (Rs)': r.amount, 'Note': r.note,
   }));
   if (view === 'By Salesperson') return Object.entries(reportEngine.bySalesperson)
     .map(([key,val]) => ({ 'Staff Name': key, 'Orders': val.orders, 'Revenue (Rs)': val.revenue, 'Gross Profit (Rs)': val.profit,
       'Margin %': val.revenue > 0 ? +((val.profit/val.revenue)*100).toFixed(1) : 0 }))
     .sort((a,b)=>b['Revenue (Rs)']-a['Revenue (Rs)']);
   const segmentKey = view === 'By City' ? 'City' : view === 'By Area' ? 'Area' : view === 'By Type' ? 'Type' : null;
   const dataObj = view === 'By Product' ? reportEngine.byProduct : view === 'By Company' ? reportEngine.byCompany : view === 'By City' ? reportEngine.byCity : view === 'By Area' ? reportEngine.byArea : view === 'By Type' ? reportEngine.byType : reportEngine.byCustomer;
   let arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => b[sortBy] - a[sortBy]);
   if (view === 'By Product') return arr.map(r => ({
     'Product Name': r.key, 'Brand': r.company || '',
     'Qty Sold': r.qty || 0, 'Revenue (Rs)': r.revenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0, 'Margin %': (r.revenue||0) > 0 ? +((r.profit/r.revenue)*100).toFixed(1) : 0,
   }));
   if (view === 'By Company') return arr.map(r => ({
     'Brand Name': r.key,
     'Qty Sold': r.qty || 0, 'Revenue (Rs)': r.revenue || r.productRevenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0, 'Margin %': (r.revenue||r.productRevenue||0) > 0 ? +((r.profit/(r.revenue||r.productRevenue))*100).toFixed(1) : 0,
   }));
   const nameKey = segmentKey || 'Customer Name';
   return arr.map(r => ({
     [nameKey]: r.label || r.key,
     'Orders': r.orders || 0, 'Revenue (Rs)': r.revenue || r.productRevenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0,
   }));
};

const handleExport = (format) => {
    const title = `Analytics - ${view}`;
    const exportData = getSortedExportData();
    if (format === 'csv') {
        if (!exportData || !exportData.length) return showToast("Nothing to export on this tab yet", "error");
        const numericKeys = ['Revenue (Rs)', 'Gross Profit (Rs)', 'Cost (Rs)', 'Outstanding (Rs)', 'Qty Sold', 'Orders'];
        const csvTotals = {};
        numericKeys.forEach(k => { if (exportData.some(r => r[k] !== undefined)) csvTotals[k] = exportData.reduce((s,r)=>s+(Number(r[k])||0),0); });
        const filterDesc = [
          filterCompanies.size > 0 && `Brand: ${[...filterCompanies].map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join('+')}`,
          filterCustomers.size > 0 && `Client: ${[...filterCustomers].map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join('+')}`,
          filterSalespersons.size > 0 && `Staff: ${[...filterSalespersons].map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join('+')}`,
        ].filter(Boolean).join(' | ');
        exportToCSV(exportData, `${title.replace(/ /g,'_')}_${filterLabel.replace(/ /g,'_')}.csv`, {
          title: `${APP_NAME} — ${title}`,
          subtitle: `Period: ${filterLabel}${filterDesc ? ' | ' + filterDesc : ''} | Generated: ${getLocalDateStr()}`,
          totals: csvTotals,
        });
    } else if (format === 'pdf') {
        const appliedFilters = {
          companies: filterCompanies.size > 0 ? [...filterCompanies].map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ') : '',
          customers: filterCustomers.size > 0 ? [...filterCustomers].map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ') : '',
          salespersons: filterSalespersons.size > 0 ? [...filterSalespersons].map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join(', ') : '',
          customStart: dateFilter === 'Custom' ? customStart : '',
          customEnd: dateFilter === 'Custom' ? customEnd : '',
        };
        setPrintConfig({ docType: 'report', format: 'a5', data: { title, dateFilter: filterLabel, view, stats: reportEngine.kpis, rows: exportData, appliedFilters, generatedOn: getLocalDateStr() } });
    } else if (format === 'text') {
        const kpis = reportEngine.kpis;
        const margin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : 0;
        let text = `📊 *${APP_NAME}*\n*${title}* | Period: ${filterLabel}\n${'─'.repeat(30)}\n`;
        if (view === 'Overview') {
          text += `💰 *Sales & Profitability*\n`;
          text += `Product Sales: Rs. ${kpis.productRevenue.toLocaleString('en-US')}\n`;
          text += `Total COGS:    Rs. ${kpis.totalCOGS.toLocaleString('en-US')}\n`;
          text += `Gross Margin:  Rs. ${kpis.grossMargin.toLocaleString('en-US')} (${margin}%)\n`;
          text += `\n🚛 *Delivery*\n`;
          text += `Billed: Rs. ${kpis.deliveryBilled.toLocaleString('en-US')} | Expense: Rs. ${kpis.transportExpense.toLocaleString('en-US')}\n`;
          text += `\n💸 *Expenses*\n`;
          text += `Operational: Rs. ${kpis.totalExpenses.toLocaleString('en-US')}\n`;
          text += `\n${'─'.repeat(30)}\n`;
          text += `✅ *Net Profit: Rs. ${kpis.netProfit.toLocaleString('en-US')}*\n`;
          text += `📌 Receivables: Rs. ${kpis.totalReceivables.toLocaleString('en-US')}\n`;
          if (reportEngine.trends.revenue !== null) text += `📈 Revenue trend: ${Number(reportEngine.trends.revenue) >= 0 ? '+' : ''}${reportEngine.trends.revenue}% vs prev period\n`;
        } else if (view === 'Insights') {
          const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
          const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
          text += `💰 *P&L Summary*\n`;
          text += `Gross Sales:     Rs.${(kpis.productRevenue + kpis.creditNotesTotal).toLocaleString('en-US')}\n`;
          if (kpis.creditNotesTotal > 0) text += `Sales Returns:   - Rs.${kpis.creditNotesTotal.toLocaleString('en-US')}\n`;
          text += `Net Sales:       Rs.${kpis.productRevenue.toLocaleString('en-US')}\n`;
          text += `Total COGS:      - Rs.${kpis.totalCOGS.toLocaleString('en-US')}\n`;
          text += `Gross Profit:    Rs.${kpis.grossMargin.toLocaleString('en-US')} (${gpMargin}%)\n`;
          text += `Delivery Net:    + Rs.${(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}\n`;
          text += `Op. Expenses:    - Rs.${kpis.totalExpenses.toLocaleString('en-US')}\n`;
          text += `${'─'.repeat(30)}\n`;
          text += `✅ *Net Profit: Rs.${kpis.netProfit.toLocaleString('en-US')} (${netMargin}%)*\n`;
          text += `\n📌 *Key Metrics*\n`;
          text += `Receivables:     Rs.${kpis.totalReceivables.toLocaleString('en-US')}\n`;
          text += `Collection Rate: ${reportEngine.collectionRate}%\n`;
          if (reportEngine.avgDaysToPay !== null) text += `Avg Days to Pay: ${reportEngine.avgDaysToPay} days\n`;
          text += `Customers:       ${reportEngine.newCustCount + reportEngine.repeatCustCount} (${reportEngine.newCustCount} new, ${reportEngine.repeatCustCount} repeat)\n`;
          const topProduct = Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit)[0];
          const topCustomer = Object.values(reportEngine.byCustomer).sort((a,b) => b.productRevenue - a.productRevenue)[0];
          if (topProduct || topCustomer || reportEngine.trends.revenue !== null) {
            text += `\n⭐ *Smart Callouts*\n`;
            if (topProduct) text += `Top Product: ${topProduct[0]} — Rs.${topProduct[1].profit.toLocaleString('en-US')} GP\n`;
            if (topCustomer) text += `Top Customer: ${topCustomer.label} — Rs.${(topCustomer.productRevenue||0).toLocaleString('en-US')} revenue\n`;
            if (reportEngine.trends.revenue !== null) text += `Revenue Trend: ${Number(reportEngine.trends.revenue) >= 0 ? '+' : ''}${reportEngine.trends.revenue}% vs prev period\n`;
            if (reportEngine.agingBuckets.days90plus.length > 0) text += `⚠️ ${reportEngine.agingBuckets.days90plus.length} customer(s) overdue 90+ days\n`;
          }
        } else if (view === 'Receivables') {
          exportData.forEach((r, i) => {
            const name = r['Customer Name'] || '?';
            const outstanding = r['Outstanding (Rs)'] || 0;
            const days = r['Oldest Debt (days)'];
            text += `${i+1}. *${name}*\n`;
            text += `   Outstanding: Rs.${Number(outstanding).toLocaleString('en-US')}`;
            if (days != null) text += ` | ${days} days overdue`;
            text += `\n`;
          });
          if (exportData.length > 0) {
            const total = exportData.reduce((s,r)=>s+(r['Outstanding (Rs)']||0),0);
            text += `${'─'.repeat(30)}\nTotal Outstanding: Rs.${total.toLocaleString('en-US')}\n`;
          }
        } else if (view === 'Expenses') {
          const t = expenseReport.totals;
          text += `Spent: Rs.${t.amount.toLocaleString('en-US')} across ${t.count} entr${t.count === 1 ? 'y' : 'ies'}\n`;
          if (t.changePct !== null) text += `vs previous period: ${t.changePct >= 0 ? '+' : ''}${t.changePct}% (Rs.${t.prevAmount.toLocaleString('en-US')})\n`;
          text += `\n*By category*\n`;
          expenseReport.byCategory.forEach(c => {
            const move = c.changePct === null ? '' : ` (${c.changePct >= 0 ? '+' : ''}${c.changePct}%)`;
            text += `${c.key}: Rs.${c.amount.toLocaleString('en-US')}${move}\n`;
          });
        } else if (view === 'Returns') {
          const t = returns.totals;
          text += `Returned: Rs.${t.value.toLocaleString('en-US')} across ${t.count} credit note${t.count === 1 ? '' : 's'}\n`;
          text += `Return rate: ${t.ratePct}% of Rs.${t.grossSales.toLocaleString('en-US')} gross sales\n`;
          if (t.withoutReason > 0) text += `⚠️ ${t.withoutReason} with no reason recorded\n`;
          text += `\n*By reason*\n`;
          returns.byReason.forEach(x => { text += `${x.key}: Rs.${x.value.toLocaleString('en-US')} (${x.count})\n`; });
          text += `\n*Most returned*\n`;
          returns.byProduct.slice(0, 10).forEach((p, i) => {
            text += `${i+1}. ${p.key} — ${p.units} units, Rs.${p.value.toLocaleString('en-US')}\n`;
          });
        } else if (view === 'Collections') {
          const t = collections.totals;
          text += `Received: Rs.${t.received.toLocaleString('en-US')} in ${t.count} collection${t.count === 1 ? '' : 's'}\n`;
          text += `  At billing: Rs.${t.atBilling.toLocaleString('en-US')} | Receipts: Rs.${t.receipts.toLocaleString('en-US')}\n`;
          if (t.discount > 0) text += `  Round-off discount given: Rs.${t.discount.toLocaleString('en-US')}\n`;
          text += `\n*By method*\n`;
          collections.byMethod.forEach(m => { text += `${m.key}: Rs.${m.amount.toLocaleString('en-US')} (${m.count})\n`; });
          text += `\n*Top payers*\n`;
          collections.byCustomer.slice(0, 10).forEach((c, i) => {
            text += `${i+1}. ${c.name} — Rs.${c.amount.toLocaleString('en-US')}\n`;
          });
        } else if (view === 'Item Sales') {
          if (!exportData.length) return showToast("Search a product or customer first", "error");
          exportData.slice(0, 40).forEach((r, i) => {
            text += `${i+1}. ${r['Date']} · ${r['Invoice']} · ${r['Customer']}\n`;
            text += `   ${r['Product']} — ${r['Qty']} × Rs.${Number(r['Rate (Rs)']).toLocaleString('en-US')} = Rs.${Number(r['Amount (Rs)']).toLocaleString('en-US')}\n`;
          });
          if (exportData.length > 40) text += `... and ${exportData.length - 40} more lines\n`;
          const units = exportData.reduce((s,r)=>s+Number(r['Qty']||0),0);
          const amt = exportData.reduce((s,r)=>s+Number(r['Amount (Rs)']||0),0);
          text += `${'─'.repeat(30)}\nTotal: ${units.toLocaleString('en-US')} units · Rs.${amt.toLocaleString('en-US')}\n`;
        } else {
          if (!exportData || !exportData.length) return showToast("Nothing to export on this tab yet", "error");
          exportData.forEach((r, i) => {
            const name = r['Product Name'] || r['Brand Name'] || r['Customer Name'] || r['Staff Name'] || r['City'] || r['Area'] || r['Type'] || '?';
            const brand = r['Brand'] || '';
            const gp = r['Gross Profit (Rs)'] || 0;
            const rev = r['Revenue (Rs)'] || 0;
            const qty = r['Qty Sold'] || 0;
            const orders = r['Orders'] || 0;
            const gpMargin = rev > 0 ? ` (${((gp/rev)*100).toFixed(1)}%)` : '';
            text += `${i+1}. *${name}*${brand ? ` — ${brand}` : ''}\n`;
            if (qty) text += `   Qty: ${Number(qty).toLocaleString('en-US')} | `;
            if (orders) text += `   Orders: ${orders} | `;
            text += `Rev: Rs.${Number(rev).toLocaleString('en-US')} | GP: Rs.${Number(gp).toLocaleString('en-US')}${gpMargin}\n`;
          });
          if (exportData.length > 0) {
            const totalRev = exportData.reduce((s,r)=>s+(r['Revenue (Rs)']||0),0);
            const totalGP = exportData.reduce((s,r)=>s+(r['Gross Profit (Rs)']||0),0);
            text += `${'─'.repeat(30)}\nTotal Rev: Rs.${totalRev.toLocaleString('en-US')} | Total GP: Rs.${totalGP.toLocaleString('en-US')}\n`;
          }
        }
        navigator.clipboard.writeText(text).catch(()=>{});
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
        showToast("Report shared to WhatsApp!");
    }
};

const renderTable = (dataObj, type, dimension) => {
  // Ranking on revenue or profit alone makes a high-turnover low-margin line look like the
  // best in the business. Margin is a sort now, with revenue as the tie-break so a single
  // Rs 100 sale at 90% does not head the list.
  const marginOf = (r) => { const rev = r.revenue || r.productRevenue || 0; return rev > 0 ? (r.profit || 0) / rev : 0; };
  let arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => {
    if (sortBy === 'qty') return b.qty - a.qty;
    if (sortBy === 'revenue') return (b.revenue||b.productRevenue||0) - (a.revenue||a.productRevenue||0);
    if (sortBy === 'margin') return marginOf(b) - marginOf(a) || (b.revenue||b.productRevenue||0) - (a.revenue||a.productRevenue||0);
    if (sortBy === 'marginWorst') return marginOf(a) - marginOf(b) || (b.revenue||b.productRevenue||0) - (a.revenue||a.productRevenue||0);
    return b.profit - a.profit;
  });
  // ABC classification by cumulative revenue share. Computed on a revenue ranking of its
  // own, not on `arr`: the tier means "this line is in the top 80% of revenue", and reading
  // it off whatever order the user last chose made it mean nothing under any other sort.
  const totalRevAll = arr.reduce((s, r) => s + (r.revenue || r.productRevenue || 0), 0);
  const tierByKey = {};
  let cumRev = 0;
  [...arr].sort((a, b) => (b.revenue||b.productRevenue||0) - (a.revenue||a.productRevenue||0)).forEach(r => {
    cumRev += (r.revenue || r.productRevenue || 0);
    const pct = totalRevAll > 0 ? cumRev / totalRevAll : 1;
    tierByKey[r.key] = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
  });
  const arrWithABC = arr.map(r => ({ ...r, abcTier: tierByKey[r.key] }));
  const maxProfit = arrWithABC[0]?.profit || 1;
  const totalRev = arrWithABC.reduce((s, r) => s + (r.revenue || r.productRevenue || 0), 0);
  const totalGP = arrWithABC.reduce((s, r) => s + (r.profit || 0), 0);
  const totalQtyOrOrders = arrWithABC.reduce((s, r) => s + (r.qty || r.orders || 0), 0);
  const tierColors = { A: 'bg-kt-green/10 text-kt-green border-kt-green/30', B: 'bg-kt-amber/10 text-kt-amber border-kt-amber/30', C: 'bg-kt-raised text-kt-sub border-kt-line' };
  return (
    <div className="bg-white rounded-xl border border-kt-line overflow-hidden mt-3">
       <div className="bg-kt-raised border-b border-kt-line p-2 flex flex-wrap justify-between items-center gap-2">
         <span className="text-xs font-medium text-kt-sub ml-1 whitespace-nowrap">{arrWithABC.length} {type}s <span className="text-kt-muted hidden sm:inline">· ABC = revenue tier</span></span>
         <FilterSelect compact className="w-44 sm:w-52 shrink-0" value={sortBy} onChange={e=>setSortBy(e.target.value)} label="Sort">
           <option value="profit">Sort: Highest GP</option>
           <option value="revenue">Sort: Highest Revenue</option>
           <option value="margin">Sort: Best Margin</option>
           <option value="marginWorst">Sort: Worst Margin</option>
           {type !== 'Customer' && <option value="qty">Sort: Highest Qty</option>}
         </FilterSelect>
       </div>
       <div className="overflow-x-auto">
         <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
            <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
              <tr>
                <th className="p-3">{type}</th>
                {type !== 'Customer' && <th className="p-3 text-center">Qty</th>}
                {type === 'Customer' && <th className="p-3 text-center">Orders</th>}
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right">Rev%</th>
                <th className="p-3 text-right text-kt-green">GP</th>
                <th className="p-3 text-right text-kt-blue">Margin%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
              {arrWithABC.map((row, i) => {
                const rev = row.revenue || row.productRevenue || 0;
                const gp = row.profit || 0;
                const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0;
                const revShare = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : 0;
                const barW = maxProfit > 0 ? Math.max((gp / maxProfit) * 100, 0) : 0;
                return (
                  <tr key={i} className="hover:bg-kt-raised">
                    <td className="px-3 py-2 sm:p-3">
                      <button
                        className="text-left block whitespace-normal max-w-[15rem] sm:max-w-none"
                        title={`Show the transactions behind ${row.label || row.key}`}
                        onClick={() => openDrill(dimension, row.key, row.label || row.key)}
                      >
                        <span className="flex items-center gap-1.5">
                          <span title="Revenue tier: A = top sellers, C = smallest" className={`text-xs font-semibold px-1 py-0.5 rounded border ${tierColors[row.abcTier]}`}>{row.abcTier}</span>
                          <span className="font-medium text-kt-ink underline decoration-dotted decoration-kt-muted underline-offset-2">{row.label || row.key}</span>
                        </span>
                        {row.company && <span className="block text-xs text-kt-muted">{row.company}</span>}
                        <span className="block w-full bg-kt-raised rounded-full h-1 mt-1 max-w-[100px]"><span className="block bg-kt-primary h-1 rounded-full" style={{width:`${barW}%`}}></span></span>
                      </button>
                    </td>
                    {type !== 'Customer' && <td className="p-3 text-center bg-kt-raised/50 font-medium">{(row.qty||0).toLocaleString('en-US')}</td>}
                    {type === 'Customer' && <td className="p-3 text-center bg-kt-raised/50 font-medium">{row.orders||0}</td>}
                    <td className="p-3 text-right text-kt-ink font-medium">Rs.{rev.toLocaleString('en-US')}</td>
                    <td className="p-3 text-right text-kt-sub">{revShare}%</td>
                    <td className="p-3 text-right font-medium" style={{color: gp >= 0 ? 'rgb(var(--kt-green))' : 'rgb(var(--kt-red))'}}>Rs.{gp.toLocaleString('en-US')}</td>
                    <td className="p-3 text-right text-kt-blue font-medium">{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-kt-ink text-xs">
              <tr>
                <td className="p-3 text-kt-sub">Totals</td>
                <td className="p-3 text-center">{totalQtyOrOrders.toLocaleString('en-US')}</td>
                <td className="p-3 text-right">Rs.{totalRev.toLocaleString('en-US')}</td>
                <td className="p-3 text-right text-kt-sub">100%</td>
                <td className="p-3 text-right text-kt-green">Rs.{totalGP.toLocaleString('en-US')}</td>
                <td className="p-3 text-right text-kt-blue">{totalRev > 0 ? ((totalGP/totalRev)*100).toFixed(1) : 0}%</td>
              </tr>
            </tfoot>
         </table>
       </div>
    </div>
  );
};

const renderSegmentTable = (dataObj, label, dimension) => {
  const segMargin = (r) => (r.revenue > 0 ? (r.profit || 0) / r.revenue : 0);
  const arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => {
    if (sortBy === 'profit') return b.profit - a.profit;
    if (sortBy === 'margin') return segMargin(b) - segMargin(a) || b.revenue - a.revenue;
    if (sortBy === 'marginWorst') return segMargin(a) - segMargin(b) || b.revenue - a.revenue;
    return b.revenue - a.revenue;
  });
  const maxRev = arr[0]?.revenue || 1;
  return (
    <div className="bg-white rounded-xl border border-kt-line overflow-hidden mt-3">
      <div className="bg-kt-raised border-b border-kt-line p-2 flex flex-wrap justify-between items-center gap-2">
        <span className="text-xs font-medium text-kt-sub ml-2">{arr.length} {label}s</span>
        <FilterSelect compact className="w-44 sm:w-52 shrink-0" value={sortBy} onChange={e=>setSortBy(e.target.value)} label="Sort">
          <option value="revenue">Sort: Highest Revenue</option>
          <option value="profit">Sort: Highest GP</option>
          <option value="margin">Sort: Best Margin</option>
          <option value="marginWorst">Sort: Worst Margin</option>
        </FilterSelect>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
          <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
            <tr><th className="p-3">{label}</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right text-kt-green">GP</th><th className="p-3 text-right text-kt-blue">Margin%</th></tr>
          </thead>
          <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
            {arr.map((row, i) => {
              const rev = row.revenue || 0;
              const gp = row.profit || 0;
              const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0;
              const barW = maxRev > 0 ? Math.max((rev / maxRev) * 100, 0) : 0;
              return (
                <tr key={i} className="hover:bg-kt-raised">
                  <td className="px-3 py-2 sm:p-3">
                    <button
                      className="text-left block whitespace-normal max-w-[15rem] sm:max-w-none"
                      title={`Show the transactions behind ${row.key}`}
                      onClick={() => openDrill(dimension, row.key)}
                    >
                      <span className="font-medium text-kt-ink underline decoration-dotted decoration-kt-muted underline-offset-2">{row.key || '—'}</span>
                      <span className="block w-full bg-kt-raised rounded-full h-1 mt-1 max-w-[100px]"><span className="block bg-kt-primary h-1 rounded-full" style={{width:`${barW}%`}}></span></span>
                    </button>
                  </td>
                  <td className="p-3 text-center bg-kt-raised/50 font-medium">{row.orders||0}</td>
                  <td className="p-3 text-right font-medium text-kt-ink">Rs.{rev.toLocaleString('en-US')}</td>
                  <td className="p-3 text-right font-medium" style={{color: gp >= 0 ? 'rgb(var(--kt-green))' : 'rgb(var(--kt-red))'}}>Rs.{gp.toLocaleString('en-US')}</td>
                  <td className="p-3 text-right text-kt-blue font-medium">{margin}%</td>
                </tr>
              );
            })}
            {arr.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-kt-muted">No data. Add city/area/type to customers first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const filterLabel = (() => {
  const nowPKT = getPKTDate();
  if (dateFilter === 'Custom') return `${customStart||'...'} to ${customEnd}`;
  if (dateFilter === 'Today') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `Today, ${nowPKT.getDate()} ${months[nowPKT.getMonth()]} ${nowPKT.getFullYear()}`;
  }
  if (dateFilter === 'This Week') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today = new Date(nowPKT.getFullYear(), nowPKT.getMonth(), nowPKT.getDate());
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
    if (sameMonth) return `${months[startOfWeek.getMonth()]} ${startOfWeek.getDate()}–${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    return `${startOfWeek.getDate()} ${months[startOfWeek.getMonth()]} – ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
  }
  if (dateFilter === 'This Month') {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[nowPKT.getMonth()]} ${nowPKT.getFullYear()}`;
  }
  if (dateFilter === 'This Year') return `Year ${nowPKT.getFullYear()}`;
  return dateFilter;
})();

return (
  <div className="h-full flex flex-col p-4">
    {/* Filter Bar */}
    {/* Two by two on a phone, a row from sm up. Every pill is the same build: the date one used to be
        a bordered box around a select, which the phone's minimum sizes made taller than the rest. */}
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-3 shrink-0">
       <FilterSelect compact className="sm:shrink-0" value={dateFilter} onChange={e => setDateFilter(e.target.value)} label="Period" icon={Calendar}>
         <option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option><option>Custom</option>
       </FilterSelect>
       <MultiPicker label="Brand" Icon={Filter} items={companies} selected={filterCompanies}
         onToggle={id=>toggleFilter(setFilterCompanies,id)} onClear={()=>clearFilter(setFilterCompanies)} />
       <MultiPicker label="Client" Icon={Users} items={customers} selected={filterCustomers}
         onToggle={id=>toggleFilter(setFilterCustomers,id)} onClear={()=>clearFilter(setFilterCustomers)} />
       <MultiPicker label="Staff" Icon={Award} items={appUsers} selected={filterSalespersons}
         onToggle={id=>toggleFilter(setFilterSalespersons,id)} onClear={()=>clearFilter(setFilterSalespersons)} />
    </div>

    {/* Custom date inputs */}
    {dateFilter === 'Custom' && (
      <div className="flex gap-2 mb-3 shrink-0">
        <div className="flex-1"><label className="text-xs font-medium text-kt-sub block mb-1">From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="w-full p-2 bg-white border border-kt-line rounded-lg text-xs font-semibold outline-none focus:border-kt-ink"/></div>
        <div className="flex-1"><label className="text-xs font-medium text-kt-sub block mb-1">To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="w-full p-2 bg-white border border-kt-line rounded-lg text-xs font-semibold outline-none focus:border-kt-ink"/></div>
      </div>
    )}

    {/* View Tabs */}
    <ScrollableTabBar className="pb-2 shrink-0">
       {['Overview','Insights','Monthly Trend','By Product','By Company','By Customer','By City','By Area','By Type','By Salesperson','Receivables','Collections','Returns','Expenses','Item Sales'].map(v => (
         <button key={v} data-analytictab={v} tabIndex={view===v?0:-1}
           onClick={() => setView(v)}
           onKeyDown={makeArrowNav(['Overview','Insights','Monthly Trend','By Product','By Company','By Customer','By City','By Area','By Type','By Salesperson','Receivables','Collections','Returns','Expenses','Item Sales'],view,setView,'data-analytictab')}
           className={`h-11 sm:h-8 px-3 rounded-xl font-medium text-sm sm:text-xs whitespace-nowrap transition-colors ${view === v ? 'bg-kt-band text-white' : 'bg-white text-kt-sub border border-kt-line'}`}>{v}</button>
       ))}
    </ScrollableTabBar>

    {/* Active filter chips */}
    {(filterCompanies.size > 0 || filterCustomers.size > 0 || filterSalespersons.size > 0) && (
      <div className="flex flex-wrap gap-1.5 mb-2 px-0.5 shrink-0">
        {filterCompanies.size > 0 && <span className="bg-kt-blue/10 text-kt-blue text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          Brand: {[...filterCompanies].slice(0,2).map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ')}{filterCompanies.size > 2 && ` +${filterCompanies.size-2}`}
          <button onClick={()=>clearFilter(setFilterCompanies)} className="ml-1 text-kt-blue hover:text-kt-blue"><X size={10}/></button>
        </span>}
        {filterCustomers.size > 0 && <span className="bg-kt-green/10 text-kt-green text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          Client: {[...filterCustomers].slice(0,2).map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ')}{filterCustomers.size > 2 && ` +${filterCustomers.size-2}`}
          <button onClick={()=>clearFilter(setFilterCustomers)} className="ml-1 text-kt-green hover:text-kt-green"><X size={10}/></button>
        </span>}
        {filterSalespersons.size > 0 && <span className="bg-kt-amber/10 text-kt-amber text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          Staff: {[...filterSalespersons].slice(0,2).map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join(', ')}{filterSalespersons.size > 2 && ` +${filterSalespersons.size-2}`}
          <button onClick={()=>clearFilter(setFilterSalespersons)} className="ml-1 text-kt-amber hover:text-kt-amber"><X size={10}/></button>
        </span>}
      </div>
    )}

    {/* Export bar */}
    <div className="flex justify-between items-center gap-3 bg-white border border-kt-line px-3 py-2 rounded-xl my-2 shrink-0">
        <span className="text-sm font-medium text-kt-ink truncate">{filterLabel}</span>
        <div className="flex gap-2 shrink-0">
           {/* Three equal buttons: they used to be solid green, white and solid dark. */}
           <button onClick={()=>handleExport('text')} title="WhatsApp" aria-label="Share on WhatsApp" className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-kt-line bg-white hover:bg-kt-raised transition-colors"><Share2 size={16} strokeWidth={1.5}/></button>
           <button onClick={()=>handleExport('csv')} title="CSV" aria-label="Download CSV" className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-kt-line bg-white hover:bg-kt-raised transition-colors"><Download size={16} strokeWidth={1.5}/></button>
           <button onClick={()=>handleExport('pdf')} title="PDF, Image or Save — opens the document" aria-label="Print, PDF or image" className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-kt-line bg-white hover:bg-kt-raised transition-colors"><Printer size={16} strokeWidth={1.5}/></button>
        </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto pr-1 pb-24 space-y-3">
      {view === 'Overview' && (
        <div className="space-y-3">
           {/* Trend cards */}
           <div className="grid grid-cols-2 gap-3">
             {[
               { label: 'Revenue Trend', val: reportEngine.trends.revenue, icon: TrendingUp },
               { label: 'Profit Trend', val: reportEngine.trends.profit, icon: TrendingUp }
             ].map(({label, val, icon: Icon}) => (
               <div key={label} className="bg-white p-4 rounded-xl border border-kt-line">
                 <p className="text-xs font-medium text-kt-muted">{label}</p>
                 {val !== null ? (
                   <div className="flex items-center gap-1 mt-1">
                     <span className={`text-lg font-semibold ${Number(val) >= 0 ? 'text-kt-green' : 'text-kt-red'}`}>{Number(val) >= 0 ? '+' : ''}{val}%</span>
                     <span className="text-xs text-kt-muted">vs prev</span>
                   </div>
                 ) : <p className="text-xs text-kt-muted mt-1">No prior data</p>}
               </div>
             ))}
           </div>

           {/* New vs Repeat + Collection Rate quick stats */}
           <div className="grid grid-cols-3 gap-2">
             <div className="bg-white p-3 rounded-xl border border-kt-line text-center">
               <p className="text-xs font-medium text-kt-muted">New Clients</p>
               <p className="text-xl font-semibold text-kt-blue mt-0.5">{reportEngine.newCustCount}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-kt-line text-center">
               <p className="text-xs font-medium text-kt-muted">Repeat</p>
               <p className="text-xl font-semibold text-kt-green mt-0.5">{reportEngine.repeatCustCount}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-kt-line text-center">
               <p className="text-xs font-medium text-kt-muted">Collected</p>
               <p className={`text-xl font-semibold mt-0.5 ${Number(reportEngine.collectionRate) >= 80 ? 'text-kt-green' : Number(reportEngine.collectionRate) >= 50 ? 'text-kt-amber' : 'text-kt-red'}`}>{reportEngine.collectionRate}%</p>
             </div>
           </div>

           {/* Daily chart - revenue + profit bars */}
           {Object.keys(reportEngine.dailyBreakdown).length > 0 && (
             <div className="bg-white p-4 rounded-xl border border-kt-line">
               <div className="flex justify-between items-center mb-3">
                 <p className="text-xs font-medium text-kt-sub">Daily Sales</p>
                 <div className="flex gap-2 text-xs font-medium"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-kt-muted/40 inline-block"></span>Revenue</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-kt-primary inline-block"></span>Profit</span></div>
               </div>
               <div className="flex items-end gap-1 h-28 overflow-x-auto">
                 {Object.entries(reportEngine.dailyBreakdown).sort((a,b) => a[0].localeCompare(b[0])).slice(-21).map(([date, data]) => {
                   const maxRevenue = Math.max(...Object.values(reportEngine.dailyBreakdown).map(d => d.revenue), 1);
                   const rH = Math.max((data.revenue / maxRevenue) * 100, 4);
                   const pH = Math.max((Math.max(data.profit,0) / maxRevenue) * 100, 0);
                   return (
                     <div key={date} className="flex flex-col items-center min-w-[22px] group relative">
                       <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-kt-band text-white text-xs font-medium px-1.5 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                         {date.slice(5)}<br/>Rev: {data.revenue.toLocaleString('en-US')}<br/>GP: {data.profit.toLocaleString('en-US')}
                       </div>
                       <div className="flex gap-0.5 items-end" style={{height:'96px'}}>
                         <div className="w-2 bg-kt-muted/40 rounded-t" style={{height:`${rH}%`}}></div>
                         <div className="w-2 bg-kt-primary rounded-t" style={{height:`${pH}%`}}></div>
                       </div>
                       <span className="text-[8px] text-kt-muted mt-1">{date.slice(-2)}</span>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* Top 5 products */}
           <div className="bg-white p-4 rounded-xl border border-kt-line">
             <p className="text-xs font-medium text-kt-sub mb-3">Top 5 Products by GP</p>
             <div className="space-y-2">
               {Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit).slice(0, 5).map(([name, data], i) => {
                 const maxP = Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit)[0]?.[1].profit || 1;
                 return (
                   <div key={name} className="flex items-center gap-3">
                     <span className="w-5 h-5 bg-kt-raised rounded-full flex items-center justify-center text-xs font-medium text-kt-sub shrink-0">{i+1}</span>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between text-xs"><span className="font-semibold text-kt-ink truncate">{name}</span><span className="font-medium text-kt-green ml-2 shrink-0">Rs.{data.profit.toLocaleString('en-US')}</span></div>
                       <div className="w-full bg-kt-raised rounded-full h-1.5 mt-1"><div className="bg-kt-primary h-1.5 rounded-full" style={{width:`${Math.min((data.profit/maxP)*100,100)}%`}}></div></div>
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>

           {/* Expense breakdown by category */}
           {Object.keys(reportEngine.byExpenseCategory).length > 0 && (
             <div className="bg-white p-4 rounded-xl border border-kt-line">
               <p className="text-xs font-medium text-kt-sub mb-3">Expenses by Category</p>
               <div className="space-y-2">
                 {Object.entries(reportEngine.byExpenseCategory).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => {
                   const maxAmt = Math.max(...Object.values(reportEngine.byExpenseCategory), 1);
                   return (
                     <div key={cat} className="flex items-center gap-3">
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between text-xs"><span className="font-semibold text-kt-sub truncate">{cat}</span><span className="font-medium text-kt-red ml-2 shrink-0">Rs.{amt.toLocaleString('en-US')}</span></div>
                         <div className="w-full bg-kt-raised rounded-full h-1.5 mt-1"><div className="bg-kt-red h-1.5 rounded-full" style={{width:`${Math.min((amt/maxAmt)*100,100)}%`}}></div></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* P&L Card */}
           {(() => {
             const k = reportEngine.kpis;
             const gpPct = k.productRevenue > 0 ? ((k.grossMargin / k.productRevenue) * 100).toFixed(1) : '0.0';
             const netPct = k.productRevenue > 0 ? ((k.netProfit / k.productRevenue) * 100).toFixed(1) : '0.0';
             return (
               <div className="bg-kt-band text-white p-6 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-white/15">
                 <p className="text-xs font-medium text-white/70 mb-5 flex justify-between"><span>P&L Dashboard</span><span className="text-white">{filterLabel}</span></p>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm font-medium"><span className="text-white/70">Gross Product Sales</span><span className="font-medium text-white">Rs.{(k.productRevenue + k.creditNotesTotal).toLocaleString('en-US')}</span></div>
                   {k.creditNotesTotal > 0 && <div className="flex justify-between items-center text-xs"><span className="text-white/80">Sales Returns ({k.creditNotesCount})</span><span className="font-medium text-white/80">− Rs.{k.creditNotesTotal.toLocaleString('en-US')}</span></div>}
                   <div className="flex justify-between items-center text-sm font-medium"><span className="text-white/80">Total COGS</span><span className="font-medium text-white/80">- Rs.{k.totalCOGS.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-baseline"><span className="text-white text-sm font-semibold">Gross Profit</span><div className="text-right"><span className="font-medium text-white">Rs.{k.grossMargin.toLocaleString('en-US')}</span><span className="text-xs text-white ml-2">{gpPct}%</span></div></div>
                   <div className="h-px bg-white/10 my-1"></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-white/70">Delivery Billed</span><span className="font-medium text-white/70">+ Rs.{k.deliveryBilled.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-white/80">Transport Expenses</span><span className="font-medium text-white/80">- Rs.{k.transportExpense.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-white/80">Operational Expenses</span><span className="font-medium text-white/80">- Rs.{k.totalExpenses.toLocaleString('en-US')}</span></div>
                   <div className="h-px bg-white/10 my-1"></div>
                   <div className="flex justify-between items-baseline"><span className="font-medium text-kt-yellow text-xs">Net Profit</span><div className="text-right"><span className={`font-display text-2xl  ${k.netProfit >= 0 ? 'text-kt-yellow' : 'text-white/80'}`}>Rs.{k.netProfit.toLocaleString('en-US')}</span><span className={`text-xs ml-2 ${k.netProfit >= 0 ? 'text-kt-yellow' : 'text-white/80'}`}>{netPct}%</span></div></div>
                   <div className="h-px bg-white/10 my-1"></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-white/80 font-semibold">Outstanding Receivables</span><span className="font-medium text-white/80">Rs.{k.totalReceivables.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-white/80">Collection Rate (all-time)</span><span className={`font-medium ${Number(reportEngine.collectionRate) >= 80 ? 'text-kt-yellow' : Number(reportEngine.collectionRate) >= 50 ? 'text-white/80' : 'text-white/80'}`}>{reportEngine.collectionRate}%</span></div>
                 </div>
               </div>
             );
           })()}
        </div>
      )}

      {view === 'By Product' && renderTable(reportEngine.byProduct, 'Product', 'product')}
      {view === 'By Company' && renderTable(reportEngine.byCompany, 'Company', 'company')}
      {view === 'By Customer' && renderTable(reportEngine.byCustomer, 'Customer', 'customer')}
      {view === 'By City' && renderSegmentTable(reportEngine.byCity, 'City', 'city')}
      {view === 'By Area' && renderSegmentTable(reportEngine.byArea, 'Area', 'area')}
      {view === 'By Type' && renderSegmentTable(reportEngine.byType, 'Type', 'type')}

      {view === 'Item Sales' && (() => {
        const hasFilter = itemProdFilter.trim() || itemCustFilter.trim();
        const rows = itemSalesRows;
        const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
        const totalAmt = rows.reduce((s, r) => s + r.sub, 0);
        return (
          <div className="space-y-3 mt-3">
            <div className="bg-white p-4 rounded-xl border border-kt-line space-y-3">
              <p className="text-xs font-medium text-kt-sub flex items-center gap-1.5"><Search size={11}/> Filter</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none"/>
                  <input className="w-full pl-8 pr-3 py-2 bg-kt-raised border border-kt-line rounded-xl text-xs font-semibold outline-none focus:border-kt-ink focus:ring-1" placeholder="Product name…" value={itemProdFilter} onChange={e => setItemProdFilter(e.target.value)}/>
                </div>
                <div className="relative">
                  <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none"/>
                  <input className="w-full pl-8 pr-3 py-2 bg-kt-raised border border-kt-line rounded-xl text-xs font-semibold outline-none focus:border-kt-ink focus:ring-1" placeholder="Customer name…" value={itemCustFilter} onChange={e => setItemCustFilter(e.target.value)}/>
                </div>
              </div>
            </div>
            {!hasFilter && (
              <div className="bg-kt-raised border border-kt-line rounded-xl p-8 text-center">
                <Package size={28} className="mx-auto text-kt-muted mb-2"/>
                <p className="text-kt-sub font-semibold text-sm">Search a product or customer to see invoice-level sales</p>
              </div>
            )}
            {hasFilter && rows.length === 0 && (
              <div className="bg-kt-raised border border-kt-line rounded-xl p-6 text-center">
                <p className="text-kt-muted font-semibold text-sm">No results found for the current filters</p>
              </div>
            )}
            {hasFilter && rows.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-kt-blue/10 p-3 rounded-xl border border-kt-blue/30 text-center">
                    <p className="text-xs font-medium text-kt-blue">Invoices</p>
                    <p className="text-xl font-semibold text-kt-blue">{new Set(rows.map(r=>r.invoiceId)).size}</p>
                  </div>
                  <div className="bg-kt-green/10 p-3 rounded-xl border border-kt-green/30 text-center">
                    <p className="text-xs font-medium text-kt-green">Units</p>
                    <p className="text-xl font-semibold text-kt-green">{totalUnits.toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-kt-green/10 p-3 rounded-xl border border-kt-green/30 text-center">
                    <p className="text-xs font-medium text-kt-green">Revenue</p>
                    <p className="text-lg font-semibold text-kt-green">Rs.{totalAmt.toLocaleString('en-US')}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
                      <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                        <tr><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Invoice</th><th className="p-3">Product</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-kt-line">
                        {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-kt-raised">
                            <td className="p-3 text-kt-sub font-medium">{formatDateDisp(r.date)}</td>
                            <td className="p-3"><button className="font-semibold text-kt-ink hover:text-kt-blue transition-colors text-left" onClick={() => { setSelectedLedgerId(r.customerId); setShowLedgerModal(true); }}>{r.customerName}</button></td>
                            <td className="p-3"><button className="font-medium text-kt-blue hover:text-kt-blue hover:underline transition-colors" onClick={() => setPrintConfig({ docType: 'invoice', format: 'thermal', data: r.inv })}>{r.invoiceId}</button></td>
                            <td className="p-3 font-semibold text-kt-ink">{r.name}</td>
                            <td className="p-3 text-center font-medium text-kt-ink">{r.qty}</td>
                            <td className="p-3 text-right text-kt-sub">Rs.{r.rate.toLocaleString('en-US')}</td>
                            <td className="p-3 text-right font-medium text-kt-green">Rs.{r.sub.toLocaleString('en-US')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-xs">
                        <tr><td colSpan={4} className="p-3 text-kt-sub">Totals</td><td className="p-3 text-center">{totalUnits.toLocaleString('en-US')}</td><td></td><td className="p-3 text-right text-kt-green">Rs.{totalAmt.toLocaleString('en-US')}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {view === 'By Salesperson' && (
        <div className="bg-white rounded-xl border border-kt-line overflow-hidden mt-3">
          <div className="bg-kt-raised border-b border-kt-line p-3">
            <p className="text-xs font-medium text-kt-sub">{Object.keys(reportEngine.bySalesperson).length} Staff Members</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
              <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                <tr><th className="p-3">Staff</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right text-kt-green">GP</th><th className="p-3 text-right text-kt-blue">Margin%</th></tr>
              </thead>
              <tbody className="divide-y divide-kt-line">
                {Object.entries(reportEngine.bySalesperson).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name, data], i) => {
                  const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={i} className="hover:bg-kt-raised">
                      <td className="p-3 font-medium text-kt-ink">{name}</td>
                      <td className="p-3 text-center font-medium">{data.orders}</td>
                      <td className="p-3 text-right font-medium text-kt-ink">Rs.{data.revenue.toLocaleString('en-US')}</td>
                      <td className="p-3 text-right font-medium text-kt-green">Rs.{data.profit.toLocaleString('en-US')}</td>
                      <td className="p-3 text-right font-medium text-kt-blue">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-xs">
                {(() => { const totalRev = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.revenue,0); const totalGP = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.profit,0); const totalOrders = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.orders,0); return (<tr><td className="p-3 text-kt-sub">Totals</td><td className="p-3 text-center">{totalOrders}</td><td className="p-3 text-right">Rs.{totalRev.toLocaleString('en-US')}</td><td className="p-3 text-right text-kt-green">Rs.{totalGP.toLocaleString('en-US')}</td><td className="p-3 text-right text-kt-blue">{totalRev > 0 ? ((totalGP/totalRev)*100).toFixed(1) : 0}%</td></tr>); })()}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {view === 'Receivables' && (
        <div className="space-y-3 mt-3">
          {/* Collection rate summary. Two across from 400px: a figure like Rs.2,506,380 in 24px serif needs more than half of a 360px screen. */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl border border-kt-line">
              <p className="text-xs font-medium text-kt-muted">Collection Rate <span className="text-kt-muted">(All-time)</span></p>
              <p className={`font-display text-2xl mt-1 ${Number(reportEngine.collectionRate) >= 80 ? 'text-kt-green' : Number(reportEngine.collectionRate) >= 50 ? 'text-kt-amber' : 'text-kt-red'}`}>{reportEngine.collectionRate}%</p>
              <p className="text-xs text-kt-muted mt-1">of all-time billed amount recovered</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-kt-line">
              <p className="text-xs font-medium text-kt-muted">Outstanding</p>
              <p className="font-display text-2xl mt-1 text-kt-red">Rs.{reportEngine.kpis.totalReceivables.toLocaleString('en-US')}</p>
              <p className="text-xs text-kt-muted mt-1">{reportEngine.receivablesList.length} customers with balance</p>
            </div>
          </div>
          {/* Top Overdue Balances */}
          {(() => {
            // One customer can now hold debt in several buckets, so sum their 31+ slices
            // rather than listing the same name once per bucket.
            const byCust = new Map();
            [...reportEngine.agingBuckets.days30, ...reportEngine.agingBuckets.days60, ...reportEngine.agingBuckets.days90plus].forEach(r => {
              const prev = byCust.get(r.id);
              if (prev) { prev.amount += r.amount; prev.ageDays = Math.max(prev.ageDays, r.ageDays); }
              else byCust.set(r.id, { ...r });
            });
            const overdue = [...byCust.values()].sort((a,b)=>b.amount-a.amount).slice(0,5);
            if (!overdue.length) return null;
            return (
              <div className="bg-white rounded-xl border border-kt-red/30 overflow-hidden">
                <div className="bg-kt-red p-3 flex justify-between items-center">
                  <span className="text-xs font-medium text-white flex items-center gap-1.5"><AlertCircle size={13}/> Top Overdue Balances</span>
                  <span className="text-xs font-semibold text-white">{overdue.length} accounts · 31+ days</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {overdue.map((r,i) => (
                    <div key={i} className="flex justify-between items-center p-3">
                      <div className="flex-1 min-w-0">
                        <button className="font-semibold text-sm text-kt-ink truncate hover:text-kt-blue text-left w-full" onClick={()=>{setSelectedLedgerId(r.id);setShowLedgerModal(true);}}>{r.name}</button>
                        <p className="text-xs text-kt-red font-semibold">{r.ageDays} days overdue</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="font-semibold text-kt-red text-sm">Rs.{r.amount.toLocaleString('en-US')}</span>
                        {r.phone && <a href={`https://wa.me/92${r.phone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam o Alaikum ${r.name},\n\nYour outstanding balance is *Rs. ${r.amount.toLocaleString('en-US')}*. Kindly process payment at earliest.\n\nJazakAllah Khair`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 bg-kt-green/10 text-kt-green rounded-lg hover:bg-kt-green/10 border border-kt-green/30"><PhoneCall size={13}/></a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {[
            { label: '0–30 days', key: 'current', color: 'emerald' },
            { label: '31–60 days', key: 'days30', color: 'amber' },
            { label: '61–90 days', key: 'days60', color: 'orange' },
            { label: '90+ days (overdue)', key: 'days90plus', color: 'rose' }
          ].map(({ label, key, color }) => {
            const bucket = reportEngine.agingBuckets[key];
            if (!bucket.length) return null;
            const total = bucket.reduce((s,r)=>s+r.amount,0);
            // Spelled out: Tailwind cannot see an assembled `bg-${color}-50`.
            return (
              <div key={key} className={`bg-white rounded-xl border overflow-hidden ${KT_TONE[color].border}`}>
                <div className={`border-b p-3 flex justify-between items-center ${KT_TONE[color].head}`}>
                  <span className="text-xs font-medium">{label} ({bucket.length} account{bucket.length === 1 ? '' : 's'})</span>
                  <span className="text-xs font-semibold tabular-nums">Rs.{total.toLocaleString('en-US')}</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {bucket.map((r,i) => {
                    const waMsg = `Assalam o Alaikum ${r.name},\n\nYour outstanding balance with ${APP_NAME} is *Rs. ${r.amount.toLocaleString('en-US')}*.\n\nKindly process the payment at your earliest convenience.\n\nJazakAllah Khair`;
                    return (
                      <div key={i} className="flex justify-between items-center p-3">
                        <div className="flex-1 min-w-0">
                          <button className="text-left w-full block" onClick={() => { setSelectedLedgerId(r.id); setShowLedgerModal(true); }}>
                            <span className="block font-semibold text-sm text-kt-ink truncate hover:text-kt-blue transition-colors">{r.name}</span>
                            <span className="block text-xs text-kt-muted">{r.ageDays} days old{r.oldestAgeDays > r.ageDays ? ` · oldest debt ${r.oldestAgeDays}d` : ''}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="font-semibold text-kt-red text-sm">Rs.{r.amount.toLocaleString('en-US')}</span>
                          {r.phone && (
                            <a href={`https://wa.me/92${r.phone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 bg-kt-green/10 text-kt-green rounded-lg hover:bg-kt-green/10 transition-colors border border-kt-green/30" title="Send WhatsApp reminder">
                              <PhoneCall size={13}/>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {reportEngine.receivablesList.length === 0 && (
            <div className="bg-kt-green/10 p-6 rounded-xl text-center border border-kt-green/30">
              <CheckCircle2 className="mx-auto text-kt-green mb-2" size={32}/>
              <p className="font-medium text-kt-green">All accounts are clear!</p>
            </div>
          )}
        </div>
      )}

      {view === 'Expenses' && (() => {
        const t = expenseReport.totals;
        const maxCat = expenseReport.byCategory.reduce((m, c) => Math.max(m, c.amount), 0) || 1;
        const maxMonth = expenseReport.byMonth.reduce((m, c) => Math.max(m, c.amount), 0) || 1;
        const move = (pct) => pct === null ? null : (
          <span className={`text-xs font-semibold ${pct > 0 ? 'text-kt-red' : pct < 0 ? 'text-kt-green' : 'text-kt-muted'}`}>
            {pct > 0 ? '↑' : pct < 0 ? '↓' : '='} {Math.abs(pct)}%
          </span>
        );
        return (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-kt-line">
                <p className="text-xs font-medium text-kt-muted">Spent · {filterLabel}</p>
                <p className="font-display text-2xl mt-1 text-kt-red">Rs.{t.amount.toLocaleString('en-US')}</p>
                <p className="text-xs text-kt-muted mt-1">{t.count} entr{t.count === 1 ? 'y' : 'ies'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-kt-line">
                <p className="text-xs font-medium text-kt-muted">vs Previous Period</p>
                {t.changePct === null ? (
                  <p className="text-sm font-medium text-kt-muted mt-2">Nothing spent in the period before this one</p>
                ) : (
                  <>
                    <p className={`font-display text-2xl mt-1 ${t.changePct > 0 ? 'text-kt-red' : 'text-kt-green'}`}>{t.changePct >= 0 ? '+' : ''}{t.changePct}%</p>
                    <p className="text-xs text-kt-muted mt-1">was Rs.{t.prevAmount.toLocaleString('en-US')}</p>
                  </>
                )}
              </div>
            </div>

            {t.count === 0 && (
              <div className="bg-white p-8 rounded-xl text-center border border-kt-line">
                <p className="font-medium text-kt-muted">Nothing was spent in this period.</p>
              </div>
            )}

            {expenseReport.byMonth.length > 1 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Month by month <span className="text-kt-muted normal-case font-medium">· all time, not the selected period</span></span>
                </div>
                <div className="flex items-end gap-1 p-3 overflow-x-auto">
                  {expenseReport.byMonth.map(m => (
                    <div key={m.key} className="flex-1 min-w-[44px] text-center">
                      <div className="text-xs font-semibold text-kt-sub">{Math.round(m.amount / 1000)}k</div>
                      <div className="bg-kt-raised rounded mt-1" style={{ height: 44 }}>
                        <div className="bg-kt-red rounded" style={{ height: `${Math.max((m.amount / maxMonth) * 44, 2)}px`, marginTop: `${44 - Math.max((m.amount / maxMonth) * 44, 2)}px` }}></div>
                      </div>
                      <div className="text-[8px] text-kt-muted font-medium mt-1">{m.key.slice(2).replace('-', '/')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenseReport.byCategory.length > 0 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">By category, and how it moved</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {expenseReport.byCategory.map(c => (
                    <div key={c.key} className="p-3">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs font-medium text-kt-ink truncate">{c.key} <span className="text-kt-muted font-medium">({c.count})</span></span>
                        <span className="flex items-center gap-2 shrink-0">
                          {move(c.changePct)}
                          <span className="text-xs font-semibold text-kt-ink">Rs.{c.amount.toLocaleString('en-US')}</span>
                        </span>
                      </div>
                      <div className="w-full bg-kt-raised rounded-full h-1 mt-1"><div className="bg-kt-red h-1 rounded-full" style={{ width: `${Math.max((c.amount / maxCat) * 100, 1)}%` }}></div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenseReport.byGroup.length > 1 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">By group</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {expenseReport.byGroup.map(g => (
                    <div key={g.key} className="flex justify-between items-center p-3">
                      <span className="text-xs font-medium text-kt-ink">{g.key} <span className="text-kt-muted font-medium">({g.count})</span></span>
                      <span className="text-xs font-semibold text-kt-ink">Rs.{g.amount.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenseReport.rows.length > 0 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Every expense · newest first</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
                    <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                      <tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Group</th><th className="p-3">Note</th><th className="p-3 text-right">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
                      {expenseReport.rows.map(r => (
                        <tr key={r.id} className="hover:bg-kt-raised">
                          <td className="p-3 text-kt-sub">{formatDateDisp(r.date)}</td>
                          <td className="p-3 font-medium text-kt-ink">{r.category}</td>
                          <td className="p-3 text-kt-sub">{r.group}</td>
                          <td className="p-3 text-kt-muted max-w-[180px] truncate">{r.note}</td>
                          <td className="p-3 text-right font-semibold text-kt-red">Rs.{r.amount.toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-kt-ink text-xs">
                      <tr>
                        <td className="p-3 text-kt-sub" colSpan={4}>Total spent</td>
                        <td className="p-3 text-right text-kt-red">Rs.{t.amount.toLocaleString('en-US')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {view === 'Returns' && (() => {
        const t = returns.totals;
        const maxReason = returns.byReason.reduce((m, x) => Math.max(m, x.value), 0) || 1;
        const rateColor = t.ratePct >= 10 ? 'rose' : t.ratePct >= 5 ? 'amber' : 'emerald';
        const list = (title, note, items, unit) => (
          <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
            <div className="bg-kt-raised border-b border-kt-line p-3">
              <span className="text-xs font-medium text-kt-sub">{title}</span>
              {note && <span className="block text-xs text-kt-muted font-medium mt-0.5">{note}</span>}
            </div>
            <div className="divide-y divide-kt-line max-h-72 overflow-y-auto">
              {items.map(x => (
                <div key={x.key} className="p-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-medium text-kt-ink truncate">{x.key} <span className="text-kt-muted font-medium">({x.count})</span></span>
                    <span className="text-xs font-semibold text-kt-red shrink-0">Rs.{x.value.toLocaleString('en-US')}</span>
                  </div>
                  {unit && <p className="text-xs text-kt-muted mt-0.5">{x.units.toLocaleString('en-US')} units</p>}
                  <div className="w-full bg-kt-raised rounded-full h-1 mt-1"><div className="bg-kt-red h-1 rounded-full" style={{ width: `${Math.max((x.value / maxReason) * 100, 1)}%` }}></div></div>
                </div>
              ))}
              {items.length === 0 && <p className="p-4 text-center text-xs text-kt-muted">—</p>}
            </div>
          </div>
        );
        return (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-kt-line">
                <p className="text-xs font-medium text-kt-muted">Returned · {filterLabel}</p>
                <p className="font-display text-2xl mt-1 text-kt-red">Rs.{t.value.toLocaleString('en-US')}</p>
                <p className="text-xs text-kt-muted mt-1">{t.count} credit note{t.count === 1 ? '' : 's'} · {t.units.toLocaleString('en-US')} units</p>
              </div>
              <div className={`p-4 rounded-xl border ${KT_TONE[rateColor]?.head || 'bg-white border-kt-line text-kt-sub'}`}>
                <p className="text-xs font-medium">Return Rate</p>
                <p className="font-display text-2xl mt-1 text-kt-ink">{t.ratePct}%</p>
                <p className="text-xs text-kt-ink/80 mt-1">of Rs.{t.grossSales.toLocaleString('en-US')} gross sales</p>
              </div>
            </div>

            {t.withoutReason > 0 && (
              <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl p-3 flex justify-between items-center gap-2">
                <span className="text-xs font-medium text-kt-amber">{t.withoutReason} credit note{t.withoutReason === 1 ? '' : 's'} with no reason recorded — the field is on the form and was left blank</span>
              </div>
            )}

            {t.count === 0 && (
              <div className="bg-kt-green/10 p-6 rounded-xl text-center border border-kt-green/30">
                <CheckCircle2 className="mx-auto text-kt-green mb-2" size={32}/>
                <p className="font-medium text-kt-green">Nothing came back this period.</p>
              </div>
            )}

            {t.count > 0 && (
              <>
                {list('Why it came back', 'Free text on the credit note, grouped without regard to case', returns.byReason, false)}
                <div className="grid sm:grid-cols-2 gap-3">
                  {list('Most returned products', '', returns.byProduct, true)}
                  {list('Who returns most', '', returns.byCustomer, false)}
                </div>

                <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                  <div className="bg-kt-raised border-b border-kt-line p-3">
                    <span className="text-xs font-medium text-kt-sub">Every credit note · newest first</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
                      <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                        <tr><th className="p-3">Date</th><th className="p-3">Credit Note</th><th className="p-3">Customer</th><th className="p-3">Reason</th><th className="p-3 text-center">Days Out</th><th className="p-3 text-right">Value</th></tr>
                      </thead>
                      <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
                        {returns.rows.map(r => (
                          <tr key={r.id} className="hover:bg-kt-raised">
                            <td className="p-3 text-kt-sub">{formatDateDisp(r.date)}</td>
                            <td className="p-3">
                              <span className="font-medium text-kt-ink">{r.id}</span>
                              {r.originalInvoiceId && <span className="block text-xs text-kt-muted">ref {r.originalInvoiceId}</span>}
                            </td>
                            <td className="p-3">
                              <button className="hover:text-kt-blue text-left" onClick={() => { if (r.customerId !== undefined) { setSelectedLedgerId(r.customerId); setShowLedgerModal(true); } }}>{r.customerName}</button>
                            </td>
                            <td className={`p-3 ${r.hasReason ? 'text-kt-sub' : 'text-kt-amber font-medium'}`}>{r.reason}</td>
                            <td className="p-3 text-center text-kt-sub">{r.daysSinceSale ?? '—'}</td>
                            <td className="p-3 text-right font-semibold text-kt-red">Rs.{r.value.toLocaleString('en-US')}<span className="block text-xs font-medium text-kt-muted">{r.units} units</span></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-kt-ink text-xs">
                        <tr>
                          <td className="p-3 text-kt-sub" colSpan={5}>Total returned</td>
                          <td className="p-3 text-right text-kt-red">Rs.{t.value.toLocaleString('en-US')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {view === 'Collections' && (() => {
        const t = collections.totals;
        const maxDay = collections.byDay.reduce((m, d) => Math.max(m, d.amount), 0) || 1;
        const bar = (val, max, cls) => (
          <div className="w-full bg-kt-raised rounded-full h-1.5 mt-1">
            <div className={`${cls} h-1.5 rounded-full`} style={{ width: `${max > 0 ? Math.max((val / max) * 100, 1) : 0}%` }}></div>
          </div>
        );
        return (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-kt-line">
                <p className="text-xs font-medium text-kt-muted">Received · {filterLabel}</p>
                <p className="font-display text-2xl mt-1 text-kt-green">Rs.{t.received.toLocaleString('en-US')}</p>
                <p className="text-xs text-kt-muted mt-1">{t.count} collection{t.count === 1 ? '' : 's'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-kt-line">
                <p className="text-xs font-medium text-kt-muted">At Counter vs Receipts</p>
                <p className="text-base font-semibold mt-1 text-kt-ink">Rs.{t.atBilling.toLocaleString('en-US')}</p>
                <p className="text-xs text-kt-muted">taken when the bill was raised</p>
                <p className="text-base font-semibold mt-1 text-kt-ink">Rs.{t.receipts.toLocaleString('en-US')}</p>
                <p className="text-xs text-kt-muted">collected later</p>
              </div>
            </div>

            {t.discount > 0 && (
              <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl p-3 flex justify-between items-center">
                <span className="text-xs font-medium text-kt-amber">Round-off discount given — reduces the balance but was never received</span>
                <span className="text-sm font-semibold text-kt-amber shrink-0 ml-2">Rs.{t.discount.toLocaleString('en-US')}</span>
              </div>
            )}

            {t.count === 0 && (
              <div className="bg-white p-8 rounded-xl text-center border border-kt-line">
                <p className="font-medium text-kt-muted">Nothing came in during this period.</p>
              </div>
            )}

            {collections.byDay.length > 0 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Day by day</span>
                </div>
                <div className="divide-y divide-kt-line max-h-72 overflow-y-auto">
                  {[...collections.byDay].reverse().map(d => (
                    <div key={d.key} className="p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-kt-ink">{formatDateDisp(d.key)}</span>
                        <span className="text-xs font-semibold text-kt-green">Rs.{d.amount.toLocaleString('en-US')}</span>
                      </div>
                      {bar(d.amount, maxDay, 'bg-kt-primary')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">By method</span>
                  <span className="block text-xs text-kt-muted font-medium mt-0.5">Read from the payment note — there is no method field to record one</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {collections.byMethod.map(m => (
                    <div key={m.key} className="flex justify-between items-center p-3">
                      <span className="text-xs font-medium text-kt-ink">{m.key} <span className="text-kt-muted font-medium">({m.count})</span></span>
                      <span className="text-xs font-semibold text-kt-ink">Rs.{m.amount.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                  {collections.byMethod.length === 0 && <p className="p-4 text-center text-xs text-kt-muted">—</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Who collected it</span>
                  <span className="block text-xs text-kt-muted font-medium mt-0.5">Counter cash goes to the salesperson on the bill; a receipt records no one</span>
                </div>
                <div className="divide-y divide-kt-line">
                  {collections.byCollector.map(c => (
                    <div key={c.key} className="flex justify-between items-center p-3">
                      <span className="text-xs font-medium text-kt-ink">{c.key} <span className="text-kt-muted font-medium">({c.count})</span></span>
                      <span className="text-xs font-semibold text-kt-ink">Rs.{c.amount.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                  {collections.byCollector.length === 0 && <p className="p-4 text-center text-xs text-kt-muted">—</p>}
                </div>
              </div>
            </div>

            {collections.byCustomer.length > 0 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Who paid</span>
                </div>
                <div className="divide-y divide-kt-line max-h-96 overflow-y-auto">
                  {collections.byCustomer.map(c => (
                    <div key={c.key} className="flex justify-between items-center p-3 gap-2">
                      <button
                        className="flex-1 min-w-0 text-left text-xs font-medium text-kt-ink truncate hover:text-kt-blue"
                        onClick={() => { if (c.id !== undefined) { setSelectedLedgerId(c.id); setShowLedgerModal(true); } }}
                      >{c.name} <span className="text-kt-muted font-medium">({c.count})</span></button>
                      <span className="text-xs font-semibold text-kt-green shrink-0">Rs.{c.amount.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {collections.rows.length > 0 && (
              <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
                <div className="bg-kt-raised border-b border-kt-line p-3">
                  <span className="text-xs font-medium text-kt-sub">Every collection · newest first</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] sm:min-w-0 text-left text-xs whitespace-nowrap">
                    <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                      <tr><th className="p-3">Date</th><th className="p-3">Reference</th><th className="p-3">Customer</th><th className="p-3">Method</th><th className="p-3 text-right">Received</th></tr>
                    </thead>
                    <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
                      {collections.rows.map(r => (
                        <tr key={r.id} className="hover:bg-kt-raised">
                          <td className="p-3 text-kt-sub">{formatDateDisp(r.date)}</td>
                          <td className="p-3 font-medium text-kt-ink">{r.ref}</td>
                          <td className="p-3">
                            <button className="hover:text-kt-blue text-left" onClick={() => { if (r.customerId !== undefined) { setSelectedLedgerId(r.customerId); setShowLedgerModal(true); } }}>{r.customerName}</button>
                          </td>
                          <td className="p-3 text-kt-sub">{r.method}{r.note ? ` · ${r.note}` : ''}</td>
                          <td className="p-3 text-right font-semibold text-kt-green">Rs.{r.received.toLocaleString('en-US')}{r.discount > 0 && <span className="block text-xs font-medium text-kt-amber">+ Rs.{r.discount.toLocaleString('en-US')} disc.</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-kt-ink text-xs">
                      <tr>
                        <td className="p-3 text-kt-sub" colSpan={4}>Total received</td>
                        <td className="p-3 text-right text-kt-green">Rs.{t.received.toLocaleString('en-US')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Insights View ── */}
      {view === 'Insights' && (() => {
        const kpis = reportEngine.kpis;
        const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
        const topProduct = Object.entries(reportEngine.byProduct).sort((a,b)=>b[1].profit-a[1].profit)[0];
        const topCustomer = Object.values(reportEngine.byCustomer).sort((a,b)=>b.productRevenue-a.productRevenue)[0];
        const aProducts = Object.entries(reportEngine.byProduct).filter(([,v]) => {
          let cum = 0; const total = Object.values(reportEngine.byProduct).reduce((s,r)=>s+r.revenue,0);
          return (Object.entries(reportEngine.byProduct).sort((a,b)=>b[1].revenue-a[1].revenue).every(([k,d]) => { cum += d.revenue; return cum / total <= 0.8 || k === Object.keys(reportEngine.byProduct)[0]; }));
        }).length || Math.max(1, Math.ceil(Object.keys(reportEngine.byProduct).length * 0.2));
        const insightCards = [
          { label: 'Gross Margin', value: `${gpMargin}%`, sub: `Rs.${kpis.grossMargin.toLocaleString('en-US')} on Rs.${kpis.productRevenue.toLocaleString('en-US')} sales`, color: Number(gpMargin) >= 25 ? 'emerald' : Number(gpMargin) >= 15 ? 'amber' : 'rose', icon: TrendingUp },
          { label: 'Net Profit Margin', value: `${netMargin}%`, sub: `Rs.${kpis.netProfit.toLocaleString('en-US')} after all expenses`, color: Number(netMargin) >= 15 ? 'emerald' : Number(netMargin) >= 5 ? 'amber' : 'rose', icon: DollarSign },
          { label: 'Collection Rate', value: `${reportEngine.collectionRate}%`, sub: `all-time billed vs outstanding`, color: Number(reportEngine.collectionRate) >= 80 ? 'emerald' : Number(reportEngine.collectionRate) >= 50 ? 'amber' : 'rose', icon: Wallet },
          { label: 'Active Customers', value: `${reportEngine.newCustCount + reportEngine.repeatCustCount}`, sub: `${reportEngine.newCustCount} new · ${reportEngine.repeatCustCount} repeat`, color: 'indigo', icon: Users },
          { label: 'Billed This Period', value: `Rs.${reportEngine.totalBilledAmt.toLocaleString('en-US')}`, sub: 'invoice totals, delivery included', color: 'slate', icon: Receipt },
          ...(reportEngine.avgDaysToPay !== null ? [{ label: 'Avg Days to Pay', value: `${reportEngine.avgDaysToPay}d`, sub: reportEngine.avgDaysToPay <= 7 ? 'Excellent payment speed' : reportEngine.avgDaysToPay <= 21 ? 'Acceptable turnaround' : 'Slow — follow up needed', color: reportEngine.avgDaysToPay <= 7 ? 'emerald' : reportEngine.avgDaysToPay <= 21 ? 'amber' : 'rose', icon: Clock }] : []),
        ];
        return (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Written out in full: Tailwind cannot see a class assembled as `bg-${color}-50`, so the
                  tiles' colours depended on whether the same class happened to appear elsewhere. */}
              {insightCards.map(card => {
                const tone = { emerald: 'bg-kt-green/10 border-kt-green/30 text-kt-green', amber: 'bg-kt-amber/10 border-kt-amber/30 text-kt-amber',
                  rose: 'bg-kt-red/10 border-kt-red/30 text-kt-red', indigo: 'bg-kt-blue/10 border-kt-blue/30 text-kt-blue' }[card.color] || 'bg-white border-kt-line text-kt-sub';
                return (
                <div key={card.label} className={`p-4 rounded-xl border ${tone}`}>
                  <p className="text-xs font-medium mb-1 flex items-center gap-1"><card.icon size={12}/> {card.label}</p>
                  <p className="font-display text-2xl text-kt-ink">{card.value}</p>
                  <p className="text-xs text-kt-ink/80 mt-1">{card.sub}</p>
                </div>
                );
              })}
            </div>
            {/* Key callouts */}
            <div className="bg-white p-4 rounded-xl border border-kt-line space-y-3">
              <p className="text-xs font-medium text-kt-sub flex items-center gap-1.5"><Zap size={12} className="text-kt-amber"/> Smart Callouts</p>
              {topProduct && <div className="flex items-start gap-2 text-sm"><span className="text-kt-green font-semibold shrink-0">★</span><p className="text-kt-ink"><span className="font-medium">{topProduct[0]}</span> is your most profitable product — Rs.{topProduct[1].profit.toLocaleString('en-US')} GP ({topProduct[1].qty} units sold)</p></div>}
              {topCustomer && <div className="flex items-start gap-2 text-sm"><span className="text-kt-blue font-semibold shrink-0">★</span><p className="text-kt-ink"><button className="font-medium hover:text-kt-blue transition-colors" onClick={() => { if (topCustomer.id !== undefined) { setSelectedLedgerId(topCustomer.id); setShowLedgerModal(true); } }}>{topCustomer.label}</button> is your top customer — Rs.{(topCustomer.productRevenue||0).toLocaleString('en-US')} revenue in {topCustomer.orders} orders</p></div>}
              {reportEngine.agingBuckets.days90plus.length > 0 && <div className="flex items-start gap-2 text-sm"><span className="text-kt-red font-semibold shrink-0">!</span><p className="text-kt-ink"><span className="font-medium text-kt-red">{reportEngine.agingBuckets.days90plus.length} customer{reportEngine.agingBuckets.days90plus.length>1?'s':''}</span> overdue 90+ days — Rs.{reportEngine.agingBuckets.days90plus.reduce((s,r)=>s+r.amount,0).toLocaleString('en-US')} at risk</p></div>}
              {reportEngine.trends.revenue !== null && <div className="flex items-start gap-2 text-sm"><span className={`font-semibold shrink-0 ${Number(reportEngine.trends.revenue)>=0?'text-kt-green':'text-kt-red'}`}>{Number(reportEngine.trends.revenue)>=0?'↑':'↓'}</span><p className="text-kt-ink">Revenue is <span className="font-medium">{Number(reportEngine.trends.revenue)>=0?'up':'down'} {Math.abs(reportEngine.trends.revenue)}%</span> vs previous period</p></div>}
              {kpis.deliveryBilled > kpis.transportExpense && <div className="flex items-start gap-2 text-sm"><span className="text-kt-green font-semibold shrink-0">+</span><p className="text-kt-ink">Delivery net contribution: <span className="font-medium text-kt-green">Rs.{(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}</span></p></div>}
            </div>
            {/* P&L summary */}
            <div className="bg-kt-band text-white p-5 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              <p className="text-xs font-medium text-white/70 mb-4">P&L Summary · {filterLabel}</p>
              <div className="space-y-0">
                {[
                  ['Gross Sales', `Rs.${(kpis.productRevenue + kpis.creditNotesTotal).toLocaleString('en-US')}`, 'text-white', false],
                  ...(kpis.creditNotesTotal > 0 ? [['Sales Returns', `- Rs.${kpis.creditNotesTotal.toLocaleString('en-US')}`, 'text-white/80 text-xs', false]] : []),
                  ['COGS', `- Rs.${kpis.totalCOGS.toLocaleString('en-US')}`, 'text-white/80', false],
                  ['Gross Profit', `Rs.${kpis.grossMargin.toLocaleString('en-US')}`, 'text-white', gpMargin + '%'],
                  ['Delivery Net', `+ Rs.${(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}`, 'text-white/70', false],
                  ['Operational Expenses', `- Rs.${kpis.totalExpenses.toLocaleString('en-US')}`, 'text-white/80', false],
                  ['Net Profit', `Rs.${kpis.netProfit.toLocaleString('en-US')}`, kpis.netProfit >= 0 ? 'text-kt-yellow text-base font-semibold' : 'text-white/80 text-base font-semibold', netMargin + '%'],
                ].map(([label, val, cls, pct]) => (
                  <div key={label} className="flex justify-between items-center text-sm py-1.5 border-b border-white/15 last:border-0">
                    <span className="text-white/70">{label}</span>
                    <div className="text-right"><span className={`font-medium ${cls}`}>{val}</span>{pct && <span className="text-xs text-white/80 ml-1.5">{pct}</span>}</div>
                  </div>
                ))}
                <div className="h-px bg-white/10 my-2"></div>
                <div className="flex justify-between items-center text-xs py-1"><span className="text-white/80">Outstanding Receivables</span><span className="font-medium text-white/80">Rs.{kpis.totalReceivables.toLocaleString('en-US')}</span></div>
                <div className="flex justify-between items-center text-xs py-0.5"><span className="text-white/80">Collection Rate (all-time)</span><span className={`font-medium ${Number(reportEngine.collectionRate) >= 80 ? 'text-kt-yellow' : Number(reportEngine.collectionRate) >= 50 ? 'text-white/80' : 'text-white/80'}`}>{reportEngine.collectionRate}%</span></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Monthly Trend View ── */}
      {view === 'Monthly Trend' && (() => {
        const months = Object.keys(reportEngine.monthlyData).sort().slice(-18);
        if (months.length === 0) return <div className="text-center py-16 text-kt-muted">No billing data yet.</div>;
        const maxRev = Math.max(...months.map(m => reportEngine.monthlyData[m].revenue), 1);
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return (
          <div className="space-y-4 mt-2">
            {/* The trend is deliberately all-time. Nothing said so, and the chart therefore
                disagreed silently with every other figure on the page. */}
            <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl px-3 py-2">
              <p className="text-xs font-medium text-kt-amber">Last {months.length} months, all time — this view ignores the <span className="underline">{filterLabel}</span> filter above.</p>
            </div>
            {/* Chart */}
            <div className="bg-white p-4 rounded-xl border border-kt-line">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-medium text-kt-sub">Monthly Revenue & Profit</p>
                <div className="flex gap-2 text-xs font-medium"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-kt-muted/40 inline-block"></span>Revenue</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-kt-primary inline-block"></span>Profit</span></div>
              </div>
              <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{height:'130px'}}>
                {months.map(m => {
                  const d = reportEngine.monthlyData[m];
                  const rH = Math.max((d.revenue / maxRev) * 100, 3);
                  const pH = Math.max((Math.max(d.profit,0) / maxRev) * 100, 0);
                  const [yr, mo] = m.split('-');
                  return (
                    <div key={m} className="flex flex-col items-center min-w-[28px] group relative flex-1">
                      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-kt-band text-white text-xs font-medium px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                        {monthNames[parseInt(mo)-1]} {yr.slice(2)}<br/>Rev: Rs.{d.revenue.toLocaleString('en-US')}<br/>GP: Rs.{d.profit.toLocaleString('en-US')}<br/>Orders: {d.orders}
                      </div>
                      <div className="flex gap-0.5 items-end" style={{height:'100px'}}>
                        <div className="w-3 bg-kt-muted/40 rounded-t-sm" style={{height:`${rH}%`}}></div>
                        <div className="w-3 bg-kt-primary rounded-t-sm" style={{height:`${pH}%`}}></div>
                      </div>
                      <span className="text-[8px] text-kt-muted mt-1 font-semibold">{monthNames[parseInt(mo)-1].slice(0,3)}</span>
                      <span className="text-[7px] text-kt-muted">{yr.slice(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Monthly table */}
            <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
              <div className="bg-kt-raised border-b border-kt-line p-3">
                <p className="text-xs font-medium text-kt-sub">Month-by-Month Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-kt-raised text-kt-sub font-medium border-b border-kt-line">
                    <tr><th className="p-3">Month</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right text-kt-green">GP</th><th className="p-3 text-right text-kt-blue">Margin%</th></tr>
                  </thead>
                  <tbody className="divide-y divide-kt-line font-semibold text-kt-ink">
                    {months.slice().reverse().map(m => {
                      const d = reportEngine.monthlyData[m];
                      const margin = d.revenue > 0 ? ((d.profit / d.revenue) * 100).toFixed(1) : 0;
                      const [yr, mo] = m.split('-');
                      return (
                        <tr key={m} className="hover:bg-kt-raised">
                          <td className="p-3 font-medium text-kt-ink">{monthNames[parseInt(mo)-1]} {yr}</td>
                          <td className="p-3 text-center">{d.orders}</td>
                          <td className="p-3 text-right">Rs.{d.revenue.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right text-kt-red">Rs.{d.cost.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right font-medium text-kt-green">Rs.{d.profit.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right text-kt-blue">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-kt-raised border-t-2 border-kt-line font-semibold text-xs">
                    {(() => { const totRev = months.reduce((s,m)=>s+reportEngine.monthlyData[m].revenue,0); const totGP = months.reduce((s,m)=>s+reportEngine.monthlyData[m].profit,0); const totOrd = months.reduce((s,m)=>s+reportEngine.monthlyData[m].orders,0); const totCost = months.reduce((s,m)=>s+reportEngine.monthlyData[m].cost,0); return (<tr><td className="p-3 text-kt-sub">Totals ({months.length}mo)</td><td className="p-3 text-center">{totOrd}</td><td className="p-3 text-right">Rs.{totRev.toLocaleString('en-US')}</td><td className="p-3 text-right text-kt-red">Rs.{totCost.toLocaleString('en-US')}</td><td className="p-3 text-right text-kt-green">Rs.{totGP.toLocaleString('en-US')}</td><td className="p-3 text-right text-kt-blue">{totRev > 0 ? ((totGP/totRev)*100).toFixed(1) : 0}%</td></tr>); })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {drill && (
        <DrillDownModal
          result={drillDown({
            dimension: drill.dimension, key: drill.key,
            invoices, products, customers,
            checkCustomFilter, filterCompanies, filterCustomers, filterSalespersons,
          })}
          label={drill.label}
          periodLabel={filterLabel}
          trend={marginTrend(drillDown({
            dimension: drill.dimension, key: drill.key,
            invoices, products, customers,
            filterCompanies, filterCustomers, filterSalespersons,
          }).rows)}
          onClose={() => setDrill(null)}
          onOpenLedger={(id) => { setDrill(null); setSelectedLedgerId(id); setShowLedgerModal(true); }}
        />
      )}

    </div>
  </div>
);

};

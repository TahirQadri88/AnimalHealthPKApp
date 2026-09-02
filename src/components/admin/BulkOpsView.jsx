import { useState, useEffect, useContext } from 'react';
import { Upload, Download, ArrowUpDown, AlertCircle } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { getLocalDateStr, exportToCSV, shareOrDownload } from '../../helpers';

export const BulkOpsView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, riders, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [bulkProducts, setBulkProducts] = useState([]);
const [bulkSearch, setBulkSearch] = useState('');
const [bulkEffectiveDate, setBulkEffectiveDate] = useState(getLocalDateStr());
const [activeExportTab, setActiveExportTab] = useState('items');
useEffect(() => { setBulkProducts(products); }, [products]);
const handleBulkSave = async () => {
let updatedCount = 0; let costUpdateCount = 0;
for (const bp of bulkProducts) {
const orig = products.find(p => p.id === bp.id);
if (orig && (orig.costPrice !== bp.costPrice || orig.sellingPrice !== bp.sellingPrice || orig.available !== bp.available || orig.name !== bp.name || orig.unit !== bp.unit || orig.unitsInBox !== bp.unitsInBox)) {
  await saveToFirebase('products', bp.id, {...orig, ...bp});
  updatedCount++;
  // Apply updated cost price retroactively to invoices from effective date onwards
  if (orig.costPrice !== bp.costPrice) {
    const affected = invoices.filter(inv => inv.date >= bulkEffectiveDate);
    for (const inv of affected) {
      const updatedItems = inv.items.map(item => item.productId === bp.id ? { ...item, costPrice: bp.costPrice } : item);
      if (updatedItems.some((item, i) => item.costPrice !== inv.items[i]?.costPrice)) {
        await saveToFirebase('invoices', inv.id, { ...inv, items: updatedItems });
        costUpdateCount++;
      }
    }
  }
}
}
const msg = costUpdateCount > 0
  ? `Updated ${updatedCount} products. Cost re-applied to ${costUpdateCount} invoice${costUpdateCount !== 1 ? 's' : ''} from ${bulkEffectiveDate}`
  : `Updated ${updatedCount} items`;
showToast(msg);
};
const downloadImportTemplate = () => {
const templateData = [{ Name: "Sample Product A", Company: "Pharma Co", Unit: "Vial", BoxQty: 1, Cost: 100, Selling: 150 }, { Name: "Sample Product B", Company: "AgriMed", Unit: "Strip", BoxQty: 10, Cost: 500, Selling: 650 }];
exportToCSV(templateData, 'Item_Import_Template.csv');
};
const handleImportCSV = (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = async (event) => {
const text = event.target.result;
const rows = text.split(/\r?\n/).filter(r => r.trim());
if(!rows || rows.length < 2) return showToast("File is empty or invalid", "error");
const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
const reqHeaders = ['name', 'company', 'unit', 'boxqty', 'cost', 'selling'];
const missing = reqHeaders.filter(h => !headers.includes(h));
if(missing.length > 0) return showToast(`Missing columns: ${missing.join(', ')}`, "error");
let addedCount = 0; let updatedCount = 0;
// Build local map to prevent duplicate companies during batch import
const localCompanyMap = {};
companies.forEach(c => { localCompanyMap[c.name.toLowerCase()] = c.id; });
for (let i = 1; i < rows.length; i++) {
const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
if(cols.length < reqHeaders.length) continue;
const rowData = {};
reqHeaders.forEach(h => { rowData[h] = cols[headers.indexOf(h)]; });
if(!rowData.name || !rowData.selling || !rowData.cost) continue;
let compId;
const compName = rowData.company || 'Unknown';
const compNameLower = compName.toLowerCase();
if (localCompanyMap[compNameLower]) { compId = localCompanyMap[compNameLower]; } else {
compId = Date.now();
await saveToFirebase('companies', compId, { id: compId, name: compName });
localCompanyMap[compNameLower] = compId;
}
const existingProd = products.find(p => p.name.toLowerCase() === rowData.name.toLowerCase());
const prodObj = { name: rowData.name, companyId: compId, unit: rowData.unit || 'Unit', unitsInBox: Number(rowData.boxqty) || 1, costPrice: Number(rowData.cost) || 0, sellingPrice: Number(rowData.selling) || 0, available: true };
if (existingProd) { await saveToFirebase('products', existingProd.id, { ...existingProd, ...prodObj }); updatedCount++; }
else { const newId = Date.now(); await saveToFirebase('products', newId, { ...prodObj, id: newId }); addedCount++; }
}
showToast(`Done! ${addedCount} added, ${updatedCount} updated.`);
};
reader.readAsText(file);
e.target.value = '';
};
const handleImportCustomers = (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = async (event) => {
const text = event.target.result;
const rows = text.split(/\r?\n/).filter(r => r.trim());
if(!rows || rows.length < 2) return showToast("File is empty or invalid", "error");
const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
let addedCount = 0; let updatedCount = 0;
for (let i = 1; i < rows.length; i++) {
const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
const get = (field) => cols[headers.indexOf(field)] || '';
const name = get('name');
if (!name) continue;
const custObj = { name, contactPerson: get('contact'), phone: get('phone'), address1: get('address1'), map1: get('map1'), address2: get('address2'), map2: get('map2'), openingBalance: Number(get('openingbalance')) || 0 };
const existing = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
if (existing) { await saveToFirebase('customers', existing.id, {...existing, ...custObj}); updatedCount++; }
else { const newId = Date.now(); await saveToFirebase('customers', newId, {...custObj, id: newId}); addedCount++; }
}
showToast(`Done! ${addedCount} added, ${updatedCount} updated.`);
};
reader.readAsText(file);
e.target.value = '';
};
const exportAll = async () => {
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const wb = ['\uFEFF'];
wb.push('=== ITEMS ===');
wb.push(['ID','Name','Company','Unit','BoxQty','Cost','Selling','Status'].join(','));
products.forEach(p => wb.push([p.id, q(p.name), q(getCompanyName(p.companyId)), q(p.unit), p.unitsInBox, p.costPrice, p.sellingPrice, p.available?'Active':'Inactive'].join(',')));
wb.push(''); wb.push('=== CUSTOMERS ===');
wb.push(['ID','Name','Contact','Phone','Email','City','Area','Type','Address1','Map1','Address2','Map2','OpeningBalance','CreditLimit'].join(','));
customers.forEach(c => wb.push([c.id, q(c.name), q(c.contactPerson||''), q(c.phone||''), q(c.email||''), q(c.city||''), q(c.area||''), q(c.customerType||''), q(c.address1||''), q(c.map1||''), q(c.address2||''), q(c.map2||''), c.openingBalance||0, c.creditLimit||0].join(',')));
wb.push(''); wb.push('=== INVOICES ===');
wb.push(['ID','Date','Customer','Status','IsCreditNote','Total','Delivery','Transport','Vehicle','TransportCo','BiltyNo','DriverName','DriverPhone','RiderID','ReceivedAmt','Salesperson','PaymentStatus','Notes'].join(','));
invoices.forEach(o => wb.push([q(o.id), o.date, q(o.customerName), o.status, o.isCreditNote?'Yes':'', o.total, o.deliveryBilled||0, o.transportExpense||0, q(o.vehicle||''), q(o.transportCompany||''), q(o.biltyNumber||''), q(o.driverName||''), q(o.driverPhone||''), o.riderId||'', o.receivedAmount||0, q(o.salespersonName||''), o.paymentStatus||'', q(o.notes||'')].join(',')));
wb.push(''); wb.push('=== PAYMENTS ===');
wb.push(['ID','Date','CustomerID','Customer','Amount','Note'].join(','));
const cMap = Object.fromEntries(customers.map(c=>[c.id, c.name]));
payments.forEach(p => wb.push([q(p.id), p.date, p.customerId, q(cMap[p.customerId]||''), p.amount, q(p.note||'')].join(',')));
wb.push(''); wb.push('=== RIDERS ===');
wb.push(['ID','Name','Phone','VehicleType','VehicleNumber'].join(','));
riders.forEach(r => wb.push([r.id, q(r.name), q(r.phone||''), q(r.vehicleType||''), q(r.vehicleNumber||'')].join(',')));
const blob = new Blob([wb.join('\n')], {type:'text/csv;charset=utf-8;'});
await shareOrDownload(blob, 'AnimalHealthPK_MasterData.csv');
showToast('Master data exported!');
};
const visibleProducts = bulkProducts.filter(p => !bulkSearch || p.name.toLowerCase().includes(bulkSearch.toLowerCase()));
return (
<div className="flex-1 overflow-y-auto p-4 pb-24">
{/* Export Section */}
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-indigo-600"/> Export Master Data</h3>
<div className="flex flex-wrap gap-2 mb-2">
<button onClick={() => setActiveExportTab('items')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='items'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Items</button>
<button onClick={() => setActiveExportTab('clients')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='clients'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Clients</button>
<button onClick={() => setActiveExportTab('invoices')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='invoices'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Invoices</button>
<button onClick={() => setActiveExportTab('payments')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='payments'?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600'}`}>Payments</button>
<button onClick={() => setActiveExportTab('riders')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='riders'?'bg-amber-500 text-white':'bg-slate-100 text-slate-600'}`}>Riders</button>
<button onClick={() => setActiveExportTab('all')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='all'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>All</button>
</div>
{activeExportTab === 'items' && <button onClick={() => { const data = products.map(p => ({ ID: p.id, Name: p.name, Company: getCompanyName(p.companyId), Unit: p.unit, BoxQty: p.unitsInBox, Cost: p.costPrice, Selling: p.sellingPrice, Status: p.available ? 'Active' : 'Inactive' })); exportToCSV(data, 'Items_Master.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {products.length} Items as CSV</button>}
{activeExportTab === 'clients' && <button onClick={() => { const data = customers.map(c => ({ ID: c.id, Name: c.name, Contact: c.contactPerson||'', Phone: c.phone||'', Email: c.email||'', AltPhone: c.altPhone||'', City: c.city||'', Area: c.area||'', Type: c.customerType||'', Address1: c.address1||'', Map1: c.map1||'', Address2: c.address2||'', Map2: c.map2||'', OpeningBalance: c.openingBalance||0, CreditLimit: c.creditLimit||0 })); exportToCSV(data, 'Customers_Master.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {customers.length} Clients as CSV</button>}
{activeExportTab === 'invoices' && <button onClick={() => { const data = invoices.map(o => ({ ID: o.id, Date: o.date, Customer: o.customerName, Status: o.status, IsCreditNote: o.isCreditNote?'Yes':'', Total: o.total, Delivery: o.deliveryBilled||0, Transport: o.transportExpense||0, Vehicle: o.vehicle||'', TransportCo: o.transportCompany||'', BiltyNo: o.biltyNumber||'', DriverName: o.driverName||'', DriverPhone: o.driverPhone||'', RiderID: o.riderId||'', DeliveryAddrKey: o.deliveryAddressKey||'', ReceivedAmt: o.receivedAmount||0, Salesperson: o.salespersonName||'', PaymentStatus: o.paymentStatus||'', Notes: o.notes||'' })); exportToCSV(data, 'Invoices_Export.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {invoices.length} Invoices as CSV</button>}
{activeExportTab === 'payments' && <button onClick={() => { const cMap = Object.fromEntries(customers.map(c=>[c.id, c.name])); const data = payments.map(p => ({ ID: p.id, Date: p.date, CustomerID: p.customerId, Customer: cMap[p.customerId]||'', Amount: p.amount, Note: p.note||'' })); exportToCSV(data, 'Payments_Export.csv'); }} className="w-full bg-emerald-50 border border-emerald-100 text-emerald-700 py-2.5 rounded-xl font-bold text-xs">Export {payments.length} Payments as CSV</button>}
{activeExportTab === 'riders' && <button onClick={() => { const data = riders.map(r => ({ ID: r.id, Name: r.name, Phone: r.phone||'', VehicleType: r.vehicleType||'', VehicleNumber: r.vehicleNumber||'' })); exportToCSV(data, 'Riders_Master.csv'); }} className="w-full bg-amber-50 border border-amber-100 text-amber-700 py-2.5 rounded-xl font-bold text-xs">Export {riders.length} Riders as CSV</button>}
{activeExportTab === 'all' && <button onClick={exportAll} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm">Export Full Master Data (CSV)</button>}
</div>

     {/* Fix Duplicate Companies */}
     {isAdmin && (() => {
       const seen = {}; const dupes = [];
       companies.forEach(c => {
         const k = c.name.trim().toLowerCase();
         if (seen[k]) dupes.push(c); else seen[k] = c;
       });
       if (dupes.length === 0) return null;
       return (
         <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl mb-4">
           <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5"><AlertCircle size={14}/> {dupes.length} Duplicate {dupes.length === 1 ? 'Company' : 'Companies'} Found</p>
           <p className="text-[10px] text-rose-600 mb-3">These were created by previous imports. Click to merge them and fix all product references.</p>
           <button onClick={async () => {
             if(!await showConfirm(`Merge ${dupes.length} duplicate compan${dupes.length > 1 ? 'ies' : 'y'}? This will re-assign all linked products and cannot be undone.`)) return;
             const canonical = {};
             companies.forEach(c => { const k = c.name.trim().toLowerCase(); if (!canonical[k]) canonical[k] = c.id; });
             let fixed = 0;
             for (const dupe of dupes) {
               const keepId = canonical[dupe.name.trim().toLowerCase()];
               if (keepId === dupe.id) continue;
               const affected = products.filter(p => String(p.companyId) === String(dupe.id));
               for (const p of affected) { await saveToFirebase('products', p.id, { ...p, companyId: keepId }); }
               await deleteFromFirebase('companies', dupe.id);
               fixed++;
             }
             showToast(`Merged ${fixed} duplicate companies`);
           }} className="w-full bg-rose-600 text-white py-2 rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors">
             Fix {dupes.length} Duplicate{dupes.length > 1 ? 's' : ''} Now
           </button>
         </div>
       );
     })()}

     {/* Import Section */}
     <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Upload size={14} className="text-emerald-600"/> Import Data</h3>
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Items</p>
             <p className="text-[9px] text-slate-400 mb-2 leading-tight">Columns: Name, Company, Unit, BoxQty, Cost, Selling</p>
             <div className="flex gap-1.5">
               <button onClick={downloadImportTemplate} className="flex-1 bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg font-bold text-[10px]">Template</button>
               <label className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg font-bold text-[10px] cursor-pointer text-center"><input type="file" accept=".csv" className="hidden" onChange={handleImportCSV}/>Import</label>
             </div>
           </div>
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Clients</p>
             <p className="text-[9px] text-slate-400 mb-2 leading-tight">Columns: Name, Contact, Phone, Address1, Map1, OpeningBalance</p>
             <div className="flex gap-1.5">
               <button onClick={() => exportToCSV([{Name:'Sample Clinic',Contact:'Dr Ali',Phone:'0300-0000000',Address1:'DHA Karachi',Map1:'https://maps.app.goo.gl/...',OpeningBalance:0}], 'Customer_Import_Template.csv')} className="flex-1 bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg font-bold text-[10px]">Template</button>
               <label className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg font-bold text-[10px] cursor-pointer text-center"><input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers}/>Import</label>
             </div>
           </div>
        </div>
     </div>

     {/* Bulk Price Edit */}
     <div className="flex-none bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden" style={{minHeight: '300px'}}>
        <div className="p-3 border-b border-slate-200 flex flex-col gap-2 bg-slate-50">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 shrink-0"><ArrowUpDown size={15}/> Quick Edit</h3>
              <input value={bulkSearch} onChange={e=>setBulkSearch(e.target.value)} placeholder="Search..." className="flex-1 p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-semibold bg-white"/>
            </div>
            <button onClick={handleBulkSave} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm shrink-0">Save All</button>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <AlertCircle size={12} className="text-amber-600 shrink-0"/>
            <span className="text-[10px] font-bold text-amber-700 shrink-0">Cost Effective From:</span>
            <input type="date" value={bulkEffectiveDate} onChange={e=>setBulkEffectiveDate(e.target.value)}
              className="text-[10px] font-bold text-amber-900 bg-transparent outline-none border-0 cursor-pointer"/>
            <span className="text-[9px] text-amber-600 hidden sm:block">— Cost price changes will update invoices from this date</span>
          </div>
        </div>
        <div className="overflow-auto" style={{maxHeight: '400px'}}>
           <table className="w-full text-left text-xs whitespace-nowrap min-w-[760px]">
              <thead className="text-slate-500 uppercase font-bold tracking-wider bg-slate-50 sticky top-0"><tr><th className="p-2 pb-3">Product</th><th className="p-2 pb-3 w-16">Unit</th><th className="p-2 pb-3 w-16">Box</th><th className="p-2 pb-3 w-24">Cost</th><th className="p-2 pb-3 w-24">Selling</th><th className="p-2 pb-3 w-16 text-center">Active</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                 {visibleProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                       <td className="p-2"><input type="text" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400 min-w-[140px]" value={p.name} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, name: e.target.value}:bp))} /></td>
                       <td className="p-2"><input type="text" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400" value={p.unit} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, unit: e.target.value}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400" value={p.unitsInBox} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, unitsInBox: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 outline-none focus:border-indigo-400" value={p.costPrice} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, costPrice: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-bold text-emerald-700 outline-none focus:border-indigo-400" value={p.sellingPrice} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, sellingPrice: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2 text-center"><input type="checkbox" checked={p.available} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, available: e.target.checked}:bp))} className="w-4 h-4 accent-indigo-600" /></td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
     </div>
  </div>
);

};

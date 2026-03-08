import React, { useRef } from ‘react’;
import { FileDown, Printer, Share2, X } from ‘lucide-react’;
import { formatDateDisp, getLocalDateStr, APP_NAME } from ‘../helpers’;

function PrintView({ printConfig, setPrintConfig, products, customers, getCustomerLedger, getCustomerBalance, showToast }) {
const { docType, format, data } = printConfig;
const isThermal = format === ‘thermal’;
const printRef = useRef(null);

const getDispatchQtyStr = (item) => {
if (!item) return ‘0’;
let uib = item.unitsInBox;
if (!uib) {
const prod = products.find(p => p.id === item.productId);
uib = prod ? prod.unitsInBox : 1;
}
uib = Number(uib) || 1;
const qty = Number(item.quantity) || 0;
if (uib <= 1) return `${qty}`;
const boxes = Math.floor(qty / uib);
const loose = qty % uib;
const boxText = boxes === 1 ? ‘Box’ : ‘Boxes’;
if (boxes > 0 && loose > 0) return `${qty} (${boxes} ${boxText}, ${loose} Loose)`;
if (boxes > 0) return `${qty} (${boxes} ${boxText})`;
return `${qty} (${loose} Loose)`;
};

const generateShareText = () => {
if (!data) return ‘’;
let text = `*AnimalHealth.PK*\ `;
if (docType === ‘invoice’) {
text += `*INVOICE #${data.id}*\ Date: ${formatDateDisp(data.date)}\ Customer: ${data.customerName}\ \ *Items:*\ `;
let savings = 0;
if (data.items && Array.isArray(data.items)) {
data.items.forEach(i => {
text += `- ${i.name || 'Unknown'} ${i.isBonus ? '(BONUS) ' : ''}(x${i.quantity || 0}): ${i.isBonus ? 'FREE' : 'Rs.' + ((i.price || 0) * (i.quantity || 0)).toLocaleString()}\ `;
if (i.isBonus) savings += ((i.originalPrice || 0) * (i.quantity || 0));
});
}
if (data.deliveryBilled > 0) text += `Delivery: Rs.${Number(data.deliveryBilled).toLocaleString()}\ `;
text += `\ *Current Bill: Rs.${(data.total || 0).toLocaleString()}*\ `;
if (savings > 0) text += `*Total Savings: Rs.${savings.toLocaleString()}*\ `;
const ledger = data.customerId ? getCustomerLedger(data.customerId) : null;
let prevBal = 0;
if (ledger && ledger.rows) {
const invIndex = ledger.rows.findIndex(r => r.id === data.id);
if (invIndex > 0) prevBal = ledger.rows[invIndex - 1]?.balance || 0;
else if (invIndex === 0) prevBal = ledger.openingBal || 0;
else prevBal = ledger.closingBal || 0;
}
const received = data.receivedAmount || 0;
const netBal = prevBal + (data.total || 0) - received;
text += `Previous Balance: Rs.${prevBal.toLocaleString()}\ `;
if (received > 0) text += `Payment Received: Rs.${received.toLocaleString()}\ `;
text += `*Net Balance: Rs.${netBal.toLocaleString()}*\ Status: ${data.paymentStatus || 'Pending'}`;
} else if (docType === ‘dispatch’) {
text += `*DISPATCH NOTE #${data.id}*\ Date: ${formatDateDisp(data.date)}\ *Customer:* ${data.customerName}\ `;
if(data.customerDetails?.contactPerson || data.customerDetails?.phone) {
text += `*Contact:* ${data.customerDetails?.contactPerson || 'N/A'} - ${data.customerDetails?.phone || ''}\ `;
}
if(data.customerDetails?.address1) text += `*Address 1:* ${data.customerDetails.address1}\ `;
if(data.customerDetails?.map1) text += `*Map 1:* ${data.customerDetails.map1}\ `;
if(data.customerDetails?.address2) text += `*Address 2:* ${data.customerDetails.address2}\ `;
if(data.customerDetails?.map2) text += `*Map 2:* ${data.customerDetails.map2}\ `;
text += `\ *Vehicle/Transport:* ${data.vehicle || 'N/A'}\ `;
if(data.vehicle === ‘Intercity Transport’) {
text += `Transport Co: ${data.transportCompany || 'N/A'}\ Bilty No: ${data.biltyNumber || 'N/A'}\ `;
} else if ([‘Rider’, ‘Rickshaw’, ‘Suzuki’].includes(data.vehicle)) {
text += `Driver: ${data.driverName || 'N/A'} - ${data.driverPhone || ''}\ `;
}
text += `\ *Items to Deliver:*\ `;
if (data.items && Array.isArray(data.items)) {
data.items.forEach(i => text += `- ${i.name || 'Unknown'} ${i.isBonus ? '- (BONUS)' : ''} -> ${getDispatchQtyStr(i)}\ `);
}
text += `\ Total SKUs: ${(data.items || []).length} | Please confirm receipt upon delivery.`;
} else if (docType === ‘receipt’) {
text += `*PAYMENT RECEIPT*\ Ref: ${data.id}\ Date: ${formatDateDisp(data.date)}\ Customer: ${data.customerName}\ \ `;
text += `*Amount Received: Rs.${data.receivedAmount || 0}*\ `;
text += `Previous Balance: Rs.${data.prevBalance || 0}\ `;
text += `*Remaining Balance: Rs.${data.newBalance || 0}*\ \ Thank you for your business!`;
} else if (docType === ‘ledger’) {
text += `*ACCOUNT STATEMENT*\ Customer: ${data.customerName}\ Statement Period: ${formatDateDisp(data.dateRange?.start)} to ${formatDateDisp(data.dateRange?.end)}\ \ `;
text += `Total Debits: Rs.${data.totalDebit || 0}\ Total Credits: Rs.${data.totalCredit || 0}\ *Current Closing Balance: Rs.${data.closingBal || 0}*\ \ Please arrange payment at your earliest convenience.`;
} else if (docType === ‘report’) {
text += `*${data.title || 'Report'}*\ Period: ${data.dateFilter || 'All Time'}\ \ `;
if (data.view === ‘Overview’) {
text += `*Financial Summary*\ `;
text += `Product Sales: Rs.${(data.stats?.productRevenue || 0).toLocaleString()}\ `;
text += `Total COGS: Rs.${(data.stats?.totalCOGS || 0).toLocaleString()}\ `;
text += `Gross Margin: Rs.${(data.stats?.grossMargin || 0).toLocaleString()}\ `;
text += `Delivery Billed: Rs.${(data.stats?.deliveryBilled || 0).toLocaleString()}\ `;
text += `Transport Exp: Rs.${(data.stats?.transportExpense || 0).toLocaleString()}\ `;
text += `Operational Exp: Rs.${(data.stats?.totalExpenses || 0).toLocaleString()}\ `;
text += `*Net Profit: Rs.${(data.stats?.netProfit || 0).toLocaleString()}*\ `;
} else if (data.view === ‘Receivables’) {
text += `*Customer Receivables*\ Top 10:\ `;
if (data.rows && Array.isArray(data.rows)) {
data.rows.slice(0, 10).forEach(r => { text += `- ${r.Name || 'Unknown'}: Rs.${(r.Amount || 0).toLocaleString()}\ `; });
if (data.rows.length > 10) text += `... and ${data.rows.length - 10} more\ `;
}
} else {
text += `*${data.view || 'Report'}*\ Top 10:\ `;
if (data.rows && Array.isArray(data.rows)) {
data.rows.slice(0, 10).forEach(r => { text += `- ${r.Name || 'Unknown'}: Qty ${r.Qty || 0}, GP Rs.${(r.GrossProfit || 0).toLocaleString()}\ `; });
if (data.rows.length > 10) text += `... and ${data.rows.length - 10} more\ `;
}
}
}
return encodeURIComponent(text);
};

const handlePrint = () => {
// Temporarily inject thermal page size if needed
let styleEl = null;
if (isThermal) {
styleEl = document.createElement(‘style’);
styleEl.id = ‘thermal-print-style’;
styleEl.textContent = `@page { size: 80mm auto; margin: 4mm; }`;
document.head.appendChild(styleEl);
}
window.print();
// Clean up after print dialog closes
setTimeout(() => {
if (styleEl) styleEl.remove();
}, 1000);
};

const handlePDF = () => {
const docLabels = { invoice: ‘Invoice’, dispatch: ‘DispatchNote’, receipt: ‘Receipt’, ledger: ‘Ledger’, report: ‘Report’ };
const filename = `${docLabels[docType] || 'Document'}_${data?.id || Date.now()}.pdf`;
const element = document.getElementById(‘print-document’);
if (!element) { showToast(“Print element not found”, “error”); return; }

```
showToast("Generating PDF...", "success");

// Clone the element to measure natural height for thermal
if (isThermal) {
  // For thermal, we need auto height - use 80mm wide
  const opt = {
    margin: [4, 4, 4, 4],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 3, 
      useCORS: true, 
      logging: false, 
      letterRendering: true,
      width: 302, // 80mm at 96dpi
      windowWidth: 302
    },
    jsPDF: { 
      unit: 'mm', 
      format: [80, 600], // tall enough for long ledgers
      orientation: 'portrait',
      hotfixes: ['px_scaling']
    },
    pagebreak: { 
      mode: ['avoid-all'],
      avoid: ['tr', '.keep-together', 'thead', 'tfoot']
    }
  };
  html2pdf().set(opt).from(element).save()
    .then(() => showToast("PDF downloaded!", "success"))
    .catch((err) => { console.error(err); showToast("PDF failed, use Print instead", "error"); });
} else {
  // A4 format
  const opt = {
    margin: [10, 10, 15, 10], // top, right, bottom, left in mm
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      logging: false, 
      letterRendering: true,
      windowWidth: 794 // A4 at 96dpi
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      hotfixes: ['px_scaling']
    },
    pagebreak: { 
      mode: ['css', 'legacy'],
      avoid: ['tr', '.keep-together'],
      before: ['.page-break-before']
    }
  };
  html2pdf().set(opt).from(element).save()
    .then(() => showToast("PDF downloaded!", "success"))
    .catch((err) => { console.error(err); showToast("PDF failed, use Print instead", "error"); });
}
```

};

// Safe data access helpers
const safeItems = data?.items || [];
const safeRows = data?.rows || [];

// Width classes based on format
const docWidth = isThermal ? ‘w-[80mm] min-w-[80mm] max-w-[80mm]’ : ‘w-full max-w-[210mm]’;
const fontSize = isThermal ? ‘text-[10px]’ : ‘text-xs sm:text-sm’;

return (
<div className="fixed inset-0 bg-white z-[100] overflow-y-auto overflow-x-hidden" id="print-root">
{/* Fixed Control Bar - Hidden on print */}
<div className="no-print sticky top-0 z-50 bg-slate-100 border-b border-slate-200 p-3 sm:p-4">
<div className="flex flex-wrap items-center justify-between gap-2 max-w-[210mm] mx-auto">
<div className="flex items-center gap-2">
<button onClick={() => setPrintConfig({…printConfig, format: ‘thermal’})} className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${isThermal ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}>Thermal (80mm)</button>
<button onClick={() => setPrintConfig({…printConfig, format: ‘a5’})} className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${!isThermal ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}>A4 / A5 Sheet</button>
</div>
<div className="flex items-center gap-2">
<button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors"><FileDown size={14}/> PDF</button>
<button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors"><Printer size={14}/> Print</button>
{docType !== ‘report’ && (
<a href={`https://wa.me/?text=${generateShareText()}`} target=”_blank” rel=“noopener noreferrer” className=“flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xs transition-colors”>
<Share2 size={14}/> Share
</a>
)}
<button onClick={() => setPrintConfig(null)} className=“flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold text-xs transition-colors”><X size={14}/> Close</button>
</div>
</div>
</div>

```
  {/* Print Document Content */}
  <div 
    id="print-document" 
    ref={printRef} 
    className={`print-doc-wrapper bg-white mx-auto ${docWidth} ${isThermal ? 'p-3' : 'p-6 sm:p-8'}`}
    style={{
      fontFamily: "'Inter', system-ui, sans-serif", 
      lineHeight: '1.5',
      fontSize: isThermal ? '10px' : '12px'
    }}
  >
    {/* ===== HEADER ===== */}
    <div className="keep-together text-center mb-5 border-b-2 border-slate-800 pb-4">
      <h1 style={{fontSize: isThermal ? '16px' : '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px'}}>{APP_NAME}</h1>
      <p style={{fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, color: '#64748b', marginTop: '4px'}}>Wholesale Veterinary Pharmacy</p>
      <div style={{
        marginTop: '10px', display: 'inline-block', background: '#1e293b', color: 'white',
        padding: isThermal ? '3px 10px' : '4px 14px', borderRadius: '999px',
        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px',
        fontSize: isThermal ? '8px' : '10px'
      }}>
        {docType === 'invoice' && 'Invoice'}
        {docType === 'dispatch' && 'Dispatch Note'}
        {docType === 'receipt' && 'Payment Receipt'}
        {docType === 'ledger' && 'Account Ledger'}
        {docType === 'report' && 'Analytics Report'}
      </div>
    </div>

    {/* ===== CUSTOMER / DOC INFO ===== */}
    {docType !== 'report' && data && (
      <div className="keep-together" style={{marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{flex: 1, paddingRight: '8px', minWidth: 0}}>
          <p style={{fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px'}}>Customer Details</p>
          <p style={{fontSize: isThermal ? '13px' : '17px', fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word'}}>{data.customerName || 'Unknown'}</p>
          {docType === 'dispatch' && data.customerDetails && (
            <div style={{marginTop: '8px', fontSize: '9px', color: '#334155', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: 1.6}}>
              {(data.customerDetails.contactPerson || data.customerDetails.phone) && (
                <p><strong>Contact:</strong> {data.customerDetails.contactPerson || 'N/A'} ({data.customerDetails.phone || ''})</p>
              )}
              {data.customerDetails.address1 && <p><strong>Addr 1:</strong> {data.customerDetails.address1}</p>}
              {data.customerDetails.address2 && <p><strong>Addr 2:</strong> {data.customerDetails.address2}</p>}
            </div>
          )}
          {docType === 'ledger' && <p style={{fontSize: '11px', color: '#64748b', marginTop: '2px'}}>{data.phone || ''}</p>}
        </div>
        <div style={{textAlign: 'right', flexShrink: 0, paddingLeft: '8px'}}>
          {docType !== 'ledger' && (
            <>
              <p style={{fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px'}}>Reference</p>
              <p style={{fontWeight: 700, wordBreak: 'break-all', maxWidth: isThermal ? '70px' : '120px'}}>{data.id || 'N/A'}</p>
              <p style={{color: '#64748b', fontSize: '11px'}}>{formatDateDisp(data.date)}</p>
            </>
          )}
          {docType === 'ledger' && (
            <>
              <p style={{fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px'}}>Statement Date</p>
              <p style={{fontWeight: 700}}>{formatDateDisp(getLocalDateStr())}</p>
            </>
          )}
        </div>
      </div>
    )}

    {/* ===== DISPATCH LOGISTICS ===== */}
    {docType === 'dispatch' && data && (
      <div className="keep-together" style={{marginBottom: '16px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '9px', color: '#1e293b'}}>
        <p style={{fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '6px', fontSize: '8px'}}>Logistics / Delivery Info</p>
        <p><strong>Method:</strong> {data.vehicle || 'N/A'}</p>
        {data.vehicle === 'Intercity Transport' ? (
          <p><strong>Transport Co:</strong> {data.transportCompany || '-'} &nbsp; <strong>Bilty No:</strong> {data.biltyNumber || '-'}</p>
        ) : ['Rider', 'Rickshaw', 'Suzuki'].includes(data.vehicle) ? (
          <p><strong>Driver:</strong> {data.driverName || '-'} &nbsp; <strong>Phone:</strong> {data.driverPhone || '-'}</p>
        ) : null}
      </div>
    )}

    {/* ===== REPORT SECTION ===== */}
    {docType === 'report' && data && (
      <div style={{color: '#1e293b'}}>
        <div className="keep-together" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', borderBottom: '2px solid #1e293b', paddingBottom: '8px'}}>
          <h2 style={{fontSize: isThermal ? '13px' : '18px', fontWeight: 900, lineHeight: 1.2}}>{data.title || 'Report'}</h2>
          <p style={{fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', flexShrink: 0}}>Period: {data.dateFilter || 'All Time'}</p>
        </div>

        {data.view === 'Overview' ? (
          <div className="keep-together" style={{border: '1px solid #e2e8f0', padding: isThermal ? '12px' : '16px', borderRadius: '12px', maxWidth: isThermal ? '100%' : '400px', margin: '0 auto'}}>
            {[
              {label: 'Product Sales', val: data.stats?.productRevenue || 0, color: '#1e293b'},
              {label: 'Total COGS', val: -(data.stats?.totalCOGS || 0), color: '#e11d48', prefix: '- '},
              {label: 'Gross Margin', val: data.stats?.grossMargin || 0, color: '#1e293b', bold: true},
              {label: 'Delivery Billed', val: data.stats?.deliveryBilled || 0, color: '#64748b', small: true},
              {label: 'Transport Exp', val: -(data.stats?.transportExpense || 0), color: '#e11d48', small: true, prefix: '- '},
              {label: 'Operational Exp', val: -(data.stats?.totalExpenses || 0), color: '#e11d48', small: true, prefix: '- '},
            ].map((row, i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: row.small ? '10px' : '11px', fontWeight: row.bold ? 800 : 500, borderTop: i === 3 ? '1px solid #e2e8f0' : 'none', paddingTop: i === 3 ? '8px' : '0'}}>
                <span style={{color: '#475569'}}>{row.label}:</span>
                <span style={{color: row.color}}>{row.prefix || ''}Rs. {Math.abs(row.val).toLocaleString()}</span>
              </div>
            ))}
            <div style={{borderTop: '2px solid #1e293b', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: isThermal ? '14px' : '18px'}}>
              <span>Net Profit:</span>
              <span>Rs. {(data.stats?.netProfit || 0).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: isThermal ? '8px' : '11px'}}>
            <thead>
              <tr style={{borderBottom: '2px solid #1e293b', color: '#475569'}}>
                <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'left', fontWeight: 800}}>Name</th>
                {data.view !== 'Receivables' && <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'center', fontWeight: 800}}>Qty</th>}
                {data.view !== 'Receivables' && <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'right', fontWeight: 800}}>Revenue</th>}
                <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'right', fontWeight: 800}}>{data.view === 'Receivables' ? 'Pending Amount' : 'Gross Profit'}</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((r, i) => (
                <tr key={i} style={{borderBottom: '1px solid #f1f5f9', pageBreakInside: 'avoid', breakInside: 'avoid'}}>
                  <td style={{padding: isThermal ? '3px 2px' : '7px 4px', fontWeight: 600, wordBreak: 'break-word'}}>
                    {r.Name || 'Unknown'}
                    {r.Company ? <span style={{fontSize: '8px', color: '#94a3b8', display: 'block'}}>({r.Company})</span> : ''}
                  </td>
                  {data.view !== 'Receivables' && <td style={{padding: isThermal ? '3px 2px' : '7px 4px', textAlign: 'center'}}>{r.Qty || 0}</td>}
                  {data.view !== 'Receivables' && <td style={{padding: isThermal ? '3px 2px' : '7px 4px', textAlign: 'right'}}>{((r.Revenue || 0)/1000).toFixed(1)}k</td>}
                  <td style={{padding: isThermal ? '3px 2px' : '7px 4px', textAlign: 'right', fontWeight: 800}}>Rs. {(r.GrossProfit || r.Amount || 0).toLocaleString()}</td>
                </tr>
              ))}
              {safeRows.length === 0 && (
                <tr><td colSpan={data.view === 'Receivables' ? 2 : 4} style={{padding: '16px', textAlign: 'center', color: '#94a3b8'}}>No data available</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    )}

    {/* ===== INVOICE / DISPATCH ITEMS TABLE ===== */}
    {(docType === 'invoice' || docType === 'dispatch') && (
      <>
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: isThermal ? '9px' : '11px'}}>
          <thead>
            <tr style={{borderBottom: '2px solid #1e293b', color: '#475569'}}>
              <th style={{padding: isThermal ? '4px 2px 4px 0' : '8px 4px 8px 0', textAlign: 'left', fontWeight: 800}}>Description</th>
              <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap'}}>{docType === 'dispatch' ? 'Packaging' : 'Qty'}</th>
              {docType === 'invoice' && <th style={{padding: isThermal ? '4px 2px' : '8px 4px', textAlign: 'right', fontWeight: 800}}>Rate</th>}
              {docType === 'invoice' && !isThermal && <th style={{padding: '8px 0 8px 4px', textAlign: 'right', fontWeight: 800}}>Total</th>}
            </tr>
          </thead>
          <tbody>
            {safeItems.map((item, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #e2e8f0', color: '#1e293b', pageBreakInside: 'avoid', breakInside: 'avoid'}}>
                <td style={{padding: isThermal ? '5px 2px 5px 0' : '8px 4px 8px 0', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3}}>
                  {item?.name || 'Unknown'}
                  {item?.isBonus && (
                    <span style={{marginLeft: '6px', padding: '1px 5px', background: '#d1fae5', color: '#059669', fontSize: '7px', fontWeight: 800, borderRadius: '4px', textTransform: 'uppercase', border: '1px solid #a7f3d0'}}>Bonus</span>
                  )}
                </td>
                <td style={{padding: isThermal ? '5px 2px' : '8px 4px', textAlign: 'center', fontWeight: 600, lineHeight: 1.3}}>
                  {docType === 'dispatch' ? getDispatchQtyStr(item) : (item?.quantity || 0)}
                </td>
                {docType === 'invoice' && (
                  <td style={{padding: isThermal ? '5px 2px' : '8px 4px', textAlign: 'right'}}>
                    {item?.isBonus ? (
                      <span style={{color: '#059669', fontWeight: 800, fontSize: '8px', textTransform: 'uppercase'}}>Free</span>
                    ) : `Rs. ${item?.price || 0}`}
                    {item?.isBonus && item?.originalPrice && (
                      <span style={{display: 'block', fontSize: '7px', textDecoration: 'line-through', color: '#94a3b8'}}>Rs. {item.originalPrice}</span>
                    )}
                    {isThermal && !item?.isBonus && (
                      <span style={{display: 'block', fontWeight: 800, marginTop: '2px', fontSize: '9px'}}>T: {(item?.price || 0) * (item?.quantity || 0)}</span>
                    )}
                  </td>
                )}
                {docType === 'invoice' && !isThermal && (
                  <td style={{padding: '8px 0 8px 4px', textAlign: 'right', fontWeight: 800}}>
                    {item?.isBonus ? <span style={{color: '#059669'}}>Rs. 0</span> : `Rs. ${((item?.price || 0) * (item?.quantity || 0)).toLocaleString()}`}
                  </td>
                )}
              </tr>
            ))}
            {safeItems.length === 0 && (
              <tr><td colSpan={docType === 'invoice' ? (isThermal ? 3 : 4) : 2} style={{padding: '16px', textAlign: 'center', color: '#94a3b8'}}>No items</td></tr>
            )}
          </tbody>
        </table>

        {/* Invoice Totals - keep together to avoid page splitting */}
        {docType === 'invoice' && data && (
          <div className="keep-together" style={{borderTop: '2px solid #1e293b', paddingTop: '10px', float: 'right', width: isThermal ? '100%' : '280px'}}>
            {(() => {
              const currentBillTotal = data.total || 0;
              const ledger = data.customerId ? getCustomerLedger(data.customerId) : null;
              let prevBalance = 0;
              if (ledger && ledger.rows) {
                const invIndex = ledger.rows.findIndex(r => r.id === data.id);
                if (invIndex > 0) prevBalance = ledger.rows[invIndex - 1]?.balance || 0;
                else if (invIndex === 0) prevBalance = ledger.openingBal || 0;
                else prevBalance = ledger.closingBal || 0;
              }
              const subtotal = prevBalance + currentBillTotal;
              const received = data.receivedAmount || 0;
              const netBalance = subtotal - received;
              const totalSavings = safeItems.reduce((sum, i) => sum + (i?.isBonus ? (i?.originalPrice || 0) * (i?.quantity || 0) : 0), 0);

              const rowStyle = (bold, large, color) => ({
                display: 'flex', justifyContent: 'space-between', marginBottom: '5px',
                fontWeight: bold ? 800 : 500,
                fontSize: large ? (isThermal ? '13px' : '16px') : (isThermal ? '9px' : '11px'),
                color: color || '#1e293b'
              });

              return (
                <>
                  <div style={rowStyle(false, false)}><span>Items Subtotal:</span><span>Rs. {(currentBillTotal - (data.deliveryBilled || 0)).toLocaleString()}</span></div>
                  {(data.deliveryBilled || 0) > 0 && (
                    <div style={rowStyle(false, false, '#64748b')}><span>Delivery ({data.vehicle || 'N/A'}):</span><span>Rs. {data.deliveryBilled}</span></div>
                  )}
                  <div style={{...rowStyle(true, true), borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '4px'}}><span>Current Bill:</span><span>Rs. {currentBillTotal.toLocaleString()}</span></div>
                  <div style={{...rowStyle(false, false), marginTop: '10px'}}><span>Previous Balance:</span><span>Rs. {prevBalance.toLocaleString()}</span></div>
                  <div style={{...rowStyle(true, false), borderTop: '1px solid #e2e8f0', paddingTop: '4px'}}><span>Subtotal:</span><span>Rs. {subtotal.toLocaleString()}</span></div>
                  <div style={rowStyle(false, false, '#059669')}><span>Payment Received:</span><span>- Rs. {received.toLocaleString()}</span></div>
                  <div style={{...rowStyle(true, true), borderTop: '2px solid #1e293b', paddingTop: '8px', marginTop: '6px'}}><span>Net Balance:</span><span>Rs. {netBalance.toLocaleString()}</span></div>
                  {totalSavings > 0 && (
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '6px 8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontWeight: 800, fontSize: '10px', color: '#065f46'}}>
                      <span>Total Savings:</span><span>Rs. {totalSavings.toLocaleString()}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
        {/* Clear float */}
        <div style={{clear: 'both'}}></div>
      </>
    )}

    {/* ===== RECEIPT CONTENT ===== */}
    {docType === 'receipt' && data && (
      <div className="keep-together">
        <div style={{background: '#f8fafc', padding: isThermal ? '16px 12px' : '24px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', marginBottom: '16px'}}>
          <p style={{fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px'}}>Amount Received</p>
          <p style={{fontSize: isThermal ? '28px' : '40px', fontWeight: 900, color: '#059669', marginTop: '8px', lineHeight: 1}}>Rs. {(data.receivedAmount || 0).toLocaleString()}</p>
          {data.note && (
            <p style={{fontSize: '10px', color: '#64748b', marginTop: '10px', fontWeight: 500, background: 'white', display: 'inline-block', padding: '4px 12px', borderRadius: '999px', border: '1px solid #e2e8f0', wordBreak: 'break-word'}}>
              {data.note}
            </p>
          )}
        </div>
        <div style={{borderTop: '2px solid #1e293b', paddingTop: '12px'}}>
          {[
            {label: 'Previous Balance:', val: `Rs. ${(data.prevBalance || 0).toLocaleString()}`, color: '#64748b'},
            {label: 'Amount Credited:', val: `- Rs. ${(data.receivedAmount || 0).toLocaleString()}`, color: '#059669'},
          ].map((r, i) => (
            <div key={i} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 600, fontSize: '11px', color: r.color}}>
              <span>{r.label}</span><span>{r.val}</span>
            </div>
          ))}
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: isThermal ? '14px' : '18px', color: '#1e293b', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px'}}>
            <span>Remaining Balance:</span><span>Rs. {(data.newBalance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    )}

    {/* ===== LEDGER CONTENT ===== */}
    {docType === 'ledger' && data && (
      <>
        <div className="keep-together" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', borderBottom: '2px solid #1e293b', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px'}}>
          <div>
            <p style={{fontWeight: 700, color: '#475569', fontSize: isThermal ? '9px' : '11px'}}>Statement Period</p>
            <p style={{fontWeight: 600, color: '#64748b', fontSize: isThermal ? '8px' : '10px'}}>
              {formatDateDisp(data.dateRange?.start)} <span style={{color: '#94a3b8'}}>to</span> {formatDateDisp(data.dateRange?.end)}
            </p>
          </div>
          <div style={{textAlign: 'right', background: '#fff1f2', padding: isThermal ? '6px 10px' : '8px 14px', borderRadius: '10px', border: '1px solid #fecdd3', flexShrink: 0}}>
            <p style={{fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#e11d48', letterSpacing: '1px'}}>Closing Balance</p>
            <p style={{fontWeight: 900, color: '#be123c', fontSize: isThermal ? '13px' : '18px'}}>{(data.closingBal || 0).toLocaleString()}</p>
          </div>
        </div>

        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: isThermal ? '8px' : '10px', tableLayout: isThermal ? 'fixed' : 'auto'}}>
          <thead>
            <tr style={{background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#475569'}}>
              <th style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', width: isThermal ? '18%' : '14%'}}>Date</th>
              <th style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px'}}>Particulars</th>
              <th style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', width: isThermal ? '15%' : '14%'}}>{isThermal ? 'Dr' : 'Debit (Dr)'}</th>
              <th style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', width: isThermal ? '15%' : '14%'}}>{isThermal ? 'Cr' : 'Credit (Cr)'}</th>
              <th style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', width: isThermal ? '17%' : '14%'}}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{background: '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid'}}>
              <td style={{padding: isThermal ? '3px 2px' : '7px 6px', color: '#64748b', fontWeight: 500}} colSpan={4}>
                Opening Bal <span style={{fontSize: '8px'}}>({formatDateDisp(data.dateRange?.start)})</span>
              </td>
              <td style={{padding: isThermal ? '3px 2px' : '7px 6px', textAlign: 'right', fontWeight: 800}}>{(data.openingBal || 0).toLocaleString()}</td>
            </tr>
            {safeRows.map((row) => (
              <tr key={row.id || Math.random()} style={{borderBottom: '1px solid #f1f5f9', pageBreakInside: 'avoid', breakInside: 'avoid'}}>
                <td style={{padding: isThermal ? '4px 2px' : '8px 6px', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap'}}>{formatDateDisp(row.date)}</td>
                <td style={{padding: isThermal ? '4px 2px' : '8px 6px', wordBreak: 'break-word'}}>
                  <span style={{fontWeight: 700, display: 'block', lineHeight: 1.3}}>{row.desc || 'N/A'}</span>
                  <span style={{fontSize: '7px', color: '#94a3b8', fontWeight: 500, display: 'block', marginTop: '1px', wordBreak: 'break-all'}}>{row.ref || ''}</span>
                </td>
                <td style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 800, color: '#4f46e5'}}>{(row.debit || 0) > 0 ? (row.debit || 0).toLocaleString() : '-'}</td>
                <td style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 800, color: '#059669'}}>{(row.credit || 0) > 0 ? (row.credit || 0).toLocaleString() : '-'}</td>
                <td style={{padding: isThermal ? '4px 2px' : '8px 6px', textAlign: 'right', fontWeight: 900}}>{(row.balance || 0).toLocaleString()}</td>
              </tr>
            ))}
            {safeRows.length === 0 && (
              <tr><td colSpan={5} style={{padding: '16px', textAlign: 'center', color: '#94a3b8'}}>No transactions</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{background: '#f8fafc', borderTop: '2px solid #1e293b'}}>
              <td colSpan={2} style={{padding: isThermal ? '5px 2px' : '10px 6px', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '1px', color: '#475569'}}>Period Totals:</td>
              <td style={{padding: isThermal ? '5px 2px' : '10px 6px', textAlign: 'right', fontWeight: 900, color: '#4338ca'}}>{(data.totalDebit || 0).toLocaleString()}</td>
              <td style={{padding: isThermal ? '5px 2px' : '10px 6px', textAlign: 'right', fontWeight: 900, color: '#059669'}}>{(data.totalCredit || 0).toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </>
    )}

    {/* ===== FOOTER ===== */}
    <div style={{marginTop: '32px', textAlign: 'center', fontSize: '8px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0'}}>
      Software Generated Document \u2022 AnimalHealth.PK IT Dept.
    </div>
  </div>

  {/* ===== PRINT & PDF STYLES ===== */}
  <style>{`
    #print-document {
      box-shadow: 0 0 40px rgba(0,0,0,0.08);
      min-height: 200px;
    }
    @media print {
      @page { margin: 10mm 8mm 12mm 8mm; }
      html, body { height: auto !important; overflow: visible !important; }
      #print-root { display: block !important; position: relative !important; }
      .no-print { display: none !important; }
      #print-document {
        box-shadow: none !important;
        width: 100% !important;
        max-width: none !important;
        min-width: unset !important;
        margin: 0 !important;
```

export default PrintView;
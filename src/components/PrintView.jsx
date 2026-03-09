import React, { useRef } from 'react';
import { FileDown, Printer, Share2, X, MessageCircle } from 'lucide-react';
import { formatDateDisp, getLocalDateStr, APP_NAME } from '../helpers';

// Format: 'thermal' | 'a5' | 'a4'
function PrintView({ printConfig, setPrintConfig, products, customers, getCustomerLedger, getCustomerBalance, showToast }) {
const { docType, format, data } = printConfig;
const isThermal = format === 'thermal';
const isA5 = format === 'a5';
const printRef = useRef(null);

// ── Helpers ───────────────────────────────────────────────────────────────
const getDispatchQtyStr = (item) => {
  if (!item) return '0';
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
  const boxText = boxes === 1 ? 'Box' : 'Boxes';
  if (boxes > 0 && loose > 0) return `${qty} (${boxes} ${boxText}, ${loose} Loose)`;
  if (boxes > 0) return `${qty} (${boxes} ${boxText})`;
  return `${qty} (${loose} Loose)`;
};

const safeStr = (s) => (s || '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const getFileName = () => {
  const custName = safeStr(data?.customerName || data?.title || 'Doc');
  const ref = safeStr(data?.id || '');
  const dateStr = (data?.date || getLocalDateStr()).replace(/-/g, '');
  const labels = { invoice: 'Invoice', dispatch: 'DispatchNote', receipt: 'Receipt', ledger: 'Ledger', report: 'Report' };
  const label = labels[docType] || 'Document';
  if (docType === 'ledger') {
    const start = (data?.dateRange?.start || '').replace(/-/g, '');
    const end = (data?.dateRange?.end || '').replace(/-/g, '');
    return `${label}_${custName}_${start}_${end}.pdf`;
  }
  if (docType === 'report') {
    const viewStr = safeStr(data?.view || 'Overview');
    const periodStr = safeStr(data?.dateFilter || 'All');
    return `${label}_${viewStr}_${periodStr}.pdf`;
  }
  return `${label}_${ref}_${custName}_${dateStr}.pdf`;
};

// ── WhatsApp share text ────────────────────────────────────────────────────
const generateShareText = () => {
  if (!data) return '';
  let text = `*${APP_NAME}*\n`;
  const hr = '─'.repeat(28);

  if (docType === 'invoice') {
    const ledger = data.customerId ? getCustomerLedger(data.customerId) : null;
    let prevBal = 0;
    if (ledger && ledger.rows) {
      const idx = ledger.rows.findIndex(r => r.id === data.id);
      if (idx > 0) prevBal = ledger.rows[idx - 1]?.balance || 0;
      else if (idx === 0) prevBal = ledger.openingBal || 0;
      else prevBal = ledger.closingBal || 0;
    }
    const received = data.receivedAmount || 0;
    const netBal = prevBal + (data.total || 0) - received;
    let savings = 0;

    text += `*INVOICE #${data.id}*\n`;
    text += `${hr}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `Customer: *${data.customerName}*\n\n`;
    text += `*Items:*\n`;
    (data.items || []).forEach(i => {
      const lineTotal = i.isBonus ? 'FREE' : `Rs.${((i.price || 0) * (i.quantity || 0)).toLocaleString()}`;
      text += `• ${i.name}${i.isBonus ? ' 🎁' : ''} x${i.quantity} = ${lineTotal}\n`;
      if (i.isBonus) savings += (i.originalPrice || 0) * (i.quantity || 0);
    });
    if ((data.deliveryBilled || 0) > 0) text += `🚚 Delivery: Rs.${Number(data.deliveryBilled).toLocaleString()}\n`;
    text += `${hr}\n`;
    text += `*Current Bill: Rs.${(data.total || 0).toLocaleString()}*\n`;
    if (savings > 0) text += `🎁 Savings: Rs.${savings.toLocaleString()}\n`;
    text += `Previous Bal: Rs.${prevBal.toLocaleString()}\n`;
    if (received > 0) text += `Paid: Rs.${received.toLocaleString()}\n`;
    text += `*Net Balance: Rs.${netBal.toLocaleString()}*\n`;
    text += `Status: ${data.paymentStatus || 'Pending'}\n`;

  } else if (docType === 'dispatch') {
    text += `*DISPATCH NOTE #${data.id}*\n`;
    text += `${hr}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `*${data.customerName}*\n`;
    if (data.customerDetails?.contactPerson || data.customerDetails?.phone)
      text += `${data.customerDetails?.contactPerson || ''} ${data.customerDetails?.phone ? '- ' + data.customerDetails.phone : ''}\n`;
    if (data.customerDetails?.address1) text += `${data.customerDetails.address1}\n`;
    if (data.customerDetails?.map1) text += `${data.customerDetails.map1}\n`;
    if (data.customerDetails?.address2) text += `Alt: ${data.customerDetails.address2}\n`;
    if (data.customerDetails?.map2) text += `${data.customerDetails.map2}\n`;
    text += `\n🚚 *${data.vehicle || 'N/A'}*`;
    if (data.vehicle === 'Intercity Transport') {
      text += `\nTransport: ${data.transportCompany || '-'} | Bilty: ${data.biltyNumber || '-'}`;
    } else if (['Rider', 'Rickshaw', 'Suzuki'].includes(data.vehicle)) {
      text += `\nDriver: ${data.driverName || '-'} (${data.driverPhone || ''})`;
    }
    text += `\n\n*Items to Deliver:*\n`;
    (data.items || []).forEach(i => {
      text += `• ${i.name}${i.isBonus ? ' 🎁 BONUS' : ''} → ${getDispatchQtyStr(i)}\n`;
    });
    text += `${hr}\n`;
    text += `Total SKUs: ${(data.items || []).length} | Confirm receipt upon delivery.`;

  } else if (docType === 'receipt') {
    text += `*PAYMENT RECEIPT*\n`;
    text += `${hr}\n`;
    text += `🔖 Ref: ${data.id}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `Customer: *${data.customerName}*\n`;
    text += `${hr}\n`;
    text += `*Amount Received: Rs.${(data.receivedAmount || 0).toLocaleString()}*\n`;
    if (data.note) text += `📝 Mode: ${data.note}\n`;
    text += `Previous Bal: Rs.${(data.prevBalance || 0).toLocaleString()}\n`;
    text += `*Remaining Bal: Rs.${(data.newBalance || 0).toLocaleString()}*\n\n`;
    text += `Thank you for your business! 🙏`;

  } else if (docType === 'ledger') {
    text += `*ACCOUNT STATEMENT*\n`;
    text += `${hr}\n`;
    text += `*${data.customerName}*\n`;
    if (data.phone) text += `${data.phone}\n`;
    text += `Period: ${formatDateDisp(data.dateRange?.start)} to ${formatDateDisp(data.dateRange?.end)}\n`;
    text += `${hr}\n`;
    text += `Total Debits: Rs.${(data.totalDebit || 0).toLocaleString()}\n`;
    text += `Total Credits: Rs.${(data.totalCredit || 0).toLocaleString()}\n`;
    text += `*Closing Balance: Rs.${(data.closingBal || 0).toLocaleString()}*\n\n`;
    text += `Please arrange payment at your earliest convenience.`;

  } else if (docType === 'report') {
    text += `*${data.title || 'Analytics Report'}*\n`;
    text += `${hr}\n`;
    text += `Period: ${data.dateFilter || 'All Time'}\n\n`;
    if (data.view === 'Overview') {
      const s = data.stats || {};
      text += `*Financial Summary:*\n`;
      text += `📦 Product Sales: Rs.${(s.productRevenue || 0).toLocaleString()}\n`;
      text += `💸 Total COGS: Rs.${(s.totalCOGS || 0).toLocaleString()}\n`;
      text += `📊 Gross Margin: Rs.${(s.grossMargin || 0).toLocaleString()}\n`;
      text += `🚚 Delivery Billed: Rs.${(s.deliveryBilled || 0).toLocaleString()}\n`;
      text += `🚗 Transport Exp: Rs.${(s.transportExpense || 0).toLocaleString()}\n`;
      text += `🏢 Operational Exp: Rs.${(s.totalExpenses || 0).toLocaleString()}\n`;
      text += `${hr}\n`;
      text += `*Net Profit: Rs.${(s.netProfit || 0).toLocaleString()}*`;
    } else {
      text += `*${data.view}:*\n`;
      (data.rows || []).slice(0, 10).forEach((r, i) => {
        text += `${i + 1}. *${r.Name || ''}*${r.Company ? ` (${r.Company})` : ''}\n`;
        if (r.Qty !== undefined) text += `   Qty: ${(r.Qty || 0).toLocaleString()} | Rev: Rs.${(r.Revenue || 0).toLocaleString()} | GP: Rs.${(r.GrossProfit || 0).toLocaleString()}\n`;
        else text += `   Balance: Rs.${(r.Amount || 0).toLocaleString()}\n`;
      });
      if ((data.rows || []).length > 10) text += `... and ${data.rows.length - 10} more`;
    }
  }

  return encodeURIComponent(text);
};

// ── Print ─────────────────────────────────────────────────────────────────
const handlePrint = () => {
  let styleEl = null;
  if (isThermal) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-style';
    styleEl.textContent = `@page { size: 80mm auto !important; margin: 2mm 3mm; } body { width: 80mm; } #print-document { width: 80mm !important; max-width: 80mm !important; padding: 3mm !important; }`;
    document.head.appendChild(styleEl);
  } else if (isA5) {
    styleEl = document.createElement('style');
    styleEl.id = 'a5-print-style';
    styleEl.textContent = `@page { size: A5 portrait; margin: 10mm; }`;
    document.head.appendChild(styleEl);
  }
  window.print();
  setTimeout(() => { if (styleEl) styleEl.remove(); }, 1500);
};

// ── PDF download ──────────────────────────────────────────────────────────
const handlePDF = () => {
  const element = document.getElementById('print-document');
  if (!element) { showToast('Print element not found', 'error'); return; }
  showToast('Generating PDF…');

  if (isThermal) {
    // Thermal: fixed 80mm (302px) width — never use scrollWidth which picks up overflow
    const thermalPx = 302;
    const pdfW = 80;
    const margins = [3, 3, 3, 3];
    const contentWmm = pdfW - margins[1] - margins[3];
    const pdfH = Math.ceil((element.scrollHeight / thermalPx) * contentWmm) + margins[0] + margins[2] + 6;
    const opt = {
      margin: margins,
      filename: getFileName(),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, logging: false, letterRendering: true, scrollY: 0, scrollX: 0, width: thermalPx, windowWidth: thermalPx },
      jsPDF: { unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' },
      pagebreak: { mode: 'avoid-all' },
    };
    html2pdf().set(opt).from(element).save()
      .then(() => showToast('PDF saved!'))
      .catch(() => showToast('PDF failed — use Print instead', 'error'));
  } else {
    // A4/A5: use offsetWidth (rendered width, no overflow) so canvas exactly matches element
    const elW = element.offsetWidth || (isA5 ? 560 : 794);
    const elH = element.scrollHeight;
    const pdfW = isA5 ? 148 : 210;
    const margins = isA5 ? [8, 8, 12, 8] : [10, 10, 15, 10];
    const contentWmm = pdfW - margins[1] - margins[3];
    const pdfH = Math.ceil((elH / elW) * contentWmm) + margins[0] + margins[2] + 20;
    const opt = {
      margin: margins,
      filename: getFileName(),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true, scrollY: 0, scrollX: 0, width: elW, windowWidth: elW },
      jsPDF: { unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' },
      pagebreak: { mode: 'avoid-all' },
    };
    html2pdf().set(opt).from(element).save()
      .then(() => showToast('PDF saved!'))
      .catch(() => showToast('PDF failed — use Print instead', 'error'));
  }
};

// ── Layout helpers ────────────────────────────────────────────────────────
const safeItems = data?.items || [];
const safeRows  = data?.rows  || [];

const docWidth = isThermal
  ? 'w-[80mm] min-w-[80mm] max-w-[80mm]'
  : isA5
    ? 'w-full max-w-[148mm]'
    : 'w-full max-w-[210mm]';

// Which format buttons to show per doc type
const showA5     = true;
const showA4     = docType !== 'receipt';
const showThermal = docType !== 'report';

// Doc type display labels
const docLabel = {
  invoice: 'Invoice',
  dispatch: 'Dispatch Note',
  receipt: 'Payment Receipt',
  ledger: 'Account Statement',
  report: 'Analytics Report',
}[docType] || 'Document';

// Sizing helpers
const sz = (thermal, a5, a4) => isThermal ? thermal : isA5 ? a5 : a4;
const pad = sz('p-3', 'p-5', 'p-7');

// Ledger totals for invoice
const getInvoiceLedger = () => {
  if (docType !== 'invoice' || !data?.customerId) return { prevBalance: 0, received: 0, netBalance: data?.total || 0 };
  const ledger = getCustomerLedger(data.customerId);
  let prevBalance = 0;
  if (ledger && ledger.rows) {
    const idx = ledger.rows.findIndex(r => r.id === data.id);
    if (idx > 0) prevBalance = ledger.rows[idx - 1]?.balance || 0;
    else if (idx === 0) prevBalance = ledger.openingBal || 0;
    else prevBalance = ledger.closingBal || 0;
  }
  const received = data.receivedAmount || 0;
  return { prevBalance, received, netBalance: prevBalance + (data.total || 0) - received };
};

// ── Render ────────────────────────────────────────────────────────────────
return (
<div className="fixed inset-0 bg-white z-[100] overflow-y-auto overflow-x-hidden" id="print-root">

  {/* ── Control Bar (hidden on print) ── */}
  <div className="no-print sticky top-0 z-50 bg-slate-900 border-b border-slate-700 shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-2 max-w-[900px] mx-auto px-3 py-2.5">

      {/* Format switcher */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
        {showThermal && (
          <button
            onClick={() => setPrintConfig({ ...printConfig, format: 'thermal' })}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${isThermal ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >📠 Thermal</button>
        )}
        {showA5 && (
          <button
            onClick={() => setPrintConfig({ ...printConfig, format: 'a5' })}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${isA5 ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >A5</button>
        )}
        {showA4 && (
          <button
            onClick={() => setPrintConfig({ ...printConfig, format: 'a4' })}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${!isThermal && !isA5 ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >A4</button>
        )}
      </div>

      {/* Doc type label */}
      <span className="text-slate-400 font-bold text-xs uppercase tracking-widest hidden sm:block">{docLabel}</span>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePDF}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><FileDown size={14}/> Save PDF</button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><Printer size={14}/> Print</button>

        <a
          href={`https://wa.me/?text=${generateShareText()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><MessageCircle size={14}/> WhatsApp</a>

        <button
          onClick={() => setPrintConfig(null)}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><X size={14}/> Close</button>
      </div>
    </div>

    {/* File name hint */}
    <div className="text-center pb-1.5 no-print">
      <span className="text-[10px] text-slate-500 font-mono">{getFileName()}</span>
    </div>
  </div>

  {/* ── Document ── */}
  <div
    id="print-document"
    ref={printRef}
    className={`bg-white mx-auto ${docWidth} ${pad}`}
    style={{ fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.5, fontSize: isThermal ? '10px' : isA5 ? '11px' : '12px' }}
  >

    {/* ── Header ── */}
    <div className="keep-together" style={{ textAlign: 'center', marginBottom: sz('14px','20px','24px'), borderBottom: '2.5px solid #1e293b', paddingBottom: sz('10px','14px','18px') }}>
      <div style={{ fontSize: sz('18px','24px','30px'), fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase', color: '#0f172a' }}>
        {APP_NAME}
      </div>
      <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2.5px', fontWeight: 700, color: '#94a3b8', marginTop: '3px' }}>
        Wholesale Veterinary Pharmacy
      </div>
      <div style={{
        marginTop: sz('8px','10px','12px'),
        display: 'inline-block',
        background: '#1e293b',
        color: 'white',
        padding: isThermal ? '3px 12px' : '5px 18px',
        borderRadius: '999px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontSize: sz('8px','9px','10px'),
      }}>
        {docLabel}
      </div>
    </div>

    {/* ── Customer / Doc Meta ── */}
    {docType !== 'report' && data && (
      <div className="keep-together" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sz('12px','16px','20px'), gap: '12px' }}>
        {/* Left: customer */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '7.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.5px', color: '#94a3b8', marginBottom: '4px' }}>
            {docType === 'ledger' ? 'Account Holder' : 'Customer'}
          </div>
          <div style={{ fontSize: sz('14px','18px','22px'), fontWeight: 900, lineHeight: 1.2, wordBreak: 'break-word', color: '#0f172a' }}>
            {data.customerName || 'Unknown'}
          </div>
          {docType === 'dispatch' && data.customerDetails && (
            <div style={{ marginTop: '8px', fontSize: '8.5px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.7 }}>
              {(data.customerDetails.contactPerson || data.customerDetails.phone) && (
                <div><strong>{data.customerDetails.contactPerson || 'N/A'}</strong>
                  {data.customerDetails.phone ? ` · ${data.customerDetails.phone}` : ''}
                </div>
              )}
              {data.customerDetails.address1 && (
                <div style={{ marginTop: '3px' }}>{data.customerDetails.address1}</div>
              )}
              {data.customerDetails.map1 && (
                <div style={{ fontSize: '7.5px', color: '#6366f1', marginTop: '2px', wordBreak: 'break-all' }}>Map: {data.customerDetails.map1}</div>
              )}
              {data.customerDetails.address2 && (
                <div style={{ marginTop: '4px', color: '#64748b' }}>Alt: {data.customerDetails.address2}</div>
              )}
              {data.customerDetails.map2 && (
                <div style={{ fontSize: '7.5px', color: '#6366f1', marginTop: '2px', wordBreak: 'break-all' }}>Map: {data.customerDetails.map2}</div>
              )}
            </div>
          )}
          {docType === 'ledger' && data.phone && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{data.phone}</div>
          )}
        </div>

        {/* Right: ref + date */}
        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
          {docType !== 'ledger' && (
            <>
              <div style={{ fontSize: '7.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.5px', color: '#94a3b8', marginBottom: '4px' }}>Reference</div>
              <div style={{ fontWeight: 800, fontSize: sz('11px','13px','14px'), color: '#1e293b', wordBreak: 'break-all', maxWidth: isThermal ? '72px' : '140px' }}>{data.id || '—'}</div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>{formatDateDisp(data.date)}</div>
              {docType === 'invoice' && data.salespersonName && (
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>by {data.salespersonName}</div>
              )}
            </>
          )}
          {docType === 'ledger' && (
            <>
              <div style={{ fontSize: '7.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.5px', color: '#94a3b8', marginBottom: '4px' }}>Printed</div>
              <div style={{ fontWeight: 700, fontSize: '10px' }}>{formatDateDisp(getLocalDateStr())}</div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                {formatDateDisp(data.dateRange?.start)} – {formatDateDisp(data.dateRange?.end)}
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* ── Dispatch Logistics ── */}
    {docType === 'dispatch' && data && (
      <div className="keep-together" style={{ marginBottom: sz('12px','16px','18px'), background: '#fffbeb', padding: sz('8px','10px','12px'), borderRadius: '8px', border: '1px solid #fcd34d', fontSize: sz('8.5px','9px','9.5px'), color: '#78350f' }}>
        <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px', fontSize: '7.5px', color: '#92400e' }}>
          Logistics / Delivery
        </div>
        <div><strong>Method:</strong> {data.vehicle || 'N/A'}</div>
        {data.vehicle === 'Intercity Transport' && (
          <div style={{ marginTop: '3px' }}>
            <strong>Transport Co:</strong> {data.transportCompany || '—'} &nbsp; <strong>Bilty No:</strong> {data.biltyNumber || '—'}
          </div>
        )}
        {['Rider', 'Rickshaw', 'Suzuki'].includes(data.vehicle) && (
          <div style={{ marginTop: '3px' }}>
            <strong>Driver:</strong> {data.driverName || '—'} &nbsp; <strong>Phone:</strong> {data.driverPhone || '—'}
          </div>
        )}
      </div>
    )}

    {/* ── Report Content ── */}
    {docType === 'report' && data && (
      <div style={{ color: '#1e293b' }}>
        <div className="keep-together" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: sz('10px','14px','16px'), borderBottom: '2px solid #1e293b', paddingBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <div>
            <div style={{ fontSize: sz('14px','18px','22px'), fontWeight: 900, lineHeight: 1.2 }}>{data.title || 'Report'}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>Generated {formatDateDisp(getLocalDateStr())}</div>
          </div>
          <div style={{ textAlign: 'right', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', flexShrink: 0 }}>
            <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Period</div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '11px' }}>{data.dateFilter || 'All Time'}</div>
          </div>
        </div>

        {data.view === 'Overview' ? (
          <div className="keep-together" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: sz('8px 12px','10px 16px','12px 20px'), fontSize: sz('9px','10px','11px'), fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Profit & Loss Summary
            </div>
            <div style={{ padding: sz('12px','16px','20px') }}>
              {[
                { label: 'Gross Product Sales', val: data.stats?.productRevenue || 0, color: '#1e293b' },
                { label: 'Total COGS', val: data.stats?.totalCOGS || 0, neg: true, color: '#dc2626' },
                { label: 'Gross Margin', val: data.stats?.grossMargin || 0, bold: true, divider: true },
                { label: 'Delivery Billed (+)', val: data.stats?.deliveryBilled || 0, color: '#0369a1', small: true },
                { label: 'Transport Expenses (−)', val: data.stats?.transportExpense || 0, neg: true, color: '#dc2626', small: true },
                { label: 'Operational Expenses (−)', val: data.stats?.totalExpenses || 0, neg: true, color: '#dc2626', small: true },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: sz('4px 0','5px 0','6px 0'),
                  borderTop: row.divider ? '1px solid #e2e8f0' : 'none',
                  marginTop: row.divider ? sz('6px','8px','10px') : 0,
                  paddingTop: row.divider ? sz('8px','10px','12px') : sz('4px','5px','6px'),
                  fontWeight: row.bold ? 800 : 500,
                  fontSize: row.small ? sz('8px','9px','10px') : sz('9px','10px','11px'),
                }}>
                  <span style={{ color: '#475569' }}>{row.label}:</span>
                  <span style={{ color: row.color || '#1e293b' }}>
                    {row.neg ? '− ' : ''}Rs. {Math.abs(row.val).toLocaleString()}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2.5px solid #1e293b', marginTop: sz('8px','10px','12px'), paddingTop: sz('8px','10px','12px'), fontWeight: 900, fontSize: sz('14px','18px','22px') }}>
                <span>Net Profit:</span>
                <span style={{ color: (data.stats?.netProfit || 0) >= 0 ? '#059669' : '#dc2626' }}>
                  Rs. {(data.stats?.netProfit || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: sz('8px','9px','10px') }}>
            <thead>
              <tr style={{ background: '#1e293b', color: 'white' }}>
                <th style={{ padding: sz('5px 4px','7px 6px','8px 8px'), textAlign: 'left', fontWeight: 800 }}>Name</th>
                {data.view !== 'Receivables' && <th style={{ padding: sz('5px 4px','7px 6px','8px 8px'), textAlign: 'center', fontWeight: 800 }}>Qty</th>}
                {data.view !== 'Receivables' && <th style={{ padding: sz('5px 4px','7px 6px','8px 8px'), textAlign: 'right', fontWeight: 800 }}>Revenue</th>}
                <th style={{ padding: sz('5px 4px','7px 6px','8px 8px'), textAlign: 'right', fontWeight: 800 }}>
                  {data.view === 'Receivables' ? 'Balance' : 'Gross Profit'}
                </th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ padding: sz('4px','6px','7px'), fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {r.Name || '—'}
                    {r.Company ? <span style={{ fontSize: '7.5px', color: '#94a3b8', display: 'block' }}>{r.Company}</span> : null}
                  </td>
                  {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'center' }}>{(r.Qty || 0).toLocaleString()}</td>}
                  {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right' }}>Rs.{(r.Revenue || 0).toLocaleString()}</td>}
                  <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                    Rs.{(r.GrossProfit || r.Amount || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {safeRows.length === 0 && (
                <tr><td colSpan={data.view === 'Receivables' ? 2 : 4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    )}

    {/* ── Invoice / Dispatch Items Table ── */}
    {(docType === 'invoice' || docType === 'dispatch') && (
      <>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: sz('12px','16px','20px'), fontSize: sz('8.5px','10px','11px') }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1e293b', background: '#f8fafc' }}>
              <th style={{ padding: sz('4px 2px 4px 0','7px 4px 7px 0','8px 6px 8px 0'), textAlign: 'left', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px' }}>
                Description
              </th>
              <th style={{ padding: sz('4px 2px','7px 4px','8px 6px'), textAlign: 'center', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                {docType === 'dispatch' ? 'Qty / Pack' : 'Qty'}
              </th>
              {docType === 'invoice' && (
                <th style={{ padding: sz('4px 2px','7px 4px','8px 6px'), textAlign: 'right', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px' }}>
                  Rate
                </th>
              )}
              {docType === 'invoice' && !isThermal && (
                <th style={{ padding: sz('','7px 4px 7px 0','8px 0 8px 4px'), textAlign: 'right', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px' }}>
                  Amount
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {safeItems.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td style={{ padding: sz('5px 2px 5px 0','7px 4px 7px 0','8px 6px 8px 0'), fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3, color: '#1e293b' }}>
                  {item?.name || '—'}
                  {item?.isBonus && (
                    <span style={{ marginLeft: '5px', padding: '1px 5px', background: '#d1fae5', color: '#059669', fontSize: '6.5px', fontWeight: 800, borderRadius: '4px', textTransform: 'uppercase', border: '1px solid #a7f3d0', letterSpacing: '0.5px' }}>
                      Bonus
                    </span>
                  )}
                </td>
                <td style={{ padding: sz('5px 2px','7px 4px','8px 6px'), textAlign: 'center', fontWeight: 600, lineHeight: 1.3, color: '#334155' }}>
                  {docType === 'dispatch' ? getDispatchQtyStr(item) : (item?.quantity || 0)}
                </td>
                {docType === 'invoice' && (
                  <td style={{ padding: sz('5px 2px','7px 4px','8px 6px'), textAlign: 'right', color: '#475569' }}>
                    {item?.isBonus ? (
                      <span style={{ color: '#059669', fontWeight: 800, fontSize: sz('7px','8px','9px'), textTransform: 'uppercase' }}>Free</span>
                    ) : (
                      <>
                        <span>Rs.{(item?.price || 0).toLocaleString()}</span>
                        {isThermal && (
                          <span style={{ display: 'block', fontWeight: 800, marginTop: '2px', fontSize: '9px', color: '#1e293b' }}>
                            = {((item?.price || 0) * (item?.quantity || 0)).toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                    {item?.isBonus && item?.originalPrice && (
                      <span style={{ display: 'block', fontSize: '7px', textDecoration: 'line-through', color: '#94a3b8', marginTop: '1px' }}>
                        Rs.{item.originalPrice}
                      </span>
                    )}
                  </td>
                )}
                {docType === 'invoice' && !isThermal && (
                  <td style={{ padding: sz('','7px 4px 7px 0','8px 0 8px 4px'), textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                    {item?.isBonus
                      ? <span style={{ color: '#059669' }}>Rs. 0</span>
                      : `Rs. ${((item?.price || 0) * (item?.quantity || 0)).toLocaleString()}`}
                  </td>
                )}
              </tr>
            ))}
            {safeItems.length === 0 && (
              <tr>
                <td colSpan={docType === 'invoice' ? (isThermal ? 3 : 4) : 2} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
          {docType === 'dispatch' && safeItems.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #1e293b' }}>
                <td style={{ padding: sz('5px 2px','7px 4px','8px 6px'), fontWeight: 700, fontSize: sz('8px','9px','10px'), color: '#475569' }}>
                  Total SKUs: <strong style={{ color: '#1e293b' }}>{safeItems.length}</strong>
                </td>
                <td colSpan={1} style={{ padding: sz('5px','7px','8px'), textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>
                  {safeItems.reduce((s, i) => s + (i.quantity || 0), 0)} units
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Invoice Totals */}
        {docType === 'invoice' && data && (() => {
          const { prevBalance, received, netBalance } = getInvoiceLedger();
          const totalSavings = safeItems.reduce((s, i) => s + (i?.isBonus ? (i?.originalPrice || 0) * (i?.quantity || 0) : 0), 0);
          const itemsSubtotal = (data.total || 0) - (data.deliveryBilled || 0);

          return (
            <div className="keep-together" style={{ float: 'right', width: isThermal ? '100%' : sz('','240px','280px'), borderTop: '2px solid #1e293b', paddingTop: sz('8px','10px','12px') }}>
              {[
                { label: 'Items Subtotal', val: `Rs. ${itemsSubtotal.toLocaleString()}` },
                (data.deliveryBilled || 0) > 0 && { label: `Delivery (${data.vehicle || ''})`, val: `Rs. ${Number(data.deliveryBilled).toLocaleString()}`, muted: true },
                { label: 'Current Bill', val: `Rs. ${(data.total || 0).toLocaleString()}`, bold: true, large: true, divider: true },
                { label: 'Previous Balance', val: `Rs. ${prevBalance.toLocaleString()}`, top: true },
                { label: 'Subtotal', val: `Rs. ${(prevBalance + (data.total || 0)).toLocaleString()}`, bold: true },
                received > 0 && { label: 'Payment Received', val: `− Rs. ${received.toLocaleString()}`, color: '#059669' },
              ].filter(Boolean).map((row, i) => row && (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sz('3px','4px','5px'), borderTop: row.divider || row.top ? '1px solid #e2e8f0' : 'none', paddingTop: row.divider || row.top ? sz('5px','6px','8px') : 0, marginTop: row.divider || row.top ? sz('4px','5px','6px') : 0, fontWeight: row.bold ? 800 : 500, fontSize: row.large ? sz('12px','14px','16px') : sz('8px','9px','10px') }}>
                  <span style={{ color: row.muted ? '#94a3b8' : '#475569' }}>{row.label}:</span>
                  <span style={{ color: row.color || '#1e293b' }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2.5px solid #1e293b', marginTop: sz('5px','6px','8px'), paddingTop: sz('6px','8px','10px'), fontWeight: 900, fontSize: sz('13px','16px','20px'), color: '#1e293b' }}>
                <span>Net Balance:</span>
                <span>Rs. {netBalance.toLocaleString()}</span>
              </div>
              {data.paymentStatus && (
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: sz('7px','8px','9px'), fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', background: data.paymentStatus === 'Paid' ? '#d1fae5' : data.paymentStatus === 'Partial' ? '#fef9c3' : '#fee2e2', color: data.paymentStatus === 'Paid' ? '#065f46' : data.paymentStatus === 'Partial' ? '#78350f' : '#991b1b', border: `1px solid ${data.paymentStatus === 'Paid' ? '#a7f3d0' : data.paymentStatus === 'Partial' ? '#fde68a' : '#fecaca'}` }}>
                    {data.paymentStatus}
                  </span>
                </div>
              )}
              {totalSavings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: sz('6px','8px','10px'), padding: sz('5px 8px','6px 10px','8px 12px'), background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontWeight: 800, fontSize: sz('8px','9px','10px'), color: '#065f46' }}>
                  <span>Bonus Savings:</span>
                  <span>Rs. {totalSavings.toLocaleString()}</span>
                </div>
              )}
            </div>
          );
        })()}
        <div style={{ clear: 'both' }}></div>

        {/* ── Invoice Notes ── */}
        {data?.notes && (
          <div className="keep-together" style={{ marginTop: sz('10px','14px','18px'), padding: sz('8px 10px','10px 14px','12px 16px'), background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: sz('8px','9px','10px'), color: '#78350f' }}>
            <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontSize: sz('7px','7.5px','8px'), color: '#92400e' }}>Notes / Remarks</div>
            <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.notes}</div>
          </div>
        )}

        {/* ── Return / Exchange Policy ── */}
        <div className="keep-together" style={{ marginTop: sz('12px','16px','20px'), border: '1.5px solid #1e293b', borderRadius: '8px', overflow: 'hidden', fontSize: sz('6.5px','7.5px','8.5px') }}>
          <div style={{ background: '#1e293b', color: 'white', padding: sz('4px 8px','5px 12px','6px 14px'), fontWeight: 900, textAlign: 'center', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: sz('6.5px','7px','8px') }}>
            "No" Return / Exchange Policy on Some Items
          </div>
          <div style={{ padding: sz('6px 8px','8px 12px','10px 14px'), background: '#f8fafc' }}>
            <div style={{ color: '#334155', lineHeight: 1.7, marginBottom: sz('4px','5px','6px') }}>
              To ensure <strong>"Reliable, Authentic &amp; Storage Maintained"</strong> Vet. Medical Supplies, there is a <strong>No Return / No Exchange</strong> policy for the following items:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sz('1px','2px','3px'), color: '#1e293b', fontWeight: 700 }}>
              {['1. Vaccines','2. Sprays','3. Imported Products','4. Surgical Items','5. Items with <6 Months Expiry','6. Damaged / Soiled Package'].map((item, i) => (
                <div key={i} style={{ padding: sz('1.5px 0','2px 0','3px 0') }}>{item}</div>
              ))}
            </div>
            <div style={{ marginTop: sz('4px','6px','8px'), textAlign: 'center', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', fontSize: sz('6px','7px','7.5px'), borderTop: '1px dashed #cbd5e1', paddingTop: sz('4px','5px','6px') }}>
              Khyber Traders · Wholesale Veterinary Pharmacy · Karachi
            </div>
          </div>
        </div>
      </>
    )}

    {/* ── Receipt Content ── */}
    {docType === 'receipt' && data && (
      <div className="keep-together">
        <div style={{ background: '#f0fdf4', padding: sz('16px 12px','24px 20px','32px 24px'), border: '2px solid #bbf7d0', borderRadius: sz('10px','14px','16px'), textAlign: 'center', marginBottom: sz('14px','18px','22px') }}>
          <div style={{ fontSize: sz('7.5px','8.5px','9px'), fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Amount Received
          </div>
          <div style={{ fontSize: sz('32px','44px','56px'), fontWeight: 900, color: '#059669', marginTop: sz('6px','8px','10px'), lineHeight: 1 }}>
            Rs. {(data.receivedAmount || 0).toLocaleString()}
          </div>
          {data.note && (
            <div style={{ display: 'inline-block', marginTop: sz('8px','10px','12px'), padding: sz('3px 10px','4px 14px','6px 16px'), background: 'white', borderRadius: '999px', border: '1px solid #86efac', fontSize: sz('9px','10px','11px'), fontWeight: 600, color: '#15803d', wordBreak: 'break-word' }}>
              {data.note}
            </div>
          )}
        </div>
        <div style={{ borderTop: '2px solid #1e293b', paddingTop: sz('10px','14px','16px') }}>
          {[
            { label: 'Previous Balance', val: `Rs. ${(data.prevBalance || 0).toLocaleString()}`, color: '#64748b' },
            { label: 'Amount Credited', val: `− Rs. ${(data.receivedAmount || 0).toLocaleString()}`, color: '#059669' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sz('5px','7px','8px'), fontWeight: 600, fontSize: sz('10px','11px','12px'), color: r.color }}>
              <span>{r.label}:</span><span>{r.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: sz('14px','18px','22px'), color: '#1e293b', borderTop: '1px solid #e2e8f0', paddingTop: sz('8px','10px','12px'), marginTop: sz('4px','6px','8px') }}>
            <span>Remaining Balance:</span>
            <span>Rs. {(data.newBalance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    )}

    {/* ── Ledger Content ── */}
    {docType === 'ledger' && data && (
      <>
        {/* Summary bar */}
        <div className="keep-together" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sz('10px','14px','16px'), background: '#f8fafc', borderRadius: '10px', padding: sz('8px 10px','10px 14px','12px 16px'), border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>Opening Balance</div>
            <div style={{ fontSize: sz('12px','14px','16px'), fontWeight: 800, color: '#1e293b' }}>Rs. {(data.openingBal || 0).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>Total Debit</div>
            <div style={{ fontSize: sz('12px','14px','16px'), fontWeight: 800, color: '#4338ca' }}>Rs. {(data.totalDebit || 0).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '7.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>Total Credit</div>
            <div style={{ fontSize: sz('12px','14px','16px'), fontWeight: 800, color: '#059669' }}>Rs. {(data.totalCredit || 0).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right', background: '#fff1f2', padding: sz('6px 10px','8px 12px','10px 14px'), borderRadius: '8px', border: '1px solid #fecdd3', flexShrink: 0 }}>
            <div style={{ fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#e11d48', letterSpacing: '1px' }}>Closing Balance</div>
            <div style={{ fontWeight: 900, color: '#be123c', fontSize: sz('13px','16px','20px') }}>Rs. {(data.closingBal || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Ledger table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: sz('7.5px','9px','10px'), tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <th style={{ padding: sz('4px 2px','7px 5px','8px 6px'), textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6.5px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '20%' : '13%' }}>Date</th>
              <th style={{ padding: sz('4px 2px','7px 5px','8px 6px'), textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6.5px','7.5px','8px'), letterSpacing: '0.5px' }}>Particulars</th>
              <th style={{ padding: sz('4px 2px','7px 5px','8px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6.5px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '17%' : '15%' }}>{isThermal ? 'Dr' : 'Debit (Dr)'}</th>
              <th style={{ padding: sz('4px 2px','7px 5px','8px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6.5px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '17%' : '15%' }}>{isThermal ? 'Cr' : 'Credit (Cr)'}</th>
              <th style={{ padding: sz('4px 2px','7px 5px','8px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6.5px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '19%' : '17%' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, i) => (
              <tr key={row.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td style={{ padding: sz('4px 2px','6px 5px','7px 6px'), color: '#64748b', whiteSpace: 'nowrap', fontSize: sz('7px','8.5px','9px') }}>
                  {formatDateDisp(row.date)}
                </td>
                <td style={{ padding: sz('4px 2px','6px 5px','7px 6px'), wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 700, display: 'block', lineHeight: 1.3, color: '#1e293b' }}>{row.desc || '—'}</span>
                  <span style={{ fontSize: sz('6px','7px','7.5px'), color: '#94a3b8', fontWeight: 500, display: 'block', marginTop: '1px', wordBreak: 'break-all' }}>{row.ref || ''}</span>
                </td>
                <td style={{ padding: sz('4px 2px','6px 5px','7px 6px'), textAlign: 'right', fontWeight: 800, color: '#4338ca' }}>
                  {(row.debit || 0) > 0 ? (row.debit || 0).toLocaleString() : '—'}
                </td>
                <td style={{ padding: sz('4px 2px','6px 5px','7px 6px'), textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                  {(row.credit || 0) > 0 ? (row.credit || 0).toLocaleString() : '—'}
                </td>
                <td style={{ padding: sz('4px 2px','6px 5px','7px 6px'), textAlign: 'right', fontWeight: 900, color: (row.balance || 0) > 0 ? '#be123c' : '#065f46' }}>
                  {(row.balance || 0).toLocaleString()}
                </td>
              </tr>
            ))}
            {safeRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No transactions in this period</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', borderTop: '2px solid #1e293b' }}>
              <td colSpan={2} style={{ padding: sz('5px 2px','8px 5px','10px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px', color: '#475569' }}>
                Period Totals:
              </td>
              <td style={{ padding: sz('5px 2px','8px 5px','10px 6px'), textAlign: 'right', fontWeight: 900, color: '#4338ca' }}>{(data.totalDebit || 0).toLocaleString()}</td>
              <td style={{ padding: sz('5px 2px','8px 5px','10px 6px'), textAlign: 'right', fontWeight: 900, color: '#059669' }}>{(data.totalCredit || 0).toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </>
    )}

    {/* ── Footer ── */}
    <div style={{
      marginTop: sz('20px','28px','36px'),
      textAlign: 'center',
      fontSize: sz('7px','7.5px','8px'),
      color: '#cbd5e1',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
      paddingTop: sz('10px','12px','14px'),
      borderTop: '1px dashed #e2e8f0',
    }}>
      Software Generated · {APP_NAME} · {formatDateDisp(getLocalDateStr())}
    </div>
  </div>

  {/* ── Print/PDF styles ── */}
  <style>{`
    #print-document {
      box-shadow: 0 4px 40px rgba(0,0,0,0.08);
      min-height: 200px;
      margin-top: 16px;
      margin-bottom: 40px;
    }
    @media print {
      @page { margin: 8mm; }
      @page :first { margin-top: 8mm; }
      html, body { height: auto !important; overflow: visible !important; }
      #print-root { display: block !important; position: relative !important; }
      .no-print { display: none !important; }
      #print-document {
        box-shadow: none !important;
        width: 100% !important;
        max-width: none !important;
        min-width: unset !important;
        margin: 0 !important;
        padding: 6mm !important;
        font-size: 10pt !important;
        position: relative !important;
      }
      .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
      table { page-break-inside: auto !important; width: 100% !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    }
  `}</style>
</div>
);
}

export default PrintView;

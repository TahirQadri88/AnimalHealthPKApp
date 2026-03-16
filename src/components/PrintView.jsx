import React, { useRef, useEffect } from 'react';
import { FileDown, Printer, Share2, X, MessageCircle, Image } from 'lucide-react';
import { formatDateDisp, getLocalDateStr, APP_NAME } from '../helpers';

// Format: 'thermal' | 'a5' | 'a4'
function PrintView({ printConfig, setPrintConfig, products, customers, getCustomerLedger, getCustomerBalance, showToast, appSettings }) {
const { docType, format, data } = printConfig;
const biz = appSettings || {};
const bizName = biz.businessName || 'Khyber Traders';
const bizAppName = biz.appName || APP_NAME;
const bizTagline = biz.tagline || 'Wholesale Veterinary Pharmacy · Karachi';
const showOnDocs = biz.showBusinessNameOnDocs !== false;
const showOnReports = biz.showBusinessNameOnReports !== false;
const isThermal = format === 'thermal';
const isA5 = format === 'a5';
const printRef = useRef(null);

// Keyboard: Escape closes the print view
useEffect(() => {
  const onKey = (e) => { if (e.key === 'Escape') setPrintConfig(null); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);

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

const safeStr = (s) => String(s ?? '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const getFileName = () => {
  const custName = safeStr(data?.customerName || data?.title || 'Doc');
  const ref = safeStr(data?.id || '');
  const dateStr = (data?.date || getLocalDateStr()).replace(/-/g, '');
  const labels = { invoice: 'Invoice', dispatch: 'DispatchNote', receipt: 'Receipt', ledger: 'Ledger', report: 'Report', estimate: 'Estimate', creditnote: 'CreditNote' };
  const label = labels[docType] || 'Document';
  if (docType === 'ledger') {
    const start = (data?.dateRange?.start || '').replace(/-/g, '');
    const end = (data?.dateRange?.end || '').replace(/-/g, '');
    return `${label}_${custName}_${start}_${end}.pdf`;
  }
  if (docType === 'report') {
    const viewStr = safeStr(data?.view || 'Overview');
    const periodStr = data?.dateFilter === 'Custom' && data?.appliedFilters?.customStart
      ? `${(data.appliedFilters.customStart||'').replace(/-/g,'')}to${(data.appliedFilters.customEnd||'').replace(/-/g,'')}`
      : safeStr(data?.dateFilter || 'All');
    return `${label}_${viewStr}_${periodStr}.pdf`;
  }
  return `${label}_${ref}_${custName}_${dateStr}.pdf`;
};

// ── Short caption for native share sheet ─────────────────────────────────
const getShareCaption = () => {
  if (!data) return getFileName().replace(/\.[^.]+$/, '');
  if (docType === 'invoice') return `Invoice #${data.id} for ${data.customerName} — Rs. ${(data.total || 0).toLocaleString()} | ${formatDateDisp(data.date)}`;
  if (docType === 'estimate') return `Price Estimate ${data.id} for ${data.customerName} | ${formatDateDisp(data.date)}`;
  if (docType === 'dispatch') return `Dispatch Note #${data.id} for ${data.customerName} | ${formatDateDisp(data.date)}`;
  if (docType === 'receipt') return `Payment Receipt ${data.id} — Rs. ${(data.receivedAmount || 0).toLocaleString()} received from ${data.customerName}`;
  if (docType === 'creditnote') return `Credit Note ${data.id} for ${data.customerName} — Rs. ${(data.total || 0).toLocaleString()}`;
  if (docType === 'ledger') return `Account Statement: ${data.customerName} | ${formatDateDisp(data.dateRange?.start)} – ${formatDateDisp(data.dateRange?.end)}`;
  if (docType === 'report') return `${data.title || 'Analytics Report'} | Period: ${data.dateFilter || ''}`;
  return getFileName().replace(/\.[^.]+$/, '');
};

// ── WhatsApp share text ────────────────────────────────────────────────────
const generateShareText = () => {
  if (!data) return '';
  let text = `*${bizAppName}*\n`;
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

  } else if (docType === 'estimate') {
    text += `*PRICE ESTIMATE / QUOTATION*\n`;
    text += `${hr}\n`;
    text += `Ref: ${data.id}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `For: *${data.customerName}*\n\n`;
    text += `*Items:*\n`;
    const estimateItemsTotal = (data.items || []).reduce((s, i) => s + (i?.isBonus ? 0 : (i?.price || 0) * (i?.quantity || 0)), 0);
    (data.items || []).forEach(i => {
      const lineTotal = i.isBonus ? 'FREE' : `Rs.${((i.price || 0) * (i.quantity || 0)).toLocaleString()}`;
      text += `• ${i.name}${i.isBonus ? ' 🎁' : ''} x${i.quantity} @ Rs.${i.price || 0} = ${lineTotal}\n`;
    });
    if ((data.deliveryBilled || 0) > 0) text += `🚚 Delivery: Rs.${Number(data.deliveryBilled).toLocaleString()}\n`;
    text += `${hr}\n`;
    text += `*Estimated Total: Rs.${(estimateItemsTotal + (data.deliveryBilled || 0)).toLocaleString()}*\n\n`;
    text += `⚠ _Rates and availability can change anytime without prior notice._\n`;
    text += `This estimate is for reference only and does not constitute a final invoice.`;

  } else if (docType === 'creditnote') {
    text += `*CREDIT NOTE / SALES RETURN*\n`;
    text += `${hr}\n`;
    text += `Ref: ${data.id}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `Customer: *${data.customerName}*\n`;
    if (data.originalInvoiceId) text += `Original Invoice: ${data.originalInvoiceId}\n`;
    text += `\n*Items Returned:*\n`;
    (data.items || []).forEach(i => {
      text += `• ${i.name} ×${i.quantity} @ Rs.${i.price || 0} = Rs.${((i.price||0)*(i.quantity||0)).toLocaleString()}\n`;
    });
    text += `${hr}\n`;
    text += `*Total Credit: Rs.${(data.total||0).toLocaleString()}*\n`;
    if (data.reason) text += `Reason: ${data.reason}\n`;
    text += `\nThis amount has been credited to your account.`;

  } else if (docType === 'dispatch') {
    text += `*DISPATCH NOTE #${data.id}*\n`;
    text += `${hr}\n`;
    text += `Date: ${formatDateDisp(data.date)}\n`;
    text += `*${data.customerName}*\n`;
    if (data.customerDetails?.contactPerson || data.customerDetails?.phone)
      text += `${data.customerDetails?.contactPerson || ''} ${data.customerDetails?.phone ? '- ' + data.customerDetails.phone : ''}\n`;
    const _addrKey = data.deliveryAddressKey || 'address1';
    const _addr = _addrKey === 'address2' ? data.customerDetails?.address2 : data.customerDetails?.address1;
    const _map = _addrKey === 'address2' ? data.customerDetails?.map2 : data.customerDetails?.map1;
    if (_addr) text += `${_addr}\n`;
    if (_map) text += `${_map}\n`;
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
    const periodClosingBal = (data.openingBal || 0) + (data.totalDebit || 0) - (data.totalCredit || 0);
    text += `Opening Balance: Rs.${(data.openingBal || 0).toLocaleString()}\n`;
    text += `Total Debits: Rs.${(data.totalDebit || 0).toLocaleString()}\n`;
    text += `Total Credits: Rs.${(data.totalCredit || 0).toLocaleString()}\n`;
    text += `*Closing Balance: Rs.${periodClosingBal.toLocaleString()}*\n\n`;
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

// ── Build standalone HTML doc (shared by print + share) ──────────────────
const buildHtmlDoc = () => {
  const element = document.getElementById('print-document');
  if (!element) return null;
  const clone = element.cloneNode(true);
  clone.removeAttribute('class');

  // THERMAL: mark dark-background elements so CSS can restore white text
  if (isThermal) {
    const parseRgb = s => { const m = (s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
    const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    clone.querySelectorAll('*').forEach(el => {
      const bg = el.style.background || el.style.backgroundColor;
      const rgb = parseRgb(bg);
      if (rgb && lum(rgb) < 0.45) el.setAttribute('data-dk', '1');
    });
  }
  const paperW  = isThermal ? '80mm' : isA5 ? '148mm' : '210mm';
  const padding = isThermal ? '12px' : isA5 ? '20px' : '28px';
  const widthCss = isThermal
    ? 'width:80mm;max-width:80mm;min-width:80mm'
    : `width:100%;max-width:${paperW}`;
  clone.style.cssText = [
    widthCss, 'margin:0 auto', `padding:${padding}`, 'background:white',
    'font-family:system-ui,-apple-system,sans-serif',
    `font-size:${isThermal ? '10px' : isA5 ? '11px' : '12px'}`,
    'line-height:1.5', 'box-sizing:border-box',
  ].join(';');
  const pageSize   = isThermal ? '80mm auto' : isA5 ? 'A5 portrait' : 'A4 portrait';
  // Thermal: 5mm top/bottom, 4mm left/right — covers the printer's 2–3mm hardware non-printable edge
  const pageMargin = isThermal ? '5mm 4mm' : '10mm';
  const bodyPad    = isThermal ? '8px' : '16px';
  const docTitle   = getFileName().replace(/\.[^.]+$/, '');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${docTitle}</title>
  <style>
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    body{margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;}
    #nav-bar{position:sticky;top:0;z-index:100;background:#1e293b;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
    #nav-bar .nav-title{color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    #nav-bar .nav-btn{background:#334155;border:none;color:white;font-size:12px;font-weight:700;padding:8px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;}
    #nav-bar .nav-btn:hover{background:#475569;}
    #nav-bar .print-btn{background:#059669;}
    #nav-bar .print-btn:hover{background:#047857;}
    #doc-wrap{padding:${bodyPad};}
    @media print{#nav-bar{display:none!important;}body{background:white;margin:0;}@page{size:${pageSize};margin:0;}
      #doc-wrap{padding:${pageMargin};}#doc>*{width:100%!important;max-width:none!important;padding:0!important;}}
    ${isThermal ? `@media print{#doc *{color:black!important;}[data-dk],[data-dk] *{color:white!important;}}` : ''}
  </style>
</head>
<body>
<div id="nav-bar">
  <button class="nav-btn" onclick="window.close()" title="Close">&#8592; Close</button>
  <span class="nav-title">${docTitle}</span>
  <button class="nav-btn print-btn" onclick="window.print()" title="Print">&#128438; Print</button>
</div>
<div id="doc-wrap"><div id="doc">${clone.outerHTML}</div></div>
</body>
</html>`;
  return { html, docTitle };
};

// ── Thermal print: html2canvas 4× scale → image → print window ───────────
// This gives dark, crisp output on thermal printers regardless of browser DPI.
const handleThermalPrint = async () => {
  const element = document.getElementById('print-document');
  if (!element) { showToast('Document not found', 'error'); return; }
  showToast('Preparing thermal print…');

  // Load html2canvas if not already loaded
  if (!window.html2canvas) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => null);
  }

  // If html2canvas still unavailable, fall back to regular HTML print
  if (!window.html2canvas) {
    showToast('Falling back to standard print…');
    const result = buildHtmlDoc();
    if (!result) return;
    const newWin = window.open('', '_blank');
    if (!newWin) { showToast('Allow popups to enable printing', 'error'); return; }
    newWin.document.open(); newWin.document.write(result.html); newWin.document.close();
    newWin.onload = () => { newWin.focus(); newWin.print(); };
    setTimeout(() => { try { newWin.focus(); newWin.print(); } catch (e) {} }, 900);
    return;
  }

  const targetW = 302; // 80 mm at 96 dpi
  const SCALE   = 4;   // Render at 4× → ~384 effective dpi → dark crisp output

  // Clone and apply high-contrast colours (gray text → black, preserve white-on-dark)
  const clone = element.cloneNode(true);
  const parseRgb = s => { const m = (s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  clone.querySelectorAll('*').forEach(el => {
    const bgRgb = parseRgb(el.style.background || el.style.backgroundColor);
    const bgLum = bgRgb ? lum(bgRgb) : 1;
    const fgRgb = parseRgb(el.style.color);
    if (fgRgb) {
      const fgL = lum(fgRgb);
      // Light bg + gray/muted text → force black
      if (bgLum >= 0.5 && fgL > 0.15 && fgL < 0.95) el.style.color = '#000000';
      // Dark bg + dark text → restore white
      if (bgLum < 0.4 && fgL < 0.7) el.style.color = '#ffffff';
    }
    // Lighten near-invisible borders slightly so they print
    if (el.style.borderColor) {
      const bcRgb = parseRgb(el.style.borderColor);
      if (bcRgb && lum(bcRgb) > 0.85) el.style.borderColor = '#aaaaaa';
    }
  });

  Object.assign(clone.style, {
    position: 'absolute', left: '-9999px', top: '0',
    width: targetW + 'px', maxWidth: targetW + 'px', minWidth: targetW + 'px',
    // 10px (≈2.6mm) side padding inside the canvas keeps text away from the image edge
    margin: '0', padding: '8px 10px', boxShadow: 'none', zIndex: '-1', background: 'white',
  });
  document.body.appendChild(clone);
  const elH = clone.scrollHeight;

  try {
    const canvas = await window.html2canvas(clone, {
      scale: SCALE, useCORS: true, logging: false, letterRendering: true,
      width: targetW, windowWidth: targetW,
      height: elH, windowHeight: elH,
      backgroundColor: '#ffffff', scrollX: 0, scrollY: 0,
    });
    if (document.body.contains(clone)) document.body.removeChild(clone);

    const imgDataUrl = canvas.toDataURL('image/png');
    const newWin = window.open('', '_blank');
    if (!newWin) { showToast('Allow popups to enable printing', 'error'); return; }
    newWin.document.write(`<!DOCTYPE html><html><head>
<style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:80mm auto;margin:5mm 4mm;}@media print{body{margin:0;background:white;}}img{width:100%;max-width:100%;display:block;}</style>
</head><body><img src="${imgDataUrl}"><script>window.onload=function(){window.focus();window.print();}<\/script></body></html>`);
    newWin.document.close();
  } catch (e) {
    if (document.body.contains(clone)) document.body.removeChild(clone);
    showToast('Print failed — try PDF instead', 'error');
  }
};

// ── Print — opens clean new window and auto-triggers print dialog ─────────
const handlePrint = () => {
  // Thermal: render via html2canvas at 4× scale for dark, crisp output
  if (isThermal) { handleThermalPrint(); return; }

  const result = buildHtmlDoc();
  if (!result) { showToast('Document not found', 'error'); return; }
  const { html } = result;
  const newWin = window.open('', '_blank');
  if (!newWin) { showToast('Allow popups to enable printing', 'error'); return; }
  newWin.document.open();
  newWin.document.write(html);
  newWin.document.close();
  // onload fires after content is rendered; fallback setTimeout for slower devices
  newWin.onload = () => { newWin.focus(); newWin.print(); };
  setTimeout(() => { try { newWin.focus(); newWin.print(); } catch (e) {} }, 900);
};

// ── HTML Share / Download ─────────────────────────────────────────────────
const handleShareHTML = () => {
  const result = buildHtmlDoc();
  if (!result) { showToast('Document not found', 'error'); return; }
  const { html, docTitle } = result;
  const blob     = new Blob([html], { type: 'text/html;charset=utf-8' });
  const fileName = docTitle + '.html';

  const downloadFallback = () => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('Downloaded! Open in browser to share or print');
  };

  // Native share sheet: iOS 15+, Android Chrome 86+ — must call synchronously
  // within the user-gesture to keep the activation context alive
  if (navigator.canShare) {
    const file = new File([blob], fileName, { type: 'text/html' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: docTitle, text: getShareCaption() })
        .catch(e => { if (e.name !== 'AbortError') downloadFallback(); });
      return;
    }
  }

  // HTML files not shareable on most Android — fall back to text-only share
  // which still opens the native share card (WhatsApp, etc.)
  if (navigator.share) {
    navigator.share({ title: docTitle, text: getShareCaption() })
      .catch(e => { if (e.name !== 'AbortError') downloadFallback(); });
    return;
  }

  // Desktop / tablets without share API: open in new tab
  const newWin = window.open('', '_blank');
  if (newWin) {
    newWin.document.open();
    newWin.document.write(html);
    newWin.document.close();
    return;
  }

  // Final fallback: download
  downloadFallback();
};

// ── PDF download ──────────────────────────────────────────────────────────
const handlePDF = () => {
  const element = document.getElementById('print-document');
  if (!element) { showToast('Print element not found', 'error'); return; }

  const printRoot = document.getElementById('print-root');
  if (printRoot) printRoot.scrollTop = 0;

  showToast('Generating PDF…');

  setTimeout(() => {
    const fixedW = isThermal ? 302 : (isA5 ? 559 : 794);

    // Clone the element off-screen at exact target width — html2pdf captures the clone,
    // so there is no coordinate offset from centering/mx-auto on the live element
    const clone = element.cloneNode(true);
    Object.assign(clone.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: fixedW + 'px',
      maxWidth: fixedW + 'px',
      minWidth: fixedW + 'px',
      margin: '0',
      boxShadow: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(clone);
    const elH = clone.scrollHeight;

    const cleanup = () => { if (document.body.contains(clone)) document.body.removeChild(clone); };

    if (isThermal) {
      const pdfW = 80;
      const margins = [3, 3, 3, 3];
      const contentWmm = pdfW - margins[1] - margins[3];
      const pdfH = Math.ceil((elH / fixedW) * contentWmm) + margins[0] + margins[2] + 20;
      html2pdf().set({
        margin: margins, filename: getFileName(),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, logging: false, letterRendering: true, scrollY: 0, scrollX: 0, width: fixedW, windowWidth: fixedW },
        jsPDF: { unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      }).from(clone).save()
        .then(() => { cleanup(); showToast('PDF saved!'); })
        .catch(() => { cleanup(); showToast('PDF failed — use Print instead', 'error'); });
    } else {
      const pdfW = isA5 ? 148 : 210;
      const margins = isA5 ? [8, 8, 12, 8] : [10, 10, 15, 10];
      const contentWmm = pdfW - margins[1] - margins[3];
      const pdfH = Math.ceil((elH / fixedW) * contentWmm) + margins[0] + margins[2] + 60;
      html2pdf().set({
        margin: margins, filename: getFileName(),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true, scrollY: 0, scrollX: 0, width: fixedW, windowWidth: fixedW },
        jsPDF: { unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      }).from(clone).save()
        .then(() => { cleanup(); showToast('PDF saved!'); })
        .catch(() => { cleanup(); showToast('PDF failed — use Print instead', 'error'); });
    }
  }, 300);
};

// ── Image (PNG) Share — uses html2canvas, no pdf library needed ───────────
const handleImageShare = async () => {
  const element = document.getElementById('print-document');
  if (!element) { showToast('Document not found', 'error'); return; }
  showToast('Generating image…');

  // Load html2canvas dynamically
  if (!window.html2canvas) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => { showToast('Image library failed to load', 'error'); });
    if (!window.html2canvas) return;
  }

  try {
    const targetW = isThermal ? 302 : isA5 ? 559 : 794;
    const clone = element.cloneNode(true);
    Object.assign(clone.style, {
      position: 'absolute', left: '-9999px', top: '0',
      width: targetW + 'px', maxWidth: targetW + 'px', minWidth: targetW + 'px',
      margin: '0', boxShadow: 'none', zIndex: '-1', background: 'white',
    });
    document.body.appendChild(clone);
    const elH = clone.scrollHeight;

    await new Promise(r => setTimeout(r, 150));

    const canvas = await window.html2canvas(clone, {
      scale: 2, useCORS: true, logging: false, letterRendering: true,
      width: targetW, windowWidth: targetW,
      height: elH, windowHeight: elH,
      backgroundColor: '#ffffff', scrollX: 0, scrollY: 0,
    });
    if (document.body.contains(clone)) document.body.removeChild(clone);

    const imgFileName = getFileName().replace(/\.pdf$/, '.jpg');
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('Image generation failed', 'error'); return; }
      const file = new File([blob], imgFileName, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: imgFileName.replace(/\.jpg$/, ''), text: getShareCaption() })
          .catch(e => { if (e.name !== 'AbortError') downloadImageFallback(blob, imgFileName); });
      } else {
        downloadImageFallback(blob, imgFileName);
      }
    }, 'image/jpeg', 0.93);
  } catch (e) {
    showToast('Image failed — use Print instead', 'error');
  }
};

const downloadImageFallback = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast('Image saved! Share via gallery or WhatsApp');
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
  estimate: 'Price Estimate / Quotation',
  creditnote: 'Sales Return / Credit Note',
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
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${isThermal ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >Thermal</button>
        )}
        {showA5 && (
          <button
            onClick={() => setPrintConfig({ ...printConfig, format: 'a5' })}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${isA5 ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >A5</button>
        )}
        {showA4 && (
          <button
            onClick={() => setPrintConfig({ ...printConfig, format: 'a4' })}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${!isThermal && !isA5 ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
          >A4</button>
        )}
      </div>

      {/* Doc type label */}
      <span className="text-slate-400 font-bold text-xs uppercase tracking-widest hidden sm:block">{docLabel}</span>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleShareHTML}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><FileDown size={14}/> Save / Share</button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><Printer size={14}/> Print</button>

        <button
          onClick={handleImageShare}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-white rounded-lg font-bold text-xs transition-colors shadow"
          title="Share as Image (PNG/JPG) — works with WhatsApp"
        ><Image size={14}/> Image</button>

        <a
          href={`https://wa.me/?text=${generateShareText()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-white rounded-lg font-bold text-xs transition-colors shadow"
        ><MessageCircle size={14}/> WhatsApp</a>

        <button
          onClick={() => setPrintConfig(null)}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 text-white rounded-lg font-bold text-xs transition-colors shadow"
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
    <div className="keep-together" style={{ textAlign: 'center', marginBottom: sz('10px','14px','18px'), borderBottom: '2px solid #1e293b', paddingBottom: sz('8px','10px','14px') }}>
      {showOnDocs && <div style={{ fontSize: sz('14px','18px','22px'), fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase', color: '#0f172a', lineHeight: 1.2 }}>
        {bizName}
      </div>}
      {bizTagline && showOnDocs && <div style={{ fontSize: sz('7px','7.5px','8px'), textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>
        {bizTagline}
      </div>}
      <div style={{
        marginTop: sz('5px','7px','9px'),
        display: 'inline-block',
        lineHeight: '1.2',
        padding: isThermal ? '4px 10px' : '5px 14px',
        background: '#1e293b',
        color: 'white',
        borderRadius: '999px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        fontSize: sz('7px','8px','9px'),
        textAlign: 'center',
      }}>
        {docLabel}
      </div>
    </div>

    {/* ── Customer / Doc Meta ── */}
    {docType !== 'report' && data && (
      <div className="keep-together" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sz('10px','12px','16px'), gap: '8px' }}>
        {/* Left: customer */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '7px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', color: '#94a3b8', marginBottom: '3px' }}>
            {docType === 'ledger' ? 'Account Holder' : 'Customer'}
          </div>
          <div style={{ fontSize: sz('12px','15px','18px'), fontWeight: 900, lineHeight: 1.2, wordBreak: 'break-word', color: '#0f172a' }}>
            {data.customerName || 'Unknown'}
          </div>
          {docType === 'dispatch' && data.customerDetails && (
            <div style={{ marginTop: '6px', fontSize: sz('7.5px','8.5px','9px'), color: '#334155', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: 1.6 }}>
              {(data.customerDetails.contactPerson || data.customerDetails.phone) && (
                <div><strong>{data.customerDetails.contactPerson || 'N/A'}</strong>
                  {data.customerDetails.phone ? ` · ${data.customerDetails.phone}` : ''}
                </div>
              )}
              {(() => {
                const useKey = data.deliveryAddressKey || 'address1';
                const addr = useKey === 'address2' ? data.customerDetails.address2 : data.customerDetails.address1;
                const mapLink = useKey === 'address2' ? data.customerDetails.map2 : data.customerDetails.map1;
                return (<>
                  {addr && <div style={{ marginTop: '2px' }}>{addr}</div>}
                  {mapLink && <div style={{ fontSize: '7px', color: '#6366f1', marginTop: '2px', wordBreak: 'break-all' }}>Map: {mapLink}</div>}
                </>);
              })()}
            </div>
          )}
          {docType === 'ledger' && data.phone && (
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{data.phone}</div>
          )}
        </div>

        {/* Right: ref + date */}
        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '6px', minWidth: 0 }}>
          {docType !== 'ledger' && (
            <>
              <div style={{ fontSize: '7px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8', marginBottom: '2px' }}>Ref #</div>
              <div style={{ fontWeight: 800, fontSize: sz('9px','11px','12px'), color: '#1e293b', maxWidth: isThermal ? '95px' : '160px', lineHeight: 1.2, fontFamily: 'monospace', ...(isThermal ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : { wordBreak: 'break-all' }) }}>{data.id || '—'}</div>
              <div style={{ color: '#64748b', fontSize: sz('8px','9px','10px'), marginTop: '2px', fontWeight: 600 }}>{formatDateDisp(data.date)}</div>
              {docType === 'invoice' && data.salespersonName && (
                <div style={{ fontSize: sz('7px','8px','9px'), color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isThermal ? '90px' : '160px' }}>by {data.salespersonName}</div>
              )}
            </>
          )}
          {docType === 'ledger' && (
            <>
              <div style={{ fontSize: '7px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8', marginBottom: '2px' }}>Printed</div>
              <div style={{ fontWeight: 700, fontSize: sz('8px','9px','10px') }}>{formatDateDisp(getLocalDateStr())}</div>
              <div style={{ fontSize: sz('7.5px','8px','9px'), color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
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
        <div className="keep-together" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: sz('6px','10px','12px'), borderBottom: '2px solid #1e293b', paddingBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <div>
            <div style={{ fontSize: sz('14px','18px','22px'), fontWeight: 900, lineHeight: 1.2 }}>{data.title || 'Report'}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>Generated {formatDateDisp(data.generatedOn || getLocalDateStr())}</div>
          </div>
          <div style={{ textAlign: 'right', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', flexShrink: 0 }}>
            <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Period</div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '11px' }}>{data.dateFilter || 'All Time'}</div>
          </div>
        </div>

        {/* Criteria box */}
        {(data.appliedFilters?.companies || data.appliedFilters?.company || data.appliedFilters?.customers || data.appliedFilters?.customer || data.appliedFilters?.salespersons || data.appliedFilters?.salesperson || data.appliedFilters?.customStart) && (
          <div className="keep-together" style={{ marginBottom: sz('8px','12px','14px'), padding: sz('6px 8px','8px 12px','10px 14px'), background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: sz('7px','8px','9px') }}>
            <div style={{ fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px', fontSize: sz('6px','7px','7.5px') }}>
              Filters Applied
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: '#0c4a6e' }}>
              {(data.appliedFilters.companies || data.appliedFilters.company) && <span><strong>Brand:</strong> {data.appliedFilters.companies || data.appliedFilters.company}</span>}
              {(data.appliedFilters.customers || data.appliedFilters.customer) && <span><strong>Client:</strong> {data.appliedFilters.customers || data.appliedFilters.customer}</span>}
              {(data.appliedFilters.salespersons || data.appliedFilters.salesperson) && <span><strong>Staff:</strong> {data.appliedFilters.salespersons || data.appliedFilters.salesperson}</span>}
              {data.appliedFilters.customStart && <span><strong>From:</strong> {formatDateDisp(data.appliedFilters.customStart)} <strong>To:</strong> {formatDateDisp(data.appliedFilters.customEnd)}</span>}
            </div>
          </div>
        )}

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
              {safeRows.map((r, i) => {
                const rName = r['Product Name'] || r['Brand Name'] || r['Customer Name'] || r['Staff Name'] || r.Name || '—';
                const rBrand = r['Brand'] || r.Company || '';
                const rQty = r['Qty Sold'] || r.Qty || 0;
                const rRev = r['Revenue (Rs)'] || r.Revenue || 0;
                const rGP = r['Gross Profit (Rs)'] || r['Outstanding (Rs)'] || r.GrossProfit || r.Amount || 0;
                return (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ padding: sz('4px','6px','7px'), fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {rName}
                    {rBrand ? <span style={{ fontSize: '7.5px', color: '#94a3b8', display: 'block' }}>{rBrand}</span> : null}
                  </td>
                  {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'center' }}>{Number(rQty).toLocaleString()}</td>}
                  {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right' }}>Rs.{Number(rRev).toLocaleString()}</td>}
                  <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                    Rs.{Number(rGP).toLocaleString()}
                  </td>
                </tr>
                );
              })}
              {safeRows.length === 0 && (
                <tr><td colSpan={data.view === 'Receivables' ? 2 : 4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No data</td></tr>
              )}
            </tbody>
            {safeRows.length > 0 && (() => {
              const totalQty = safeRows.reduce((s,r) => s + (Number(r['Qty Sold']||r.Qty)||0), 0);
              const totalRev = safeRows.reduce((s,r) => s + (Number(r['Revenue (Rs)']||r.Revenue)||0), 0);
              const totalGP = safeRows.reduce((s,r) => s + (Number(r['Gross Profit (Rs)']||r['Outstanding (Rs)']||r.GrossProfit||r.Amount)||0), 0);
              return (
                <tfoot>
                  <tr style={{ background: '#1e293b', color: 'white', fontWeight: 900, fontSize: sz('8px','9px','10px') }}>
                    <td style={{ padding: sz('4px 4px','6px 6px','7px 8px') }}>TOTAL ({safeRows.length})</td>
                    {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'center' }}>{totalQty.toLocaleString()}</td>}
                    {data.view !== 'Receivables' && <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right' }}>Rs.{totalRev.toLocaleString()}</td>}
                    <td style={{ padding: sz('4px','6px','7px'), textAlign: 'right' }}>Rs.{totalGP.toLocaleString()}</td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        )}
      </div>
    )}

    {/* ── Invoice / Dispatch / Credit Note Items Table ── */}
    {(docType === 'invoice' || docType === 'dispatch' || docType === 'estimate' || docType === 'creditnote') && (
      <>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: sz('12px','16px','20px'), fontSize: sz('8.5px','10px','11px') }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1e293b', background: '#f8fafc' }}>
              <th style={{ padding: sz('4px 2px 4px 0','7px 4px 7px 0','8px 6px 8px 0'), textAlign: 'left', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '54%' : '50%' }}>
                Description
              </th>
              <th style={{ padding: sz('4px 2px','7px 4px','8px 6px'), textAlign: 'center', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px', whiteSpace: 'nowrap', width: isThermal ? '12%' : '9%' }}>
                {docType === 'dispatch' ? 'Qty / Pack' : 'Qty'}
              </th>
              {(docType === 'invoice' || docType === 'estimate') && (
                <th style={{ padding: sz('4px 2px','7px 4px','8px 6px'), textAlign: 'right', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: sz('7px','7.5px','8px'), letterSpacing: '0.5px', width: isThermal ? '34%' : '17%' }}>
                  Rate
                </th>
              )}
              {(docType === 'invoice' || docType === 'estimate') && !isThermal && (
                <th style={{ padding: sz('','7px 4px 7px 0','8px 0 8px 4px'), textAlign: 'right', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', width: '24%' }}>
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
                {(docType === 'invoice' || docType === 'estimate') && (
                  <td style={{ padding: sz('5px 2px','7px 4px','8px 6px'), textAlign: 'right', color: '#475569' }}>
                    {item?.isBonus ? (
                      <span style={{ color: '#059669', fontWeight: 800, fontSize: sz('7px','8px','9px'), textTransform: 'uppercase' }}>Free</span>
                    ) : (
                      <>
                        <span>Rs.{(item?.price || 0).toLocaleString()}</span>
                        {isThermal && (
                          <span style={{ display: 'block', fontWeight: 800, marginTop: '2px', paddingTop: '1px', borderTop: '1px dotted #e2e8f0', fontSize: '9px', color: '#1e293b' }}>
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
                {(docType === 'invoice' || docType === 'estimate') && !isThermal && (
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
                <td colSpan={(docType === 'invoice' || docType === 'estimate') ? (isThermal ? 3 : 4) : 2} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
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

        {/* Estimate Totals */}
        {docType === 'estimate' && data && (() => {
          const estimateSubtotal = safeItems.reduce((s, i) => s + (i?.isBonus ? 0 : (i?.price || 0) * (i?.quantity || 0)), 0);
          const estimateGrandTotal = estimateSubtotal + (Number(data.deliveryBilled) || 0);
          return (
            <div className="keep-together" style={{ marginLeft: 'auto', width: isThermal ? '100%' : sz('','240px','280px'), borderTop: '2px solid #7c3aed', paddingTop: sz('8px','10px','12px') }}>
              {[
                { label: 'Items Subtotal', val: `Rs. ${estimateSubtotal.toLocaleString()}` },
                (data.deliveryBilled || 0) > 0 && { label: 'Delivery', val: `Rs. ${Number(data.deliveryBilled).toLocaleString()}`, muted: true },
                { label: 'Estimated Total', val: `Rs. ${estimateGrandTotal.toLocaleString()}`, bold: true, large: true, divider: true },
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sz('3px','4px','5px'), borderTop: row.divider ? '1px solid #e2e8f0' : 'none', paddingTop: row.divider ? sz('4px','5px','7px') : 0, marginTop: row.divider ? sz('3px','4px','5px') : 0, fontWeight: row.bold ? 800 : 500, fontSize: row.large ? sz('10px','12px','13px') : sz('8px','9px','10px'), fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: row.muted ? '#94a3b8' : '#475569' }}>{row.label}:</span>
                  <span style={{ color: row.bold ? '#7c3aed' : '#1e293b' }}>{row.val}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Invoice Totals */}
        {docType === 'invoice' && data && (() => {
          const { prevBalance, received, netBalance } = getInvoiceLedger();
          const totalSavings = safeItems.reduce((s, i) => s + (i?.isBonus ? (i?.originalPrice || 0) * (i?.quantity || 0) : 0), 0);
          const itemsSubtotal = (data.total || 0) - (data.deliveryBilled || 0);

          return (
            <div className="keep-together" style={{ marginLeft: 'auto', width: isThermal ? '100%' : sz('','240px','280px'), borderTop: '2px solid #1e293b', paddingTop: sz('8px','10px','12px') }}>
              {[
                { label: 'Items Subtotal', val: `Rs. ${itemsSubtotal.toLocaleString()}` },
                (data.deliveryBilled || 0) > 0 && { label: `Delivery (${data.vehicle || ''})`, val: `Rs. ${Number(data.deliveryBilled).toLocaleString()}`, muted: true },
                { label: 'Current Bill', val: `Rs. ${(data.total || 0).toLocaleString()}`, bold: true, large: true, divider: true },
                { label: 'Previous Balance', val: `Rs. ${prevBalance.toLocaleString()}`, top: true },
                { label: 'Subtotal', val: `Rs. ${(prevBalance + (data.total || 0)).toLocaleString()}`, bold: true },
                received > 0 && { label: 'Payment Received', val: `− Rs. ${received.toLocaleString()}`, color: '#059669' },
              ].filter(Boolean).map((row, i) => row && (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sz('3px','4px','5px'), borderTop: row.divider || row.top ? '1px solid #e2e8f0' : 'none', paddingTop: row.divider || row.top ? sz('4px','5px','7px') : 0, marginTop: row.divider || row.top ? sz('3px','4px','5px') : 0, fontWeight: row.bold ? 800 : 500, fontSize: row.large ? sz('10px','12px','13px') : sz('8px','9px','10px') }}>
                  <span style={{ color: row.muted ? '#94a3b8' : '#475569' }}>{row.label}:</span>
                  <span style={{ color: row.color || '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1e293b', marginTop: sz('4px','5px','6px'), paddingTop: sz('5px','6px','8px'), fontWeight: 900, fontSize: sz('11px','13px','15px'), color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                <span>Net Balance:</span>
                <span>Rs. {netBalance.toLocaleString()}</span>
              </div>
              {totalSavings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: sz('6px','8px','10px'), padding: sz('5px 8px','6px 10px','8px 12px'), background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontWeight: 800, fontSize: sz('8px','9px','10px'), color: '#065f46' }}>
                  <span>Bonus Savings:</span>
                  <span>Rs. {totalSavings.toLocaleString()}</span>
                </div>
              )}
            </div>
          );
        })()}
        {/* Credit Note Totals */}
        {docType === 'creditnote' && data && (() => {
          const cnSubtotal = safeItems.reduce((s, i) => s + (i?.isBonus ? 0 : (i?.price || 0) * (i?.quantity || 0)), 0);
          return (
            <div className="keep-together" style={{ marginLeft: 'auto', width: isThermal ? '100%' : sz('','240px','280px'), borderTop: '2px solid #e11d48', paddingTop: sz('8px','10px','12px') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: sz('12px','14px','16px'), color: '#e11d48' }}>
                <span>Total Credit:</span>
                <span>Rs. {cnSubtotal.toLocaleString()}</span>
              </div>
              {data.originalInvoiceId && (
                <div style={{ marginTop: '8px', fontSize: sz('7px','8px','9px'), color: '#64748b' }}>
                  <strong>Original Invoice:</strong> {data.originalInvoiceId}
                </div>
              )}
              {data.reason && (
                <div style={{ marginTop: '4px', fontSize: sz('7px','8px','9px'), color: '#64748b' }}>
                  <strong>Reason:</strong> {data.reason}
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

        {/* ── Estimate Disclaimer ── */}
        {docType === 'estimate' && (
          <div className="keep-together" style={{ marginTop: sz('12px','16px','20px'), border: '1.5px solid #7c3aed', borderRadius: '8px', overflow: 'hidden', fontSize: sz('6.5px','7.5px','8.5px') }}>
            <div style={{ background: '#7c3aed', color: 'white', padding: sz('4px 8px','5px 12px','6px 14px'), fontWeight: 900, textAlign: 'center', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: sz('6.5px','7px','8px') }}>
              Important Notice — Rates &amp; Availability
            </div>
            <div style={{ padding: sz('6px 8px','8px 12px','10px 14px'), background: '#faf5ff', color: '#4c1d95', lineHeight: 1.7, fontWeight: 600, fontSize: sz('7px','8px','9px') }}>
              ⚠ Rates and availability can change anytime without prior notice. This estimate is for reference purposes only and does <strong>not</strong> constitute a final invoice. Final pricing will be confirmed at the time of order.
            </div>
          </div>
        )}

        {/* ── Credit Note Acknowledgement ── */}
        {docType === 'creditnote' && (
          <div className="keep-together" style={{ marginTop: sz('12px','16px','20px'), border: '1.5px solid #e11d48', borderRadius: '8px', overflow: 'hidden', fontSize: sz('6.5px','7.5px','8.5px') }}>
            <div style={{ background: '#e11d48', color: 'white', padding: sz('4px 8px','5px 12px','6px 14px'), fontWeight: 900, textAlign: 'center', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: sz('6.5px','7px','8px') }}>
              Credit Note Acknowledgement
            </div>
            <div style={{ padding: sz('6px 8px','8px 12px','10px 14px'), background: '#fff1f2', color: '#881337', lineHeight: 1.7, fontWeight: 600, fontSize: sz('7px','8px','9px') }}>
              This credit note reduces the customer's outstanding balance by the amount shown above. The returned goods have been accepted subject to inspection and verification.
            </div>
          </div>
        )}

        {/* ── Return / Exchange Policy ── */}
        {docType !== 'estimate' && docType !== 'creditnote' && <div className="keep-together" style={{ marginTop: sz('12px','16px','20px'), border: '1.5px solid #1e293b', borderRadius: '8px', overflow: 'hidden', fontSize: sz('6.5px','7.5px','8.5px') }}>
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
              {showOnDocs ? `${bizName}${bizTagline ? ` · ${bizTagline}` : ''}` : ''}
            </div>
          </div>
        </div>}
      </>
    )}

    {/* ── Receipt Content ── */}
    {docType === 'receipt' && data && (
      <div className="keep-together">
        <div style={{ background: '#f0fdf4', padding: sz('16px 12px','24px 20px','32px 24px'), border: '2px solid #bbf7d0', borderRadius: sz('10px','14px','16px'), textAlign: 'center', marginBottom: sz('14px','18px','22px') }}>
          <div style={{ fontSize: sz('7.5px','8.5px','9px'), fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Amount Received
          </div>
          <div style={{ fontSize: sz('24px','32px','40px'), fontWeight: 900, color: '#059669', marginTop: sz('4px','6px','8px'), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            Rs. {(data.receivedAmount || 0).toLocaleString()}
          </div>
          {data.note && (
            <div style={{ display: 'inline-block', lineHeight: '1.2', marginTop: sz('8px','10px','12px'), padding: sz('5px 10px','6px 14px','8px 16px'), background: 'white', borderRadius: '999px', border: '1px solid #86efac', fontSize: sz('9px','10px','11px'), fontWeight: 600, color: '#15803d', wordBreak: 'break-word', textAlign: 'center' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: sz('11px','14px','16px'), color: '#1e293b', borderTop: '1px solid #e2e8f0', paddingTop: sz('6px','8px','10px'), marginTop: sz('4px','5px','6px'), fontVariantNumeric: 'tabular-nums' }}>
            <span>Remaining Balance:</span>
            <span>Rs. {(data.newBalance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    )}

    {/* ── Ledger Content ── */}
    {docType === 'ledger' && data && (() => {
      const isSimple = (data.ledgerMode || 'simple') === 'simple';
      const closingBal = (data.openingBal || 0) + (data.totalDebit || 0) - (data.totalCredit || 0);
      return (
      <>
        {/* Compact summary bar — 4 figures inline, smaller for thermal */}
        <div className="keep-together" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: sz('4px','6px','8px'), marginBottom: sz('8px','10px','12px') }}>
          {[
            { label: 'Opening', val: data.openingBal || 0, color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
            { label: 'Debit (Dr)', val: data.totalDebit || 0, color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
            { label: 'Credit (Cr)', val: data.totalCredit || 0, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Balance', val: closingBal, color: closingBal > 0 ? '#be123c' : '#065f46', bg: closingBal > 0 ? '#fff1f2' : '#f0fdf4', border: closingBal > 0 ? '#fecdd3' : '#bbf7d0' },
          ].map((item, i) => (
            <div key={i} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: sz('6px','7px','8px'), padding: sz('4px 4px','5px 6px','6px 8px'), textAlign: 'center', overflow: 'hidden' }}>
              <div style={{ fontSize: sz('5.5px','6.5px','7px'), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '2px', whiteSpace: 'nowrap' }}>{item.label}</div>
              <div style={{ fontSize: sz('8px','10px','11px'), fontWeight: 900, color: item.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, ...(isThermal ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : { wordBreak: 'break-all' }) }}>Rs.{item.val.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Ledger table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: sz('7.5px','9px','10px'), tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <th style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px', width: isThermal ? '22%' : '13%' }}>Date</th>
              <th style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'left', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px' }}>Particulars</th>
              <th style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px', width: isThermal ? '18%' : '15%' }}>Dr</th>
              <th style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px', width: isThermal ? '18%' : '15%' }}>Cr</th>
              <th style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px', width: isThermal ? '19%' : '17%' }}>Bal</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, i) => (
              <tr key={row.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td style={{ padding: sz('3px 2px','5px 4px','6px 6px'), color: '#64748b', whiteSpace: 'nowrap', fontSize: sz('6.5px','8px','9px') }}>
                  {formatDateDisp(row.date)}
                </td>
                <td style={{ padding: sz('3px 2px','5px 4px','6px 6px'), wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 700, display: 'block', lineHeight: 1.3, color: row.isCreditNote ? '#be123c' : '#1e293b', fontSize: sz('7px','8.5px','9.5px') }}>{row.desc || '—'}</span>
                  {!isSimple && <span style={{ fontSize: sz('6px','7px','7.5px'), color: '#94a3b8', fontWeight: 500, display: 'block', marginTop: '1px', wordBreak: 'break-all' }}>{row.ref || ''}</span>}
                  {!isSimple && (row.lineItems || []).length > 0 && (row.lineItems || []).map((li, idx) => (
                    <div key={idx} style={{ fontSize: sz('6px','7px','7.5px'), color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: '2px', paddingLeft: '6px' }}>
                      <span style={{ flex: 1 }}>{li.isBonus ? '🎁 ' : '• '}{li.name} ×{li.qty}{!li.isBonus && ` @ Rs.${(li.price||0).toLocaleString()}`}</span>
                      <span style={{ fontWeight: 700, marginLeft: '6px', flexShrink: 0 }}>{li.isBonus ? 'FREE' : `Rs.${(li.subtotal||0).toLocaleString()}`}</span>
                    </div>
                  ))}
                  {!isSimple && (row.deliveryBilled || 0) > 0 && (
                    <div style={{ fontSize: sz('6px','7px','7.5px'), color: '#94a3b8', display: 'flex', justifyContent: 'space-between', paddingLeft: '6px', marginTop: '1px' }}>
                      <span>+ Delivery</span><span>Rs.{(row.deliveryBilled||0).toLocaleString()}</span>
                    </div>
                  )}
                </td>
                <td style={{ padding: sz('3px 2px','5px 4px','6px 6px'), textAlign: 'right', fontWeight: 800, color: '#4338ca', fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>
                  {(row.debit || 0) > 0 ? (row.debit || 0).toLocaleString() : '—'}
                </td>
                <td style={{ padding: sz('3px 2px','5px 4px','6px 6px'), textAlign: 'right', fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>
                  {(row.credit || 0) > 0 ? (row.credit || 0).toLocaleString() : '—'}
                </td>
                <td style={{ padding: sz('3px 2px','5px 4px','6px 6px'), textAlign: 'right', fontWeight: 900, color: (row.balance || 0) > 0 ? '#be123c' : '#065f46', fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>
                  {(row.balance || 0).toLocaleString()}
                </td>
              </tr>
            ))}
            {safeRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>No transactions in this period</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <td colSpan={2} style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: sz('6px','7px','7.5px'), letterSpacing: '0.5px' }}>
                Totals:
              </td>
              <td style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>{(data.totalDebit || 0).toLocaleString()}</td>
              <td style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>{(data.totalCredit || 0).toLocaleString()}</td>
              <td style={{ padding: sz('4px 2px','6px 4px','7px 6px'), textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: sz('7px','8.5px','9.5px') }}>{closingBal.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </>
      );
    })()}

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
      Software Generated{showOnDocs ? ` · ${bizName}` : ''} · {formatDateDisp(getLocalDateStr())}
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
      @page { margin: 0; size: auto; }
      html, body { height: auto !important; overflow: visible !important; }
      #print-root { display: block !important; position: relative !important; overflow: visible !important; }
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
        page-break-after: auto !important;
      }
      /* Keep header/summary blocks together; tables flow across pages */
      .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
      /* Tables spanning multiple pages: header repeats, footer on last page only */
      table { page-break-inside: auto !important; width: 100% !important; border-collapse: collapse !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      /* Ensure every td/th has its background colour on print */
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      /* Tabular numbers stay aligned across pages */
      .tabular-nums { font-variant-numeric: tabular-nums !important; }
    }
  `}</style>
</div>
);
}

export default PrintView;

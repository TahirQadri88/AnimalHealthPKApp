// --- CONSTANTS & HELPERS ---
const APP_NAME = "AnimalHealth.PK";
const VEHICLES = ['Rider', 'Rickshaw', 'Suzuki', 'Intercity Transport', 'Self-Pickup'];

// Helper to force Pakistan Standard Time (UTC+5) strictly
const getPKTDate = (date = new Date()) => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5));
};

const getLocalDateStr = (date = new Date()) => {
  const pktDate = getPKTDate(date);
  const year = pktDate.getFullYear();
  const month = String(pktDate.getMonth() + 1).padStart(2, '0');
  const day = String(pktDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisp = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[parseInt(month, 10) - 1]}-${year.slice(-2)}`;
};

const checkDateFilter = (dateStr, filter) => {
  if (filter === 'All Time') return true;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return true;
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const nowPKT = getPKTDate();
  const todayPKT = new Date(nowPKT.getFullYear(), nowPKT.getMonth(), nowPKT.getDate());

  if (filter === 'Today') return targetDate.getTime() === todayPKT.getTime();
  if (filter === 'This Week') {
    const startOfWeek = new Date(todayPKT);
    startOfWeek.setDate(todayPKT.getDate() - todayPKT.getDay());
    return targetDate >= startOfWeek;
  }
  if (filter === 'This Month') return targetDate.getMonth() === todayPKT.getMonth() && targetDate.getFullYear() === todayPKT.getFullYear();
  if (filter === 'This Year') return targetDate.getFullYear() === todayPKT.getFullYear();
  return true;
};

// shareOrDownload — on mobile browsers that support Web Share API with files,
// opens the native share sheet (WhatsApp, email, Drive, etc.).
// Falls back to a standard anchor-click download on desktop/unsupported browsers.
const shareOrDownload = async (blob, filename) => {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return; // shared successfully
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled — don't fall through to download
    }
  }
  // Fallback: direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const exportToCSV = async (data, filename, options = {}) => {
  if(!data || !data.length) return;
  const { title, subtitle, totals } = options;
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [];
  // Optional header rows (title + subtitle)
  if (title) { lines.push(q(title)); lines.push(q(subtitle || '')); lines.push(''); }
  // Column headers
  lines.push(Object.keys(data[0]).map(q).join(','));
  // Data rows
  data.forEach(obj => lines.push(Object.values(obj).map(q).join(',')));
  // Optional totals row
  if (totals && Object.keys(totals).length) {
    lines.push('');
    lines.push(Object.keys(data[0]).map((k, i) =>
      i === 0 ? q('TOTAL') : totals[k] !== undefined ? q(totals[k]) : q('')
    ).join(','));
  }
  // BOM prefix ensures correct encoding in Excel
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  await shareOrDownload(blob, filename);
};

export { APP_NAME, VEHICLES, getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV, shareOrDownload };

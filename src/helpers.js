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

const exportToCSV = (data, filename) => {
  if(!data || !data.length) return;
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = Object.keys(data[0]).map(q).join(',');
  const rows = data.map(obj => Object.values(obj).map(q).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export { APP_NAME, VEHICLES, getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV };

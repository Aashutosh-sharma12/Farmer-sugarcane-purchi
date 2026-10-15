// Must match COMMON_FIELDS in backend/src/models/Purchi.js
export const COMMON_FIELDS = [
  { key: 'samitiPurchiNumber', en: 'Society purchi no', hi: 'समिति पर्ची नं०' },
  { key: 'growerNumber', en: 'Grower registration no', hi: 'कृषक पंजीकरण संख्या' },
  { key: 'farmerName', en: 'Farmer Name', hi: 'किसान का नाम' },
  { key: 'farmerCode', en: 'Farmer Code', hi: 'कृषक कोड' },
  { key: 'fatherName', en: "Father's Name", hi: 'पिता का नाम' },
  { key: 'village', en: 'Village', hi: 'गाँव' },
  { key: 'centre', en: 'Centre', hi: 'केंद्र' },
  { key: 'millName', en: 'Mill', hi: 'मिल' },
  { key: 'date', en: 'Date and time', hi: 'तारीख और समय' },
  { key: 'season', en: 'Season', hi: 'सीजन' },
  { key: 'clerk', en: 'Clerk / operator', hi: 'लिपिक' },
  { key: 'vehicleNo', en: 'Vehicle No', hi: 'वाहन संख्या' },
  { key: 'variety', en: 'Variety', hi: 'प्रजाति' },
  { key: 'grossWeight', en: 'Loaded vehicle weight', hi: 'वजन भरी गाड़ी' },
  { key: 'tareWeight', en: 'Empty vehicle weight', hi: 'वजन खाली गाड़ी' },
  { key: 'caneWeight', en: 'Total cane weight', hi: 'कुल गन्ना वजन' },
  { key: 'deduction', en: 'Deduction', hi: 'कटौती' },
  { key: 'netWeight', en: 'Net cane weight', hi: 'शुद्ध गन्ना वजन' },
  { key: 'rate', en: 'Rate per quintal', hi: 'दर प्रति क्विंटल' },
  { key: 'amount', en: 'Total cane value', hi: 'कुल गन्ना मूल्य' },
];

// Groups used on the purchi details screen (titles come from i18n as group_<id>).
export const FIELD_GROUPS = [
  { id: 'farmer', keys: ['farmerName', 'farmerCode', 'growerNumber', 'fatherName', 'village'] },
  { id: 'mill', keys: ['millName', 'samitiPurchiNumber', 'centre', 'season', 'date', 'clerk'] },
  { id: 'vehicle', keys: ['vehicleNo', 'variety'] },
  { id: 'weight', keys: ['grossWeight', 'tareWeight', 'caneWeight', 'deduction', 'netWeight', 'rate', 'amount'] },
];

export const COLORS = {
  primary: '#2E7D32',
  primaryLight: '#E8F5E9',
  danger: '#C62828',
  warning: '#FFF3E0',
  warningText: '#E65100',
  text: '#1B1B1B',
  muted: '#666',
  border: '#DDD',
  bg: '#F6F7F6',
  white: '#FFF',
};

export const STATUSES = [
  { key: 'pending', en: 'Pending', hi: 'अभी नहीं मिला', color: '#E65100', bg: '#FFF3E0' },
  { key: 'partial', en: 'Partial', hi: 'आंशिक भुगतान मिला', color: '#1565C0', bg: '#E3F2FD' },
  { key: 'received', en: 'Received', hi: 'पूरा भुगतान मिला', color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'problem', en: 'Problem', hi: 'समस्या', color: '#C62828', bg: '#FFEBEE' },
  { key: 'cancelled', en: 'Cancelled', hi: 'रद्द', color: '#616161', bg: '#EEEEEE' },
];

export const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

// "₹ 12,345.50 /-" -> 12345.5 (null when no number is found)
export const parseAmount = (text) => {
  const m = String(text ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// 12345.5 -> "₹12,345.5" (Indian digit grouping where the device supports it)
export const money = (n) => {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  try {
    return '₹' + rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  } catch {
    return '₹' + rounded;
  }
};

// Amount still to be received on one purchi. Cancelled purchis owe nothing; null when the slip amount is unknown.
export const pendingOf = (p) => {
  if (p.status === 'cancelled') return 0;
  const total = parseAmount(p.amount);
  return total == null ? null : Math.max(total - (Number(p.receivedAmount) || 0), 0);
};

export const MONTHS = [
  { en: 'Jan', hi: 'जन॰' }, { en: 'Feb', hi: 'फ़र॰' }, { en: 'Mar', hi: 'मार्च' }, { en: 'Apr', hi: 'अप्रैल' },
  { en: 'May', hi: 'मई' }, { en: 'Jun', hi: 'जून' }, { en: 'Jul', hi: 'जुलाई' }, { en: 'Aug', hi: 'अग॰' },
  { en: 'Sep', hi: 'सित॰' }, { en: 'Oct', hi: 'अक्टू॰' }, { en: 'Nov', hi: 'नव॰' }, { en: 'Dec', hi: 'दिस॰' },
];

// Date a purchi belongs to: the weighing date printed on the slip ("13-Dec-2025 10:01", "2025-12-13", "13/12/2025"),
// or the day it was saved when the slip date cannot be read. Returns { year, month } with month 0-11.
export const purchiDate = (p) => {
  const text = String(p.date || '');
  let m;
  if ((m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return validDate(+m[1], +m[2] - 1) || savedDate(p);
  if ((m = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return validDate(+m[3], +m[2] - 1) || savedDate(p);
  if ((m = text.match(/(\d{1,2})[-/ ]+([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{4})/))) {
    const idx = MONTHS.findIndex((x) => x.en.toLowerCase() === m[2].toLowerCase());
    if (idx >= 0) return { year: +m[3], month: idx };
  }
  return savedDate(p);
};
const validDate = (year, month) => (month >= 0 && month < 12 && year > 1990 ? { year, month } : null);
const savedDate = (p) => {
  const d = new Date(p.createdAt);
  return Number.isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth() };
};

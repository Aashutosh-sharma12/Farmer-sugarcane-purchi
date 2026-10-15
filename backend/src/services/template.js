// The red pre-printed side of the purchi never changes, so its labels are fixed here.
// Only the printed values (the other side) change from slip to slip.
const ROWS = [
  ['season', 'सीजन'],
  ['centre', 'क्रय केन्द्र का नाम'],
  ['date', 'तौलने की तिथि व समय'],
  ['purchiNumber', 'मिल पर्ची नं०'],
  ['samitiPurchiNumber', 'समिति पर्ची नं०'],
  ['farmer', 'कृषक का कोड व नाम'], // farmerCode + farmerName
  ['growerNumber', 'कृषक पंजीकरण संख्या'],
  ['fatherName', 'पिता का नाम'],
  ['village', 'गाँव का नाम'],
  ['variety', 'गन्ना प्रजाति'],
  ['grossWeight', 'वजन भरी गाड़ी'],
  ['tareWeight', 'वजन खाली गाड़ी'],
  ['caneWeight', 'कुल गन्ना वजन'],
  ['deduction', 'कटौती'],
  ['netWeight', 'शुद्ध गन्ना वजन'],
  ['rate', 'दर प्रति कु.'],
  ['amount', 'कुल गन्ना मूल्य'],
  ['clerk', 'लिपिक'],
];

// Turns the extracted values into the label/value list shown to the farmer, in slip order.
function buildFields(data) {
  const value = (key) =>
    key === 'farmer' ? [data.farmerCode, data.farmerName].filter(Boolean).join(' ') : data[key];
  return ROWS.map(([key, label]) => ({ key: label, value: value(key) }))
    .filter((row) => row.value != null && String(row.value).trim() !== '')
    .map((row) => ({ key: row.key, value: String(row.value) }));
}

module.exports = { buildFields };

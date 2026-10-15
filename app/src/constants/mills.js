// Mills shown in the "mill" dropdown. `hi` is what gets saved (the slip is printed in Hindi).
// This is a starter list: edit it freely, or farmers can type any other mill with "Other".
export const MILLS = [
  { hi: 'सिंभावली शुगर्स लिमिटेड, यूनिट ब्रजनाथपुर', en: 'Simbhaoli Sugars Ltd, Brajnathpur Unit' },
  { hi: 'सिंभावली शुगर्स लिमिटेड, यूनिट सिंभावली', en: 'Simbhaoli Sugars Ltd, Simbhaoli Unit' },
  { hi: 'धामपुर शुगर मिल्स, धामपुर', en: 'Dhampur Sugar Mills, Dhampur' },
  { hi: 'धामपुर शुगर मिल्स, असमोली', en: 'Dhampur Sugar Mills, Asmoli' },
  { hi: 'त्रिवेणी इंजीनियरिंग, खतौली', en: 'Triveni Engineering, Khatauli' },
  { hi: 'त्रिवेणी इंजीनियरिंग, देवबंद', en: 'Triveni Engineering, Deoband' },
  { hi: 'त्रिवेणी इंजीनियरिंग, साबितगढ़', en: 'Triveni Engineering, Sabitgarh' },
  { hi: 'उत्तम शुगर मिल्स, बरकातपुर', en: 'Uttam Sugar Mills, Barkatpur' },
  { hi: 'मवाना शुगर्स, मवाना', en: 'Mawana Sugars, Mawana' },
  { hi: 'द्वारिकेश शुगर, बिजनौर', en: 'Dwarikesh Sugar, Bijnor' },
  { hi: 'बजाज हिंदुस्तान शुगर, गोला', en: 'Bajaj Hindusthan Sugar, Gola' },
  { hi: 'बलरामपुर चीनी मिल्स, बलरामपुर', en: 'Balrampur Chini Mills, Balrampur' },
];

// Preselected on the review screen.
export const DEFAULT_MILL = MILLS[0].hi;

// Shows the saved Hindi name in the current language when it is one of the list items.
export const millLabel = (value, lang) => {
  const mill = MILLS.find((m) => m.hi === value);
  return mill ? mill[lang] ?? mill.en : value;
};

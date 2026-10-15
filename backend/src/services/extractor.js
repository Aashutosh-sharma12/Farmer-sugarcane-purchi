const { GoogleGenAI } = require('@google/genai');
const { COMMON_FIELDS } = require('../models/Purchi');

let client;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in .env');
  client ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

const nullableString = { type: 'string', nullable: true };

const responseSchema = {
  type: 'object',
  properties: {
    purchiNumber: nullableString,
    ...Object.fromEntries(COMMON_FIELDS.map((f) => [f, nullableString])),
    rawText: { type: 'string' },
    // true only when clear, dark, correctly oriented printed values are visible in the photo
    valuesClear: { type: 'boolean' },
    // false when the photo is not a sugarcane mill purchi at all (any side)
    isPurchi: { type: 'boolean' },
  },
  required: ['purchiNumber', 'rawText', 'valuesClear', 'isPurchi'],
};

const PROMPT = `You are reading a photo of an Indian (Uttar Pradesh) sugarcane mill weighment slip, called a "purchi" or "Grower Purchy".

First decide isPurchi. isPurchi = true if the photo shows a sugarcane mill weighment slip / purchi, on either side (the red
pre-printed Hindi label side, or the side with printed values), even if it is blurry, dark, tilted or partly cut off.
isPurchi = false for anything else: people, fields, animals, vehicles, other documents, bills, screenshots, blank or covered photos.
When isPurchi = false, set valuesClear = false, purchiNumber null and every other field null.

The slip has two sides. The red pre-printed Hindi labels never change and are NOT needed: do not read them.
You need only the VALUES: dot-matrix / thermal printed text (blue or purple, English capitals and numbers) with no labels next to it.
- Ink bleeding through from the other side looks faint, blurry and MIRRORED or upside down. It is NOT data. Ignore it completely.
- Set valuesClear = true only if you can read clear, dark, correctly oriented printed values. If the photo shows only the red labels
  (with at most faint mirrored bleed-through), set valuesClear = false, purchiNumber null and every other field null.
- Never invent values. If a line is not visible, use null.

The printed value lines come in this fixed order (the examples are made up, never copy them):
 1 title and season ("Grower Purchy 2030-31"); 2 purchase centre name and code (e.g. "TOWNNAME 123");
 3 weighing date and time; 4 mill purchi number (centre code followed by a serial, e.g. 12300001);
 5 society purchi number (long number); 6 grower code and name (e.g. "7 FIRSTNAME LASTNAME");
 7 grower registration number (long, printed under the name); 8 father's name;
 9 village code and name. The printer cuts long names: if the next line is a short word at the left margin (not a code such as
   "C00999" and not a number), it is the rest of the village name, so join it to the village;
 10 cane variety (e.g. "C00999" means Co 0999); 11 loaded vehicle weight; 12 empty vehicle weight;
 13 total cane weight (loaded minus empty); 14 deduction; 15 net cane weight; 16 rate per quintal; 17 total cane value (amount);
 18 clerk / operator code and name. Weights are in quintals.
Use the arithmetic to resolve unclear digits: loaded - empty = cane weight; cane weight - deduction = net weight;
net weight x rate = amount. If a printed value breaks a check, still report what is printed.

Return JSON with these keys:
- purchiNumber: line 4, exactly as printed. samitiPurchiNumber: line 5. growerNumber: line 7. clerk: line 18.
- centre: line 2 with its code. season: from line 1, e.g. "2030-31". date: line 3 as printed.
- farmerName: the name from line 6 without the leading code. farmerCode: the code number in front of the name.
- fatherName: line 8. village: line 9 (joined if wrapped). variety: line 10 written like "Co 0999".
- grossWeight (11), tareWeight (12), caneWeight (13), deduction (14), netWeight (15): number with unit "Qtl", e.g. "10.00 Qtl".
- rate (16): e.g. "100.00 per Qtl". amount (17): number only, e.g. "1000.00".
- Other keys in the schema that the slip does not show: null.
- rawText: every clear printed line, top to bottom (not the bleed-through).
- valuesClear and isPurchi: as described above.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTransient = (err) => [429, 500, 503, 504].includes(err.status) || /timeout|timed out|abort/i.test(err.message || '');

const modelNames = () =>
  [...new Set([process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite', process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'])];

// One model, retried briefly when Google reports overload.
async function callModel(model, params) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await getClient().models.generateContent({ ...params, model });
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) break;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

const toNumber = (v) => {
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const keyOf = (d) => [String(d.purchiNumber || '').replace(/\s+/g, '').toUpperCase(), toNumber(d.netWeight), toNumber(d.amount)].join('|');

function parseResult(text) {
  const data = JSON.parse(text || '{}');
  if (data.isPurchi === false || data.valuesClear === false) {
    // Not a purchi, or only labels (plus faint mirrored bleed-through) were visible: nothing read is trustworthy.
    return {
      purchiNumber: '',
      ...Object.fromEntries(COMMON_FIELDS.map((f) => [f, null])),
      rawText: '',
      valuesClear: false,
      isPurchi: data.isPurchi !== false,
    };
  }
  return {
    valuesClear: true,
    purchiNumber: data.purchiNumber || '',
    ...Object.fromEntries(COMMON_FIELDS.map((f) => [f, data[f] ?? null])),
    rawText: data.rawText || '',
  };
}

// Reads the values side of one slip photo.
// Two different models read the slip at the same time. A made-up reading rarely matches between models,
// so when purchi number, net weight and amount differ we flag `uncertain` and the farmer is asked to check.
async function extractPurchi({ buffer, mimeType }) {
  const params = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
      httpOptions: { timeout: 40000 }, // a stuck call is dropped instead of hanging
    },
  };

  const models = process.env.GEMINI_VERIFY === 'false' ? modelNames().slice(0, 1) : modelNames();
  const settled = await Promise.allSettled(models.map((m) => callModel(m, params)));
  const results = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    try {
      results.push(parseResult(r.value.text));
    } catch {
      // unparseable answer from this model: ignore it
    }
  }
  if (!results.length) {
    const failure = settled.find((r) => r.status === 'rejected');
    throw failure ? failure.reason : new Error('Could not read the model answer');
  }
  const [main, ...others] = results;
  const uncertain = others.some((o) => o.valuesClear !== main.valuesClear || (main.valuesClear && keyOf(o) !== keyOf(main)));
  // One model inventing a slip from a blank or unrelated photo is the main risk, so if ANY model says it is not a purchi,
  // the photo is rejected and the farmer retakes it. Clear real slips are accepted by both models.
  const notPurchi = results.some((r) => r.isPurchi === false);
  return { ...main, uncertain, notPurchi };
}

module.exports = { extractPurchi, isTransient };

const mongoose = require('mongoose');

// Common purchi fields pulled out of the slip for search and display.
const COMMON_FIELDS = [
  'samitiPurchiNumber', // समिति पर्ची नं. (society slip number); purchiNumber is the mill number
  'growerNumber', // कृषक पंजीकरण संख्या
  'farmerName',
  'farmerCode',
  'fatherName',
  'village',
  'centre',
  'millName',
  'date',
  'clerk', // लिपिक
  'vehicleNo',
  'variety',
  'season',
  'grossWeight', // loaded vehicle weight (वजन भरी गाड़ी)
  'tareWeight', // empty vehicle weight (वजन खाली गाड़ी)
  'caneWeight', // gross - tare (कुल गन्ना वजन)
  'deduction', // कटौती
  'netWeight', // शुद्ध गन्ना वजन
  'rate',
  'amount',
];

const STATUSES = ['pending', 'partial', 'received', 'problem', 'cancelled'];

const commonFieldDefs = Object.fromEntries(
  COMMON_FIELDS.map((f) => [f, { type: String, default: null }])
);

const purchiSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purchiNumber: { type: String, required: true },
    imageHash: { type: String, required: true },
    imagePath: { type: String, default: '' }, // empty for purchis added by the admin without a photo
    ...commonFieldDefs,
    // Every label/value pair printed on the slip.
    fields: [{ _id: false, key: String, value: String }],
    rawText: { type: String, default: '' },
    // Payment tracking, edited by the farmer after the mill pays.
    status: { type: String, enum: STATUSES, default: 'pending' },
    receivedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

purchiSchema.index({ user: 1, purchiNumber: 1 }, { unique: true });
purchiSchema.index({ user: 1, imageHash: 1 }, { unique: true });


module.exports = mongoose.model('Purchi', purchiSchema);
module.exports.COMMON_FIELDS = COMMON_FIELDS;
module.exports.STATUSES = STATUSES;

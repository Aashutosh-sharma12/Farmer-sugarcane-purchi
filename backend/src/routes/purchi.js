const express = require('express');
const multer = require('multer');
const Purchi = require('../models/Purchi');
const { COMMON_FIELDS, STATUSES } = Purchi;
const { extractPurchi, isTransient } = require('../services/extractor');
const { sha256, normalizePurchiNumber } = require('../utils/hash');
const storage = require('../services/storage');
const { buildFields } = require('../services/template');

const router = express.Router();
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG or WEBP images are allowed')),
});

const duplicateResponse = (res, reason, purchi) =>
  res.status(409).json({
    message:
      reason === 'image'
        ? 'This image is already uploaded'
        : `Purchi ${purchi.purchiNumber} is already saved`,
    reason,
    purchi,
  });

// Step 1: upload the photo (values side), check duplicates, extract data. Nothing is saved to the DB yet.
router.post('/extract', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image is required' });
  const userId = req.user.id;
  const imageHash = sha256(req.file.buffer);

  const sameImage = await Purchi.findOne({ user: userId, imageHash });
  if (sameImage) return duplicateResponse(res, 'image', sameImage);

  let data;
  let warning = null; // 'unreadable' | 'noNumber' | 'busy' | 'noValues' | 'verify', the app shows the text in the user's language
  try {
    data = await extractPurchi({ buffer: req.file.buffer, mimeType: req.file.mimetype });
    data.fields = buildFields(data);
  } catch (err) {
    console.error('Extraction failed:', err.message);
    data = { purchiNumber: '', fields: [], rawText: '' };
    warning = isTransient(err) ? 'busy' : 'unreadable';
  }

  // A photo that is not a purchi is rejected and never stored.
  if (data.notPurchi) {
    return res.status(422).json({ code: 'notPurchi', message: 'This image is not a purchi. Please upload a clear photo of the purchi.' });
  }

  try {
    if (!(await storage.findImage(userId, imageHash))) {
      await storage.saveImage(userId, imageHash, req.file.buffer, req.file.mimetype);
    }
  } catch (err) {
    console.error('Image storage failed:', err.message);
    return res.status(502).json({ message: 'Could not store the image, please try again' });
  }

  if (!warning && data.valuesClear === false) warning = 'noValues'; // only the labels side was photographed
  data.purchiNumber = normalizePurchiNumber(data.purchiNumber);
  if (data.purchiNumber) {
    const sameNumber = await Purchi.findOne({ user: userId, purchiNumber: data.purchiNumber });
    if (sameNumber) return duplicateResponse(res, 'purchiNumber', sameNumber);
  } else if (!warning) {
    warning = 'noNumber';
  }
  if (!warning && data.uncertain) warning = 'verify'; // two models disagreed, the farmer must check against the paper
  delete data.valuesClear;
  delete data.uncertain;
  delete data.notPurchi;
  delete data.isPurchi;

  res.json({ imageHash, warning, data });
});

// Step 2: save the (reviewed) data.
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const body = req.body || {};
  const purchiNumber = normalizePurchiNumber(body.purchiNumber);
  if (!purchiNumber) return res.status(400).json({ message: 'Purchi number is required' });

  const payment = paymentUpdate(body);
  if (payment.error) return res.status(400).json({ message: payment.error });

  const imageHash = body.imageHash ? String(body.imageHash) : '';
  const imagePath = imageHash && (await storage.findImage(userId, imageHash));
  if (!imagePath) return res.status(400).json({ message: 'Image not found, please upload again' });

  const existing = await Purchi.findOne({ user: userId, $or: [{ purchiNumber }, { imageHash }] });
  if (existing) return duplicateResponse(res, existing.purchiNumber === purchiNumber ? 'purchiNumber' : 'image', existing);

  try {
    const purchi = await Purchi.create({
      user: userId,
      purchiNumber,
      imageHash,
      imagePath,
      ...Object.fromEntries(COMMON_FIELDS.map((f) => [f, body[f] ? String(body[f]) : null])),
      fields: Array.isArray(body.fields)
        ? body.fields.filter((p) => p && p.key).map((p) => ({ key: String(p.key), value: String(p.value ?? '') }))
        : [],
      rawText: body.rawText ? String(body.rawText) : '',
      ...payment.update,
    });
    res.status(201).json(purchi);
  } catch (err) {
    // Unique index hit by a parallel request.
    if (err.code === 11000) return res.status(409).json({ message: 'This purchi is already saved' });
    throw err;
  }
});

// Pulls status / receivedAmount out of a request body and validates them.
function paymentUpdate(body) {
  const update = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'Invalid status' };
    update.status = body.status;
  }
  if (body.receivedAmount !== undefined && body.receivedAmount !== '') {
    const amount = Number(body.receivedAmount);
    if (!Number.isFinite(amount) || amount < 0) return { error: 'Received amount must be a number, 0 or more' };
    update.receivedAmount = amount;
  }
  return { update };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res) => {
  const filter = { user: req.user.id };
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const q = String(req.query.q || '').trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = ['purchiNumber', 'date', 'centre', 'village', 'farmerName', 'vehicleNo'].map((f) => ({
      [f]: re,
    }));
  }
  const list = await Purchi.find(filter).select('-fields -rawText').sort({ createdAt: -1 }).limit(500);
  res.json(list);
});

router.get('/:id', async (req, res) => {
  const purchi = await Purchi.findOne({ _id: req.params.id, user: req.user.id }).catch(() => null);
  if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
  res.json(purchi);
});

// Update payment status and/or received amount.
router.patch('/:id', async (req, res) => {
  const { update, error } = paymentUpdate(req.body || {});
  if (error) return res.status(400).json({ message: error });
  if (!Object.keys(update).length) return res.status(400).json({ message: 'Nothing to update' });
  const purchi = await Purchi.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, update, {
    returnDocument: 'after',
    runValidators: true,
  }).catch(() => null);
  if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
  res.json(purchi);
});

router.delete('/:id', async (req, res) => {
  const purchi = await Purchi.findOneAndDelete({ _id: req.params.id, user: req.user.id }).catch(() => null);
  if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
  await storage.deleteImage(purchi.imagePath, purchi.user.toString(), purchi.imageHash);
  res.json({ message: 'Deleted' });
});

module.exports = router;

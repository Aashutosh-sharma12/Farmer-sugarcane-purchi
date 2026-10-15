const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Purchi = require('../models/Purchi');
const adminAuth = require('../middleware/adminAuth');
const storage = require('../services/storage');
const { normalizePurchiNumber } = require('../utils/hash');
const crypto = require('crypto');
const { COMMON_FIELDS, STATUSES } = Purchi;

const router = express.Router();

// "₹ 12,345.50 /-" -> 12345.5 (null when no number is found). Same rule as the app.
const parseAmount = (text) => {
  const m = String(text ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

// Cancelled purchis owe nothing; purchis with an unreadable amount count as 0 pending.
function totalsOf(purchis) {
  let total = 0;
  let received = 0;
  let pending = 0;
  for (const p of purchis) {
    const amount = parseAmount(p.amount) || 0;
    const got = Number(p.receivedAmount) || 0;
    if (p.status !== 'cancelled') {
      total += amount;
      pending += Math.max(amount - got, 0);
    }
    received += got;
  }
  return { total: round2(total), received: round2(received), pending: round2(pending) };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validId = (id) => /^[a-f\d]{24}$/i.test(String(id));

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = username && (await Admin.findOne({ username: String(username).trim().toLowerCase() }));
  if (!admin || !(await bcrypt.compare(String(password || ''), admin.passwordHash))) {
    return res.status(401).json({ message: 'Wrong username or password' });
  }
  const token = jwt.sign({ id: admin._id.toString(), role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, admin: { username: admin.username } });
});

router.use(adminAuth);

router.get('/me', (req, res) => res.json({ username: req.admin.username }));

router.get('/dashboard', async (req, res) => {
  const [userCount, purchiCount, latestUsers, latestPurchis] = await Promise.all([
    User.countDocuments(),
    Purchi.countDocuments(),
    User.find().select('name phone createdAt').sort({ createdAt: -1 }).limit(5),
    Purchi.find()
      .select('purchiNumber farmerName millName amount status receivedAmount createdAt user')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);
  res.json({ userCount, purchiCount, latestUsers, latestPurchis });
});

router.get('/users', async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { phone: re }];
  }
  const users = await User.find(filter).select('name phone createdAt').sort({ createdAt: -1 }).limit(500).lean();
  const purchis = await Purchi.find({ user: { $in: users.map((u) => u._id) } })
    .select('user amount status receivedAmount')
    .lean();
  const byUser = new Map();
  for (const p of purchis) {
    const key = p.user.toString();
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(p);
  }
  res.json(
    users.map((u) => {
      const list = byUser.get(u._id.toString()) || [];
      return { ...u, purchiCount: list.length, ...totalsOf(list) };
    })
  );
});

router.get('/users/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const user = await User.findById(req.params.id).select('name phone createdAt').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  const purchis = await Purchi.find({ user: user._id }).select('-fields -rawText -imageHash').sort({ createdAt: -1 }).lean();
  res.json({
    user,
    summary: { purchiCount: purchis.length, ...totalsOf(purchis) },
    purchis: purchis.map((p) => ({
      ...p,
      amountValue: parseAmount(p.amount),
      pendingValue: p.status === 'cancelled' ? 0 : Math.max((parseAmount(p.amount) || 0) - (p.receivedAmount || 0), 0),
    })),
  });
});

router.put('/users/:id/password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ message: 'User password changed' });
});

// ---- User create / edit / delete ----
function cleanUser(body, { passwordRequired }) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const password = body.password ? String(body.password) : '';
  if (!name) return { error: 'Name is required' };
  if (!/^\d{10}$/.test(phone)) return { error: 'Enter a valid 10 digit phone number' };
  if ((passwordRequired || password) && password.length < 6) return { error: 'Password must be at least 6 characters' };
  return { name, phone, password };
}

router.post('/users', async (req, res) => {
  const v = cleanUser(req.body || {}, { passwordRequired: true });
  if (v.error) return res.status(400).json({ message: v.error });
  if (await User.exists({ phone: v.phone })) return res.status(409).json({ message: 'This phone number is already registered' });
  const user = await User.create({ name: v.name, phone: v.phone, passwordHash: await bcrypt.hash(v.password, 10) });
  res.status(201).json({ _id: user._id, name: user.name, phone: user.phone });
});

router.put('/users/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const v = cleanUser(req.body || {}, { passwordRequired: false });
  if (v.error) return res.status(400).json({ message: v.error });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (await User.exists({ phone: v.phone, _id: { $ne: user._id } })) {
    return res.status(409).json({ message: 'This phone number is already registered' });
  }
  user.name = v.name;
  user.phone = v.phone;
  if (v.password) user.passwordHash = await bcrypt.hash(v.password, 10);
  await user.save();
  res.json({ _id: user._id, name: user.name, phone: user.phone });
});

// Deletes the user together with all their purchis and stored images.
router.delete('/users/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const purchis = await Purchi.find({ user: user._id }).select('imagePath imageHash user');
  await Purchi.deleteMany({ user: user._id });
  await Promise.all(purchis.filter((p) => p.imagePath).map((p) => storage.deleteImage(p.imagePath, user._id.toString(), p.imageHash)));
  res.json({ message: 'User deleted' });
});

// ---- Purchi create / edit / delete ----
function cleanPurchi(body, { partial }) {
  const out = {};
  if (!partial || body.purchiNumber !== undefined) {
    const number = normalizePurchiNumber(body.purchiNumber);
    if (!number) return { error: 'Purchi number is required' };
    out.purchiNumber = number;
  }
  for (const f of COMMON_FIELDS) {
    if (body[f] !== undefined) out[f] = String(body[f]).trim() || null;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'Invalid status' };
    out.status = body.status;
  }
  if (body.receivedAmount !== undefined && body.receivedAmount !== '') {
    const n = Number(body.receivedAmount);
    if (!Number.isFinite(n) || n < 0) return { error: 'Received amount must be a number, 0 or more' };
    out.receivedAmount = n;
  }
  return { update: out };
}

router.post('/users/:id/purchis', async (req, res) => {
  if (!validId(req.params.id) || !(await User.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'User not found' });
  const v = cleanPurchi(req.body || {}, { partial: false });
  if (v.error) return res.status(400).json({ message: v.error });
  try {
    const purchi = await Purchi.create({
      ...v.update,
      user: req.params.id,
      imageHash: 'manual-' + crypto.randomBytes(8).toString('hex'),
      imagePath: '',
    });
    res.status(201).json(purchi);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This user already has that purchi number' });
    throw err;
  }
});

router.get('/purchis/:id', async (req, res) => {
  const purchi = validId(req.params.id) && (await Purchi.findById(req.params.id).select('-fields -rawText -imageHash').populate('user', 'name phone'));
  if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
  res.json(purchi);
});

router.put('/purchis/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Purchi not found' });
  const v = cleanPurchi(req.body || {}, { partial: true });
  if (v.error) return res.status(400).json({ message: v.error });
  try {
    const purchi = await Purchi.findByIdAndUpdate(req.params.id, v.update, { returnDocument: 'after', runValidators: true });
    if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
    res.json(purchi);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This user already has that purchi number' });
    throw err;
  }
});

router.delete('/purchis/:id', async (req, res) => {
  const purchi = validId(req.params.id) && (await Purchi.findByIdAndDelete(req.params.id));
  if (!purchi) return res.status(404).json({ message: 'Purchi not found' });
  if (purchi.imagePath) await storage.deleteImage(purchi.imagePath, purchi.user.toString(), purchi.imageHash);
  res.json({ message: 'Deleted' });
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!(await bcrypt.compare(String(currentPassword || ''), req.admin.passwordHash))) {
    return res.status(400).json({ message: 'Current password is wrong' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  req.admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await req.admin.save();
  res.json({ message: 'Password changed' });
});

// Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD when no admin exists yet.
async function seedAdmin() {
  if (await Admin.estimatedDocumentCount()) return;
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn('No admin exists. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env and restart to create one.');
    return;
  }
  await Admin.create({
    username: ADMIN_USERNAME,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
  });
  console.log(`Admin "${ADMIN_USERNAME}" created`);
}

module.exports = router;
module.exports.seedAdmin = seedAdmin;

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

async function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Login required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    const admin = await Admin.findById(payload.id);
    if (!admin) throw new Error('missing admin');
    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please login again' });
  }
}

module.exports = adminAuth;

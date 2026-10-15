const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });

const publicUser = (user) => ({ id: user._id, name: user.name, phone: user.phone });

router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Name, phone and password are required' });
  }
  if (!/^\d{10}$/.test(String(phone).trim())) {
    return res.status(400).json({ message: 'Enter a valid 10 digit phone number' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (await User.exists({ phone: String(phone).trim() })) {
    return res.status(409).json({ message: 'This phone number is already registered' });
  }
  const user = await User.create({
    name,
    phone: String(phone).trim(),
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body || {};
  const user = phone && (await User.findOne({ phone: String(phone).trim() }));
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ message: 'Wrong phone number or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

module.exports = router;

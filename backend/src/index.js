require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const auth = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Admin panel (single page app) served at /admin/login, /admin, /admin/users, /admin/users/:id
const adminPage = path.join(__dirname, '..', 'public', 'admin', 'index.html');
app.get(['/admin', '/admin/*splat'], (req, res) => res.sendFile(adminPage));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/purchi', auth, require('./routes/purchi'));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.name === 'MulterError' || /Only JPG/.test(err.message) ? 400 : 500;
  res.status(status).json({ message: status === 400 ? err.message : 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
connectDB()
  .then(() => require('./routes/admin').seedAdmin())
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });

module.exports = app;

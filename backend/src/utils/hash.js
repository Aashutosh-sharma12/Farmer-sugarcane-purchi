const crypto = require('crypto');

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// "  up-12 345 " -> "UP-12345" so the same purchi number always matches.
const normalizePurchiNumber = (value) =>
  value == null ? '' : String(value).replace(/\s+/g, '').toUpperCase();

module.exports = { sha256, normalizePurchiNumber };

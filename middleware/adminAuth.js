const jwt = require('jsonwebtoken');
const { getDb, toObjects } = require('../database');
const JWT_SECRET = process.env.JWT_SECRET || 'rusukh-online-academy-secret-2024';

function adminAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'অ্যাডমিন লগইন প্রয়োজন' });
  try {
    const d = jwt.verify(h.split(' ')[1], JWT_SECRET);
    if (!d.isAdmin) return res.status(403).json({ error: 'অ্যাডমিন অ্যাক্সেস নেই' });
    req.adminId = d.adminId;
    next();
  } catch (e) { return res.status(401).json({ error: 'অবৈধ টোকেন' }); }
}

module.exports = { adminAuth, JWT_SECRET };

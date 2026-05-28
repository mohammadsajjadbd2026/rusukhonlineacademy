const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'rusukh-online-academy-secret-2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'অনুগ্রহ করে লগইন করুন' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'অবৈধ টোকেন, আবার লগইন করুন' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };

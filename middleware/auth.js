import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'wb_super_secret_key_change_in_prod';

/**
 * Express middleware that verifies Bearer JWT token from Authorization header.
 * Attaches decoded { id, userName } to req.user on success.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

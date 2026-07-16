// Middleware de autenticación (verifica el token JWT) y de autorización
// (verifica que el usuario tenga uno de los roles permitidos).
const jwt = require('jsonwebtoken');

// Verifica que venga un token válido en el header:
//   Authorization: Bearer <token>
// Si es válido, agrega el usuario decodificado a req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó un token de autenticación.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, nombre, correo, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// Middleware factory: requireRole('admin', 'veterinario') solo deja pasar
// a usuarios con esos roles. Debe usarse siempre DESPUÉS de requireAuth.
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

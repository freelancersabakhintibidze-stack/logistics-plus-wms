const crypto = require('node:crypto');
const { envBool } = require('./config');

const allowedRoles = new Set(
  (process.env.WMS_ALLOWED_ROLES || 'operator,supervisor,admin')
    .split(',').map(role => role.trim().toLowerCase()).filter(Boolean)
);

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Trusted gateway assertion. The deployment gateway must authenticate the user,
// discard inbound copies of these headers, and inject its own values.
function authRequired(req, res, next) {
  const mode = (process.env.WMS_AUTH_MODE || 'unset').toLowerCase();

  if (mode === 'disabled' && process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '::1'].includes(req.hostname)) {
    req.wmsUser = { id: 'local-development', role: 'admin' };
    return next();
  }

  if (mode !== 'proxy' || !process.env.WMS_TRUSTED_PROXY_SECRET) {
    return res.status(503).json({
      error: {
        code: 'AUTH_NOT_CONFIGURED',
        message: 'A trusted enterprise authentication gateway is required before protected data endpoints can be used.'
      }
    });
  }

  if (!safeEqual(req.get('x-wms-proxy-key'), process.env.WMS_TRUSTED_PROXY_SECRET)) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
  }

  const user = req.get(process.env.WMS_USER_HEADER || 'x-wms-authenticated-user');
  const role = (req.get(process.env.WMS_ROLE_HEADER || 'x-wms-authenticated-role') || '').toLowerCase();

  if (!user || !allowedRoles.has(role)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'The authenticated identity or role is not authorized.' }
    });
  }

  req.wmsUser = { id: user.slice(0, 160), role };
  return next();
}

function allow(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.wmsUser && req.wmsUser.role)) return next();
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'This operation is not permitted for your role.' }
    });
  };
}

module.exports = {
  authRequired, allow, allowedRoles,
  exportEnabled: () => envBool('WMS_ENABLE_CSV_EXPORT', false),
  safeEqual
};

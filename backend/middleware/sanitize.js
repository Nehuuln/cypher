/**
 * Middleware de sanitation pour empêcher les injections NoSQL / prototype pollution.
 * - supprime les clés commençant par '$'
 * - supprime les clés contenant '.'
 * - bloque '__proto__', 'constructor', 'prototype'
 */
function cleanObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanObject);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) continue;
    if (k.indexOf(".") !== -1) continue;
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    const v = obj[k];
    out[k] = v && typeof v === "object" ? cleanObject(v) : v;
  }
  return out;
}

function sanitizeMiddleware(req, res, next) {
  try {
    req.body = cleanObject(req.body);
    req.query = cleanObject(req.query);
    req.params = cleanObject(req.params);
  } catch (err) {
    // en cas d'erreur, on continue sans planter le serveur
    console.error("sanitizeMiddleware error:", err);
  }
  next();
}

module.exports = sanitizeMiddleware;

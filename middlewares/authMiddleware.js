import jwt from "jsonwebtoken";

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contiene { id, role } desde el token
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Igual que `protect` pero no bloquea: si hay un token válido carga `req.user`,
 * si no hay token o es inválido sigue como anónimo (req.user = undefined).
 * Útil para rutas públicas que personalizan la respuesta cuando hay sesión
 * (ej. banners segmentados por rol/suscripción/zona).
 */
const optionalAuth = (req, _res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = undefined;
  }
  next();
};

export { protect, optionalAuth };

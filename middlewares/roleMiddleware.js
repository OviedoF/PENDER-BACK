import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const onlyAdmin = async (req, res, next) => {
    const authHeader = req.get("Authorization");
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        if (req.user.role !== "admin") {
            return res.status(403).send("You are not allowed to access this route");
        }
        next();
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
};

const onlyAprobator = async (req, res, next) => {
    const authHeader = req.get("Authorization");
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        if (req.user.role !== "admin" && req.user.role !== "aprobation") {
            return res.status(403).send("You are not allowed to access this route");
        }
        next();
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
};

const requirePermission = (module, action = 'view') => {
    return async (req, res, next) => {
        const authHeader = req.get("Authorization");
        const token = (authHeader && authHeader.split(" ")[1]) || req.query?.token;
        if (!token) return res.status(401).json({ error: "Access Denied" });

        try {
            const verified = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(verified.id).populate('adminRole');

            if (!user || !['admin', 'moderator'].includes(user.role)) {
                return res.status(403).json({ error: "No tienes permisos de administrador" });
            }

            req.user = user;

            if (user.role === 'admin' && !user.adminRole) return next();

            if (!user.adminRole) {
                return res.status(403).json({ error: "No tienes un rol asignado" });
            }

            const modulePerms = user.adminRole.permissions?.[module];
            if (!modulePerms) {
                return res.status(403).json({ error: "No tienes permisos para este módulo" });
            }

            if (modulePerms[action] === true) {
                return next();
            }

            return res.status(403).json({ error: "No tienes permisos suficientes para esta acción" });
        } catch (err) {
            return res.status(400).json({ error: "Token inválido" });
        }
    };
};

export { onlyAdmin, onlyAprobator, requirePermission };

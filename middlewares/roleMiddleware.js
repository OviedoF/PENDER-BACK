import jwt from 'jsonwebtoken';

const onlyAdmin = async (req, res, next) => {
    const authHeader = req.get("Authorization"); // Cambiado a req.get
    const token = authHeader && authHeader.split(" ")[1];
    console.log(token);
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log(verified);
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
    const authHeader = req.get("Authorization"); // Cambiado a req.get
    const token = authHeader && authHeader.split(" ")[1];
    console.log(token);
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log(verified);
        req.user = verified;
        if (req.user.role !== "admin" || req.user.role !== "aprobation") {
            return res.status(403).send("You are not allowed to access this route");
        }
        next();
    } catch (err) {
        res.status(400).send("Invalid Token");
    }
};

export { onlyAdmin, onlyAprobator };
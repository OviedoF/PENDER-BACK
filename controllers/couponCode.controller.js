import CouponCode from '../models/PremiumCouponCodes.js'
import Service from '../models/Service.js'
import { Cupon } from '../models/Coupon.js';
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import createUserNotification from '../utils/createUserNotification.js';
import BalanceMovement from "../models/BalanceMovement.js";
dotenv.config()

const CouponCodeController = {}

// Función para generar un código único de 5 caracteres
async function generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code
    let exists = true

    while (exists) {
        // Generar un string aleatorio de 5 caracteres
        code = Array.from({ length: 5 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('')

        // Verificar que no exista en la DB
        const existing = await CouponCode.findOne({ code })
        if (!existing) exists = false
    }

    return code
}

// Crear un nuevo código de cupón
CouponCodeController.create = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' })

        const payload = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(payload.id)
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' })

        // Generar código único
        const uniqueCode = await generateUniqueCode()

        const couponCode = new CouponCode({
            code: uniqueCode,
            coupon: req.body.coupon, // ID del cupón al que pertenece
            user: user._id
        })

        createUserNotification(user._id, "Cupón creado", `Se ha creado un cupón con el código ${couponCode.code}`)

        await couponCode.save()
        res.status(201).json(couponCode.code)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Obtener todos los códigos de cupón (no eliminados)
CouponCodeController.getAll = async (req, res) => {
    try {
        const codes = await CouponCode.find({ deletedAt: null })
            .populate('coupon')
            .populate('user', 'username firstName lastName image')

        res.json(codes)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener todos los códigos de cupón de un servicio
CouponCodeController.getCouponCodesByService = async (req, res) => {
    try {
        const { service: serviceId } = req.query;

        const couponCodes = await CouponCode.find({ deletedAt: null })
            .populate('coupon', 'service')
            .populate('user', 'username email');


        const filtered = [];

        couponCodes.forEach(cc => {
            console.log(cc.coupon.service)
            if (cc.coupon && cc.coupon.service.toString() === serviceId) {
                filtered.push(cc);
            }
        });

        const count = {
            created: 0,
            used: 0
        }

        filtered.forEach(cc => {
            if (cc.status === 'pending') {
                count.used++;
            }
            count.created++;
        });

        res.json({
            ...count,
            codes: filtered.filter(cc => cc.status !== 'created'),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo los cupones' });
    }
};

// Crear uso de cupón 

CouponCodeController.useCoupon = async (req, res) => {
    try {
        const { code, service, email, amount, reference } = req.body;
        console.log(req.body)
        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        console.log(req.body)
        console.log(code, service, email, amount, reference)

        const couponCode = await CouponCode.findOne({ code }).populate('coupon', 'service')
        console.log(couponCode)
        if (!couponCode) return res.status(404).json({ error: 'Código no encontrado' });

        if (couponCode.coupon.service.toString() !== service) {
            console.log(couponCode.coupon.service.toString(), service)
            return res.status(400).json({ error: 'El código de cupón no es válido para este servicio' });
        }

        const user = await User.findOne({ email: email })
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Marcar el cupón como utilizado
        couponCode.status = 'pending';
        couponCode.amount = amount;
        couponCode.reference = reference;
        couponCode.attachment = req.body.imagen;

        await couponCode.save();

        return res.status(200).json({ message: 'Cupón utilizado correctamente', couponCode });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Error en el servidor' });
    }
}

// Obtener un código de cupón por ID
CouponCodeController.getById = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOne({ _id: id, deletedAt: null })
            .populate('coupon')
            .populate('user', 'username firstName lastName image')

        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json(code)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Actualizar un código de cupón
CouponCodeController.update = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOneAndUpdate(
            { _id: id, deletedAt: null },
            req.body,
            { new: true }
        )
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json(code)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Eliminar un código de cupón (lógico)
CouponCodeController.softDelete = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        )
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json({ message: 'Código eliminado correctamente (soft delete)', code })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Eliminar un código de cupón (definitivo)
CouponCodeController.delete = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findByIdAndDelete(id)
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json({ message: 'Código eliminado permanentemente' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Listar servicios y sus códigos en "pending"
CouponCodeController.getServicesWithPendingCodes = async (req, res) => {
    try {
        const { search } = req.query;

        // Filtro base
        const filter = {
            deletedAt: null,
            nombre: { $regex: search ? search : "", $options: "i" },
        };

        // Buscar todos los servicios
        const services = await Service.find(filter)
            .populate("user", "username firstName lastName image email") // ajustar campos
            .sort({ createdAt: -1, score: -1 })
            .lean();

        // Sacar todos los IDs de servicios
        const serviceIds = services.map((s) => s._id);

        // Agrupar cupones -> códigos pendientes
        const pendingCounts = await CouponCode.aggregate([
            {
                $match: { status: "pending", deletedAt: null },
            },
            {
                $lookup: {
                    from: "cupons", // 👈 nombre de la colección en plural
                    localField: "coupon",
                    foreignField: "_id",
                    as: "coupon",
                },
            },
            { $unwind: "$coupon" },
            {
                $match: {
                    "coupon.service": { $in: serviceIds },
                },
            },
            {
                $group: {
                    _id: "$coupon.service",
                    count: { $sum: 1 },
                },
            },
        ]);

        // Transformar a objeto para lookup rápido
        const pendingMap = {};
        pendingCounts.forEach((p) => {
            pendingMap[p._id.toString()] = p.count;
        });

        // Agregar key pendingCodes a cada servicio
        const result = services.map((s) => ({
            ...s,
            pendingCodes: pendingMap[s._id.toString()] || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error en getServicesWithPendingCodes:", error);
        res.status(500).json({ error: "Error al obtener servicios" });
    }
};

// Listar los code coupons por service
CouponCodeController.getCouponCodesByService = async (req, res) => {
    try {
        const { serviceId } = req.params;

        const codes = await CouponCode.find({
            status: { $ne: "created" },
            deletedAt: null,
        })
            .populate({
                path: "coupon",
                match: { service: serviceId },
                select: "nombre codigo service tipoDescuento valorDescuento",
            })
            .populate("user", "username firstName lastName email image")
            .sort({ createdAt: -1 }) // orden base por fecha
            .lean();

        // Filtrar por los que sí pertenecen al service
        const filtered = codes.filter((c) => c.coupon);

        // Reordenar: primero los "pending"
        const ordered = [
            ...filtered.filter((c) => c.status === "pending"),
            ...filtered.filter((c) => c.status !== "pending"),
        ];

        res.json(ordered);
    } catch (error) {
        console.error("Error en getCouponCodesByService:", error);
        res.status(500).json({ error: "Error al obtener códigos de cupones" });
    }
};

// Aprobar código
CouponCodeController.approveCouponCode = async (req, res) => {
    try {
        const { codeId } = req.params;

        // Buscar el código con su cupón y usuario
        const couponCode = await CouponCode.findById(codeId)
            .populate({
                path: "coupon",
                populate: {
                    path: "service",
                    select: "nombre descripcion user"
                }
            })
            .populate("user");

        if (!couponCode) {
            return res.status(404).json({ error: "CouponCode no encontrado" });
        }

        if (couponCode.status === "approved") {
            return res.status(400).json({ error: "El código ya fue aprobado" });
        }

        // Validar que tenga cupón
        const coupon = couponCode.coupon;
        if (!coupon) {
            return res.status(400).json({ error: "El código no tiene cupón asociado" });
        }

        // Calcular monto del descuento
        let totalDescuento = 0;
        const valor = parseFloat(coupon.valorDescuento);

        if (coupon.tipoDescuento === "Monto fijo") {
            totalDescuento = valor;
        } else if (coupon.tipoDescuento === "Porcentaje") {
            totalDescuento = (couponCode.amount * valor) / 100;
        }

        // Actualizar CouponCode
        couponCode.status = "approved";

        // Actualizar balance del usuario
        const user = await User.findById(couponCode.coupon.service.user);
        user.balance += totalDescuento;
        await user.save();
        await couponCode.save();

        // Crear movimiento
        const movement = new BalanceMovement({
            user: user._id,
            amount: totalDescuento,
            type: "payment",
            codeCoupon: couponCode._id,
            status: "completed",
        });
        await movement.save();

        res.json({
            message: "Código aprobado correctamente",
            couponCode,
            balance: user.balance,
            movement,
        });
    } catch (error) {
        console.error("Error en approveCouponCode:", error);
        res.status(500).json({ error: "Error al aprobar el código" });
    }
};

CouponCodeController.adminGetAll = async (req, res) => {
    try {
        const { status = '', page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query = { deletedAt: null, status: { $ne: 'created' } };
        if (status) query.status = status;

        const [codes, total] = await Promise.all([
            CouponCode.find(query)
                .populate({
                    path: 'coupon',
                    select: 'nombre codigo tipoDescuento valorDescuento service',
                    populate: {
                        path: 'service',
                        select: 'nombre',
                        populate: { path: 'user', select: 'commercialName email' },
                    },
                })
                .populate('user', 'firstName lastName commercialName email image')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            CouponCode.countDocuments(query),
        ]);

        // pending primero
        const ordered = [
            ...codes.filter(c => c.status === 'pending'),
            ...codes.filter(c => c.status !== 'pending'),
        ];

        res.json({ codes: ordered, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default CouponCodeController
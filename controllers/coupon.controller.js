import { Cupon } from '../models/Coupon.js'
import CouponCode from '../models/PremiumCouponCodes.js'
import User from '../models/User.js'
import Service from '../models/Service.js'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const CouponController = {}

// Crear un nuevo cupón
CouponController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(payload.id)
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' })

        const existingCoupon = await Cupon.findOne({ code: req.body.code, service: req.body.service, deletedAt: null })
        
        if (existingCoupon) {
            return res.status(400).json({ error: 'El código de cupón ya existe para este servicio' })
        }

        const cupon = new Cupon(req.body)
        await cupon.save()
        res.status(201).json(cupon)
    } catch (error) {
        console.log(error)
        res.status(400).json({ error: error.message })
    }
}

// Obtener todos los cupones de un servicio
CouponController.getAllByService = async (req, res) => {
    try {
        const { serviceId } = req.params
        const cupones = await Cupon.find({ service: serviceId, deletedAt: null }).sort({ createdAt: -1 })
        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones activos de un servicio
CouponController.getActive = async (req, res) => {
    try {
        const { serviceId } = req.params;
        console.log("Service ID:", serviceId); // Verifica que el ID del servicio se reciba correctamente

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: false,
            activarProgramacion: false,
            deletedAt: null
        }).sort({ createdAt: -1 })

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones programados de un servicio
CouponController.getScheduled = async (req, res) => {
    try {
        const { serviceId } = req.params

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: false,
            activarProgramacion: true,
            deletedAt: null
        }).sort({ createdAt: -1 })
        console.log(cupones)

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones ocultos de un servicio
CouponController.getHidden = async (req, res) => {
    try {
        const { serviceId } = req.params

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: true,
            deletedAt: null
        }).sort({ createdAt: -1 })

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener un cupón por ID
CouponController.getById = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findById({
            _id: id,
            deletedAt: null
        })
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json(cupon)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Actualizar un cupón
CouponController.update = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findByIdAndUpdate(id, req.body, { new: true })
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json(cupon)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Eliminar un cupón (eliminación directa)
CouponController.delete = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json({ message: 'Cupón eliminado correctamente' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

CouponController.adminGetAll = async (req, res) => {
    try {
        const { search = '', premium = '', empresa = '', category = '', zona = '', global: isGlobal = '', page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query = { deletedAt: null };

        if (search) query.$or = [
            { codigo: { $regex: search, $options: 'i' } },
            { nombre:  { $regex: search, $options: 'i' } },
        ];
        if (premium === 'true')  query.premium = true;
        if (premium === 'false') query.premium = false;
        if (zona)     query.zona = { $regex: zona, $options: 'i' };
        if (isGlobal === 'true')  query.global = true;
        if (isGlobal === 'false') query.global = { $ne: true };

        if (empresa || category) {
            const serviceQuery = { deletedAt: null };
            if (category) serviceQuery.categoria = category;
            if (empresa) {
                const enterprises = await User.find({
                    role: 'enterprise',
                    $or: [
                        { commercialName: { $regex: empresa, $options: 'i' } },
                        { email:          { $regex: empresa, $options: 'i' } },
                    ],
                }).select('_id').lean();
                serviceQuery.user = { $in: enterprises.map(e => e._id) };
            }
            const services = await Service.find(serviceQuery).select('_id').lean();
            query.service = { $in: services.map(s => s._id) };
        }

        const [coupons, total] = await Promise.all([
            Cupon.find(query)
                .populate({
                    path: 'service',
                    select: 'nombre categoria ciudad departamento',
                    populate: { path: 'user', select: 'commercialName email' },
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Cupon.countDocuments(query),
        ]);

        res.json({ coupons, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CouponController.adminCreate = async (req, res) => {
    try {
        const existing = await Cupon.findOne({ codigo: req.body.codigo, deletedAt: null });
        if (existing) return res.status(400).json({ error: 'El código ya existe' });
        const cupon = new Cupon(req.body);
        await cupon.save();
        res.status(201).json(cupon);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CouponController.adminDelete = async (req, res) => {
    try {
        await Cupon.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
        res.json({ message: 'Cupón eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CouponController.adminGetMetrics = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Cupon.findById(id).lean();
        if (!coupon) return res.status(404).json({ error: 'Cupón no encontrado' });

        const codes = await CouponCode.find({ coupon: id, deletedAt: null })
            .select('status amount user')
            .lean();

        const totalGenerados = codes.length;
        const usados = codes.filter(c => c.status !== 'created');
        const aprobados = codes.filter(c => c.status === 'approved');

        const totalUsados = usados.length;
        const totalAprobados = aprobados.length;
        const tasaRedencion = totalGenerados > 0
            ? Math.round((totalAprobados / totalGenerados) * 100)
            : 0;

        // Ingresos generados: suma del monto total de compras aprobadas
        const ingresosGenerados = aprobados.reduce((sum, c) => sum + (c.amount || 0), 0);

        // Descuento efectivo entregado
        const valor = parseFloat(coupon.valorDescuento) || 0;
        const descuentoEntregado = aprobados.reduce((sum, c) => {
            if (coupon.tipoDescuento === 'Monto fijo') return sum + valor;
            return sum + ((c.amount || 0) * valor / 100);
        }, 0);

        // Usuarios únicos que usaron el cupón (pending o approved)
        const usuariosUnicos = new Set(usados.map(c => c.user?.toString())).size;

        res.json({
            totalGenerados,
            totalUsados,
            totalAprobados,
            tasaRedencion,
            ingresosGenerados,
            descuentoEntregado,
            usuariosUnicos,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default CouponController
import Service from '../models/Service.js';
import { Cupon } from '../models/Coupon.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const ServiceController = {};

const formatNumberK = (num) => {
    if (num < 1000) return num;
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
};

// Crear un nuevo servicio
ServiceController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        req.body.user = user._id;
        const service = new Service(req.body);
        await service.save();
        res.status(201).json(service);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Obtener servicios por usuario
ServiceController.getByUser = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        const services = await Service.find({ user: user._id, deletedAt: null }).sort({ createdAt: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener todos los servicios
ServiceController.getAll = async (req, res) => {
    try {
        const { search } = req.query;
        const services = await Service.find({ 
            deletedAt: null,
            nombre: { $regex: search ? search : '', $options: 'i' }
         }).sort({ createdAt: -1, score: -1 }).populate('user', 'username firstName lastName image _id');
         
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener un servicio por ID
ServiceController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        const service = await Service.findOne({ _id: req.params.id, deletedAt: null }).populate('user', 'username firstName lastName image _id');
        const isOwner = service.user._id.toString() === user._id.toString();

        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
        res.json({
            ...service.toObject(),

            isOwner,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Actualizar un servicio
ServiceController.update = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        const service = await Service.findOneAndUpdate(
            { _id: req.params.id, user: user._id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
        res.json(service);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Eliminar un servicio (borrado lógico)
ServiceController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        const service = await Service.findOne({ _id: req.params.id, user: user._id });
        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
        
        service.deletedAt = new Date();
        await service.save();
        res.json({ message: 'Servicio eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Sumar vista a un servicio
ServiceController.addView = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

        service.vistas += 1;
        await service.save();
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener estadísticas de un usuario
ServiceController.getStats = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        const stats = await Service.aggregate([
            { $match: { user: user._id, deletedAt: null } },
            {
                $group: {
                    _id: null,
                    totalServices: { $sum: 1 },
                    totalViews: { $sum: '$vistas' },
                },
            },
        ]);

        const services = await Service.find({ user: user._id, deletedAt: null });

        let totalCoupons = 0;
        let totalReviews = 0;

        for (const service of services) {
            const coupons = await Cupon.find({ service: service._id });
            totalCoupons += coupons.length;
            const reviews = await Review.find({ service: service._id });
            totalReviews += reviews.length;
        }

        const rawStats = {
            totalServices: stats[0] ? stats[0].totalServices : 0,
            totalViews: stats[0] ? stats[0].totalViews : 0,
            totalReviews,
            totalCoupons,
        };

        const userStats = {
            totalServices: formatNumberK(rawStats.totalServices),
            totalViews: formatNumberK(rawStats.totalViews),
            totalReviews: formatNumberK(rawStats.totalReviews),
            totalCoupons: formatNumberK(rawStats.totalCoupons),
        };

        res.json(userStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default ServiceController;
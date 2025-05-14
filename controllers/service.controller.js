import Service from '../models/Service.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const ServiceController = {};

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
        const { search, categoria, distrito, departamento } = req.query; // Recibe los nuevos parámetros

        let queryFilter = { deletedAt: null };

        if (search) {
            queryFilter.nombre = { $regex: search, $options: 'i' };
        }
        if (categoria) {
            queryFilter.categoria = categoria; // Asegurarse que el campo en el modelo se llame 'categoria'
        }
        if (distrito) {
            queryFilter.distrito = distrito;
        }
        if (departamento) {
            queryFilter.departamento = departamento;
        }
        // Añadir más condiciones de filtro según se necesite

        const services = await Service.find(queryFilter) // Aplica el filtro
            .sort({ createdAt: -1, score: -1 })
            .populate('user', 'username firstName lastName image _id');

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

export default ServiceController;
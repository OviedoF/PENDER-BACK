import Adoption from '../models/Adoption.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const AdoptionController = {};

AdoptionController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        console.log(token);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        req.body.user = user._id;
        if (req.files.image && req.files.image.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        if(req.files.images && req.files.images.length > 0) {
            req.body.imagenes = req.files.images.map((image) => {
                return `${process.env.API_URL}/api/uploads/${image.filename}`;
            });
        }

        const adoption = new Adoption({ ...req.body });
        await adoption.save();
        res.status(201).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.getByUser = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoptions = await Adoption.find({ user: user._id, deletedAt: null }).sort({ createdAt: -1 });

        const parsedAdoptions = adoptions.map((adoption) => {
            return {
                id: adoption._id,
                nombre: adoption.nombre,
                raza: adoption.raza,
                imagen: adoption.imagen,
                fecha: new Date(adoption.createdAt).toLocaleDateString(),
                status: adoption.adopted ? 'adoptado' : 'por_adoptar'
            };
        });

        res.status(200).json(parsedAdoptions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};    

AdoptionController.getAll = async (req, res) => {
    try {
        const {search} = req.query;
        console.log(search);

        const query = search ? {
            deletedAt: null,
            $or: [
                { nombre: { $regex: search, $options: 'i' } },
                { raza: { $regex: search, $options: 'i' } }
            ]
        } : { deletedAt: null };

        const adoptions = await Adoption.find(query).sort({ createdAt: -1 });

        res.status(200).json(adoptions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoption = await Adoption.findOne({ _id: req.params.id, deletedAt: null });

        const isOwner = adoption.user.toString() === user._id.toString();

        if (!adoption) return res.status(404).json({ 
            message: 'No se encontró la adopcion' 
        });

        res.status(200).json({
            adoption,
            isOwner
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.update = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const isOwner = await Adoption.findOne({ _id: req.params.id, user: user._id });
        if (!isOwner) return res.status(403).json({ message: 'No tienes permisos' });

        if (req.files?.image?.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        if (req.files?.images?.length > 0) {
            req.body.imagenes = req.files.images.map(image => `${process.env.API_URL}/api/uploads/${image.filename}`);
        }

        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        
        if (!adoption) return res.status(404).json({ message: 'Not found' });
        
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoption = await Adoption.findOne({ _id: req.params.id, user: user._id });
        if (!adoption) return res.status(404).json({ message: 'Error al eliminar' });
        adoption.deletedAt = new Date();
        await adoption.save();
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default AdoptionController;

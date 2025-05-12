import FindMe from '../models/FindMe.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const FoundMeController = {};

FoundMeController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        console.log(token);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        req.body.user = user._id;
        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }

        const foundMe = new FindMe({ ...req.body });
        await foundMe.save();
        res.status(201).json(foundMe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

FoundMeController.getByUser = async (req, res) => {
    try {
        const { tipo, page, search } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        let foundMe = [];
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userObject = await User.findOne({ _id: payload.id });
        const user = userObject._id;

        if (search) {
            foundMe = await FindMe.find({ nombre: { $regex: search, $options: 'i' }, deletedAt: null, tipo, user }).sort({ createdAt: -1 }).limit(limit).skip(skip);
        } else {
            foundMe = await FindMe.find({ tipo, deletedAt: null, user }).sort({ createdAt: -1 }).limit(limit).skip(skip);
        }

        const parsedFoundMe = foundMe.map((foundMe) => {
            return {
                id: foundMe._id,
                nombre: foundMe.nombre,
                raza: foundMe.raza,
                imagen: foundMe.imagen,
                locacion: `${foundMe.ciudad}, ${foundMe.distrito}`,
                fecha: new Date(foundMe.createdAt).toLocaleDateString(),
                finished: foundMe.finished
            };
        });

        res.status(200).json(parsedFoundMe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.getAll = async (req, res) => {
    try {
        const { tipo, page, search } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        let foundMe = [];

        if (search) {
            foundMe = await FindMe.find({ nombre: { $regex: search, $options: 'i' }, deletedAt: null, tipo }).sort({ createdAt: -1 }).limit(limit).skip(skip);
        } else {
            foundMe = await FindMe.find({ tipo, deletedAt: null }).sort({ createdAt: -1 }).limit(limit).skip(skip);
        }

        const parsedFoundMe = foundMe.map((foundMe) => {
            return {
                id: foundMe._id,
                nombre: foundMe.nombre,
                raza: foundMe.raza,
                imagen: foundMe.imagen,
                locacion: `${foundMe.ciudad}, ${foundMe.distrito}`,
                fecha: new Date(foundMe.createdAt).toLocaleDateString()
            };
        });

        res.status(200).json(parsedFoundMe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const foundMe = await FindMe.findOne({ _id: req.params.id, deletedAt: null });

        const isOwner = foundMe.user.toString() === user._id.toString();

        if (!foundMe) return res.status(404).json({
            message: 'No se encontró la adopcion'
        });

        res.status(200).json({
            foundMe,
            isOwner
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.update = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const isOwner = await FindMe.findOne({ _id: req.params.id, user: user._id });
        if (!isOwner) return res.status(403).json({ message: 'No tienes permisos' });

        if (req.files?.image?.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        const foundMe = await FindMe.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );

        if (!foundMe) return res.status(404).json({ message: 'Not found' });

        res.status(200).json(foundMe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

FoundMeController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const foundMe = await FindMe.findOne({ _id: req.params.id, user: user._id });
        if (!foundMe) return res.status(404).json({ message: 'Error al eliminar' });
        foundMe.deletedAt = new Date();
        await foundMe.save();
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default FoundMeController;

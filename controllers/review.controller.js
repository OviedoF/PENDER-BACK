import Review from '../models/Review.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const ReviewController = {};

ReviewController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        req.body.user = user._id;

        const service = await Service.findById(req.body.service);
        if (!service) {
            return res.status(404).json({ message: 'Servicio no encontrado' });
        }

        const review = new Review({ ...req.body });
        await review.save();

        res.status(201).json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

ReviewController.getAll = async (req, res) => {
    try {
        const { service } = req.query;
        let reviews = [];

        // Filtramos por el servicio si se pasa el parámetro
        if (service) {
            reviews = await Review.find({ service, deletedAt: null }).sort({ createdAt: -1 }).populate('user', '_id firstName lastName image');
        } else {
            reviews = await Review.find({ deletedAt: null }).sort({ createdAt: -1 }).populate('user', '_id firstName lastName image');
        }

        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ReviewController.getById = async (req, res) => {
    try {
        const review = await Review.findOne({ _id: req.params.id, deletedAt: null })
            .populate('user', 'nombre avatar');

        if (!review) return res.status(404).json({ message: 'Review no encontrado' });

        res.status(200).json(review);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ReviewController.update = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);

        const review = await Review.findOne({ _id: req.params.id, user: user._id, deletedAt: null });
        if (!review) return res.status(403).json({ message: 'No tienes permisos' });

        const updatedReview = await Review.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.status(200).json(updatedReview);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

ReviewController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);

        const review = await Review.findOne({ _id: req.params.id, user: user._id, deletedAt: null });
        if (!review) return res.status(404).json({ message: 'Review no encontrado' });

        review.deletedAt = new Date();
        await review.save();

        res.status(200).json({ message: 'Review eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default ReviewController;

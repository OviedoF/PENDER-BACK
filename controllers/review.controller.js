import Review from '../models/Review.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const ReviewController = {};

ReviewController.create = async (req, res) => {
    try {
        // Obtener usuario desde token
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        req.body.user = user._id;

        // Validar servicio
        const service = await Service.findById(req.body.service);
        if (!service) {
            return res.status(404).json({ message: 'Servicio no encontrado' });
        }

        // Crear la review
        const review = new Review({ ...req.body });
        await review.save();

        // Actualizar el score promedio del service
        const reviews = await Review.find({ service: service._id });
        const totalScore = reviews.reduce((acc, r) => acc + r.rating, 0);
        service.score = totalScore / reviews.length;
        await service.save();

        // Crear notificación al dueño del servicio
        createUserNotification(
            service.user,
            'Nueva reseña creada',
            `Han creado una nueva reseña para el servicio: ${service.nombre}`,
            'usuario/benefits/restaurant',
            { _id: service._id }
        );

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
            reviews = await Review.find({ service, deletedAt: null }).sort({ createdAt: -1 })
            .populate('user', '_id firstName commercialName lastName image')
            .populate('responses.user', '_id firstName commercialName lastName image');
        } else {
            reviews = await Review.find({ deletedAt: null }).sort({ createdAt: -1 })
            .populate('user', '_id firstName commercialName lastName image')
            .populate('responses.user', '_id firstName commercialName lastName image');
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

ReviewController.getAllByOwner = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id;

    // Buscar todos los servicios creados por este usuario
    const services = await Service.find({ user: userId, deletedAt: null }).select('_id');

    if (!services.length)
      return res.status(200).json([]);

    // Buscar todas las reseñas de esos servicios
    const serviceIds = services.map(s => s._id);
    const reviews = await Review.find({ service: { $in: serviceIds }, deletedAt: null })
      .sort({ createdAt: -1 })
      .populate('user', '_id firstName lastName commercialName image')
      .populate('responses.user', '_id firstName lastName commercialName image')
      .populate('service', '_id nombre');

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

ReviewController.respond = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await User.findById(payload.id);

    const { id } = req.params; // ID de la review
    const { comment } = req.body;

    if (!comment || !comment.trim())
      return res.status(400).json({ message: 'El comentario no puede estar vacío' });

    const review = await Review.findById(id).populate('service');

    if (!review)
      return res.status(404).json({ message: 'Reseña no encontrada' });

    // Verificar que el usuario autenticado sea el dueño del servicio
    if (String(review.service.user) !== String(owner._id))
      return res.status(403).json({ message: 'No tienes permiso para responder esta reseña' });

    // Agregar respuesta
    const response = {
      user: owner._id,
      comment: comment.trim(),
      createdAt: new Date()
    };

    review.responses.push(response);
    await review.save();

    res.status(201).json({
      message: 'Respuesta añadida correctamente',
      review
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default ReviewController;

import Featured from '../models/FeaturedRequest.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const FeaturedController = {};

// Crear petición
FeaturedController.create = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    console.log(req.body);

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const featured = new Featured({
      ...req.body,
      user: user._id,
      status: 'pending',
    });

    await featured.save();
    res.status(201).json(featured);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener todas las peticiones
FeaturedController.getAll = async (req, res) => {
  try {
    const petitions = await Featured.find({ deletedAt: null })
      .populate('user', 'name email')
      .populate('coupon')
      .populate('service')
      .sort({ createdAt: -1 });

    res.status(200).json(petitions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener peticiones de un usuario
FeaturedController.getByUser = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const petitions = await Featured.find({ user: user._id, deletedAt: null })
      .populate('coupon')
      .populate('service')
      .sort({ createdAt: -1 });

    res.status(200).json(petitions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

FeaturedController.findByService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // buscamos FeaturedRequests cuyo coupon pertenezca a ese service
    const requests = await Featured.find()
      .populate({
        path: "coupon",
        match: { service: serviceId }, // <-- filtramos por service dentro del coupon
        populate: { path: "service" },
      });

    console.log(requests);

    // quitamos los null (porque populate con match puede devolver null)
    const filtered = requests.filter(r => r.coupon !== null);

    res.json(filtered);
  } catch (error) {
    console.error("Error en findByService:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Obtener por ID
FeaturedController.getById = async (req, res) => {
  try {
    const petition = await Featured.findOne({ _id: req.params.id, deletedAt: null })
      .populate('user', 'name email')
      .populate('coupon')
      .populate('service');

    if (!petition) return res.status(404).json({ message: 'No encontrada' });

    res.status(200).json(petition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar petición
FeaturedController.update = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const updated = await Featured.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar (soft delete)
FeaturedController.delete = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    const petition = await Featured.findOne({ _id: req.params.id, user: user._id });
    if (!petition) return res.status(404).json({ message: 'No encontrada' });

    await Featured.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Aprobar
FeaturedController.approve = async (req, res) => {
  try {
    const petition = await Featured.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!petition) return res.status(404).json({ message: 'No encontrada' });

    res.status(200).json(petition);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Rechazar
FeaturedController.reject = async (req, res) => {
  try {
    const petition = await Featured.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    if (!petition) return res.status(404).json({ message: 'No encontrada' });

    res.status(200).json(petition);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default FeaturedController;

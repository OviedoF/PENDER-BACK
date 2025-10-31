import Service from '../models/Service.js';
import { Cupon } from '../models/Coupon.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import Category from '../models/Category.js';
import dotenv from 'dotenv';
import { Types } from 'mongoose';
import createUserNotification from '../utils/createUserNotification.js';
import featuredRequest from "../models/FeaturedRequest.js";
dotenv.config();

const ServiceController = {};

const formatNumberK = (num) => {
    if (num < 1000) return num;
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
};

// Crear un nuevo servicio
ServiceController.create = async (req, res) => {
    try {
        // Validación de usuario
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        // Asignar usuario
        req.body.user = user._id;

        // Manejo de imagen principal
        if (req.files?.imagen?.length > 0) {
            const mainImage = req.files.imagen[0];
            req.body.imagen = `${process.env.API_URL}/api/uploads/${mainImage.filename}`;
        }

        // Manejo de imágenes adicionales
        if (req.files?.imagenes?.length > 0) {
            req.body.imagenes = req.files.imagenes.map(file => `${process.env.API_URL}/api/uploads/${file.filename}`);
        }

        // Crear servicio
        const service = new Service(req.body);

        // Notificación al usuario
        createUserNotification(
            user._id,
            'Nuevo servicio creado',
            `Has creado un nuevo servicio: ${service.nombre}`,
            'empresa/service',
            { _id: service._id }
        );

        await service.save();
        res.status(201).json(service);

    } catch (error) {
        console.error(error);
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
        const { search, category, tag } = req.query;
        console.log("Query params:", req.query);

        // Filtro base (solo servicios no eliminados)
        const filter = { deletedAt: null, oculto: false };

        // Buscar por nombre si hay "search"
        if (search && search.trim()) {
            filter.nombre = { $regex: search, $options: "i" };
        }

        // Filtrar por categoría si se envía
        if (category && category.trim()) {
            filter.categoria = category;
        }

        // Nuevo: filtrar por etiqueta (tag)
        if (tag && tag.trim()) {
            filter.etiquetas = { $regex: tag, $options: "i" };
        }

        // Traer todos los servicios con filtro
        const allServices = await Service.find(filter)
            .sort({ createdAt: -1, score: -1 })
            .populate("user", "username firstName lastName image _id");

        // Traer todas las featuredRequest aprobadas
        const approvedRequests = await featuredRequest
            .find({ status: "approved" })
            .populate("coupon")
            .populate({
                path: "service",
                populate: { path: "user", select: "username firstName lastName image _id" },
            });

        // Clasificación
        const premium = [];
        const approved = [];

        approvedRequests.forEach((req) => {
            if (!req.service) return;

            // Aplicar el mismo filtro de búsqueda, categoría y tag al servicio destacado
            const matchesFilter =
                (!search ||
                    req.service.nombre.toLowerCase().includes(search.toLowerCase())) &&
                (!category || req.service.categoria === category) &&
                (!tag ||
                    req.service.etiquetas?.some((t) =>
                        t.toLowerCase().includes(tag.toLowerCase())
                    ));

            if (!matchesFilter) return;

            if (req.coupon?.premium) {
                premium.push({
                    ...req.service.toObject(),
                    discount: `${req.coupon?.valorDescuento} ${req.coupon?.tipoDescuento === "Porcentaje" ? "%" : "$"
                        }`,
                });
            } else {
                approved.push({
                    ...req.service.toObject(),
                    discount: `${req.coupon?.valorDescuento} ${req.coupon?.tipoDescuento === "Porcentaje" ? "%" : "$"
                        }`,
                });
            }
        });

        // Filtrar los "regular"
        const excludedIds = new Set([
            ...premium.map((s) => s._id.toString()),
            ...approved.map((s) => s._id.toString()),
        ]);

        const regular = allServices.filter(
            (s) => !excludedIds.has(s._id.toString())
        );

        return res.status(200).json({ premium, approved, regular });
    } catch (error) {
        console.error("Error en getAll:", error);
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

        const service = await Service.findOne({ _id: req.params.id, deletedAt: null })
            .populate('user', 'username firstName lastName image _id commercialName');
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
        console.log(req.body);
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Usuario no autorizado' });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        // Construir la URL base del servidor
        const baseUrl = process.env.API_URL;

        // Procesar imágenes si llegan en req.files
        if (req.files) {
            if (req.files.imagen && req.files.imagen.length > 0) {
                req.body.imagen = `${baseUrl}/api/uploads/${req.files.imagen[0].filename}`;
            }
            if (req.files.imagenes && req.files.imagenes.length > 0) {
                req.body.imagenes = req.files.imagenes.map(file => `${baseUrl}/api/uploads/${file.filename}`);
            }
        }

        const service = await Service.findOneAndUpdate(
            { _id: req.params.id, user: user._id, deletedAt: null },
            req.body,
            { new: true }
        );

        createUserNotification(user._id, 'Servicio actualizado', `El servicio ${service.nombre} ha sido actualizado`, null, { _id: service._id });

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
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id);
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

        service.vistas += 1;
        service.views.push({ user: payload.id, createdAt: new Date() });

        await service.save();
        res.json(service);
    } catch (error) {
        console.error('Error al sumar vista:', error);
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

// Obtener vistas y reviews de un servicio en los últimos 7 días

ServiceController.getViewsAndReviews = async (req, res, next) => {
    try {
        const tz = 'America/Lima';
        const id = req.params.serviceId;
        const end = new Date(req.query.end);            // 2025-05-19 00:00:00
        end.setHours(23, 59, 59, 999);                  // fin del día
        const start = new Date(end);                    // 7 días atrás
        start.setDate(end.getDate() - 6);               // 13-05-2025 00:00
        console.log(end)

        /* etiquetas DD/MM → orden cronológico */
        const labels = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i);
            return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', timeZone: tz });
        });

        /* ── VISTAS ───────────────────────────────────────────── */
        const viewsPipeline = [
            { $match: { _id: new Types.ObjectId(id) } },       // <─ solo ese servicio
            { $unwind: '$views' },
            { $match: { 'views.createdAt': { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: {
                        y: { $year: { date: '$views.createdAt', timezone: tz } },
                        m: { $month: { date: '$views.createdAt', timezone: tz } },
                        d: { $dayOfMonth: { date: '$views.createdAt', timezone: tz } }
                    },
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            date: {
                                $dateFromParts: {
                                    year: '$_id.y', month: '$_id.m', day: '$_id.d', timezone: tz
                                }
                            },
                            format: '%d/%m', timezone: tz
                        }
                    },
                    total: 1
                }
            }
        ];

        /* ── REVIEWS ──────────────────────────────────────────── */
        const reviewsPipeline = [
            {
                $match: {
                    service: new Types.ObjectId(id),              // <─ reviews de ese servicio
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        y: { $year: { date: '$createdAt', timezone: tz } },
                        m: { $month: { date: '$createdAt', timezone: tz } },
                        d: { $dayOfMonth: { date: '$createdAt', timezone: tz } }
                    },
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            date: {
                                $dateFromParts: {
                                    year: '$_id.y', month: '$_id.m', day: '$_id.d', timezone: tz
                                }
                            },
                            format: '%d/%m', timezone: tz
                        }
                    },
                    total: 1
                }
            }
        ];

        /* ── ejecutamos en paralelo ──────────────────────────── */
        const [viewsAgg, reviewsAgg] = await Promise.all([
            Service.aggregate(viewsPipeline),
            Review.aggregate(reviewsPipeline)
        ]);

        const vMap = Object.fromEntries(viewsAgg.map(o => [o.date, o.total]));
        const rMap = Object.fromEntries(reviewsAgg.map(o => [o.date, o.total]));

        const views = labels.map(d => vMap[d] ?? 0);
        const reviews = labels.map(d => rMap[d] ?? 0);

        res.json({ labels, views, reviews });
    } catch (err) { next(err); }
};

// Obtener estadísticas de un servicio
ServiceController.getTotals = async (req, res) => {
    try {
        /*── 1. Autenticación ───────────────────────────────────────────────*/
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Token faltante' });

        const { id: userId } = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(userId);
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

        /*── 2. Validar que el servicio pertenezca al usuario ───────────────*/
        const { serviceId } = req.params;
        const service = await Service.findOne({ _id: serviceId, user: user._id, deletedAt: null });
        if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

        /*── 3. Totales del servicio ────────────────────────────────────────*/
        // vistas (campo acumulado)
        const totalViews = service.vistas ?? 0;

        // reviews y cupones (conteo directo)
        const [totalReviews, totalCoupons] = await Promise.all([
            Review.countDocuments({ service: serviceId }),
            Cupon.countDocuments({ service: serviceId })
        ]);

        const rawStats = { totalViews, totalReviews, totalCoupons };

        /*── 4. Formateo K (función aux) ────────────────────────────────────*/
        const userStats = {
            totalViews: formatNumberK(rawStats.totalViews),
            totalReviews: formatNumberK(rawStats.totalReviews),
            totalCoupons: formatNumberK(rawStats.totalCoupons)
        };

        res.json({ ...rawStats, formatted: userStats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener categorias
ServiceController.getCategories = async (req, res) => {
    try {
        // 1️⃣ Obtener categorías activas
        const categories = await Category.find({ deletedAt: null }).sort({ createdAt: -1 });

        // 2️⃣ Agrupar los servicios por categoría y sumar las vistas
        const servicesByCategory = await Service.aggregate([
            { $match: { deletedAt: null } },
            {
                $group: {
                    _id: "$categoria",
                    totalVistas: { $sum: "$vistas" } // sumamos el número total de vistas
                }
            }
        ]);

        // 3️⃣ Crear un mapa { nombreCategoria: totalVistas }
        const vistaMap = {};
        servicesByCategory.forEach(s => {
            vistaMap[s._id] = s.totalVistas;
        });

        // 4️⃣ Combinar categorías con su conteo de vistas
        const result = categories.map(cat => ({
            ...cat.toObject(),
            count: vistaMap[cat.title] || 0
        }));

        res.json(result);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: error.message });
    }
};

// Categorías con tags
ServiceController.getCategoriesWithTags = async (req, res) => {
  try {
    // 1️⃣ Obtener todas las categorías activas
    const categories = await Category.find({ deletedAt: null }).sort({ createdAt: -1 });

    // 2️⃣ Agrupar los tags de los servicios por categoría
    const tagsByCategory = await Service.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: "$categoria",
          tags: { $addToSet: "$etiquetas" }
        }
      },
      {
        $project: {
          _id: 1,
          tags: {
            $reduce: {
              input: "$tags",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] }
            }
          }
        }
      }
    ]);

    // 🧹 3️⃣ Sanear tags que sean strings tipo JSON
    const cleanTags = (tags) =>
      tags.flatMap((t) => {
        if (Array.isArray(t)) return t;
        if (typeof t === "string") {
          try {
            const parsed = JSON.parse(t);
            return Array.isArray(parsed) ? parsed : [t];
          } catch {
            return [t];
          }
        }
        return [t];
      });

    // 4️⃣ Crear un mapa { categoria: [tags] }
    const tagMap = {};
    tagsByCategory.forEach((item) => {
      tagMap[item._id] = cleanTags(item.tags);
    });

    // 5️⃣ Combinar categorías con sus tags
    const result = categories.map((cat) => ({
      ...cat.toObject(),
      tags: tagMap[cat.title] || []
    }));

    res.json(result);
  } catch (error) {
    console.error("❌ Error al obtener categorías con tags:", error);
    res.status(500).json({ error: error.message });
  }
};

// Tags de una categoría
ServiceController.getTagsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        if (!category) return res.status(400).json({ error: 'Categoría es requerida' });

        // 1️⃣ Obtener los tags únicos de los servicios en esa categoría
        const tagsAgg = await Service.aggregate([
            { $match: { categoria: category, deletedAt: null } },
            { $unwind: "$etiquetas" },
            { $group: { _id: "$etiquetas" } }
        ]);

        const tags = tagsAgg.map(tag => tag._id);
        res.json({ category, tags });
    } catch (error) {
        console.error("❌ Error al obtener tags por categoría:", error);
        res.status(500).json({ error: error.message });
    }
};

export default ServiceController;
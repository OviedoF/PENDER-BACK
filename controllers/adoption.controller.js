import Adoption from '../models/Adoption.js';
import AdoptionReport from '../models/AdoptionReport.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createUserNotification from '../utils/createUserNotification.js';
import createSystemNotification from '../utils/createSystemNotification.js';
dotenv.config();

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
    return user;
};

const AdoptionController = {};

AdoptionController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        req.body.user = user._id;
        if (req.files.image && req.files.image.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        if (req.files.images && req.files.images.length > 0) {
            req.body.imagenes = req.files.images.map((image) => {
                return `${process.env.API_URL}/api/uploads/${image.filename}`;
            });
        }

        const adoption = new Adoption({ ...req.body });
        createUserNotification(req.body.user, "Adopción creada", "Se ha creado tu adopción.", 'usuario/adoption/myAdoptions');
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

        console.log(adoptions);

        const parsedAdoptions = adoptions.map((adoption) => {
            return {
                id: adoption._id,
                nombre: adoption.nombre,
                raza: adoption.raza,
                imagen: adoption.imagen,
                fecha: new Date(adoption.createdAt).toLocaleDateString(),
                status: adoption.adopted ? 'adoptado' : 'por_adoptar',
                lugar: `${adoption.distrito}, ${adoption.departamento}`
            };
        });

        res.status(200).json(parsedAdoptions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.getAll = async (req, res) => {
    try {
        const { search } = req.query;

        const query = {
            deletedAt: null,
        };

        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');

            query.$or = [
                { nombre: regex },
                { raza: regex },
                { especie: regex },
                { tamano: regex },
                { sexo: regex },
                { ciudad: regex },
                { distrito: regex },
                { departamento: regex },
                { comentarios: regex },
            ];
        }

        const adoptions = await Adoption
            .find(query)
            .sort({ createdAt: -1 });

        res.status(200).json(adoptions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.getAllToAdopt = async (req, res) => {
    try {
        const { search } = req.query;

        const query = {
            deletedAt: null,
        };

        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');

            query.$or = [
                { nombre: regex },
                { raza: regex },
                { especie: regex },
                { tamano: regex },
                { sexo: regex },
                { ciudad: regex },
                { distrito: regex },
                { departamento: regex },
                { comentarios: regex },
            ];
        }

        const adoptions = await Adoption
            .find(query)
            .sort({ createdAt: -1 });

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

        const oldAdoption = await Adoption.findOne({ _id: req.params.id, deletedAt: null });
        if (!oldAdoption) return res.status(404).json({ message: 'Not found' });

        const oldImages = oldAdoption.imagenes || [];
        if (req.body.oldImages) {
            if (typeof req.body.oldImages === 'string') {
                req.body.oldImages = [req.body.oldImages];
            }

            // * Borar las imágenes que no están en el nuevo array
            const imagesToDelete = oldImages.filter(image => !req.body.oldImages.includes(image));
            if (imagesToDelete.length > 0) {
                // * Aquí podrías agregar la lógica para eliminar las imágenes del servidor
                console.log('Imágenes a eliminar:', imagesToDelete);
            }
            // * Actualizar las imágenes en el objeto de adopción
            req.body.imagenes = req.body.oldImages;
        }

        if (!req.body.oldImages) {
            req.body.imagenes = [];
        }
        if (req.files?.images?.length > 0) {
            req.files.images.forEach((image) => {
                req.body.imagenes = req.body.imagenes || [];
                req.body.imagenes.push(`${process.env.API_URL}/api/uploads/${image.filename}`);
            });
        }

        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );

        if (adoption.adopted) {
            await createSystemNotification({
                title: `${adoption.nombre} fue adoptado/a en Petnder!`,
                text: `Una mascota más ha sido adoptada en Petnder 🤗`,
            });
        }

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

// ─── PUBLIC: Reportar abuso ───────────────────────────────────────────────────

AdoptionController.reportAbuse = async (req, res) => {
    try {
        const { reason, description } = req.body;
        if (!reason) return res.status(400).json({ message: 'Motivo requerido' });

        let reportedBy = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                reportedBy = payload.id;
            }
        } catch (_) { /* anonymous report */ }

        const adoption = await Adoption.findOne({ _id: req.params.id, deletedAt: null });
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });

        const report = new AdoptionReport({ adoption: adoption._id, reportedBy, reason, description });
        await report.save();
        await Adoption.updateOne({ _id: adoption._id }, { $inc: { reportsCount: 1 } });

        res.status(201).json({ message: 'Reporte enviado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN METHODS ────────────────────────────────────────────────────────────

AdoptionController.adminGetAll = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, search, status, adopted, fraudFlag, zona } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = { deletedAt: null };
        if (status)   filter.status = status;
        if (zona)     filter.departamento = new RegExp(zona, 'i');
        if (adopted !== undefined && adopted !== '') filter.adopted = adopted === 'true';
        if (fraudFlag !== undefined && fraudFlag !== '') filter.fraudFlag = fraudFlag === 'true';

        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { nombre: regex }, { raza: regex }, { especie: regex },
                { ciudad: regex }, { distrito: regex }, { departamento: regex },
                { comentarios: regex },
            ];
        }

        const [adoptions, total] = await Promise.all([
            Adoption.find(filter)
                .populate('user', 'firstName lastName email image role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Adoption.countDocuments(filter),
        ]);

        res.status(200).json({ adoptions, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminGetById = async (req, res) => {
    try {
        await verifyAdmin(req);
        const adoption = await Adoption.findOne({ _id: req.params.id })
            .populate('user', 'firstName lastName email image phone role verified');
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        res.status(200).json(adoption);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminApprove = async (req, res) => {
    try {
        await verifyAdmin(req);
        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { status: 'approved' },
            { new: true }
        );
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        await createUserNotification(adoption.user, 'Publicacion aprobada', `Tu publicacion de ${adoption.nombre} fue aprobada.`, 'usuario/adoption/myAdoptions');
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.adminReject = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { reason } = req.body;
        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { status: 'rejected' },
            { new: true }
        );
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        await createUserNotification(
            adoption.user,
            'Publicacion rechazada',
            `Tu publicacion de ${adoption.nombre} fue rechazada.${reason ? ` Motivo: ${reason}` : ''}`,
            'usuario/adoption/myAdoptions'
        );
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.adminMarkAdopted = async (req, res) => {
    try {
        await verifyAdmin(req);
        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { adopted: true },
            { new: true }
        );
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        await createSystemNotification({
            title: `${adoption.nombre} fue adoptado/a en Petnder!`,
            text: `Una mascota mas ha encontrado hogar.`,
        });
        await createUserNotification(adoption.user, 'Mascota adoptada', `Se registro que ${adoption.nombre} fue adoptada.`, 'usuario/adoption/myAdoptions');
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.adminFlagFraud = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { fraudReason, flagged } = req.body;
        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { fraudFlag: flagged !== false, fraudReason: flagged !== false ? (fraudReason || null) : null },
            { new: true }
        );
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        if (flagged !== false) {
            await createUserNotification(adoption.user, 'Publicacion marcada como sospechosa', `Tu publicacion de ${adoption.nombre} fue marcada para revision.`, 'usuario/adoption/myAdoptions');
        }
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.adminDelete = async (req, res) => {
    try {
        await verifyAdmin(req);
        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!adoption) return res.status(404).json({ message: 'No encontrado' });
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminGetUserHistory = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { userId } = req.params;

        const [user, adoptions] = await Promise.all([
            User.findOne({ _id: userId }, 'firstName lastName email image role verified suspendedTo banned createdAt'),
            Adoption.find({ user: userId }).sort({ createdAt: -1 }),
        ]);

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const totalPublicaciones = adoptions.length;
        const adoptadas = adoptions.filter(a => a.adopted).length;
        const rechazadas = adoptions.filter(a => a.status === 'rejected').length;
        const fraudes = adoptions.filter(a => a.fraudFlag).length;
        const totalReportes = adoptions.reduce((acc, a) => acc + (a.reportsCount || 0), 0);

        let score = 100;
        score += Math.min(adoptadas * 10, 50);
        score -= fraudes * 30;
        score -= Math.min(totalReportes * 5, 40);
        score -= rechazadas * 5;
        score = Math.max(0, Math.min(100, score));

        const nivel = score >= 80 ? 'Confiable' : score >= 50 ? 'Regular' : 'Sospechoso';

        res.status(200).json({
            user,
            adoptions,
            reputation: { score, nivel, totalPublicaciones, adoptadas, rechazadas, fraudes, totalReportes },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminDetectFraud = async (req, res) => {
    try {
        await verifyAdmin(req);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Find adoptions with high report count
        const highReports = await Adoption.find({ deletedAt: null, reportsCount: { $gte: 2 } })
            .populate('user', 'firstName lastName email')
            .sort({ reportsCount: -1 })
            .limit(30);

        // Find users with multiple adoptions of same especie in last 30 days
        const recentAdoptions = await Adoption.aggregate([
            { $match: { deletedAt: null, createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { user: '$user', especie: '$especie' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
            { $match: { count: { $gte: 3 } } },
        ]);

        const duplicateUserIds = recentAdoptions.map(r => r._id.user);
        const suspiciousUsers = await User.find(
            { _id: { $in: duplicateUserIds } },
            'firstName lastName email'
        );

        res.status(200).json({ highReports, suspiciousPatterns: recentAdoptions, suspiciousUsers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminGetReports = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, status } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = status ? { status } : {};
        const [reports, total] = await Promise.all([
            AdoptionReport.find(filter)
                .populate('adoption', 'nombre especie imagen ciudad departamento status fraudFlag')
                .populate('reportedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            AdoptionReport.countDocuments(filter),
        ]);

        res.status(200).json({ reports, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.adminResolveReport = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { action } = req.body; // 'resolved' | 'dismissed'
        if (!['resolved', 'dismissed'].includes(action)) return res.status(400).json({ message: 'Accion invalida' });

        const report = await AdoptionReport.findOneAndUpdate(
            { _id: req.params.id },
            { status: action, resolvedAt: new Date(), resolvedBy: admin._id },
            { new: true }
        );
        if (!report) return res.status(404).json({ message: 'Reporte no encontrado' });
        res.status(200).json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export default AdoptionController;

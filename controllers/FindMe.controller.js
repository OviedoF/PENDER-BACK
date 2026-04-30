import FindMe from '../models/FindMe.js';
import User from '../models/User.js';
import ZoneConfig from '../models/ZoneConfig.js';
import GeoConfig from '../models/GeoConfig.js';
import AutomationConfig from '../models/AutomationConfig.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createSystemNotification from '../utils/createSystemNotification.js';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const sendRecoverySurvey = async (reporte) => {
    try {
        const autoConfig = await AutomationConfig.findOne({ key: 'global' });
        if (!autoConfig || !autoConfig.surveyEnabled) return;

        const message = autoConfig.surveyMessage.replace('{nombre}', reporte.nombre);
        const delay = (autoConfig.surveyDelayMinutes || 0) * 60 * 1000;

        setTimeout(async () => {
            try {
                await createUserNotification(
                    reporte.user,
                    '¿Cómo fue tu experiencia?',
                    message,
                    'usuario/foundeMe/myReports',
                    null
                );
            } catch (err) {
                console.error('Error enviando encuesta post-recuperación:', err.message);
            }
        }, delay);
    } catch (err) {
        console.error('Error en sendRecoverySurvey:', err.message);
    }
};

const calculateMatchScore = (report, candidate, geoConfig) => {
    let score = 0;
    const speciesW = geoConfig.matchingSpeciesWeight || 40;
    const breedW = geoConfig.matchingBreedWeight || 25;
    const locationW = geoConfig.matchingLocationWeight || 20;
    const sizeW = geoConfig.matchingSizeWeight || 15;

    if (report.especie && candidate.especie &&
        report.especie.toLowerCase() === candidate.especie.toLowerCase()) {
        score += speciesW;
    }

    if (report.raza && candidate.raza &&
        report.raza.toLowerCase() === candidate.raza.toLowerCase()) {
        score += breedW;
    } else if (!report.raza && !candidate.raza) {
        score += breedW * 0.5;
    }

    if (report.departamento && candidate.departamento &&
        report.departamento.toLowerCase() === candidate.departamento.toLowerCase()) {
        score += locationW * 0.5;
        if (report.ciudad && candidate.ciudad &&
            report.ciudad.toLowerCase() === candidate.ciudad.toLowerCase()) {
            score += locationW * 0.3;
            if (report.distrito && candidate.distrito &&
                report.distrito.toLowerCase() === candidate.distrito.toLowerCase()) {
                score += locationW * 0.2;
            }
        }
    }

    if (report.tamano && candidate.tamano &&
        report.tamano.toLowerCase() === candidate.tamano.toLowerCase()) {
        score += sizeW;
    }

    return Math.round(score);
};

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
    return user;
};

const FoundMeController = {};

FoundMeController.create = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    console.log(token);
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


    const foundMe = new FindMe({ ...req.body });
    await foundMe.save();

    // Matching automático con score ponderado
    try {
      const [geoConfig, autoConfig] = await Promise.all([
        GeoConfig.findOne({ key: 'global' }),
        AutomationConfig.findOne({ key: 'global' }),
      ]);

      const matchingEnabled = geoConfig?.matchingEnabled !== false;
      const notifyEnabled = autoConfig?.matchingNotifyEnabled !== false;

      if (matchingEnabled) {
        const opposingTipo = foundMe.tipo === 'reporte' ? 'busqueda' : 'reporte';
        const daysWindow = geoConfig?.matchingDaysWindow || 30;
        const minScore = geoConfig?.matchingMinScore || 60;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysWindow);

        const candidates = await FindMe.find({
          _id: { $ne: foundMe._id },
          deletedAt: null,
          finished: false,
          tipo: opposingTipo,
          createdAt: { $gte: cutoffDate },
        });

        const tipoLabel = foundMe.tipo === 'reporte' ? 'extraviada' : 'en búsqueda';
        const especieText = `${foundMe.especie}${foundMe.raza ? ' - ' + foundMe.raza : ''}`;
        const zonaText = `${foundMe.distrito}, ${foundMe.ciudad}`;

        const notifiedUsers = new Set();
        let matchCount = 0;

        for (const candidate of candidates) {
          const score = calculateMatchScore(foundMe, candidate, geoConfig || {});
          if (score < minScore) continue;
          matchCount++;

          const userId = candidate.user.toString();
          if (userId === user._id.toString()) continue;
          if (notifiedUsers.has(userId)) continue;
          notifiedUsers.add(userId);

          if (notifyEnabled) {
            const msgTemplate = autoConfig?.matchingMessage || 'Encontramos una posible coincidencia ({score}%) con tu reporte de {nombre}. ¡Revisala!';
            const message = msgTemplate
              .replace('{score}', String(score))
              .replace('{nombre}', candidate.nombre);

            await createUserNotification(
              candidate.user,
              `Posible coincidencia (${score}%)`,
              message,
              'usuario/foundeMe/lossPet',
              { id: foundMe._id.toString() }
            );
          }
        }

        if (matchCount > 0) {
          await createSystemNotification({
            title: `Mascota ${tipoLabel} en ${foundMe.departamento}`,
            text: `Se reportó ${foundMe.nombre} (${especieText}) en ${zonaText}. ${matchCount} coincidencia(s) encontrada(s), se notificó a ${notifiedUsers.size} usuario(s).`,
          });
        }
      }
    } catch (matchError) {
      console.error('Error en matching automático:', matchError.message);
    }

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

    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userObject = await User.findOne({ _id: payload.id });
    const user = userObject._id;

    let filter = {
      tipo,
      deletedAt: null,
      user,
    };

    // 🔎 SEARCH UNIFICADO
    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');

      filter.$or = [
        { nombre: regex },
        { raza: regex },
        { especie: regex },
        { tamano: regex },
        { sexo: regex },
        { ciudad: regex },
        { distrito: regex },
        { departamento: regex },
        { comentarios: regex },
        { tipo: regex },
      ];
    }

    const foundMe = await FindMe
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const parsedFoundMe = foundMe.map((foundMe) => ({
      id: foundMe._id,
      nombre: foundMe.nombre,
      raza: foundMe.raza,
      imagen: foundMe.imagen,
      locacion: `${foundMe.ciudad}, ${foundMe.distrito}`,
      fecha: new Date(foundMe.createdAt).toLocaleDateString(),
      finished: foundMe.finished,
    }));

    res.status(200).json(parsedFoundMe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

FoundMeController.getAll = async (req, res) => {
  try {
    const { tipo, page, search, species, sex, sizes } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {
      tipo,
      deletedAt: null,
    };

    // 🔎 SEARCH UNIFICADO
    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');

      filter.$or = [
        { nombre: regex },
        { raza: regex },
        { especie: regex },
        { tamano: regex },
        { sexo: regex },
        { ciudad: regex },
        { distrito: regex },
        { departamento: regex },
        { comentarios: regex },
        { tipo: regex },
      ];
    }

    // 🔹 Filtros existentes (NO se tocan)
    if (species) {
      const speciesArray = species.split(',').map(s => s.trim());
      filter.especie = { $in: speciesArray };
    }

    if (sex && sex !== 'null') {
      filter.sexo = sex.toLowerCase();
    }

    if (sizes) {
      const sizesArray = sizes.split(',').map(s => s.trim());
      filter.tamano = { $in: sizesArray };
    }

    const foundMe = await FindMe
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const parsedFoundMe = foundMe.map((foundMe) => ({
      id: foundMe._id,
      nombre: foundMe.nombre,
      raza: foundMe.raza,
      imagen: foundMe.imagen,
      locacion: `${foundMe.ciudad}, ${foundMe.distrito}`,
      encontrado: foundMe.finished,
      fecha: new Date(foundMe.createdAt).toLocaleDateString('es-ES'),
    }));

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

    const oldDoc = await FindMe.findOne({ _id: req.params.id, deletedAt: null });
    if (!oldDoc) return res.status(404).json({ message: 'Not found' });

    const oldImages = oldDoc.imagenes || [];
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

    const foundMe = await FindMe.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      req.body,
      { new: true }
    );

    if (foundMe.finished) {
      await createSystemNotification({
        title: `${foundMe.nombre} fue encontrado/a!`,
        text: `Nos alegra comunicar que ha vuelto con su dueño!`,
      });
      sendRecoverySurvey(foundMe);
    }

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

// ─── ADMIN METHODS ────────────────────────────────────────────────────────────

FoundMeController.adminGetAll = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, search, tipo, estado, zona, fechaDesde, fechaHasta } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = { deletedAt: null };

        if (tipo) filter.tipo = tipo;
        if (zona) filter.departamento = new RegExp(zona, 'i');
        if (estado === 'activa') filter.finished = false;
        if (estado === 'resuelta') filter.finished = true;

        if (fechaDesde || fechaHasta) {
            filter.createdAt = {};
            if (fechaDesde) filter.createdAt.$gte = new Date(fechaDesde);
            if (fechaHasta) {
                const end = new Date(fechaHasta);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { nombre: regex },
                { raza: regex },
                { especie: regex },
                { ciudad: regex },
                { distrito: regex },
                { departamento: regex },
                { nombreResponsable: regex },
                { telefono: regex },
                { comentarios: regex },
            ];
        }

        const [reportes, total] = await Promise.all([
            FindMe.find(filter)
                .populate('user', 'firstName lastName email image role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            FindMe.countDocuments(filter),
        ]);

        res.status(200).json({
            reportes,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminGetById = async (req, res) => {
    try {
        await verifyAdmin(req);
        const reporte = await FindMe.findOne({ _id: req.params.id })
            .populate('user', 'firstName lastName email image role');
        if (!reporte) return res.status(404).json({ message: 'No encontrado' });
        res.status(200).json(reporte);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminUpdateStatus = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { encontrado, finished } = req.body;
        const reporte = await FindMe.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { encontrado, finished },
            { new: true }
        );
        if (!reporte) return res.status(404).json({ message: 'No encontrado' });

        if (finished) {
            await createSystemNotification({
                title: `${reporte.nombre} fue recuperado/a!`,
                text: `Nos alegra comunicar que la mascota ha vuelto con su dueno.`,
                specificUser: reporte.user,
            });
            sendRecoverySurvey(reporte);
        }

        res.status(200).json(reporte);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

FoundMeController.adminDelete = async (req, res) => {
    try {
        await verifyAdmin(req);
        const reporte = await FindMe.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!reporte) return res.status(404).json({ message: 'No encontrado' });
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminMerge = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { survivorId, duplicateId } = req.body;
        if (!survivorId || !duplicateId) return res.status(400).json({ message: 'Faltan IDs' });
        if (survivorId === duplicateId) return res.status(400).json({ message: 'El reporte principal y el duplicado no pueden ser el mismo' });

        const survivor = await FindMe.findOne({ _id: survivorId, deletedAt: null });
        if (!survivor) return res.status(404).json({ message: 'Reporte principal no encontrado' });

        const duplicate = await FindMe.findOneAndUpdate(
            { _id: duplicateId, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!duplicate) return res.status(404).json({ message: 'Reporte duplicado no encontrado' });

        res.status(200).json({ message: 'Reportes fusionados correctamente', survivor });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminGetMatches = async (req, res) => {
    try {
        await verifyAdmin(req);
        const reporte = await FindMe.findOne({ _id: req.params.id, deletedAt: null });
        if (!reporte) return res.status(404).json({ message: 'No encontrado' });

        const opposingTipo = reporte.tipo === 'reporte' ? 'busqueda' : 'reporte';
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const matches = await FindMe.find({
            _id: { $ne: reporte._id },
            deletedAt: null,
            finished: false,
            tipo: opposingTipo,
            especie: new RegExp(reporte.especie, 'i'),
            departamento: new RegExp(reporte.departamento, 'i'),
            createdAt: { $gte: thirtyDaysAgo },
        })
            .populate('user', 'firstName lastName email')
            .limit(10);

        res.status(200).json({ matches, reporte });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminSendNotification = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { title, text, specificUser } = req.body;
        if (!title || !text) return res.status(400).json({ message: 'Titulo y texto requeridos' });

        await createSystemNotification({ title, text, specificUser: specificUser || null });
        res.status(200).json({ message: 'Notificacion enviada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminGetZoneConfigs = async (req, res) => {
    try {
        await verifyAdmin(req);
        const configs = await ZoneConfig.find().sort({ zona: 1 });
        res.status(200).json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

FoundMeController.adminUpsertZoneConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { zona, radio, activo } = req.body;
        if (!zona || radio === undefined) return res.status(400).json({ message: 'Zona y radio requeridos' });

        const config = await ZoneConfig.findOneAndUpdate(
            { zona },
            { zona, radio, activo: activo ?? true },
            { upsert: true, new: true }
        );
        res.status(200).json(config);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

FoundMeController.adminSendZoneNotification = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { zona, title, text } = req.body;
        if (!zona || !title || !text) return res.status(400).json({ message: 'Zona, titulo y texto requeridos' });

        const zoneConfig = await ZoneConfig.findOne({ zona, activo: true });
        if (!zoneConfig) return res.status(404).json({ message: 'Zona no encontrada o inactiva' });

        const activeReports = await FindMe.find({
            deletedAt: null,
            finished: false,
            departamento: new RegExp(`^${zona}$`, 'i'),
        });

        const notifiedUsers = new Set();
        for (const report of activeReports) {
            const userId = report.user.toString();
            if (notifiedUsers.has(userId)) continue;
            notifiedUsers.add(userId);

            await createUserNotification(
                report.user,
                title,
                text,
                'usuario/foundeMe/myReports',
                null
            );
        }

        res.status(200).json({
            message: `Notificacion enviada a ${notifiedUsers.size} usuario(s) con reportes activos en ${zona}`,
            notified: notifiedUsers.size,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default FoundMeController;

import GeoConfig from '../models/GeoConfig.js';
import Service from '../models/Service.js';
import FindMe from '../models/FindMe.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG_KEY = 'global';

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
    return user;
};

const GeoController = {};

GeoController.getConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        let config = await GeoConfig.findOne({ key: CONFIG_KEY });
        if (!config) {
            config = await GeoConfig.create({ key: CONFIG_KEY });
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

GeoController.updateConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        const {
            notificationRadiusKm, notificationEnabled,
            proximityEnabled, proximityMaxDistanceKm, proximityWeight,
            matchingEnabled, matchingRadiusKm, matchingMinScore,
            matchingSpeciesWeight, matchingBreedWeight, matchingLocationWeight, matchingSizeWeight,
            matchingAutoNotify, matchingDaysWindow,
        } = req.body;

        const update = {};
        if (notificationRadiusKm !== undefined) update.notificationRadiusKm = notificationRadiusKm;
        if (notificationEnabled !== undefined) update.notificationEnabled = notificationEnabled;
        if (proximityEnabled !== undefined) update.proximityEnabled = proximityEnabled;
        if (proximityMaxDistanceKm !== undefined) update.proximityMaxDistanceKm = proximityMaxDistanceKm;
        if (proximityWeight !== undefined) update.proximityWeight = proximityWeight;
        if (matchingEnabled !== undefined) update.matchingEnabled = matchingEnabled;
        if (matchingRadiusKm !== undefined) update.matchingRadiusKm = matchingRadiusKm;
        if (matchingMinScore !== undefined) update.matchingMinScore = matchingMinScore;
        if (matchingSpeciesWeight !== undefined) update.matchingSpeciesWeight = matchingSpeciesWeight;
        if (matchingBreedWeight !== undefined) update.matchingBreedWeight = matchingBreedWeight;
        if (matchingLocationWeight !== undefined) update.matchingLocationWeight = matchingLocationWeight;
        if (matchingSizeWeight !== undefined) update.matchingSizeWeight = matchingSizeWeight;
        if (matchingAutoNotify !== undefined) update.matchingAutoNotify = matchingAutoNotify;
        if (matchingDaysWindow !== undefined) update.matchingDaysWindow = matchingDaysWindow;

        const config = await GeoConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            update,
            { upsert: true, new: true }
        );
        res.status(200).json(config);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

GeoController.getMapData = async (req, res) => {
    try {
        await verifyAdmin(req);

        const [empresas, extraviadas, encontradas] = await Promise.all([
            Service.find({
                deletedAt: null,
                latitude: { $exists: true, $ne: null },
                longitude: { $exists: true, $ne: null },
            }).populate('user', 'firstName lastName commercialName image').select(
                'nombre categoria distrito ciudad departamento latitude longitude imagen user'
            ).limit(500),

            FindMe.find({
                deletedAt: null,
                finished: false,
                tipo: 'reporte',
            }).select(
                'nombre especie raza imagen distrito ciudad departamento createdAt'
            ).sort({ createdAt: -1 }).limit(200),

            FindMe.find({
                deletedAt: null,
                finished: false,
                tipo: 'busqueda',
            }).select(
                'nombre especie raza imagen distrito ciudad departamento createdAt'
            ).sort({ createdAt: -1 }).limit(200),
        ]);

        res.status(200).json({ empresas, extraviadas, encontradas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

GeoController.getStats = async (req, res) => {
    try {
        await verifyAdmin(req);

        const [
            totalEmpresas,
            empresasConGeo,
            totalExtraviadas,
            totalEncontradas,
        ] = await Promise.all([
            Service.countDocuments({ deletedAt: null }),
            Service.countDocuments({
                deletedAt: null,
                latitude: { $exists: true, $ne: null },
                longitude: { $exists: true, $ne: null },
            }),
            FindMe.countDocuments({ deletedAt: null, finished: false, tipo: 'reporte' }),
            FindMe.countDocuments({ deletedAt: null, finished: false, tipo: 'busqueda' }),
        ]);

        const topZonas = await FindMe.aggregate([
            { $match: { deletedAt: null, finished: false } },
            { $group: { _id: '$departamento', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        res.status(200).json({
            totalEmpresas,
            empresasConGeo,
            empresasSinGeo: totalEmpresas - empresasConGeo,
            totalExtraviadas,
            totalEncontradas,
            topZonas,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default GeoController;

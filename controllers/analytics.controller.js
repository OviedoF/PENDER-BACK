import User from '../models/User.js';
import Adoption from '../models/Adoption.js';
import FindMe from '../models/FindMe.js';
import Service from '../models/Service.js';
import Category from '../models/Category.js';

const analyticsController = {};

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── 1. Tiempo promedio en app + Sesiones por usuario ─────────────────────────

analyticsController.getSessionMetrics = async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [globalResult] = await User.aggregate([
      { $unwind: '$times' },
      { $group: {
        _id: null,
        totalSeconds: { $sum: '$times.seconds' },
        totalSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$_id' },
      }},
      { $project: {
        totalSeconds: 1,
        totalSessions: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
      }},
    ]);

    const [last30Result] = await User.aggregate([
      { $unwind: '$times' },
      { $match: { 'times.date': { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: null,
        totalSeconds: { $sum: '$times.seconds' },
        totalSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$_id' },
      }},
      { $project: {
        totalSeconds: 1,
        totalSessions: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
      }},
    ]);

    const [last7Result] = await User.aggregate([
      { $unwind: '$times' },
      { $match: { 'times.date': { $gte: sevenDaysAgo } } },
      { $group: {
        _id: null,
        totalSeconds: { $sum: '$times.seconds' },
        totalSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$_id' },
      }},
      { $project: {
        totalSeconds: 1,
        totalSessions: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
      }},
    ]);

    const dailyAvg = await User.aggregate([
      { $unwind: '$times' },
      { $match: { 'times.date': { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$times.date' } },
        avgSeconds: { $avg: '$times.seconds' },
        sessions: { $sum: 1 },
        users: { $addToSet: '$_id' },
      }},
      { $project: {
        _id: 0,
        date: '$_id',
        avgMinutes: { $round: [{ $divide: ['$avgSeconds', 60] }, 1] },
        sessions: 1,
        users: { $size: '$users' },
      }},
      { $sort: { date: 1 } },
    ]);

    const calc = (r) => ({
      avgMinutes: r && r.uniqueUsers > 0 ? Math.round((r.totalSeconds / r.uniqueUsers / 60) * 10) / 10 : 0,
      sessionsPerUser: r && r.uniqueUsers > 0 ? Math.round((r.totalSessions / r.uniqueUsers) * 10) / 10 : 0,
      totalSessions: r?.totalSessions ?? 0,
      activeUsers: r?.uniqueUsers ?? 0,
    });

    res.json({
      global: calc(globalResult),
      last30: calc(last30Result),
      last7: calc(last7Result),
      daily: dailyAvg,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 2. Retención por cohortes ────────────────────────────────────────────────

analyticsController.getCohortRetention = async (_req, res) => {
  try {
    const cohorts = [];

    for (let m = 5; m >= 0; m--) {
      const cohortStart = monthsAgo(m);
      const cohortEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 1, 0, 23, 59, 59, 999);

      const cohortUsers = await User.find({
        createdAt: { $gte: cohortStart, $lte: cohortEnd },
        deletedAt: null,
      }).select('_id times createdAt').lean();

      const cohortSize = cohortUsers.length;
      if (cohortSize === 0) {
        cohorts.push({
          month: cohortStart.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          cohortSize: 0,
          retention: [],
        });
        continue;
      }

      const retention = [];
      for (let w = 0; w < 6 - m; w++) {
        const weekStart = new Date(cohortStart.getTime() + w * 7 * 86400000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

        let activeCount = 0;
        for (const user of cohortUsers) {
          const hasSession = (user.times ?? []).some(
            t => t.date >= weekStart && t.date < weekEnd
          );
          if (hasSession) activeCount++;
        }

        retention.push(Math.round((activeCount / cohortSize) * 100));
      }

      cohorts.push({
        month: cohortStart.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        cohortSize,
        retention,
      });
    }

    res.json({ cohorts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 3. Top categorías ───────────────────────────────────────────────────────

analyticsController.getTopCategories = async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const categories = await Service.aggregate([
      { $match: { deletedAt: null } },
      { $group: {
        _id: '$categoria',
        totalServices: { $sum: 1 },
        totalViews: { $sum: '$vistas' },
        avgScore: { $avg: '$score' },
      }},
      { $sort: { totalViews: -1 } },
    ]);

    const viewsThisMonth = await Service.aggregate([
      { $match: { deletedAt: null } },
      { $unwind: '$views' },
      { $match: { 'views.createdAt': { $gte: startOfMonth } } },
      { $group: { _id: '$categoria', monthViews: { $sum: 1 } } },
    ]);

    const monthViewsMap = Object.fromEntries(viewsThisMonth.map(v => [v._id, v.monthViews]));

    const dbCategories = await Category.find({ deletedAt: null }).select('title').lean();
    const categoryNames = dbCategories.map(c => c.title);

    const result = categories.map(c => ({
      name: c._id,
      services: c.totalServices,
      totalViews: c.totalViews,
      monthViews: monthViewsMap[c._id] ?? 0,
      avgScore: Math.round((c.avgScore ?? 0) * 10) / 10,
      isRegistered: categoryNames.some(cn => cn.toLowerCase() === (c._id ?? '').toLowerCase()),
    }));

    res.json({ categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 4. Empresas con mejor rendimiento ───────────────────────────────────────

analyticsController.getTopEnterprises = async (_req, res) => {
  try {
    const enterpriseFilter = {
      deletedAt: null,
      $or: [
        { ruc: { $exists: true, $ne: null, $gt: '' } },
        { commercialName: { $exists: true, $ne: null, $gt: '' } },
      ],
    };

    const enterprises = await User.find(enterpriseFilter)
      .select('commercialName email city department suscription featured score')
      .lean();

    const enterpriseIds = enterprises.map(e => e._id);

    const serviceStats = await Service.aggregate([
      { $match: { user: { $in: enterpriseIds }, deletedAt: null } },
      { $group: {
        _id: '$user',
        totalServices: { $sum: 1 },
        totalViews: { $sum: '$vistas' },
        avgScore: { $avg: '$score' },
      }},
    ]);

    const statsMap = Object.fromEntries(serviceStats.map(s => [s._id.toString(), s]));

    const ranked = enterprises.map(e => {
      const stats = statsMap[e._id.toString()] ?? { totalServices: 0, totalViews: 0, avgScore: 0 };
      return {
        _id: e._id,
        name: e.commercialName ?? e.email,
        city: e.city,
        department: e.department,
        suscription: e.suscription,
        featured: e.featured,
        services: stats.totalServices,
        views: stats.totalViews,
        avgScore: Math.round((stats.avgScore ?? 0) * 10) / 10,
        performanceScore: stats.totalViews + (stats.avgScore ?? 0) * 10 + stats.totalServices * 5,
      };
    });

    ranked.sort((a, b) => b.performanceScore - a.performanceScore);

    res.json({ enterprises: ranked.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 5. Zonas con más actividad ──────────────────────────────────────────────

analyticsController.getZoneActivity = async (_req, res) => {
  try {
    const [serviceZones, adoptionZones, findMeZones] = await Promise.all([
      Service.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$departamento', services: { $sum: 1 }, views: { $sum: '$vistas' } } },
      ]),
      Adoption.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$departamento', adoptions: { $sum: 1 }, adopted: { $sum: { $cond: ['$adopted', 1, 0] } } } },
      ]),
      FindMe.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$departamento', reports: { $sum: 1 }, found: { $sum: { $cond: ['$finished', 1, 0] } } } },
      ]),
    ]);

    const zonesMap = {};
    const merge = (arr, fields) => {
      for (const item of arr) {
        const zone = item._id ?? 'Sin zona';
        if (!zonesMap[zone]) zonesMap[zone] = { zone, services: 0, views: 0, adoptions: 0, adopted: 0, reports: 0, found: 0 };
        for (const [k, v] of Object.entries(fields(item))) zonesMap[zone][k] = v;
      }
    };

    merge(serviceZones, i => ({ services: i.services, views: i.views }));
    merge(adoptionZones, i => ({ adoptions: i.adoptions, adopted: i.adopted }));
    merge(findMeZones, i => ({ reports: i.reports, found: i.found }));

    const zones = Object.values(zonesMap)
      .map(z => ({ ...z, activityScore: z.views + z.adoptions * 5 + z.reports * 3 }))
      .sort((a, b) => b.activityScore - a.activityScore);

    res.json({ zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 6. Embudo de adopción ───────────────────────────────────────────────────

analyticsController.getAdoptionFunnel = async (_req, res) => {
  try {
    const active = { deletedAt: null };

    const [total, approved, withImages, adopted] = await Promise.all([
      Adoption.countDocuments(active),
      Adoption.countDocuments({ ...active, status: 'approved' }),
      Adoption.countDocuments({ ...active, status: 'approved', $or: [{ imagen: { $exists: true, $ne: '' } }, { imagenes: { $exists: true, $ne: [] } }] }),
      Adoption.countDocuments({ ...active, adopted: true }),
    ]);

    const monthlyAdoptions = await Adoption.aggregate([
      { $match: { ...active, adopted: true } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: -1 } },
      { $limit: 6 },
    ]);

    const speciesBreakdown = await Adoption.aggregate([
      { $match: active },
      { $group: {
        _id: '$especie',
        total: { $sum: 1 },
        adopted: { $sum: { $cond: ['$adopted', 1, 0] } },
      }},
      { $sort: { total: -1 } },
      { $limit: 6 },
    ]);

    res.json({
      funnel: [
        { step: 'Publicadas', value: total },
        { step: 'Aprobadas', value: approved },
        { step: 'Con fotos', value: withImages },
        { step: 'Adoptadas', value: adopted },
      ],
      conversionRate: total > 0 ? Math.round((adopted / total) * 1000) / 10 : 0,
      monthly: monthlyAdoptions.reverse().map(m => ({
        month: m._id,
        adoptions: m.count,
      })),
      bySpecies: speciesBreakdown.map(s => ({
        species: s._id,
        total: s.total,
        adopted: s.adopted,
        rate: s.total > 0 ? Math.round((s.adopted / s.total) * 1000) / 10 : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── 7. Embudo de recuperación de mascotas ───────────────────────────────────

analyticsController.getFindMeFunnel = async (_req, res) => {
  try {
    const active = { deletedAt: null };

    const [totalReports, totalSearches, found, finished] = await Promise.all([
      FindMe.countDocuments({ ...active, tipo: 'reporte' }),
      FindMe.countDocuments({ ...active, tipo: 'busqueda' }),
      FindMe.countDocuments({ ...active, encontrado: true }),
      FindMe.countDocuments({ ...active, finished: true }),
    ]);

    const total = totalReports + totalSearches;

    const monthlyRecovery = await FindMe.aggregate([
      { $match: { ...active, finished: true } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: -1 } },
      { $limit: 6 },
    ]);

    const byZone = await FindMe.aggregate([
      { $match: active },
      { $group: {
        _id: '$departamento',
        total: { $sum: 1 },
        found: { $sum: { $cond: ['$finished', 1, 0] } },
      }},
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]);

    const avgRecoveryTime = await FindMe.aggregate([
      { $match: { ...active, finished: true } },
      { $project: {
        daysDiff: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 86400000] },
      }},
      { $group: { _id: null, avgDays: { $avg: '$daysDiff' } } },
    ]);

    res.json({
      funnel: [
        { step: 'Reportes', value: totalReports },
        { step: 'Busquedas', value: totalSearches },
        { step: 'Encontrados', value: found },
        { step: 'Finalizados', value: finished },
      ],
      total,
      recoveryRate: total > 0 ? Math.round((finished / total) * 1000) / 10 : 0,
      avgRecoveryDays: Math.round((avgRecoveryTime[0]?.avgDays ?? 0) * 10) / 10,
      monthly: monthlyRecovery.reverse().map(m => ({
        month: m._id,
        recovered: m.count,
      })),
      byZone: byZone.map(z => ({
        zone: z._id ?? 'Sin zona',
        total: z.total,
        found: z.found,
        rate: z.total > 0 ? Math.round((z.found / z.total) * 1000) / 10 : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default analyticsController;

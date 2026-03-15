import User from '../models/User.js';
import Adoption from '../models/Adoption.js';
import FindMe from '../models/FindMe.js';
import Forum from '../models/Forum.js';
import Community from '../models/Community.js';
import SuscriptionChange from '../models/SuscriptionChange.js';
import CouponCode from '../models/PremiumCouponCodes.js';
import Service from '../models/Service.js';
import SystemNotification from '../models/SystemNotification.js';

const statsController = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDateRanges() {
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    return { now, startOfToday, startOfWeek, startOfMonth, startOfPrevMonth, endOfPrevMonth };
}

function calcChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

statsController.getKPIs = async (req, res) => {
    try {
        const {
            startOfToday,
            startOfWeek,
            startOfMonth,
            startOfPrevMonth,
            endOfPrevMonth,
        } = getDateRanges();

        const activeFilter    = { deletedAt: null };
        const thisMonthFilter = { createdAt: { $gte: startOfMonth } };
        const prevMonthFilter = { createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } };

        const empresaFilter = { ...activeFilter, ruc: { $exists: true, $ne: null }, commercialName: { $exists: true, $ne: null } };
        const cuponesUsadosFilter = { deletedAt: null, status: { $in: ['pending', 'approved'] } };

        const [
            // 1. Usuarios registrados
            totalUsuarios,
            usuariosHoy,
            usuariosSemana,
            usuariosMes,
            usuariosMesAnterior,

            // 2. Empresas activas
            totalEmpresas,
            empresasPremium,
            empresasFree,
            empresasMes,
            empresasMesAnterior,

            // 3. Mascotas en adopción
            totalAdopciones,
            adoptadasEsteMes,
            adopcionesMes,
            adopcionesMesAnterior,

            // 4. Publicaciones activas (foros + comunidades)
            totalForos,
            totalComunidades,
            forosMes,
            forosMesAnterior,
            comunidadesMes,
            comunidadesMesAnterior,

            // 5. Mascotas extraviadas
            totalExtraviadas,
            extraviadasMes,
            extraviadasMesAnterior,

            // 6. Matches exitosos (FindMe finished)
            totalMatches,
            matchesMes,
            matchesMesAnterior,

            // 7. Conversión free → premium
            totalConversiones,
            conversionesMes,
            conversionesMesAnterior,

            // 8. Cupones redimidos
            totalCuponesUsados,
            cuponesUsadosMes,
            cuponesUsadosMesAnterior,
        ] = await Promise.all([
            // 1. Usuarios
            User.countDocuments({ ...activeFilter }),
            User.countDocuments({ ...activeFilter, createdAt: { $gte: startOfToday } }),
            User.countDocuments({ ...activeFilter, createdAt: { $gte: startOfWeek } }),
            User.countDocuments({ ...activeFilter, ...thisMonthFilter }),
            User.countDocuments({ ...activeFilter, ...prevMonthFilter }),

            // 2. Empresas
            User.countDocuments({ ...empresaFilter }),
            User.countDocuments({ ...empresaFilter, suscription: { $in: ['basic', 'pro'] } }),
            User.countDocuments({ ...empresaFilter, suscription: 'free' }),
            User.countDocuments({ ...empresaFilter, ...thisMonthFilter }),
            User.countDocuments({ ...empresaFilter, ...prevMonthFilter }),

            // 3. Adopciones
            Adoption.countDocuments({ ...activeFilter }),
            Adoption.countDocuments({ adopted: true, updatedAt: { $gte: startOfMonth } }),
            Adoption.countDocuments({ ...activeFilter, ...thisMonthFilter }),
            Adoption.countDocuments({ ...activeFilter, ...prevMonthFilter }),

            // 4. Foros y comunidades
            Forum.countDocuments({ ...activeFilter }),
            Community.countDocuments({ ...activeFilter }),
            Forum.countDocuments({ ...activeFilter, ...thisMonthFilter }),
            Forum.countDocuments({ ...activeFilter, ...prevMonthFilter }),
            Community.countDocuments({ ...activeFilter, ...thisMonthFilter }),
            Community.countDocuments({ ...activeFilter, ...prevMonthFilter }),

            // 5. Mascotas extraviadas
            FindMe.countDocuments({ ...activeFilter }),
            FindMe.countDocuments({ ...activeFilter, ...thisMonthFilter }),
            FindMe.countDocuments({ ...activeFilter, ...prevMonthFilter }),

            // 6. Matches exitosos
            FindMe.countDocuments({ finished: true }),
            FindMe.countDocuments({ finished: true, updatedAt: { $gte: startOfMonth } }),
            FindMe.countDocuments({ finished: true, updatedAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } }),

            // 7. Conversiones free → premium (registradas en SuscriptionChange)
            SuscriptionChange.countDocuments({ to: { $ne: 'free' } }),
            SuscriptionChange.countDocuments({ to: { $ne: 'free' }, createdAt: { $gte: startOfMonth } }),
            SuscriptionChange.countDocuments({ to: { $ne: 'free' }, createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } }),

            // 8. Cupones redimidos
            CouponCode.countDocuments({ ...cuponesUsadosFilter }),
            CouponCode.countDocuments({ ...cuponesUsadosFilter, updatedAt: { $gte: startOfMonth } }),
            CouponCode.countDocuments({ ...cuponesUsadosFilter, updatedAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } }),
        ]);

        // Tasa de conversión del mes (sobre total de usuarios activos)
        const tasaConversion = totalUsuarios > 0
            ? Math.round((conversionesMes / totalUsuarios) * 100)
            : 0;

        res.status(200).json({
            usuarios: {
                total: totalUsuarios,
                hoy: usuariosHoy,
                semana: usuariosSemana,
                mes: usuariosMes,
                cambio: calcChange(usuariosMes, usuariosMesAnterior),
            },
            empresas: {
                total: totalEmpresas,
                premium: empresasPremium,
                free: empresasFree,
                mes: empresasMes,
                cambio: calcChange(empresasMes, empresasMesAnterior),
            },
            adopciones: {
                total: totalAdopciones,
                adoptadasEsteMes,
                mes: adopcionesMes,
                cambio: calcChange(adopcionesMes, adopcionesMesAnterior),
            },
            publicaciones: {
                total: totalForos + totalComunidades,
                foros: totalForos,
                comunidades: totalComunidades,
                mes: forosMes + comunidadesMes,
                cambio: calcChange(forosMes + comunidadesMes, forosMesAnterior + comunidadesMesAnterior),
            },
            extraviadas: {
                total: totalExtraviadas,
                mes: extraviadasMes,
                cambio: calcChange(extraviadasMes, extraviadasMesAnterior),
            },
            matchesExitosos: {
                total: totalMatches,
                mes: matchesMes,
                cambio: calcChange(matchesMes, matchesMesAnterior),
            },
            conversiones: {
                total: totalConversiones,
                mes: conversionesMes,
                tasaConversion,
                cambio: calcChange(conversionesMes, conversionesMesAnterior),
            },
            cuponesRedimidos: {
                total: totalCuponesUsados,
                mes: cuponesUsadosMes,
                cambio: calcChange(cuponesUsadosMes, cuponesUsadosMesAnterior),
            },
            ingresosMensuales: {
                total: 0,
                anual: 0,
                cambio: 0,
            },
            reportesPendientes: {
                total: 0,
                urgentes: 0,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Crecimiento mensual + Retención semanal ─────────────────────────────────

statsController.getGrowth = async (req, res) => {
    try {
        const now = new Date();

        // ── Últimos 6 meses ──────────────────────────────────────────────────
        const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const usuariosFilter  = { deletedAt: null, ruc: null, commercialName: null };
        const empresasFilter  = { deletedAt: null, ruc: { $ne: null }, commercialName: { $ne: null } };

        const monthlyGrowth = [];
        for (let i = 5; i >= 0; i--) {
            const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            const [usuarios, empresas, mascotas] = await Promise.all([
                User.countDocuments({ ...usuariosFilter, createdAt: { $gte: start, $lte: end } }),
                User.countDocuments({ ...empresasFilter, createdAt: { $gte: start, $lte: end } }),
                Adoption.countDocuments({ deletedAt: null, createdAt: { $gte: start, $lte: end } }),
            ]);

            monthlyGrowth.push({ name: MONTH_NAMES[d.getMonth()], usuarios, empresas, mascotas });
        }

        // ── Retención últimas 8 semanas ──────────────────────────────────────
        const currentMonday = new Date(now);
        const dayOfWeek = now.getDay();
        currentMonday.setDate(now.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
        currentMonday.setHours(0, 0, 0, 0);

        const weekAverages = [];
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(currentMonday);
            weekStart.setDate(currentMonday.getDate() - i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const [result] = await User.aggregate([
                { $unwind: '$times' },
                { $match: { 'times.date': { $gte: weekStart, $lte: weekEnd } } },
                { $group: { _id: null, totalSeconds: { $sum: '$times.seconds' }, count: { $sum: 1 } } },
            ]);

            const avgSeconds = result ? result.totalSeconds / result.count : 0;
            weekAverages.push(avgSeconds);
        }

        const maxAvg = Math.max(...weekAverages, 1);
        const weeklyRetention = weekAverages.map((avgSeconds, i) => ({
            name:      `Sem ${i + 1}`,
            retencion: Math.round((avgSeconds / maxAvg) * 100),
            minutos:   Math.round((avgSeconds / 60) * 10) / 10,
        }));

        res.status(200).json({ monthlyGrowth, weeklyRetention });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Registrar sesión ────────────────────────────────────────────────────────

statsController.recordSession = async (req, res) => {
    try {
        const { seconds } = req.body;

        if (typeof seconds !== 'number' || seconds <= 0) {
            return res.status(400).json({ error: 'seconds debe ser un número positivo' });
        }

        await User.findByIdAndUpdate(req.user.id, {
            $push: { times: { date: new Date(), seconds: Math.round(seconds) } },
        });

        res.status(200).json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Embudo de conversión + Actividad por categoría + Reportes por zona ──────

const FUNNEL_COLORS = ['#FF6B6B', '#FF8E72', '#FFB088', '#FFC4A3'];

const CATEGORY_RULES = [
    { label: 'Veterinarias', keywords: ['veterinar'] },
    { label: 'Restaurantes', keywords: ['restauran', 'comida', 'gastronom', 'cafeter'] },
    { label: 'Tiendas',      keywords: ['tienda', 'petshop', 'mascot', 'accesor', 'store'] },
    { label: 'Hoteles',      keywords: ['hotel', 'hosped', 'alojam', 'pension'] },
];

function bucketCategory(catRaw) {
    const cat = (catRaw ?? '').toLowerCase();
    for (const { label, keywords } of CATEGORY_RULES) {
        if (keywords.some(kw => cat.includes(kw))) return label;
    }
    return 'Otros';
}

statsController.getCharts = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── Embudo de conversión ─────────────────────────────────────────────
        const [visitasResult, registros, cuponesActivos, premium] = await Promise.all([
            Service.aggregate([
                { $match: { deletedAt: null } },
                { $unwind: '$views' },
                { $match: { 'views.createdAt': { $gte: startOfMonth } } },
                { $count: 'total' },
            ]),
            User.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth } }),
            CouponCode.countDocuments({ deletedAt: null, status: { $in: ['pending', 'approved'] } }),
            User.countDocuments({ deletedAt: null, suscription: { $in: ['basic', 'pro'] } }),
        ]);

        const funnel = [
            { name: 'Visitas',         value: visitasResult[0]?.total ?? 0, fill: FUNNEL_COLORS[0] },
            { name: 'Registros',       value: registros,                    fill: FUNNEL_COLORS[1] },
            { name: 'Cupones activos', value: cuponesActivos,               fill: FUNNEL_COLORS[2] },
            { name: 'Premium',         value: premium,                      fill: FUNNEL_COLORS[3] },
        ];

        // ── Actividad por categoría ──────────────────────────────────────────
        const rawCatViews = await Service.aggregate([
            { $match: { deletedAt: null } },
            { $unwind: '$views' },
            { $match: { 'views.createdAt': { $gte: startOfMonth } } },
            { $group: { _id: '$categoria', visitas: { $sum: 1 } } },
        ]);

        const catTotals = { Veterinarias: 0, Restaurantes: 0, Tiendas: 0, Hoteles: 0, Otros: 0 };
        for (const entry of rawCatViews) {
            catTotals[bucketCategory(entry._id)] += entry.visitas;
        }
        const categoryActivity = Object.entries(catTotals).map(([name, value]) => ({ name, value }));

        // ── Reportes por zona ────────────────────────────────────────────────
        const zoneGroups = await FindMe.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: '$departamento', reportes: { $sum: 1 } } },
            { $sort: { reportes: -1 } },
        ]);

        const allZones = zoneGroups.map(z => ({ zona: z._id ?? 'Sin zona', reportes: z.reportes }));
        const topZones = allZones.slice(0, 6).map((z, i) => ({
            ...z,
            lat: i < 2 ? 'Alta' : i < 4 ? 'Media' : 'Baja',
        }));
        const totalReportes = allZones.reduce((sum, z) => sum + z.reportes, 0);

        res.status(200).json({ funnel, categoryActivity, topZones, allZones, totalReportes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Detalle de FindMe por zona ───────────────────────────────────────────────

statsController.getZoneReports = async (req, res) => {
    try {
        const { zona } = req.query;
        if (!zona) return res.status(400).json({ error: 'zona es requerida' });

        const reports = await FindMe.find({ departamento: zona, deletedAt: null })
            .select('nombre especie raza tipo ciudad distrito sexo edad edadUnidad createdAt')
            .sort({ createdAt: -1 })
            .limit(100);

        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Actividad reciente (últimas system notifications) ────────────────────────

statsController.getRecentActivity = async (req, res) => {
    try {
        const activity = await SystemNotification
            .find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .select('title text link specificUser createdAt')
            .lean();

        res.status(200).json(activity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default statsController;

// ─── (eliminado: seed solo-frontend) ─────────────────────────────────────────
/*
statsController.seedDemoData = async (req, res) => {
    try {
        const now      = new Date();
        const PREFIX   = `demo_${Date.now()}_`;

        const rnd    = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const rndN   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const uid    = () => new mongoose.Types.ObjectId();
        const pastTs = (monthsAgo) => {
            const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, rndN(1, 25));
            d.setHours(rndN(8, 22), rndN(0, 59), 0, 0);
            return d;
        };

        const DEPTS    = ['Lima', 'Arequipa', 'Cusco', 'La Libertad', 'Piura', 'Lambayeque', 'Junín', 'Tacna', 'Puno', 'Ica'];
        const DISTRITS = ['Miraflores', 'San Isidro', 'Surco', 'Barranco', 'Lince', 'Chorrillos', 'San Borja', 'La Molina'];
        const CITIES   = ['Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Piura'];
        const SPECIES  = ['Perro', 'Gato', 'Conejo', 'Loro'];
        const BREEDS   = ['Labrador', 'Beagle', 'Poodle', 'Mestizo', 'Siamés', 'Persa', 'Bulldog'];
        const PNAMES   = ['Max', 'Luna', 'Rocky', 'Bella', 'Toby', 'Coco', 'Bruno', 'Nala', 'Simba', 'Mia'];
        const FNAMES   = ['Ana', 'Carlos', 'María', 'José', 'Lucía', 'Diego', 'Sofía', 'Pedro', 'Camila', 'Andrés'];
        const LNAMES   = ['García', 'López', 'Martínez', 'Rodríguez', 'Pérez', 'Torres', 'Flores', 'Castro'];
        const BRANDS   = ['VetPet', 'PetLove', 'AnimalCare', 'PawCare', 'PetHotel', 'FurFriend'];
        const CATS     = ['Veterinaria', 'Restaurante Pet Friendly', 'Tienda Mascotas', 'Hotel para Mascotas', 'Accesorios'];

        const fakeRef  = uid();
        const demoHash = await bcryptjs.hash('demo123', 10);

        // 1. Usuarios regulares
        const regularUsers = [];
        for (let m = 5; m >= 0; m--) {
            for (let i = 0; i < rndN(3, 6); i++) {
                const fn = rnd(FNAMES), ln = rnd(LNAMES), ts = `${PREFIX}${m}_${i}`;
                regularUsers.push({
                    username: `${ts}`, email: `${ts}@petnder.demo`,
                    password: demoHash, phone: `9${rndN(10000000, 99999999)}`,
                    firstName: fn, lastName: ln, role: 'user',
                    suscription: rnd(['free', 'free', 'basic', 'pro']),
                    createdAt: pastTs(m), updatedAt: pastTs(m),
                });
            }
        }

        // 2. Empresas
        const enterprises = [];
        for (let m = 5; m >= 0; m--) {
            for (let i = 0; i < rndN(1, 3); i++) {
                const brand = rnd(BRANDS), ts = `${PREFIX}ent_${m}_${i}`;
                enterprises.push({
                    username: ts, email: `${ts}@petnder.demo`,
                    password: demoHash, phone: `9${rndN(10000000, 99999999)}`,
                    firstName: brand, lastName: 'SAC',
                    ruc: `${rndN(10000000000, 20000000000)}`,
                    commercialName: `${brand} ${rnd(['Pet Center', 'Store', 'Clinic', 'Hotel'])}`,
                    role: 'enterprise', suscription: rnd(['free', 'basic', 'pro']),
                    city: rnd(CITIES), district: rnd(DISTRITS), department: rnd(DEPTS),
                    createdAt: pastTs(m), updatedAt: pastTs(m),
                });
            }
        }

        await User.collection.insertMany([...regularUsers, ...enterprises], { ordered: false });

        // 3. Adopciones
        const adoptions = [];
        for (let m = 5; m >= 0; m--) {
            for (let i = 0; i < rndN(2, 6); i++) {
                const ts = pastTs(m);
                adoptions.push({
                    nombre: rnd(PNAMES), ciudad: rnd(CITIES), distrito: rnd(DISTRITS),
                    departamento: rnd(DEPTS), especie: rnd(SPECIES), raza: rnd(BREEDS),
                    user: fakeRef, tamano: rnd(['Pequeño', 'Mediano', 'Grande']),
                    sexo: rnd(['macho', 'hembra']), edad: rndN(1, 8),
                    edadUnidad: rnd(['Meses', 'Años']), imagen: '',
                    deletedAt: null, adopted: Math.random() > 0.7,
                    createdAt: ts, updatedAt: ts,
                });
            }
        }
        await Adoption.collection.insertMany(adoptions, { ordered: false });

        // 4. FindMe (distribuidos por departamento)
        const findMes = [];
        for (let i = 0; i < 45; i++) {
            const ts = pastTs(rndN(0, 5));
            findMes.push({
                distrito: rnd(DISTRITS), departamento: rnd(DEPTS), ciudad: rnd(CITIES),
                nombre: rnd(PNAMES), nombreResponsable: `${rnd(FNAMES)} ${rnd(LNAMES)}`,
                telefono: `9${rndN(10000000, 99999999)}`,
                tipo: rnd(['reporte', 'busqueda']), especie: rnd(SPECIES), raza: rnd(BREEDS),
                tamano: rnd(['Pequeño', 'Mediano', 'Grande']), sexo: rnd(['macho', 'hembra']),
                edad: rndN(1, 10), edadUnidad: rnd(['Meses', 'Años']),
                comentarios: 'Dato de demostración', imagen: '', imagenes: [],
                deletedAt: null, encontrado: Math.random() > 0.5, finished: Math.random() > 0.6,
                user: fakeRef, createdAt: ts, updatedAt: ts,
            });
        }
        await FindMe.collection.insertMany(findMes, { ordered: false });

        // 5. Servicios con vistas distribuidas por mes
        const services = [];
        for (let i = 0; i < 14; i++) {
            const views = [];
            for (let m = 5; m >= 0; m--) {
                for (let v = 0; v < rndN(4, 25); v++) {
                    views.push({ user: uid(), createdAt: pastTs(m) });
                }
            }
            services.push({
                nombre: `${rnd(BRANDS)} Demo ${i + 1}`,
                ciudad: rnd(CITIES), distrito: rnd(DISTRITS), departamento: rnd(DEPTS),
                telefono: `9${rndN(10000000, 99999999)}`, categoria: rnd(CATS),
                etiquetas: [], detalle: 'Servicio de demostración.', imagen: '', imagenes: [],
                oculto: false, vistas: views.length, views,
                user: fakeRef, score: rndN(0, 100), deletedAt: null,
                ruc: `${rndN(10000000000, 20000000000)}`, times: '', timesObject: {},
            });
        }
        await Service.collection.insertMany(services, { ordered: false });

        // 6. Notificaciones del sistema (actividad reciente)
        const notifTemplates = [
            { title: 'Nuevo usuario registrado',       text: 'Ana García se unió a Petnder',          link: 'usuario/home'    },
            { title: 'Nueva empresa registrada',       text: 'VetPet Clinic creó su perfil',           link: 'empresa/home'    },
            { title: 'Mascota reportada como encontrada', text: 'Max fue encontrado en Lima',           link: 'usuario/foundMe' },
            { title: 'Nueva adopción publicada',       text: 'Luna busca un hogar en Miraflores',      link: 'usuario/adoption'},
            { title: 'Pago premium recibido',          text: 'Carlos López actualizó a Pro',           link: 'empresa/wallet'  },
            { title: 'Cupón redimido',                 text: 'Cupón PETNDER20 fue usado',              link: 'empresa/coupons' },
            { title: 'Mascota perdida reportada',      text: 'Bruno desapareció en Surco',             link: 'usuario/foundMe' },
            { title: 'Empresa aprobada',               text: 'AnimalCare Clinic fue verificada',       link: 'empresa/home'    },
            { title: 'Match exitoso',                  text: 'Toby fue reunido con su dueño',          link: 'usuario/foundMe' },
            { title: 'Suscripción actualizada',        text: 'PetHotel pasó de Free a Basic',          link: 'empresa/wallet'  },
            { title: 'Nuevo usuario registrado',       text: 'Sofía Pérez se unió a Petnder',          link: 'usuario/home'    },
            { title: 'Nueva adopción publicada',       text: 'Coco necesita un hogar nuevo',           link: 'usuario/adoption'},
            { title: 'Nueva empresa registrada',       text: 'PawCare Store abrió su perfil',          link: 'empresa/home'    },
            { title: 'Pago recibido',                  text: 'María Torres realizó un pago',           link: 'empresa/wallet'  },
            { title: 'Mascota perdida reportada',      text: 'Bella desapareció en Cusco',             link: 'usuario/foundMe' },
        ];
        const sysNotifs = notifTemplates.map((n, i) => ({
            title: n.title, text: n.text, link: n.link,
            readedBy: [], specificUser: null, paramsStringify: null,
            createdAt: new Date(now.getTime() - i * 7 * 60 * 1000),
            updatedAt: new Date(now.getTime() - i * 7 * 60 * 1000),
        }));
        await SystemNotification.collection.insertMany(sysNotifs, { ordered: false });

        // 7. Cambios de suscripción
        const subChanges = [];
        for (let m = 2; m >= 0; m--) {
            for (let i = 0; i < rndN(2, 4); i++) {
                const ts = pastTs(m);
                subChanges.push({ user: fakeRef, from: 'free', to: rnd(['basic', 'pro']), createdAt: ts, updatedAt: ts });
            }
        }
        await SuscriptionChange.collection.insertMany(subChanges, { ordered: false });

        // 8. Cupón codes
        const couponCodes = [];
        for (let i = 0; i < 18; i++) {
            const ts = pastTs(rndN(0, 2));
            couponCodes.push({
                code: `DEMO${rndN(1000, 9999)}`, coupon: uid(), user: fakeRef,
                status: rnd(['created', 'pending', 'approved', 'approved', 'approved']),
                amount: rndN(10, 100), deletedAt: null, createdAt: ts, updatedAt: ts,
            });
        }
        await CouponCode.collection.insertMany(couponCodes, { ordered: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
*/

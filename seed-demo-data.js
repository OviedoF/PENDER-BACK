// Datos demo para poblar una base recién reseteada. Uso: node seed-demo-data.js
// Crea usuarios, empresas, servicios, cupones, banners, adopciones,
// encuéntrame, foros y comunidades de muestra.
// Idempotente: si ya existe usuario@test.com no vuelve a crear nada.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Adoption from './models/Adoption.js';
import FindMe from './models/FindMe.js';
import Service from './models/Service.js';
import Banner from './models/Banner.js';
import Forum from './models/Forum.js';
import Community from './models/Community.js';
import { Cupon } from './models/Coupon.js';
dotenv.config();

const img = (seed, w = 600, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a', process.env.MONGO_URI);

    if (await User.findOne({ email: 'usuario@test.com' })) {
        console.log('Los datos demo ya existen (usuario@test.com). No se creó nada.');
        await mongoose.disconnect();
        return;
    }

    // ── Usuarios (save() para que el pre-save hashee la contraseña) ──────────
    const usuario1 = await new User({
        username: 'MariaTest', email: 'usuario@test.com', password: 'test123',
        firstName: 'Maria', lastName: 'Prueba', phone: '999111222',
        birthdate: new Date('1995-05-10'), verified: true,
        department: 'Lima', city: 'Lima', district: 'Miraflores',
        latitude: -12.1211, longitude: -77.0297,
    }).save();

    const usuario2 = await new User({
        username: 'JuanTest', email: 'usuario2@test.com', password: 'test123',
        firstName: 'Juan', lastName: 'Prueba', phone: '999333444',
        birthdate: new Date('1990-09-20'), verified: true,
        department: 'Lima', city: 'Lima', district: 'San Isidro',
        latitude: -12.0976, longitude: -77.0365,
    }).save();

    const empresaPro = await new User({
        username: 'CafePatitas', email: 'empresa@test.com', password: 'test123',
        firstName: 'Cafe', lastName: 'Patitas', phone: '999555666', role: 'enterprise',
        suscription: 'pro', verified: true, enterpriseActive: true,
        ruc: '20123456789', socialReason: 'Café Patitas S.A.C.',
        commercialName: 'Café Patitas',
        department: 'Lima', city: 'Lima', district: 'Miraflores',
        principalActivity: 'Cafetería pet-friendly',
        description: 'Empresa demo con plan PRO.',
    }).save();

    const empresaFree = await new User({
        username: 'TimboPets', email: 'empresa2@test.com', password: 'test123',
        firstName: 'Timbo', lastName: 'Pets', phone: '999777888', role: 'enterprise',
        suscription: 'free', verified: true, enterpriseActive: true,
        ruc: '20987654321', socialReason: 'Timbo Pets E.I.R.L.',
        commercialName: 'Timbo Pets',
        department: 'Lima', city: 'Lima', district: 'Barranco',
        principalActivity: 'Tienda de mascotas',
        description: 'Empresa demo con plan free y cupón propio.',
    }).save();

    console.log('Usuarios: usuario@test.com, usuario2@test.com, empresa@test.com (PRO), empresa2@test.com (free) — contraseña test123');

    // ── Servicios ─────────────────────────────────────────────────────────────
    const [cafePatitas, groomingDeluxe, timbo, vetSanBlas] = await Service.insertMany([
        {
            nombre: 'Café Patitas', categoria: 'Café y restaurantes',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            direccion: 'Av. Larco 345', telefono: '999555666',
            detalle: 'Café pet-friendly con menú especial para mascotas. (demo)',
            imagen: img('cafe'), imagenes: [img('cafe'), img('cafe2')],
            etiquetas: ['pet-friendly', 'café'], score: 4.8,
            user: empresaPro._id, ruc: empresaPro.ruc,
            latitude: -12.1215, longitude: -77.0292,
        },
        {
            nombre: 'Grooming Deluxe', categoria: 'Grooming',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            direccion: 'Calle Los Pinos 120', telefono: '999555666',
            detalle: 'Baño y corte para perros y gatos. (demo)',
            imagen: img('grooming'), imagenes: [img('grooming')],
            etiquetas: ['baño', 'corte'], score: 4.5,
            user: empresaPro._id, ruc: empresaPro.ruc,
            latitude: -12.0970, longitude: -77.0360,
        },
        {
            nombre: 'Timbo Pets', categoria: 'Tiendas',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Barranco',
            direccion: 'Av. Grau 810', telefono: '999777888',
            detalle: 'Alimentos, accesorios y juguetes. (demo)',
            imagen: img('timbo'), imagenes: [img('timbo')],
            etiquetas: ['tienda', 'accesorios'], score: 4.2,
            user: empresaFree._id, ruc: empresaFree.ruc,
            petnderBenefit: false,
            latitude: -12.1405, longitude: -77.0210,
        },
        {
            nombre: 'Veterinaria San Blas', categoria: 'Salud y clínica',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Surco',
            direccion: 'Av. Benavides 2250', telefono: '999777888',
            detalle: 'Consultas, vacunas y emergencias 24h. (demo)',
            imagen: img('vet'), imagenes: [img('vet')],
            etiquetas: ['veterinaria', 'salud'], score: 3.9,
            user: empresaFree._id, ruc: empresaFree.ruc,
            petnderBenefit: false,
            latitude: -12.1290, longitude: -76.9870,
        },
    ]);
    console.log('Servicios: Café Patitas y Grooming Deluxe (premium PRO), Timbo Pets (con cupón propio), Veterinaria San Blas (regular)');

    // ── Cupones ───────────────────────────────────────────────────────────────
    await Cupon.insertMany([
        {
            nombre: 'Descuento Timbo', codigo: 'TIMBO20',
            tipoDescuento: 'Porcentaje', valorDescuento: '20',
            service: timbo._id,
            fechaInicio: new Date(), fechaExpiracion: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        },
        {
            nombre: 'Bienvenida Petnder', codigo: 'PETNDER10',
            tipoDescuento: 'Porcentaje', valorDescuento: '10',
            global: true,
            fechaInicio: new Date(), fechaExpiracion: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        },
    ]);
    console.log('Cupones: TIMBO20 (servicio Timbo Pets), PETNDER10 (global)');

    // ── Banners ───────────────────────────────────────────────────────────────
    await Banner.insertMany([
        { title: 'Beneficios pet-friendly', image: img('banner-home', 1200, 600), section: 'home', order: 0, duration: 4 },
        { title: 'Suma puntos con tu mascota', image: img('banner-home2', 1200, 600), section: 'home', order: 1, duration: 4 },
        { title: 'Adoptá con responsabilidad', image: img('banner-adop', 1200, 600), section: 'adopcion', order: 0, duration: 4 },
        { title: 'Reportá una mascota perdida', image: img('banner-find', 1200, 600), section: 'encuentrame', order: 0, duration: 4 },
    ]);
    console.log('Banners: 2 home, 1 adopción, 1 encuéntrame');

    // ── Adopciones ────────────────────────────────────────────────────────────
    await Adoption.insertMany([
        {
            nombre: 'Max', especie: 'Perro', raza: 'Labrador', sexo: 'macho',
            edad: 2, edadUnidad: 'Años', tamano: 'Grande',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            comentarios: 'Muy juguetón, ideal para familias. (demo)',
            imagen: img('max'), imagenes: [img('max'), img('max2')],
            user: usuario1._id, status: 'approved',
        },
        {
            nombre: 'Luna', especie: 'Gato', raza: 'Siames', sexo: 'hembra',
            edad: 8, edadUnidad: 'Meses', tamano: 'Pequeño',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            comentarios: 'Tranquila y cariñosa. (demo)',
            imagen: img('luna'), imagenes: [img('luna')],
            user: usuario2._id, status: 'approved',
        },
    ]);
    console.log('Adopciones: Max y Luna (aprobadas)');

    // ── Encuéntrame ───────────────────────────────────────────────────────────
    await FindMe.insertMany([
        {
            tipo: 'busqueda', nombre: 'Rocky', especie: 'Perro', raza: 'Beagle',
            sexo: 'macho', edad: 3, edadUnidad: 'Años', tamano: 'Mediano',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            nombreResponsable: 'Maria Prueba', telefono: '999111222',
            comentarios: 'Se perdió en el parque Kennedy. (demo)',
            imagen: img('rocky'), latitude: -12.1219, longitude: -77.0301,
            user: usuario1._id,
        },
        {
            tipo: 'reporte', nombre: 'Desconocido', especie: 'Perro', raza: 'Beagle',
            sexo: 'macho', edad: 3, edadUnidad: 'Años', tamano: 'Mediano',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            nombreResponsable: 'Juan Prueba', telefono: '999333444',
            comentarios: 'Encontré este perrito cerca del Olivar. (demo)',
            imagen: img('rocky2'), latitude: -12.0980, longitude: -77.0370,
            user: usuario2._id,
        },
    ]);
    console.log('Encuéntrame: búsqueda de Rocky y reporte de encontrado (deberían matchear)');

    // ── Foros ─────────────────────────────────────────────────────────────────
    await Forum.insertMany([
        {
            titulo: '¿Qué alimento recomiendan para cachorros?',
            categorias: ['Alimentación'], etiquetas: ['cachorros', 'alimento'],
            descripcion: 'Adopté un labrador de 3 meses y quiero arrancar bien con su dieta. (demo)',
            imagen: img('foro1', 800, 500), user: usuario1._id,
            likes: [usuario2._id], featured: true,
        },
        {
            titulo: 'Parques pet-friendly en Lima',
            categorias: ['Paseos'], etiquetas: ['parques', 'lima'],
            descripcion: 'Armemos una lista de parques donde se pueda ir con perros sueltos. (demo)',
            imagen: img('foro2', 800, 500), user: usuario2._id,
        },
    ]);
    console.log('Foros: 2 (uno destacado)');

    // ── Comunidades ───────────────────────────────────────────────────────────
    await Community.insertMany([
        {
            nombre: 'Perros de Miraflores', privacidad: 'publica', visibilidad: 'visible',
            resena: 'Comunidad de dueños de perros de Miraflores. Paseos grupales todos los sábados. (demo)',
            imagen: img('comu1', 800, 500), owner: usuario1._id,
            members: [usuario1._id, usuario2._id], featured: true,
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
        },
        {
            nombre: 'Gatos de Lima', privacidad: 'publica', visibilidad: 'visible',
            resena: 'Todo sobre gatos: salud, adopciones y anécdotas. (demo)',
            imagen: img('comu2', 800, 500), owner: usuario2._id,
            members: [usuario2._id],
            departamento: 'Lima', ciudad: 'Lima',
        },
    ]);
    console.log('Comunidades: 2 (una destacada)');

    await mongoose.disconnect();
    console.log('✅ Seed demo completo.');
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });

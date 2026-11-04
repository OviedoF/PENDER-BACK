// Datos de prueba para desarrollo local. Uso: node seed-test-data.js
// Crea usuarios, adopciones, reportes de encuéntrame y servicios de prueba.
// Es idempotente: si ya existe usuario@test.com no vuelve a crear nada.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Adoption from './models/Adoption.js';
import FindMe from './models/FindMe.js';
import Service from './models/Service.js';
dotenv.config();

const petImg = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a', process.env.MONGO_URI);

    if (await User.findOne({ email: 'usuario@test.com' })) {
        console.log('Los datos de prueba ya existen (usuario@test.com). No se creó nada.');
        console.log('Para regenerarlos, borrá antes los usuarios *@test.com y sus publicaciones.');
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

    const empresa = await new User({
        username: 'PetShopTest', email: 'empresa@test.com', password: 'test123',
        firstName: 'Pet', lastName: 'Shop', phone: '999555666', role: 'enterprise',
        suscription: 'pro', verified: true, enterpriseActive: true,
        ruc: '20123456789', socialReason: 'Pet Shop Test S.A.C.',
        commercialName: 'Pet Shop Test',
        department: 'Lima', city: 'Lima', district: 'Miraflores',
        principalActivity: 'Venta de productos para mascotas',
        description: 'Empresa de prueba para desarrollo local.',
    }).save();

    console.log('Usuarios creados: usuario@test.com, usuario2@test.com, empresa@test.com (contraseña: test123)');

    // ── Adopciones ────────────────────────────────────────────────────────────
    await Adoption.insertMany([
        {
            nombre: 'Max', especie: 'Perro', raza: 'Labrador', sexo: 'macho',
            edad: 2, edadUnidad: 'Años', tamano: 'Grande',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            comentarios: 'Muy juguetón, ideal para familias. (dato de prueba)',
            imagen: petImg('max'), imagenes: [petImg('max'), petImg('max2')],
            user: usuario1._id, status: 'approved',
        },
        {
            nombre: 'Luna', especie: 'Gato', raza: 'Siames', sexo: 'hembra',
            edad: 8, edadUnidad: 'Meses', tamano: 'Pequeño',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            comentarios: 'Tranquila y cariñosa. (dato de prueba)',
            imagen: petImg('luna'), imagenes: [petImg('luna')],
            user: usuario2._id, status: 'pending',
        },
    ]);
    console.log('Adopciones creadas: Max (aprobada, de Maria), Luna (pendiente, de Juan)');

    // ── Encuéntrame: una búsqueda (perdida) y un reporte (encontrada) ─────────
    await FindMe.insertMany([
        {
            tipo: 'busqueda', nombre: 'Rocky', especie: 'Perro', raza: 'Beagle',
            sexo: 'macho', edad: 3, edadUnidad: 'Años', tamano: 'Mediano',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            nombreResponsable: 'Maria Prueba', telefono: '999111222',
            comentarios: 'Se perdió en el parque Kennedy. (dato de prueba)',
            imagen: petImg('rocky'), latitude: -12.1219, longitude: -77.0301,
            user: usuario1._id,
        },
        {
            tipo: 'reporte', nombre: 'Desconocido', especie: 'Perro', raza: 'Beagle',
            sexo: 'macho', edad: 3, edadUnidad: 'Años', tamano: 'Mediano',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            nombreResponsable: 'Juan Prueba', telefono: '999333444',
            comentarios: 'Encontré este perrito cerca del Olivar. (dato de prueba)',
            imagen: petImg('rocky2'), latitude: -12.0980, longitude: -77.0370,
            user: usuario2._id,
        },
    ]);
    console.log('Encuéntrame creados: búsqueda de Rocky (Maria) y reporte de encontrado (Juan) — deberían matchear');

    // ── Servicios de la empresa ───────────────────────────────────────────────
    await Service.insertMany([
        {
            nombre: 'Café Patitas', categoria: 'Café y restaurantes',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'Miraflores',
            direccion: 'Av. Larco 345', telefono: '999555666',
            detalle: 'Café pet-friendly con menú para mascotas. (dato de prueba)',
            imagen: petImg('cafe'), etiquetas: ['pet-friendly', 'café'],
            user: empresa._id, ruc: empresa.ruc,
            latitude: -12.1215, longitude: -77.0292,
        },
        {
            nombre: 'Grooming Deluxe', categoria: 'Grooming',
            departamento: 'Lima', ciudad: 'Lima', distrito: 'San Isidro',
            direccion: 'Calle Los Pinos 120', telefono: '999555666',
            detalle: 'Baño y corte para perros y gatos. (dato de prueba)',
            imagen: petImg('grooming'), etiquetas: ['baño', 'corte'],
            user: empresa._id, ruc: empresa.ruc,
            latitude: -12.0970, longitude: -77.0360,
        },
    ]);
    console.log('Servicios creados: Café Patitas y Grooming Deluxe (de empresa@test.com)');

    await mongoose.disconnect();
    console.log('✅ Base de prueba lista.');
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });

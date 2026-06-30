import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import Category from './models/Category.js';
import User from './models/User.js';
import AdminRole from './models/AdminRole.js';
dotenv.config();

async function seedAdmin() {
  try {
    // Datos del administrador desde las variables de entorno
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrador';

    if (!adminEmail || !adminPassword) {
      console.error('Faltan las variables ADMIN_EMAIL o ADMIN_PASSWORD en el archivo .env');
      return;
    }

    // Busca si el administrador ya existe
    const existingAdmin = await User.findOne({ role: 'admin' });
    const existingAprobation = await User.findOne({ role: 'aprobation' });

    if (existingAdmin) {
      console.log('El administrador ya existe. No se realizaron cambios.');
      return;
    }
    

    // Crea el administrador con contraseña encriptada
    await new User({ email: adminEmail, password: adminPassword, username: adminName, role: 'admin', phone: "1111", dni: "1111", genre: "Masculino", birthdate: "11/11/1111",
      firstName: "admin", lastName: "admin"
     }).save();

    console.log('Administrador creado exitosamente.');
  } catch (error) {
    console.error('Error al crear el administrador:', error.message);
  }
}

async function seedAprobator() {
  try {
    const aprobatorEmail = process.env.APROBATOR_EMAIL;
    const aprobatorPassword = process.env.APROBATOR_PASSWORD;
    const aprobatorName = process.env.APROBATOR_NAME || 'Aprobador';

    if (!aprobatorEmail || !aprobatorPassword) {
      console.error('Faltan las variables APROBATOR_EMAIL o APROBATOR_PASSWORD en el archivo .env');
      return;
    }

    // Busca si el aprobador ya existe
    const existingAprobator = await User.findOne({ role: 'aprobation' });

    if (existingAprobator) {
      console.log('El aprobador ya existe. No se realizaron cambios.');
      return;
    }

    // Crea el aprobador con contraseña encriptada
    await new User({ email: aprobatorEmail, password: aprobatorPassword, username: aprobatorName, firstName: "ap", lastName: "ap", role: 'aprobation', phone: "1111", dni: "1111", genre: "Masculino", birthdate: "11/11/1111" }).save();

    console.log('Aprobador creado exitosamente.');
  } catch (error) {
    console.error('Error al crear el aprobador:', error.message);
  }
}

async function seedCategories() {
  try {
    const existingCategories = await Category.find();
    if (existingCategories.length > 0) {
      console.log('Las categorías ya existen. No se realizaron cambios.');
      return;
    }

    const benefitCards = [
      {
        title: "Café y restaurantes",
        description: "Encuentra beneficios exclusivos en cafeterías y restaurantes para ti y tu mascota.",
        image: `${process.env.API_URL}/api/images/service/cafe.jpg`,
      },
      {
        title: "Salud y clínica",
        description: "Descuentos y convenios con clínicas veterinarias y servicios de salud animal.",
        image: `${process.env.API_URL}/api/images/service/salud.jpg`,
      },
      {
        title: "Grooming",
        description: "Servicios de estética y peluquería para mantener a tu mascota impecable.",
        image: `${process.env.API_URL}/api/images/service/grooming.jpg`,
      },
      {
        title: "Adiestrador y paseador",
        description: "Profesionales certificados para el cuidado y entrenamiento de tu mascota.",
        image: `${process.env.API_URL}/api/images/service/paseador.jpg`,
      },
      {
        title: "Tiendas",
        description: "Descubre las mejores tiendas de productos y accesorios para tu mascota.",
        image: `${process.env.API_URL}/api/images/service/tiendas.jpg`,
      },
      {
        title: "Guardería y hospedaje",
        description: "Lugares seguros y confiables donde tu mascota puede quedarse cuando no estás.",
        image: `${process.env.API_URL}/api/images/service/guarderia.jpg`,
      },
      {
        title: "Albergues y fundaciones",
        description: "Organizaciones dedicadas al rescate y adopción de mascotas necesitadas.",
        image: `${process.env.API_URL}/api/images/service/albergues.jpg`,
      },
    ];

    for (const categoryData of benefitCards) {
      const category = new Category(categoryData);
      await category.save();
    }
    console.log('✅ Categorías creadas exitosamente.');
  } catch (error) {
    console.error('❌ Error al crear las categorías:', error.message);
  }
}

async function seedAdminRoles() {
  try {
    const existing = await AdminRole.countDocuments();
    if (existing > 0) {
      console.log('Los roles de admin ya existen. No se realizaron cambios.');
      return;
    }

    const allManage = {
      dashboard: 'manage', usuarios: 'manage', empresas: 'manage',
      mascotas: 'manage', adopciones: 'manage', comunidad: 'manage',
      cupones: 'manage', suscripciones: 'manage', pagos: 'manage',
      seguridad: 'manage', geolocalizacion: 'manage',
      automatizaciones: 'manage', configuracion: 'manage', adminUsuarios: 'manage',
    };

    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Acceso total a todas las funcionalidades del panel',
        isDefault: true,
        permissions: allManage,
      },
      {
        name: 'Admin Operativo',
        description: 'Gestión operativa diaria sin acceso a configuración ni roles',
        isDefault: true,
        permissions: {
          dashboard: 'view', usuarios: 'manage', empresas: 'manage',
          mascotas: 'manage', adopciones: 'manage', comunidad: 'manage',
          cupones: 'manage', suscripciones: 'view', pagos: 'view',
          seguridad: 'view', geolocalizacion: 'view',
          automatizaciones: 'none', configuracion: 'none', adminUsuarios: 'none',
        },
      },
      {
        name: 'Moderador',
        description: 'Moderación de contenido, comunidad y reportes de seguridad',
        isDefault: true,
        permissions: {
          dashboard: 'view', usuarios: 'view', empresas: 'view',
          mascotas: 'view', adopciones: 'view', comunidad: 'manage',
          cupones: 'none', suscripciones: 'none', pagos: 'none',
          seguridad: 'manage', geolocalizacion: 'none',
          automatizaciones: 'none', configuracion: 'none', adminUsuarios: 'none',
        },
      },
      {
        name: 'Marketing',
        description: 'Gestión de cupones, comunidad y contenido promocional',
        isDefault: true,
        permissions: {
          dashboard: 'view', usuarios: 'view', empresas: 'view',
          mascotas: 'view', adopciones: 'none', comunidad: 'manage',
          cupones: 'manage', suscripciones: 'view', pagos: 'none',
          seguridad: 'none', geolocalizacion: 'none',
          automatizaciones: 'view', configuracion: 'none', adminUsuarios: 'none',
        },
      },
      {
        name: 'Finanzas',
        description: 'Gestión de pagos, suscripciones y métricas financieras',
        isDefault: true,
        permissions: {
          dashboard: 'view', usuarios: 'view', empresas: 'view',
          mascotas: 'none', adopciones: 'none', comunidad: 'none',
          cupones: 'view', suscripciones: 'manage', pagos: 'manage',
          seguridad: 'none', geolocalizacion: 'none',
          automatizaciones: 'none', configuracion: 'none', adminUsuarios: 'none',
        },
      },
      {
        name: 'Soporte',
        description: 'Atención a usuarios y empresas, gestión de reportes',
        isDefault: true,
        permissions: {
          dashboard: 'view', usuarios: 'view', empresas: 'view',
          mascotas: 'view', adopciones: 'view', comunidad: 'view',
          cupones: 'none', suscripciones: 'view', pagos: 'none',
          seguridad: 'manage', geolocalizacion: 'view',
          automatizaciones: 'none', configuracion: 'none', adminUsuarios: 'none',
        },
      },
    ];

    await AdminRole.insertMany(defaultRoles);
    console.log('✅ Roles de admin creados exitosamente.');
  } catch (error) {
    console.error('❌ Error al crear los roles de admin:', error.message);
  }
}

const seeds = async () => {
  await seedAdmin();
  await seedAprobator();
  await seedCategories();
  await seedAdminRoles();
};

export default seeds;
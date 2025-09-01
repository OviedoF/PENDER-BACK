import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from './models/User.js';
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
    await new User({ email: adminEmail, password: adminPassword, username: adminName, role: 'admin', phone: "1111", dni: "1111", genre: "Masculino", birthdate: "11/11/1111" }).save();

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

const seeds = async () => {
  await seedAdmin();
  await seedAprobator();
};

export default seeds;
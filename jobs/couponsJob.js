import { Cupon } from '../models/Coupon.js'
import createUserNotification from '../utils/createUserNotification.js';

const couponsJob = (agenda) => {
  agenda.define('coupons_test', async () => {
    try {
      console.log('Iniciando job de cupones programados...');
      const now = new Date();
      console.log('Hora actual:', now);
      const utc = now.getTime() + now.getTimezoneOffset() * 60000; // tiempo en UTC
      const offsetPeru = -5; // UTC-5
      // const peruTime = new Date(utc + 3600000 * offsetPeru);;

      const cupones = await Cupon.find({
        oculto: false,
        activarProgramacion: true,
        fechaPublicacion: { $lte: now },
      }).sort({ createdAt: -1 });
      console.log(`Cupones encontrados: ${cupones}`);

      const completedCuponesDates = cupones.map((cupon) => {
        const fechaPublicacion = new Date(cupon.fechaPublicacion).toISOString();
        const horaPublicacion = new Date(cupon.horaPublicacion).toISOString();
        console.log(`Cupon ID: ${cupon._id}, Fecha Publicacion: ${fechaPublicacion}, Hora Publicacion: ${horaPublicacion}`);

        return {
          id: cupon._id,
          fechaPublicacion: fechaPublicacion.split('T')[0] + 'T' + horaPublicacion.split('T')[1],
        };
      });

      for (const cupon of completedCuponesDates) {
        if (cupon.fechaPublicacion <= now.toISOString()) {
          const cuponToUpdate = await Cupon.findById(cupon.id).populate("service");
          if (cuponToUpdate) {
            cuponToUpdate.oculto = false;
            cuponToUpdate.activarProgramacion = false;
            cuponToUpdate.fechaPublicacion = null;
            cuponToUpdate.horaPublicacion = null;
            await cuponToUpdate.save();
            console.log(`Cupon ${cupon.id} actualizado a visible`);
            createUserNotification(
              cuponToUpdate.service.user,
              `Tu cupón "${cuponToUpdate.nombre}" ya está activo y visible para los usuarios.`,
              'Cupon Activado'
            );
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener cupones programados:', error);
    }
  });
};

export default couponsJob;

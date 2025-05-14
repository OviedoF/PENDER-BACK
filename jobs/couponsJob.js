import { Cupon } from '../models/Coupon.js'

const couponsJob = (agenda) => {
  agenda.define('coupons_test', async () => {
    try {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000; // tiempo en UTC
      const offsetPeru = -5; // UTC-5
      const peruTime = new Date(utc + 3600000 * offsetPeru);;

      const cupones = await Cupon.find({
        oculto: false,
        activarProgramacion: true,
        fechaPublicacion: { $lte: peruTime },
      }).sort({ createdAt: -1 });

      const completedCuponesDates = cupones.map((cupon) => {
        const fechaPublicacion = new Date(cupon.fechaPublicacion).toISOString();
        const horaPublicacion = new Date(cupon.horaPublicacion).toISOString();

        return {
          id: cupon._id,
          fechaPublicacion: fechaPublicacion.split('T')[0] + 'T' + horaPublicacion.split('T')[1],
        };
      });

      for (const cupon of completedCuponesDates) {
        if (cupon.fechaPublicacion <= peruTime.toISOString()) {
          const cuponToUpdate = await Cupon.findById(cupon.id);
          if (cuponToUpdate) {
            cuponToUpdate.oculto = false;
            cuponToUpdate.activarProgramacion = false;
            cuponToUpdate.fechaPublicacion = null;
            cuponToUpdate.horaPublicacion = null;
            await cuponToUpdate.save();
            console.log(`Cupon ${cupon.id} actualizado a visible`);
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener cupones programados:', error);
    }
  });
};

export default couponsJob;

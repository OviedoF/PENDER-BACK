import mongoose from 'mongoose';

const NotificacionesSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
});

export default mongoose.model('Notificacion', NotificacionesSchema);

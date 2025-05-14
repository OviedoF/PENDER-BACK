import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    ciudad: { type: String, required: true },
    distrito: { type: String, required: true },
    departamento: { type: String, required: true },
    telefono: { type: String, required: true },
    categoria: { type: String, required: true },
    etiquetas: { type: [String], default: [] },
    detalle: { type: String, required: true },
    imagen: { type: String, required: true },
    imagenes: { type: [String], default: [] },
    oculto: { type: Boolean, default: false },
    vistas: { type: Number, default: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    ruc: { type: String, required: true },
    times: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Service', ServiceSchema);
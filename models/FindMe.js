import mongoose from 'mongoose';

const FoundMeSchema = new mongoose.Schema({
    distrito: { type: String, required: true },
    departamento: { type: String, required: true },
    ciudad: { type: String, required: true },
    nombre: { type: String, required: true },
    nombreResponsable: { type: String, required: true },
    telefono: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['reporte', 'busqueda'] },    
    especie: { type: String, required: true },
    raza: { type: String },
    tamano: { type: String, required: true },
    sexo: { type: String, required: true, enum: ['macho', 'hembra'] },
    edad: { type: Number, required: true },
    edadUnidad: { type: String, required: true, enum: ['Meses', 'Años'] },
    comentarios: { type: String },
    imagen: { type: String, required: true }, // URL de la imagen subida
    imagenes: { type: [String], required: false, default: [] }, // Array de URLs de imágenes
    deletedAt: { type: Date, required: false, default: null },
    encontrado: { type: Boolean, required: true, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    finished: { type: Boolean, required: true, default: false }
}, { timestamps: true });

export default mongoose.model('FindMe', FoundMeSchema);
import mongoose from 'mongoose';

const ForumSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    categorias: { type: [String], required: true },
    etiquetas: { type: [String], default: [] },
    descripcion: { type: String, required: true },
    imagen: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    dislikes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    // distrito: { type: String, required: true },
    // departamento: { type: String, required: true },
    // ciudad: { type: String, required: true },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Forum', ForumSchema);
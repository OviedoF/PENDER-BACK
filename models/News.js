import mongoose from 'mongoose';

// Noticias editoriales para la sección "Novedades" de la web
// (albergues, fundaciones, anuncios, campañas, etc.). Se cargan desde el admin.
const NewsSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  texto:  { type: String, required: true },
  imagen: { type: String, required: true },
  link:   { type: String, default: '' },
  activo: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('News', NewsSchema);

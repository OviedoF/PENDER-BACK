import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  image:       { type: String, required: true },
  link:        { type: String, default: '' },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },

  // Sección de la app donde se muestra el banner
  section:     { type: String, enum: ['home', 'adopcion', 'encuentrame'], default: 'home' },

  // Segundos que el banner permanece visible en el carrusel antes de pasar al siguiente
  duration:    { type: Number, default: 3, min: 1, max: 60 },

  // A/B testing: los banners que comparten `abGroup` forman una prueba.
  // Cada usuario se asigna de forma estable al grupo A o B y solo ve la variante
  // que le corresponde. Sin `abGroup`, el banner se muestra a todos sin importar la variante.
  variant:     { type: String, enum: ['A', 'B'], default: 'A' },
  abGroup:     { type: String, default: '', trim: true },

  // Scheduling
  startDate:   { type: Date, default: null },
  endDate:     { type: Date, default: null },

  // Geographic targeting
  departments: [{ type: String }],

  // User targeting
  targetRoles:       [{ type: String, enum: ['user', 'enterprise'] }],
  targetSubscriptions: [{ type: String, enum: ['free', 'basic', 'pro'] }],

  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Banner', bannerSchema);

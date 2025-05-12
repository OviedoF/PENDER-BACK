import mongoose from "mongoose";

const AdoptionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ciudad: { type: String, required: true },
  distrito: { type: String, required: true },
  departamento: { type: String, required: true },
  especie: { type: String, required: true },
  raza: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tamano: { type: String, required: true },
  sexo: { type: String, required: true, enum: ['macho', 'hembra'] },
  edad: { type: Number, required: true },
  edadUnidad: { type: String, required: true, enum: ['Meses', 'Años'] },
  comentarios: { type: String },
  imagen: { type: String, required: false }, // URL de la imagen subida
  imagenes: [{ type: String, required: false }], // URLs de las imagenes subidas
  deletedAt: {type: Date, required: false, default: null},
  adopted: { type: Boolean, required: true, default: false },
}, { timestamps: true });

const Adoption = mongoose.model('Adoption', AdoptionSchema);

export default Adoption;
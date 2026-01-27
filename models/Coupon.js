import mongoose, { Schema, model } from 'mongoose'

const CuponSchema = new Schema({
  nombre: { type: String, required: true },
  codigo: { type: String, required: true, unique: true },
  tipoDescuento: { type: String, enum: ['Porcentaje', 'Monto fijo'], required: true },
  valorDescuento: { type: String, required: true },
  fechaInicio: { type: Date, required: false },
  fechaExpiracion: { type: Date, required: false },
  activarProgramacion: { type: Boolean, default: false },
  fechaPublicacion: { type: Date, required: false },
  horaPublicacion: { type: Date, required: false },
  oculto: { type: Boolean, default: false },
  premium: { type: Boolean, default: false },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  vistas: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
})

export const Cupon = model('Cupon', CuponSchema)
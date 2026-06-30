import mongoose from 'mongoose';

const b = { type: Boolean, default: false };

const adminRoleSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  isDefault:   { type: Boolean, default: false },

  permissions: {
    dashboard: {
      view: b,
    },
    usuarios: {
      view: b,
      edit: b,
      suspend: b,
      delete: b,
    },
    empresas: {
      view: b,
      edit: b,
      approve: b,
      delete: b,
    },
    mascotas: {
      view: b,
      edit: b,
      delete: b,
    },
    adopciones: {
      view: b,
      manage: b,
      delete: b,
    },
    comunidad: {
      view: b,
      moderate: b,
      delete: b,
    },
    cupones: {
      view: b,
      create: b,
      edit: b,
      delete: b,
    },
    suscripciones: {
      view: b,
      manage: b,
    },
    pagos: {
      view: b,
      manage: b,
      export: b,
    },
    reportes: {
      view: b,
      manage: b,
      export: b,
    },
    seguridad: {
      view: b,
      manage: b,
    },
    geolocalizacion: {
      view: b,
      manage: b,
    },
    automatizaciones: {
      view: b,
      manage: b,
    },
    marketing: {
      view: b,
      manage: b,
    },
    configuracion: {
      view: b,
      manage: b,
    },
    adminUsuarios: {
      view: b,
      manage: b,
    },
  },
}, {
  timestamps: true,
});

export default mongoose.model('AdminRole', adminRoleSchema);

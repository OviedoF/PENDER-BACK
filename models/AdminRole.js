import mongoose from 'mongoose';

const permissionLevel = {
  type: String,
  enum: ['none', 'view', 'manage'],
  default: 'none',
};

const adminRoleSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  isDefault:   { type: Boolean, default: false },

  permissions: {
    dashboard:        permissionLevel,
    usuarios:         permissionLevel,
    empresas:         permissionLevel,
    mascotas:         permissionLevel,
    adopciones:       permissionLevel,
    comunidad:        permissionLevel,
    cupones:          permissionLevel,
    suscripciones:    permissionLevel,
    pagos:            permissionLevel,
    seguridad:        permissionLevel,
    geolocalizacion:  permissionLevel,
    automatizaciones: permissionLevel,
    configuracion:    permissionLevel,
    adminUsuarios:    permissionLevel,
  },
}, {
  timestamps: true,
});

export default mongoose.model('AdminRole', adminRoleSchema);

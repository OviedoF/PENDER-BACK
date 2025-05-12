import mongoose from 'mongoose';

const CommunitySchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    privacidad: { type: String, enum: ['publica', 'privada'], required: true },
    visibilidad: { type: String, enum: ['visible', 'oculta'], required: true },
    resena: { type: String, required: true },
    imagen: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mods: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Community', CommunitySchema);

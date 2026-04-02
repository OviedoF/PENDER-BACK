import Community from '../models/Community.js';
import Comment from '../models/CommunityComment.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const CommunityController = {};

CommunityController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        req.body.owner = user._id;

        const community = new Community(req.body);
        createUserNotification(user._id, "Comunidad creada", "Se ha creado tu comunidad.", 'empresa/community');
        await community.save();
        res.status(201).json(community);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.getAll = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const { search } = req.query;

        // * Leer las 10 comunidades con más miembros
        const communities = await Community.find({ deletedAt: null, nombre: { $regex: search || '', $options: 'i' } })
            .sort({ members: -1 })
            .limit(10)
            .populate('owner', 'name email')
            .populate('admins', 'name email')
            .populate('mods', 'name email')
            .populate('chatAdmins', 'name email')
            .populate('members', 'name email')
            .populate('pendingMembers', 'name email');


        let communitiesToReturn = [];

        communities.forEach(community => {
            let isMember = false;
            let isPending = false;

            if (community.members.some(member => member._id.toString() === user._id.toString())) {
                isMember = true;
            }

            if (community.pendingMembers.some(member => member._id.toString() === user._id.toString())) {
                isMember = false;
                isPending = true;
            }

            if (community.owner._id.toString() === user._id.toString() || community.admins.some(admin => admin._id.toString() === user._id.toString()) || community.mods.some(mod => mod._id.toString() === user._id.toString()) || community.chatAdmins.some(chatAdmin => chatAdmin._id.toString() === user._id.toString())) {
                isMember = true;
            }

            communitiesToReturn.push({
                ...community._doc,
                isMember,
                isPending,
                membersCount: community.members.length + community.admins.length + community.mods.length + community.chatAdmins.length + 1, // +1 for the owner
            });
        });

        res.status(200).json(communitiesToReturn);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.getByOwner = async (req, res) => {
    try {
        const { search } = req.query;
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });


        const communities = await Community.find({
            deletedAt: null,
            $or: [
                { owner: user._id },
                {
                    admins: { $in: [user._id] }
                }
            ],
            nombre: { $regex: search || '', $options: 'i' }
        })
            .populate('owner', 'name email')
            .populate('admins', 'name email');

        res.status(200).json(communities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.getByMemberId = async (req, res) => {
    try {
        const { search } = req.query;
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const communities = await Community.find({
            deletedAt: null,
            members: { $in: [user._id] },
            nombre: { $regex: search || '', $options: 'i' }
        })
            .populate('owner', 'name email')
            .populate('admins', 'name email');

        res.status(200).json(communities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        let isMember = false;
        let isAdminOrOwner = false;

        if (!user) return res.status(404).json({ message: 'User not found' });

        const community = await Community.findOne({ _id: req.params.id, deletedAt: null })
            .populate('owner', 'name image email')
            .populate('admins', 'name image email')
            .populate('mods', 'name image email')
            .populate('chatAdmins', 'name image email')
            .populate('members', 'name image email');

        if (!community) return res.status(404).json({ message: 'Not found' });

        if (community.members.some(member => member._id.toString() === user._id.toString())) {
            isMember = true;
        }

        if (community.owner._id.toString() === user._id.toString() || community.admins.some(admin => admin._id.toString() === user._id.toString())) {
            isAdminOrOwner = true;
        }

        const commentsToSend = [];

        const comments = await Comment.find({ community: community._id, deletedAt: null, respondsTo: null })
            .populate('user', 'firstName lastName image email')

        const membersCount = community.members.length + community.admins.length + community.mods.length + community.chatAdmins.length + 1; // +1 for the owner

        const membersPhotos = [community.owner.image, ...community.admins.map(admin => admin.image), ...community.mods.map(mod => mod.image), ...community.chatAdmins.map(chatAdmin => chatAdmin.image), ...community.members.map(member => member.image)];
        // Limit to 7 photos
        const limitedMembersPhotos = membersPhotos.slice(0, 7);

        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            const replies = await Comment.countDocuments({ respondsTo: comment._id, deletedAt: null });

            commentsToSend.push({
                ...comment._doc,
                replies,
                isOwner: comment.user._id.toString() === user._id.toString(),
                isLiked: comment.likes.includes(user._id),
                isDisliked: comment.dislikes.includes(user._id),
            });
        }

        res.status(200).json({
            ...community._doc,
            comments: commentsToSend,
            isMember,
            isAdminOrOwner,
            isOwner: community.owner._id.toString() === user._id.toString(),
            isAdmin: community.admins.some(admin => admin._id.toString() === user._id.toString()),
            membersCount,
            membersPhotos: limitedMembersPhotos,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.update = async (req, res) => {
    try {
        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        console.log(req.file);
        const community = await Community.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(community);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const communityFind = await Community.findOne({ _id: req.params.id, deletedAt: null, owner: user._id });
        if (!communityFind) return res.status(404).json({ message: 'Sin permisos.' });

        const community = await Community.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.addMemberToCommunity = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });

        if (!community) return res.status(404).json({ message: 'Not found' });

        if (community.owner.toString() === user._id.toString()) {
            return res.status(400).json({ message: 'No puedes salir de tu propia comunidad.' });
        }

        if (community.members.some(member => member._id.toString() === user._id.toString())) {
            await Community.findByIdAndUpdate(community._id, { $pull: { members: user._id } });
            return res.status(200).json({ message: 'Has salido de la comunidad.' });
        }

        if (community.pendingMembers.some(member => member._id.toString() === user._id.toString())) {
            await Community.findByIdAndUpdate(community._id, { $pull: { pendingMembers: user._id } });
            return res.status(200).json({ message: 'Has cancelado tu solicitud.' });
        }

        if (community.admins.some(admin => admin._id.toString() === user._id.toString()) || community.mods.some(mod => mod._id.toString() === user._id.toString()) || community.chatAdmins.some(chatAdmin => chatAdmin._id.toString() === user._id.toString())) {
            await Community.findByIdAndUpdate(community._id, { $pull: { admins: user._id } });
            return res.status(200).json({ message: 'Has salido de la comunidad como admin.' });
        }

        if (community.privacidad === 'privada') {
            // * Agregar a community.pendingMembers

            if (community.pendingMembers.includes(user._id)) {
                return res.status(400).json({ message: 'Ya has solicitado unirte a esta comunidad.' });
            }

            community.pendingMembers.push(user._id);

            await community.save();
            createUserNotification(community.owner, "Nueva solicitud", `${user.firstName} ${user.lastName} ha solicitado unirse a tu comunidad.`, 'empresa/community/view', {
                id: community._id
            });
            return res.status(200).json({ message: 'Solicitud enviada.' });
        } else {
            // * Agregar a community.members

            if (community.members.includes(user._id)) {
                return res.status(400).json({ message: 'Ya eres miembro de esta comunidad.' });
            }

            community.members.push(user._id);
            createUserNotification(user._id, "Nuevo miembro", "Te has unido a la comunidad.", 'empresa/community');
            createUserNotification(community.owner, "Nuevo miembro", `${user.firstName} ${user.lastName} se ha unido a tu comunidad.`, 'empresa/community');

            await community.save();
            return res.status(200).json({ message: 'Te has unido a la comunidad.' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.acceptOrRejectMember = async (req, res) => {
    try {
        const { community, userId, action } = req.body;
        const communityFind = await Community.findOne({ _id: community, deletedAt: null });
        if (!communityFind) return res.status(404).json({ message: 'Not found' });

        if (action === 'accept') {
            communityFind.members.push(userId);
            communityFind.pendingMembers = communityFind.pendingMembers.filter(member => member._id.toString() !== userId.toString());
        } else {
            communityFind.pendingMembers = communityFind.pendingMembers.filter(member => member._id.toString() !== userId.toString());
        }

        await communityFind.save();
        res.status(200).json({ message: `Usuario ${action === 'accept' ? 'aceptado' : 'rechazado'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.getPendingMembers = async (req, res) => {
    try {
        const { email } = req.query;

        const community = await Community.findOne({ _id: req.params.id, deletedAt: null })
            .populate('pendingMembers', 'name email firstName lastName image')

        const pendingMembers = community.pendingMembers.filter(member => member.email.includes(email || ''));

        if (!community) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(pendingMembers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.getMembers = async (req, res) => {
    try {
        const { email } = req.query;
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null })
            .populate('members', 'name email firstName lastName image')
            .populate('admins', 'name email firstName lastName image')
            .populate('mods', 'name email firstName lastName image')
            .populate('chatAdmins', 'name email firstName lastName image');

        const allMembers = [...community.members, ...community.admins, ...community.mods, ...community.chatAdmins];

        const members = allMembers.filter(member => member.email.includes(email || ''));

        if (!community) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.deleteMember = async (req, res) => {
    try {
        const { memberId } = req.body;
        const community = req.params.id;

        const communityFind = await Community.findOne({ _id: community, deletedAt: null });
        console.log(communityFind.members, communityFind.admins, communityFind.mods, communityFind.chatAdmins);
        if (!communityFind) return res.status(404).json({ message: 'Not found' });

        if (communityFind.members.includes(memberId)) {
            await Community.findByIdAndUpdate(communityFind._id, { $pull: { members: memberId } });
        }
        if (communityFind.admins.includes(memberId)) {
            await Community.findByIdAndUpdate(communityFind._id, { $pull: { admins: memberId } });
        }
        if (communityFind.mods.includes(memberId)) {
            await Community.findByIdAndUpdate(communityFind._id, { $pull: { mods: memberId } });
        }
        if (communityFind.chatAdmins.includes(memberId)) {
            await Community.findByIdAndUpdate(communityFind._id, { $pull: { chatAdmins: memberId } });
        }

        return res.status(200).json({ message: 'Usuario eliminado de la comunidad.' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}

// * MANAGE ADMINS

CommunityController.adminsCount = async (req, res) => {
    try {
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({
            admins: community.admins.length,
            mods: community.mods.length,
            chatAdmins: community.chatAdmins.length,
            pendingMembers: community.pendingMembers.length,
            pendingComments: community.pendingComments?.length || 0,
            reportedContent: community.reportedContent?.length || 0,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.addEmailToRole = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const community = await Community.findOne({ _id: req.params.id, members: { $in: [user._id] }, deletedAt: null });
        if (!community) return res.status(404).json({
            message: 'El usuario no es miembro de la comunidad.'
        });

        if (!community.members.includes(user._id)) {
            community.members.push(user._id);
        }

        if (req.body.role === 'admins') {
            community.admins.push(user._id);
        } else if (req.body.role === 'mods') {
            community.mods.push(user._id);
        } else if (req.body.role === 'chatAdmins') {
            community.chatAdmins.push(user._id);
        }

        await community.save();
        res.status(200).json(community);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

CommunityController.getRoleMembers = async (req, res) => {
    try {
        const { role } = req.query;

        const community = await Community.findOne({ _id: req.params.id, deletedAt: null })
            .populate(role, 'name email firstName lastName image');

        if (!community) return res.status(404).json({ message: 'Not found' });

        res.status(200).json(community[role]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
    return user;
};

CommunityController.adminGetAll = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, search, oficial, featured, privacidad } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;
        const filter = { deletedAt: null };
        if (oficial !== undefined && oficial !== '') filter.oficial = oficial === 'true';
        if (featured !== undefined && featured !== '') filter.featured = featured === 'true';
        if (privacidad) filter.privacidad = privacidad;
        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');
            filter.$or = [{ nombre: regex }, { resena: regex }, { departamento: regex }, { ciudad: regex }];
        }
        const [communities, total] = await Promise.all([
            Community.find(filter)
                .populate('owner', 'firstName lastName email')
                .sort({ featured: -1, oficial: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Community.countDocuments(filter),
        ]);
        const result = communities.map(c => ({ ...c.toObject(), memberCount: c.members.length }));
        res.status(200).json({ communities: result, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminGetById = async (req, res) => {
    try {
        await verifyAdmin(req);
        const community = await Community.findOne({ _id: req.params.id })
            .populate('owner', 'firstName lastName email image')
            .populate('members', 'firstName lastName email image')
            .populate('bannedMembers', 'firstName lastName email');
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        const commentCount = await Comment.countDocuments({ community: community._id, deletedAt: null });
        res.status(200).json({ ...community.toObject(), commentCount, memberCount: community.members.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminToggleOfficial = async (req, res) => {
    try {
        await verifyAdmin(req);
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        community.oficial = !community.oficial;
        await community.save();
        res.status(200).json(community);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.adminToggleFeatured = async (req, res) => {
    try {
        await verifyAdmin(req);
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        community.featured = !community.featured;
        await community.save();
        res.status(200).json(community);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.adminBanUser = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId requerido' });
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        const alreadyBanned = community.bannedMembers.some(m => m.toString() === userId);
        if (!alreadyBanned) community.bannedMembers.push(userId);
        community.members = community.members.filter(m => m.toString() !== userId);
        await community.save();
        await createUserNotification(userId, 'Expulsado de comunidad', `Has sido expulsado de la comunidad "${community.nombre}".`, 'usuario/community');
        res.status(200).json({ message: 'Usuario baneado correctamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.adminUnbanUser = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId requerido' });
        const community = await Community.findOne({ _id: req.params.id, deletedAt: null });
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        community.bannedMembers = community.bannedMembers.filter(m => m.toString() !== userId);
        await community.save();
        res.status(200).json({ message: 'Usuario desbaneado correctamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CommunityController.adminDelete = async (req, res) => {
    try {
        await verifyAdmin(req);
        const community = await Community.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!community) return res.status(404).json({ message: 'No encontrado' });
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminGetComments = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1 } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;
        const [comments, total] = await Promise.all([
            Comment.find({ community: req.params.id, deletedAt: null })
                .populate('user', 'firstName lastName email image')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Comment.countDocuments({ community: req.params.id, deletedAt: null }),
        ]);
        res.status(200).json({ comments, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminDeleteComment = async (req, res) => {
    try {
        await verifyAdmin(req);
        const comment = await Comment.findOneAndUpdate(
            { _id: req.params.commentId, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });
        res.status(200).json({ message: 'Comentario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminGetMetrics = async (req, res) => {
    try {
        await verifyAdmin(req);
        const [totalCommunities, membersAgg, totalComments, totalForums] = await Promise.all([
            Community.countDocuments({ deletedAt: null }),
            Community.aggregate([
                { $match: { deletedAt: null } },
                { $project: { count: { $size: '$members' } } },
                { $group: { _id: null, total: { $sum: '$count' } } },
            ]),
            Comment.countDocuments({ deletedAt: null }),
            (await import('../models/Forum.js')).default.countDocuments({ deletedAt: null }),
        ]);
        const topByMembers = await Community.aggregate([
            { $match: { deletedAt: null } },
            { $addFields: { memberCount: { $size: '$members' } } },
            { $sort: { memberCount: -1 } },
            { $limit: 5 },
            { $project: { nombre: 1, imagen: 1, privacidad: 1, oficial: 1, featured: 1, memberCount: 1 } },
        ]);
        const topByComments = await Comment.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: '$community', commentCount: { $sum: 1 } } },
            { $sort: { commentCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'communities', localField: '_id', foreignField: '_id', as: 'community' } },
            { $unwind: '$community' },
            { $match: { 'community.deletedAt': null } },
            { $project: { nombre: '$community.nombre', imagen: '$community.imagen', oficial: '$community.oficial', commentCount: 1 } },
        ]);
        res.status(200).json({
            totals: { communities: totalCommunities, forums: totalForums, members: membersAgg[0]?.total ?? 0, comments: totalComments },
            topByMembers,
            topByComments,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CommunityController.adminCreateOfficial = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { nombre, resena, privacidad = 'publica', visibilidad = 'visible', imagen, departamento, ciudad, distrito } = req.body;
        if (!nombre || !resena) return res.status(400).json({ message: 'Nombre y resena requeridos' });
        const community = new Community({
            nombre, resena, privacidad, visibilidad,
            imagen: imagen || `${process.env.API_URL}/api/uploads/default.png`,
            owner: admin._id,
            oficial: true,
            featured: false,
            departamento: departamento || null,
            ciudad: ciudad || null,
            distrito: distrito || null,
        });
        await community.save();
        res.status(201).json(community);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export default CommunityController;

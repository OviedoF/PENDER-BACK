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

export default CommunityController;

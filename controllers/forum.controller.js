import Forum from '../models/Forum.js';
import Comment from '../models/forumComment.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const ForumController = {};

ForumController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        req.body.user = user._id; 

        const forum = new Forum(req.body);
        createUserNotification(user._id, "Foro creado", `Has creado el foro ${forum.titulo}`, "empresa/forum");
        await forum.save();
        res.status(201).json(forum);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};

ForumController.getAll = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const { search } = req.query;

        // * Leer las 10 comunidades con más miembros
        const forums = await Forum.find({ deletedAt: null, titulo: { $regex: search || '', $options: 'i' } })
            .sort({ members: -1 })
            .limit(10);


        let forumsToReturn = [];

        forums.forEach(forum => {
            forumsToReturn.push({
                ...forum._doc,
                isLiked: forum.likes.includes(user._id),
                isDisliked: forum.dislikes.includes(user._id),
            });
        });

        res.status(200).json(forumsToReturn);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ForumController.likeForum = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null });
        if (!forum) return res.status(404).json({ message: 'Not found' });

        if (forum.likes.includes(user._id)) {
            forum.likes = forum.likes.filter(like => like.toString() !== user._id.toString());
            await forum.save();
            return res.status(200).json({ message: 'Like removed' });
        } else {
            forum.likes.push(user._id);
            forum.dislikes = forum.dislikes.filter(dislike => dislike.toString() !== user._id.toString());
            await forum.save();
            return res.status(200).json({ message: 'Like added' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ForumController.dislikeForum = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null });
        if (!forum) return res.status(404).json({ message: 'Not found' });

        if (forum.dislikes.includes(user._id)) {
            forum.dislikes = forum.dislikes.filter(dislike => dislike.toString() !== user._id.toString());
            await forum.save();
            return res.status(200).json({ message: 'Dislike removed' });
        } else {
            forum.dislikes.push(user._id);
            forum.likes = forum.likes.filter(like => like.toString() !== user._id.toString());
            await forum.save();
            return res.status(200).json({ message: 'Dislike added' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ForumController.getByOwner = async (req, res) => {
    try {
        const { search } = req.query;
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });


        const communities = await Forum.find({
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

ForumController.getByMemberId = async (req, res) => {
    try {
        const { search } = req.query;
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const communities = await Forum.find({
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

ForumController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null })

        const comments = await Comment.find({ forum: req.params.id, deletedAt: null, respondsTo: null })
            .populate('user', 'name email firstName lastName image');

        if (!forum) return res.status(404).json({ message: 'Not found' });

        const forumWithComments = {
            ...forum._doc,
            comments: comments.map(comment => ({
                ...comment._doc,
                isLiked: comment.likes.includes(user._id),
                isDisliked: comment.dislikes.includes(user._id),
            })),
            isLiked: forum.likes.includes(user._id),
            isDisliked: forum.dislikes.includes(user._id),
        };

        res.status(200).json(forumWithComments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ForumController.update = async (req, res) => {
    try {
        if (req.file) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        console.log(req.file);
        const forum = await Forum.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!forum) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(forum);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

ForumController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const forumFind = await Forum.findOne({ _id: req.params.id, deletedAt: null, owner: user._id });
        if (!forumFind) return res.status(404).json({ message: 'Sin permisos.' });

        const forum = await Forum.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
        if (!forum) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

ForumController.addMemberToforum = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
    
        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null });

        if (!forum) return res.status(404).json({ message: 'Not found' });

        if (forum.owner.toString() === user._id.toString()) {
            return res.status(400).json({ message: 'No puedes salir de tu propia comunidad.' });
        }

        if (forum.members.some(member => member._id.toString() === user._id.toString())) {
            await Forum.findByIdAndUpdate(forum._id, { $pull: { members: user._id } });
            return res.status(200).json({ message: 'Has salido de la comunidad.' });
        }

        if (forum.pendingMembers.some(member => member._id.toString() === user._id.toString())) {
            await Forum.findByIdAndUpdate(forum._id, { $pull: { pendingMembers: user._id } });
            return res.status(200).json({ message: 'Has cancelado tu solicitud.' });
        }

        if (forum.admins.some(admin => admin._id.toString() === user._id.toString()) || forum.mods.some(mod => mod._id.toString() === user._id.toString()) || forum.chatAdmins.some(chatAdmin => chatAdmin._id.toString() === user._id.toString())) {
            await Forum.findByIdAndUpdate(forum._id, { $pull: { admins: user._id } });
            return res.status(200).json({ message: 'Has salido de la comunidad como admin.' });
        }

        if (forum.privacidad === 'privada') {
            // * Agregar a forum.pendingMembers

            if (forum.pendingMembers.includes(user._id)) {
                return res.status(400).json({ message: 'Ya has solicitado unirte a esta comunidad.' });
            }

            forum.pendingMembers.push(user._id);

            await forum.save();
            return res.status(200).json({ message: 'Solicitud enviada.' });
        } else {
            // * Agregar a forum.members
            
            if (forum.members.includes(user._id)) {
                return res.status(400).json({ message: 'Ya eres miembro de esta comunidad.' });
            }

            forum.members.push(user._id);

            await forum.save();
            return res.status(200).json({ message: 'Te has unido a la comunidad.' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.acceptOrRejectMember = async (req, res) => {
    try {
        const {forum, userId, action} = req.body;
        const forumFind = await Forum.findOne({ _id: forum, deletedAt: null });
        if (!forumFind) return res.status(404).json({ message: 'Not found' });

        if (action === 'accept') {
            forumFind.members.push(userId);
            forumFind.pendingMembers = forumFind.pendingMembers.filter(member => member._id.toString() !== userId.toString());
        } else {
            forumFind.pendingMembers = forumFind.pendingMembers.filter(member => member._id.toString() !== userId.toString());
        }

        await forumFind.save();
        res.status(200).json({ message: `Usuario ${action === 'accept' ? 'aceptado' : 'rechazado'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.getPendingMembers = async (req, res) => {
    try {
        const {email} = req.query;

        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null })
            .populate('pendingMembers', 'name email firstName lastName image')

        const pendingMembers = forum.pendingMembers.filter(member => member.email.includes(email || ''));

        if (!forum) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(pendingMembers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.getMembers = async (req, res) => {
    try {
        const {email} = req.query;
        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null })
            .populate('members', 'name email firstName lastName image')
            .populate('admins', 'name email firstName lastName image')
            .populate('mods', 'name email firstName lastName image')
            .populate('chatAdmins', 'name email firstName lastName image');

        const allMembers = [...forum.members, ...forum.admins, ...forum.mods, ...forum.chatAdmins];

        const members = allMembers.filter(member => member.email.includes(email || ''));

        if (!forum) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.deleteMember = async (req, res) => {
    try {
        const { memberId } = req.body;
        const forum = req.params.id;

        const forumFind = await Forum.findOne({ _id: forum, deletedAt: null });
        console.log(forumFind.members, forumFind.admins, forumFind.mods, forumFind.chatAdmins);
        if (!forumFind) return res.status(404).json({ message: 'Not found' });

        if (forumFind.members.includes(memberId)) {
            await Forum.findByIdAndUpdate(forumFind._id, { $pull: { members: memberId } });
        }
        if (forumFind.admins.includes(memberId)) {
            await Forum.findByIdAndUpdate(forumFind._id, { $pull: { admins: memberId } });
        }
        if (forumFind.mods.includes(memberId)) {
            await Forum.findByIdAndUpdate(forumFind._id, { $pull: { mods: memberId } });
        }
        if (forumFind.chatAdmins.includes(memberId)) {
            await Forum.findByIdAndUpdate(forumFind._id, { $pull: { chatAdmins: memberId } });
        }

        return res.status(200).json({ message: 'Usuario eliminado de la comunidad.' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}

// * MANAGE ADMINS

ForumController.adminsCount = async (req, res) => {
    try {
        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null });
        if (!forum) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ 
            admins: forum.admins.length, 
            mods: forum.mods.length, 
            chatAdmins: forum.chatAdmins.length,
            pendingMembers: forum.pendingMembers.length,
            pendingComments: forum.pendingComments?.length || 0,
            reportedContent: forum.reportedContent?.length || 0,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.addEmailToRole = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const forum = await Forum.findOne({ _id: req.params.id, members: { $in: [user._id] }, deletedAt: null });
        if (!forum) return res.status(404).json({ 
            message: 'El usuario no es miembro de la comunidad.'
        });

        if(!forum.members.includes(user._id)) {
            forum.members.push(user._id);
        }

        if (req.body.role === 'admins') {
            forum.admins.push(user._id);
        } else if (req.body.role === 'mods') {
            forum.mods.push(user._id);
        } else if (req.body.role === 'chatAdmins') {
            forum.chatAdmins.push(user._id);
        }

        await forum.save();
        res.status(200).json(forum);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

ForumController.getRoleMembers = async (req, res) => {
    try {
        const { role } = req.query;
       
        const forum = await Forum.findOne({ _id: req.params.id, deletedAt: null })
            .populate(role, 'name email firstName lastName image');

        if (!forum) return res.status(404).json({ message: 'Not found' });

        res.status(200).json(forum[role]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export default ForumController;

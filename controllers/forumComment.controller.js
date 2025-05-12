import dotenv from 'dotenv';
import ForumComment from '../models/forumComment.js';
import jwt from 'jsonwebtoken';
dotenv.config();

const ForumCommentController = {};

// Crear un nuevo comentario
ForumCommentController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        req.body.user = payload.id;

        const newComment = new ForumComment(req.body);
        await newComment.save();
        res.status(201).json(newComment);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};

// Obtener todos los comentarios de un foro
ForumCommentController.getAllByForum = async (req, res) => {
    try {
        const comments = await ForumComment.find({ forum: req.params.forumId, deletedAt: null, respondsTo: null })
            .populate('user', 'name email')
            .populate('respondsTo', 'comment user')
            .populate('forum', 'name');

        res.status(200).json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener un comentario por ID con sus respuestas
ForumCommentController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;

        const comment = await ForumComment.findOne({ _id: req.params.id, deletedAt: null })
            .populate('user', 'firstName lastName email image');

        const repliesToSend = [];
        const replies = await ForumComment.find({ respondsTo: req.params.id, deletedAt: null })
            .populate('user', 'firstName lastName email image');

        const isLiked = comment.likes.includes(req.user.id);
        const isDisliked = comment.dislikes.includes(req.user.id);

        // Añadir liked o disliked a la respuesta
        if (replies) {
            replies.forEach(reply => {
                repliesToSend.push({
                    ...reply._doc,
                    isLiked: reply.likes.includes(req.user.id),
                    isDisliked: reply.dislikes.includes(req.user.id),
                    isOwner: reply.user._id.toString() === req.user.id,
                });
            });
        }

        if (!comment) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({
            comment: {
                ...comment._doc,
                isLiked,
                isDisliked,
                isOwner: comment.user._id.toString() === req.user.id,
            },
            replies: repliesToSend
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

// Actualizar un comentario
ForumCommentController.update = async (req, res) => {
    try {
        const comment = await ForumComment.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null, user: req.user.id },
            req.body,
            { new: true }
        );
        if (!comment) return res.status(404).json({ message: 'Not found or not authorized' });
        res.status(200).json(comment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Eliminar un comentario
ForumCommentController.delete = async (req, res) => {
    try {
        const comment = await ForumComment.findOneAndUpdate(
            { _id: req.params.id },
            { deletedAt: new Date() }
        );
        if (!comment) return res.status(404).json({ message: 'Not found or not authorized' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

// Dar like a un comentario
ForumCommentController.like = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const comment = await ForumComment.findOne({ _id: req.params.id, deletedAt: null });
        if (!comment) return res.status(404).json({ message: 'Not found' });

        if (comment.dislikes.some(
            dislike => dislike.toString() === payload.id
        )) {
            await comment.updateOne({ $pull: { dislikes: payload.id } });
        }

        if (
            comment.likes.some(
                like => like.toString() === payload.id
            )
        ) {
            await comment.updateOne({ $pull: { likes: payload.id } });
            return res.status(200).json();
        } else {
            await comment.updateOne({ $push: { likes: payload.id } });
            return res.status(200).json();
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Dar dislike a un comentario
ForumCommentController.dislike = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const comment = await ForumComment.findOne({ _id: req.params.id, deletedAt: null });
        if (!comment) return res.status(404).json({ message: 'Not found' });

        if (comment.likes.some(
            like => like.toString() === payload.id
        )) {
            await comment.updateOne({ $pull: { likes: payload.id } });
        }

        if (comment.dislikes.some(
            dislike => dislike.toString() === payload.id
        )) {
            await comment.updateOne({ $pull: { dislikes: payload.id } });
        } else {
            await comment.updateOne({ $push: { dislikes: payload.id } });
        }

        res.status(200).json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default ForumCommentController;
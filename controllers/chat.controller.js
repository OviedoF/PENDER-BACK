import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import FindMe from '../models/FindMe.js';
import Adoption from '../models/Adoption.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createUserNotification from '../utils/createUserNotification.js';
import createSystemNotification from '../utils/createSystemNotification.js';
dotenv.config();

const chatController = {};

chatController.getMessagesForChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;
        const chat = await Chat.findById(chatId).populate("participants");
        const messages = await Message.find({ chat: chatId }).populate("sender");
        const response = {};

        const parsedMessages = Promise.all(messages.map(async (message) => {
            return {
                _id: message._id,
                isSender: message.sender._id.toString() === userId.toString(),
                content: message.content,
                senderAvatar: message.sender.image,
                timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
        }));

        response.messages = await parsedMessages;
        response.status = chat.status || 'active';

        if (chat.type === "adoption") {
            const adoption = await Adoption.findById(chat.adoption).populate('user');
            response.adoption = adoption;
        }

        res.json(response);
    } catch (error) {
        console.error("Error fetching messages for chat:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.sendMessage = async (req, res) => {
    try {
        const { chatId, content } = req.body;

        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        const chat = await Chat.findById(chatId)
            .populate("participants")
            .populate("lastMessage");

        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }

        // ✅ Verificar quién envió el último mensaje
        const lastSenderId = chat.lastMessage?.sender?.toString();

        const message = await Message.create({
            chat: chatId,
            sender: userId,
            content,
            timestamp: new Date(),
        });

        chat.lastMessage = message._id;
        await chat.save();

        /* =======================================================
           🔔 NOTIFICACIÓN SOLO SI CAMBIA EL SENDER
        ======================================================= */

        const receiver = chat.participants.find(
            participant => participant._id.toString() !== userId.toString()
        );

        // Solo notificar si el último mensaje NO era del mismo sender
        if (receiver && lastSenderId !== userId.toString()) {
            await createUserNotification(
                receiver._id,
                `Tienes mensajes ${chat.type === "adoption" ? "en adopción" : "en perdidos"}!`,
                `Revisa tu bandeja de entrada desde el ícono de Mensajes.`,
            );

            await createSystemNotification({
                title: `Tienes mensajes ${chat.type === "adoption" ? "en adopción" : "en perdidos"}!`,
                text: `Revisa tu bandeja de entrada desde el ícono de Mensajes.`,
                specificUser: receiver._id
            });
        }

        res.status(201).json(message);

    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.foundPet = async (req, res) => {
    try {
        const { findMe } = req.body;

        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const userId = user._id;

        const findMeData = await FindMe.findById(findMe).populate('user');

        const ownerId = findMeData.user._id;

        const message = `Hola ${findMeData.user.username}, he encontrado a tu mascota: ${findMeData.nombre}. ¿Cómo te gustaría proceder?`;

        const isAlreadyInChat = await Chat.findOne({
            participants: { $all: [userId, ownerId] },
            type: 'findMe',
            findMe,
            createdBy: userId
        });

        if (isAlreadyInChat) {
            return res.status(400).json({ error: "Ya existe un chat para este hallazgo." });
        }

        const chat = await Chat.create({
            participants: [userId, ownerId],
            type: 'findMe',
            findMe,
            createdBy: userId
        });

        const newMessage = await Message.create({
            chat: chat._id,
            sender: userId,
            content: message,
        });

        await Chat.findByIdAndUpdate(chat._id, { lastMessage: newMessage._id });

        /* =======================================================
           🔔 NOTIFICACIONES
        ======================================================= */

        // ----------- DUEÑO DE LA MASCOTA -----------
        await createUserNotification(
            ownerId,
            "Posible mascota encontrada",
            `${user.username} cree haber encontrado a ${findMeData.nombre}`,
            "usuario/chats/findMeSolis",
            { chatId: chat._id }
        );

        await createSystemNotification({
            title: "Posible mascota encontrada",
            text: `${user.username} cree haber encontrado a ${findMeData.nombre}`,
            link: "usuario/chats/findMeSolis",
            params: { chatId: chat._id },
            specificUser: ownerId
        });


        // ----------- USUARIO QUE ENCONTRÓ -----------
        await createUserNotification(
            userId,
            "Mensaje enviado",
            `Tu aviso sobre ${findMeData.nombre} fue enviado al dueño`,
            "usuario/chats/findMeRequests",
            { chatId: chat._id }
        );

        res.status(201).json(chat);

    } catch (error) {
        console.error("Error in foundPet:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.getUserChats = async (req, res) => {
    const { search } = req.query;

    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        const chats = await Chat.find({
            participants: userId,
            type: "findMe",
            ocultedBy: { $ne: userId }
        })
            .populate("participants")
            .populate("lastMessage");

        if (search) {
            const searchLower = search.toLowerCase();
            const filteredChats = chats.filter(chat => {
                const participantsNames = chat.participants.map(participant => participant.username.toLowerCase());
                return participantsNames.some(name => name.includes(searchLower));
            });

            const parsedChats = await Promise.all(filteredChats.map(async (chat) => {
                const unreadedMessages = await Message.countDocuments({
                    chat: chat._id,
                    unreaded: true,
                    sender: { $ne: userId }
                });

                return {
                    _id: chat._id,
                    userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                    userAvatar: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                    lastMessage: chat.lastMessage ? chat.lastMessage.content : '',
                    timeStamp: chat.lastMessage ? chat.lastMessage.timestamp : null,
                    unreadCount: unreadedMessages,
                }
            }));

            return res.status(200).json(parsedChats);
        }

        const parsedChats = await Promise.all(chats.map(async (chat) => {
            const unreadedMessages = await Message.countDocuments({
                chat: chat._id,
                unreaded: true,
                sender: { $ne: userId }
            });

            return {
                _id: chat._id,
                userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                userAvatar: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                lastMessage: chat.lastMessage ? chat.lastMessage.content : '',
                timeStamp: chat.lastMessage ? chat.lastMessage.timestamp : null,
                unreadCount: unreadedMessages,
            }
        }));

        res.status(200).json(parsedChats);
    } catch (error) {
        console.error("Error fetching user chats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

chatController.getUserAdoptionsReqs = async (req, res) => {
    const { search } = req.query;

    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        const chats = await Chat.find({
            participants: userId,
            type: "adoption",
            createdBy: userId,
            ocultedBy: { $ne: userId }
        })
            .populate("participants")
            .populate("lastMessage")
            .populate("adoption");
        console.log(chats);

        if (search) {
            const searchLower = search.toLowerCase();
            const filteredChats = chats.filter(chat => {
                const participantsNames = chat.participants.map(participant => participant.username.toLowerCase());
                return participantsNames.some(name => name.includes(searchLower));
            });

            const parsedChats = await filteredChats.map(async (chat) => {
                return {
                    _id: chat._id,
                    userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                    userImage: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                    petBreed: chat.adoption ? chat.adoption.raza : chat.adoption.especie,
                    petName: chat.adoption ? chat.adoption.nombre : '',
                }
            });

            return res.status(200).json(parsedChats);
        }

        const parsedChats = chats.map((chat) => {
            return {
                _id: chat._id,
                userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                userImage: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                petBreed: chat.adoption ? chat.adoption.raza : chat.adoption.especie,
                petName: chat.adoption ? chat.adoption.nombre : '',
            }
        });

        console.log(parsedChats);

        res.status(200).json(parsedChats);
    } catch (error) {
        console.error("Error fetching user chats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

chatController.getUserAdoptionsSolis = async (req, res) => {
    const { search } = req.query;

    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;
        console.log(userId);

        const chats = await Chat.find({
            participants: userId,
            type: "adoption",
            createdBy: { $ne: userId },
            ocultedBy: { $ne: userId }
        })
            .populate("participants")
            .populate("lastMessage")
            .populate("adoption");

        if (search) {
            const searchLower = search.toLowerCase();
            const filteredChats = chats.filter(chat => {
                const participantsNames = chat.participants.map(participant => participant.username.toLowerCase());
                return participantsNames.some(name => name.includes(searchLower));
            });

            const parsedChats = await filteredChats.map(async (chat) => {
                return {
                    _id: chat._id,
                    userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                    userImage: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                    petBreed: chat.adoption ? chat.adoption.raza : chat.adoption.especie,
                    petName: chat.adoption ? chat.adoption.nombre : '',
                }
            });

            return res.status(200).json(parsedChats);
        }

        const parsedChats = chats.map((chat) => {
            return {
                _id: chat._id,
                userName: chat.participants.find(participant => participant._id.toString() !== userId.toString()).username,
                userImage: chat.participants.find(participant => participant._id.toString() !== userId.toString()).image,
                petBreed: chat.adoption ? chat.adoption.raza : chat.adoption.especie,
                petName: chat.adoption ? chat.adoption.nombre : '',
            }
        });

        console.log(parsedChats);

        res.status(200).json(parsedChats);
    } catch (error) {
        console.error("Error fetching user chats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

chatController.requestAdoption = async (req, res) => {
    try {
        const { adoption } = req.body;

        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const userId = user._id;

        const adoptionData = await Adoption.findById(adoption).populate('user');

        const ownerId = adoptionData.user._id;

        const message = `Hola ${adoptionData.user.username}, me gustaría adoptar a tu mascota: ${adoptionData.nombre}. ¿Podríamos hablar más al respecto?`;

        const isAlreadyInChat = await Chat.findOne({
            participants: { $all: [userId, ownerId] },
            type: 'adoption',
            adoption,
            createdBy: userId
        });

        if (isAlreadyInChat) {
            return res.status(400).json({ error: "Ya existe un chat para esta adopción." });
        }

        const chat = await Chat.create({
            participants: [userId, ownerId],
            type: 'adoption',
            adoption,
            createdBy: userId
        });

        const newMessage = await Message.create({
            chat: chat._id,
            sender: userId,
            content: message,
        });

        await Chat.findByIdAndUpdate(chat._id, { lastMessage: newMessage._id });

        /* =======================================================
           🔔 NOTIFICACIONES
        ======================================================= */

        // ----------- DUEÑO DE LA MASCOTA -----------
        await createUserNotification(
            ownerId,
            "Nueva solicitud de adopción",
            `${user.username} quiere adoptar a ${adoptionData.nombre}`,
            "usuario/chats/adoptionSolis",
            { chatId: chat._id }
        );

        await createSystemNotification({
            title: "Nueva solicitud de adopción",
            text: `${user.username} quiere adoptar a ${adoptionData.nombre}`,
            link: "usuario/chats/adoptionSolis",
            params: { chatId: chat._id },
            specificUser: ownerId
        });


        // ----------- ADOPTANTE -----------
        await createUserNotification(
            userId,
            "Solicitud enviada",
            `Tu solicitud para adoptar a ${adoptionData.nombre} fue enviada`,
            "usuario/chats/adoptionsRequests",
        );

        res.status(201).json(chat);
    } catch (error) {
        console.error("Error in requestAdoption:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.readMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        console.log("Marking messages as read for chat:", chatId);

        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        await Message.updateMany(
            { chat: chatId, unreaded: true, sender: { $ne: userId } },
            { $set: { unreaded: false } }
        );

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.rejectAdoption = async (req, res) => {
    try {
        const { chatId } = req.params;

        const token = req.headers.authorization.split(" ")[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        const chat = await Chat.findById(chatId)
            .populate("participants")
            .populate({
                path: "adoption",
                populate: { path: "user" }
            });

        if (!chat) {
            return res.status(404).json({ error: "Chat no encontrado" });
        }

        if (chat.type !== "adoption") {
            return res.status(400).json({ error: "Este chat no es de adopción" });
        }

        const ownerId = chat.adoption.user._id.toString();

        // 👉 Solo el dueño puede rechazar
        if (ownerId !== userId.toString()) {
            return res.status(403).json({ error: "No autorizado para rechazar esta adopción" });
        }

        // 👉 Cambiar status
        chat.status = "rejected";
        await chat.save();

        /* =======================================================
           🔔 NOTIFICACIONES
        ======================================================= */

        const requester = chat.participants.find(
            p => p._id.toString() !== ownerId
        );

        if (requester) {
            await createUserNotification(
                requester._id,
                "Solicitud de adopción rechazada",
                `El dueño rechazó tu solicitud de adopción.`,
                "usuario/chats/adoptionsRequests",
                { chatId: chat._id }
            );

            await createSystemNotification({
                title: "Solicitud de adopción rechazada",
                text: `El dueño rechazó tu solicitud de adopción.`,
                link: "usuario/chats/adoptionsRequests",
                params: { chatId: chat._id },
                specificUser: requester._id
            });
        }

        return res.status(200).json({ message: "Adopción rechazada correctamente" });

    } catch (error) {
        console.error("Error rechazando adopción:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

chatController.ocultChatForUser = async (req, res) => {
    try {
        const { chatId } = req.params;

        const token = req.headers.authorization.split(" ")[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.id;

        const chat = await Chat.findById(chatId);

        if (!chat) {
            return res.status(404).json({ error: "Chat no encontrado" });
        }

        // ✅ Si ya está oculto, no hacer nada
        if (chat.ocultedBy.includes(userId)) {
            return res.status(200).json({ message: "Chat ya estaba oculto" });
        }

        chat.ocultedBy.push(userId);
        await chat.save();

        return res.status(200).json({ message: "Chat ocultado correctamente" });

    } catch (error) {
        console.error("Error ocultando chat:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export default chatController; 
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import FindMe from '../models/FindMe.js';
import Adoption from '../models/Adoption.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
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
        
        if(chat.type === "adoption") {
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

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }

        const message = await Message.create({
            chat: chatId,
            sender: userId,
            content,
            timestamp: new Date(),
        });

        chat.lastMessage = message._id;
        await chat.save();

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

        const message = `Hola ${findMeData.user.username}, he encontrado a tu mascota: ${findMeData.nombre}. ¿Cómo te gustaría proceder?`;

        const isAlreadyInChat = await Chat.findOne({
            participants: { $all: [userId, findMeData.user._id] },
            type: 'findMe',
            findMe,
            createdBy: userId
        });

        if (isAlreadyInChat) {
            return res.status(400).json({ error: "Ya existe un chat para este hallazgo." });
        }

        const chat = await Chat.create({
            participants: [userId, findMeData.user._id],
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

        const chats = await Chat.find({ participants: userId, type: "findMe" })
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

        const chats = await Chat.find({ participants: userId, type: "adoption", createdBy: userId })
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

        const chats = await Chat.find({ participants: userId, type: "adoption", createdBy: { $ne: userId } })
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

        const message = `Hola ${adoptionData.user.username}, me gustaría adoptar a tu mascota: ${adoptionData.nombre}. ¿Podríamos hablar más al respecto?`;

        const isAlreadyInChat = await Chat.findOne({
            participants: { $all: [userId, adoptionData.user._id] },
            type: 'adoption',
            adoption,
            createdBy: userId
        });

        if (isAlreadyInChat) {
            return res.status(400).json({ error: "Ya existe un chat para esta adopción." });
        }

        const chat = await Chat.create({
            participants: [userId, adoptionData.user._id],
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

        res.status(201).json(chat);
    } catch (error) {
        console.error("Error in requestAdoption:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

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

export default chatController;
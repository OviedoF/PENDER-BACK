import AutomationConfig from '../models/AutomationConfig.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG_KEY = 'global';

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
    return user;
};

const AutomationController = {};

AutomationController.getConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        let config = await AutomationConfig.findOne({ key: CONFIG_KEY });
        if (!config) {
            config = await AutomationConfig.create({ key: CONFIG_KEY });
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AutomationController.updateConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        const {
            surveyEnabled, surveyMessage, surveyDelayMinutes,
            premiumExpiredEnabled, premiumExpiredMessage,
            premiumReminderEnabled, premiumReminderDaysBefore, premiumReminderMessage,
            inactiveEnabled, inactiveDays, inactiveMessage, inactiveRepeatDays,
            matchingNotifyEnabled, matchingMessage,
        } = req.body;

        const update = {};
        if (surveyEnabled !== undefined) update.surveyEnabled = surveyEnabled;
        if (surveyMessage !== undefined) update.surveyMessage = surveyMessage;
        if (surveyDelayMinutes !== undefined) update.surveyDelayMinutes = surveyDelayMinutes;
        if (premiumExpiredEnabled !== undefined) update.premiumExpiredEnabled = premiumExpiredEnabled;
        if (premiumExpiredMessage !== undefined) update.premiumExpiredMessage = premiumExpiredMessage;
        if (premiumReminderEnabled !== undefined) update.premiumReminderEnabled = premiumReminderEnabled;
        if (premiumReminderDaysBefore !== undefined) update.premiumReminderDaysBefore = premiumReminderDaysBefore;
        if (premiumReminderMessage !== undefined) update.premiumReminderMessage = premiumReminderMessage;
        if (inactiveEnabled !== undefined) update.inactiveEnabled = inactiveEnabled;
        if (inactiveDays !== undefined) update.inactiveDays = inactiveDays;
        if (inactiveMessage !== undefined) update.inactiveMessage = inactiveMessage;
        if (inactiveRepeatDays !== undefined) update.inactiveRepeatDays = inactiveRepeatDays;
        if (matchingNotifyEnabled !== undefined) update.matchingNotifyEnabled = matchingNotifyEnabled;
        if (matchingMessage !== undefined) update.matchingMessage = matchingMessage;

        const config = await AutomationConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            update,
            { upsert: true, new: true }
        );
        res.status(200).json(config);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export default AutomationController;

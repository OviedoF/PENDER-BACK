import SystemConfig from '../models/SystemConfig.js';
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

const SystemController = {};

SystemController.getConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        let config = await SystemConfig.findOne({ key: CONFIG_KEY });
        if (!config) {
            config = await SystemConfig.create({ key: CONFIG_KEY });
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SystemController.updateConfig = async (req, res) => {
    try {
        await verifyAdmin(req);
        const {
            termsAndConditions, privacyPolicy,
            commissionEnabled, commissionPercentage, commissionFixedFee,
            premiumEnabled, premiumMonthlyPrice, premiumAnnualPrice, premiumTrialDays,
            taxEnabled, taxPercentage, taxName,
            currency, currencySymbol,
            defaultLanguage, availableLanguages,
            maintenanceMode, maintenanceMessage, maintenanceScheduledAt, maintenanceEstimatedEnd,
        } = req.body;

        const update = {};
        if (termsAndConditions !== undefined) update.termsAndConditions = termsAndConditions;
        if (privacyPolicy !== undefined) update.privacyPolicy = privacyPolicy;
        if (commissionEnabled !== undefined) update.commissionEnabled = commissionEnabled;
        if (commissionPercentage !== undefined) update.commissionPercentage = commissionPercentage;
        if (commissionFixedFee !== undefined) update.commissionFixedFee = commissionFixedFee;
        if (premiumEnabled !== undefined) update.premiumEnabled = premiumEnabled;
        if (premiumMonthlyPrice !== undefined) update.premiumMonthlyPrice = premiumMonthlyPrice;
        if (premiumAnnualPrice !== undefined) update.premiumAnnualPrice = premiumAnnualPrice;
        if (premiumTrialDays !== undefined) update.premiumTrialDays = premiumTrialDays;
        if (taxEnabled !== undefined) update.taxEnabled = taxEnabled;
        if (taxPercentage !== undefined) update.taxPercentage = taxPercentage;
        if (taxName !== undefined) update.taxName = taxName;
        if (currency !== undefined) update.currency = currency;
        if (currencySymbol !== undefined) update.currencySymbol = currencySymbol;
        if (defaultLanguage !== undefined) update.defaultLanguage = defaultLanguage;
        if (availableLanguages !== undefined) update.availableLanguages = availableLanguages;
        if (maintenanceMode !== undefined) update.maintenanceMode = maintenanceMode;
        if (maintenanceMessage !== undefined) update.maintenanceMessage = maintenanceMessage;
        if (maintenanceScheduledAt !== undefined) update.maintenanceScheduledAt = maintenanceScheduledAt;
        if (maintenanceEstimatedEnd !== undefined) update.maintenanceEstimatedEnd = maintenanceEstimatedEnd;

        const config = await SystemConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            update,
            { upsert: true, new: true }
        );
        res.status(200).json(config);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

SystemController.getPublicConfig = async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ key: CONFIG_KEY });
        if (!config) {
            return res.status(200).json({});
        }
        res.status(200).json({
            termsAndConditions: config.termsAndConditions,
            privacyPolicy: config.privacyPolicy,
            currencySymbol: config.currencySymbol,
            currency: config.currency,
            defaultLanguage: config.defaultLanguage,
            availableLanguages: config.availableLanguages,
            premiumEnabled: config.premiumEnabled,
            premiumMonthlyPrice: config.premiumMonthlyPrice,
            premiumAnnualPrice: config.premiumAnnualPrice,
            premiumTrialDays: config.premiumTrialDays,
            taxEnabled: config.taxEnabled,
            taxPercentage: config.taxPercentage,
            taxName: config.taxName,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SystemController.getMaintenanceStatus = async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ key: CONFIG_KEY });
        if (!config) {
            return res.status(200).json({ maintenanceMode: false });
        }
        res.status(200).json({
            maintenanceMode: config.maintenanceMode,
            maintenanceMessage: config.maintenanceMessage,
            maintenanceScheduledAt: config.maintenanceScheduledAt,
            maintenanceEstimatedEnd: config.maintenanceEstimatedEnd,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default SystemController;

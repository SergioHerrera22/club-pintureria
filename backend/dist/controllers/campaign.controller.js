"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCampaign = exports.getTemplates = exports.getRecipients = void 0;
const campaign_service_1 = require("../services/campaign.service");
const systemConfig_service_1 = require("../services/systemConfig.service");
const getRecipients = async (req, res, next) => {
    try {
        const data = await campaign_service_1.CampaignService.getRecipients();
        res.json(data);
    }
    catch (error) {
        next(error);
    }
};
exports.getRecipients = getRecipients;
const getTemplates = async (req, res, next) => {
    try {
        const templates = await systemConfig_service_1.SystemConfigService.getWhatsappTemplates();
        res.json({ templates });
    }
    catch (error) {
        next(error);
    }
};
exports.getTemplates = getTemplates;
const sendCampaign = async (req, res, next) => {
    try {
        const { message, sendToAll, recipientIds, testPhone } = req.body;
        const result = await campaign_service_1.CampaignService.sendCampaign({ message, sendToAll, recipientIds, testPhone });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.sendCampaign = sendCampaign;
//# sourceMappingURL=campaign.controller.js.map
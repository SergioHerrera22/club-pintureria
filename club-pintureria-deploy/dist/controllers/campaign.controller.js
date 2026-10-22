"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareCampaign = exports.sendCampaign = exports.getTemplates = exports.getRecipients = void 0;
const campaign_service_1 = require("../services/campaign.service");
const systemConfig_service_1 = require("../services/systemConfig.service");
/**
 * Lee el filtro de sucursal (query o body). undefined/string vacío = todas.
 */
const readBranchId = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
const getRecipients = async (req, res, next) => {
    try {
        const data = await campaign_service_1.CampaignService.getRecipients(readBranchId(req.query.branchId));
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
        const result = await campaign_service_1.CampaignService.sendCampaign({
            message, sendToAll, recipientIds, testPhone,
            branchId: readBranchId(req.body.branchId),
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.sendCampaign = sendCampaign;
const prepareCampaign = async (req, res, next) => {
    try {
        const { message, sendToAll, recipientIds, testPhone } = req.body;
        const result = await campaign_service_1.CampaignService.prepareCampaign({
            message, sendToAll, recipientIds, testPhone,
            branchId: readBranchId(req.body.branchId),
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.prepareCampaign = prepareCampaign;
//# sourceMappingURL=campaign.controller.js.map
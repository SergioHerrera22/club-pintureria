"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelCampaign = exports.ackDelivery = exports.getCampaign = exports.getActiveCampaigns = exports.getAudience = exports.startCampaign = exports.prepareCampaign = exports.sendCampaign = exports.getTemplates = exports.getRecipients = void 0;
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
/** Inicia una campaña persistiéndola (registro + un entregable por cliente). */
const startCampaign = async (req, res, next) => {
    try {
        const { message, sendToAll, recipientIds, testPhone, audience, maxFaltan, days } = req.body;
        const result = await campaign_service_1.CampaignService.startCampaign({
            message, sendToAll, recipientIds, testPhone,
            branchId: readBranchId(req.body.branchId),
            audience,
            maxFaltan,
            days,
        }, req.user?.id);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.startCampaign = startCampaign;
/** Audiencias automáticas (cercanía a premio / resumen semanal). */
const getAudience = async (req, res, next) => {
    try {
        const kind = String(req.params.kind);
        if (kind !== 'near_prize' && kind !== 'weekly_summary') {
            res.status(400).json({ error: 'Audiencia desconocida' });
            return;
        }
        const rawMaxFaltan = Number(req.query.maxFaltan);
        const rawDays = Number(req.query.days);
        const result = await campaign_service_1.CampaignService.getAudience(kind, {
            branchId: readBranchId(req.query.branchId),
            maxFaltan: Number.isFinite(rawMaxFaltan) && rawMaxFaltan > 0 ? rawMaxFaltan : undefined,
            days: Number.isFinite(rawDays) && rawDays > 0 ? rawDays : undefined,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAudience = getAudience;
/** Campañas sin terminar, para retomar el envío desde donde quedó. */
const getActiveCampaigns = async (_req, res, next) => {
    try {
        const campaigns = await campaign_service_1.CampaignService.getActiveCampaigns();
        res.json({ campaigns });
    }
    catch (error) {
        next(error);
    }
};
exports.getActiveCampaigns = getActiveCampaigns;
/** Progreso de una campaña + destinatarios pendientes (para retomar). */
const getCampaign = async (req, res, next) => {
    try {
        const result = await campaign_service_1.CampaignService.getCampaign(String(req.params.id));
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getCampaign = getCampaign;
/** Marca un destinatario como enviado/omitido (idempotente). */
const ackDelivery = async (req, res, next) => {
    try {
        const { clientId, status, reason } = req.body;
        const result = await campaign_service_1.CampaignService.ackDelivery(String(req.params.id), clientId, status, reason);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.ackDelivery = ackDelivery;
/** Descarta una campaña sin terminar. */
const cancelCampaign = async (req, res, next) => {
    try {
        await campaign_service_1.CampaignService.cancelCampaign(String(req.params.id));
        res.json({ message: 'Campaña descartada' });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelCampaign = cancelCampaign;
//# sourceMappingURL=campaign.controller.js.map
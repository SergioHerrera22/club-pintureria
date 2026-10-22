"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectRevision = exports.approveRevision = exports.getMyRevisions = exports.listRevisions = exports.requestRevision = exports.getMyPurchases = void 0;
const saleRevision_service_1 = require("../services/saleRevision.service");
const errorHandler_1 = require("../middleware/errorHandler");
const getMyPurchases = async (req, res, next) => {
    try {
        const { dni, page = 1, limit = 20, startDate, endDate } = req.query;
        const result = await saleRevision_service_1.SaleRevisionService.getMySales({
            userId: req.user.id,
            dni: dni,
            page: Number(page),
            limit: Math.min(Number(limit), 100),
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyPurchases = getMyPurchases;
const requestRevision = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'No autenticado');
        const { id } = req.params;
        const { items, newClientDni, notes, observation } = req.body;
        const result = await saleRevision_service_1.SaleRevisionService.requestRevision(id, req.user, {
            items,
            newClientDni,
            notes,
            observation,
        });
        res.status(201).json({
            message: 'Solicitud de revisión enviada al administrador',
            revisionId: result.revision.id,
            preview: result.preview,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestRevision = requestRevision;
const listRevisions = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const validStatus = status && ['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(status)
            ? status
            : undefined;
        const result = await saleRevision_service_1.SaleRevisionService.listRevisions({
            status: validStatus,
            page: Number(page),
            limit: Math.min(Number(limit), 100),
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.listRevisions = listRevisions;
const getMyRevisions = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await saleRevision_service_1.SaleRevisionService.getMyRevisions(req.user.id, {
            page: Number(page),
            limit: Math.min(Number(limit), 100),
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyRevisions = getMyRevisions;
const approveRevision = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const result = await saleRevision_service_1.SaleRevisionService.approveRevision(id, req.user.id, note);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.approveRevision = approveRevision;
const rejectRevision = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const result = await saleRevision_service_1.SaleRevisionService.rejectRevision(id, req.user.id, reason);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.rejectRevision = rejectRevision;
//# sourceMappingURL=saleRevision.controller.js.map
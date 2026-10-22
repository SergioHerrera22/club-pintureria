"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPurchase = exports.getPurchases = exports.getPurchaseById = exports.createPurchase = void 0;
const purchase_service_1 = require("../services/purchase.service");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
const createPurchase = async (req, res, next) => {
    try {
        const { clientId, branchId, items, couponCode, notes } = req.body;
        const cashierId = req.user.id;
        if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
            throw new errorHandler_1.AppError(400, 'Datos de compra incompletos');
        }
        // Aislamiento por sucursal: la cajera/vendedor registra ventas en su sucursal.
        // El admin puede indicar la sucursal; si no, cae a la primera activa.
        const scope = (0, auth_1.resolveBranchScope)(req.user);
        let effectiveBranchId = null;
        if (scope.isGlobal) {
            effectiveBranchId = branchId || null;
        }
        else {
            if (!scope.branchId || scope.branchId === auth_1.NO_BRANCH) {
                throw new errorHandler_1.AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
            }
            effectiveBranchId = scope.branchId;
        }
        if (!effectiveBranchId) {
            const defaultBranch = await prisma_1.prisma.branch.findFirst({ where: { isActive: true } });
            if (!defaultBranch)
                throw new errorHandler_1.AppError(400, 'No hay sucursales activas');
            effectiveBranchId = defaultBranch.id;
        }
        // Verificar que el cliente pertenezca a la sucursal (staff no puede vender a clientes de otra sucursal)
        if (!scope.isGlobal) {
            const client = await prisma_1.prisma.user.findFirst({
                where: { id: clientId, role: client_1.UserRole.CLIENTE, branchId: effectiveBranchId },
            });
            if (!client)
                throw new errorHandler_1.AppError(404, 'Cliente no encontrado en tu sucursal');
        }
        const purchase = await purchase_service_1.PurchaseService.createPurchase({
            clientId,
            branchId: effectiveBranchId,
            cashierId,
            items,
            couponCode: req.body.couponCode,
            notes: req.body.notes,
        });
        res.status(201).json(purchase);
    }
    catch (error) {
        next(error);
    }
};
exports.createPurchase = createPurchase;
const getPurchaseById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const purchase = await purchase_service_1.PurchaseService.getPurchaseById(id);
        if (!purchase)
            throw new errorHandler_1.AppError(404, 'Compra no encontrada');
        // Aislamiento por sucursal
        const scope = (0, auth_1.resolveBranchScope)(req.user);
        if (!scope.isGlobal && purchase.branch?.id !== scope.branchId) {
            throw new errorHandler_1.AppError(404, 'Compra no encontrada');
        }
        res.json(purchase);
    }
    catch (error) {
        next(error);
    }
};
exports.getPurchaseById = getPurchaseById;
const getPurchases = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, clientId, branchId, startDate, endDate, status } = req.query;
        // Aislamiento por sucursal: no-admin siempre ve solo su sucursal
        const scope = (0, auth_1.resolveBranchScope)(req.user);
        const effectiveBranchId = scope.isGlobal ? branchId : scope.branchId;
        const filters = {};
        if (clientId)
            filters.clientId = clientId;
        if (effectiveBranchId)
            filters.branchId = effectiveBranchId;
        if (status)
            filters.status = status;
        if (startDate)
            filters.startDate = new Date(startDate);
        if (endDate)
            filters.endDate = new Date(endDate);
        if (page)
            filters.page = Number(page);
        if (limit)
            filters.limit = Number(limit);
        const result = await purchase_service_1.PurchaseService.getPurchases(filters);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getPurchases = getPurchases;
const cancelPurchase = async (req, res, next) => {
    try {
        const { id } = req.params;
        await purchase_service_1.PurchaseService.cancelPurchase(id);
        res.json({ message: 'Compra cancelada correctamente' });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelPurchase = cancelPurchase;
//# sourceMappingURL=purchase.controller.js.map
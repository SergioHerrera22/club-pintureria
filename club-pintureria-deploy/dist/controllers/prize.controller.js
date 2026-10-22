"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemPrizeByClient = exports.getAvailablePrizes = exports.getRedemptions = exports.redeemPrize = exports.deletePrize = exports.updatePrize = exports.createPrize = exports.getPrizeById = exports.getPrizes = void 0;
const prisma_1 = require("../config/prisma");
const points_service_1 = require("../services/points.service");
const email_service_1 = require("../services/email.service");
const systemConfig_service_1 = require("../services/systemConfig.service");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
/** Scope de sucursal: staff (cajera/vendedor) solo opera con clientes de su sucursal. */
const staffBranchWhere = (req) => {
    const scope = (0, auth_1.resolveBranchScope)(req.user);
    if (scope.isGlobal)
        return {};
    return { branchId: scope.branchId };
};
const getPrizes = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, category, status, isActive } = req.query;
        const where = {};
        const searchStr = Array.isArray(search) ? search[0] : search;
        const categoryStr = Array.isArray(category) ? category[0] : category;
        const statusStr = Array.isArray(status) ? status[0] : status;
        const isActiveStr = Array.isArray(isActive) ? isActive[0] : isActive;
        if (searchStr) {
            where.OR = [
                { name: { contains: searchStr, mode: 'insensitive' } },
                { code: { contains: searchStr, mode: 'insensitive' } },
            ];
        }
        if (categoryStr)
            where.category = categoryStr;
        if (statusStr)
            where.status = statusStr;
        if (isActiveStr !== undefined)
            where.isActive = isActiveStr === 'true';
        const [prizes, total] = await Promise.all([
            prisma_1.prisma.prize.findMany({
                where,
                orderBy: { pointsCost: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.prisma.prize.count({ where }),
        ]);
        res.json({
            prizes,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPrizes = getPrizes;
const getPrizeById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const prize = await prisma_1.prisma.prize.findUnique({ where: { id } });
        if (!prize)
            throw new errorHandler_1.AppError(404, 'Premio no encontrado');
        res.json(prize);
    }
    catch (error) {
        next(error);
    }
};
exports.getPrizeById = getPrizeById;
const createPrize = async (req, res, next) => {
    try {
        const { code, name, description, imageUrl, pointsCost, stock, category, validFrom, validTo } = req.body;
        const existing = await prisma_1.prisma.prize.findUnique({ where: { code } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Código de premio ya existe');
        const prize = await prisma_1.prisma.prize.create({
            data: {
                code,
                name,
                description,
                imageUrl: imageUrl || null,
                pointsCost,
                stock,
                category,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
            },
        });
        res.status(201).json(prize);
    }
    catch (error) {
        next(error);
    }
};
exports.createPrize = createPrize;
const updatePrize = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, imageUrl, pointsCost, stock, category, status, isActive, validFrom, validTo } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (description !== undefined)
            data.description = description;
        if (imageUrl !== undefined)
            data.imageUrl = imageUrl || null;
        if (pointsCost !== undefined)
            data.pointsCost = pointsCost;
        if (stock !== undefined)
            data.stock = stock;
        if (category !== undefined)
            data.category = category;
        if (status !== undefined)
            data.status = status;
        if (isActive !== undefined)
            data.isActive = isActive;
        if (validFrom !== undefined)
            data.validFrom = validFrom ? new Date(validFrom) : null;
        if (validTo !== undefined)
            data.validTo = validTo ? new Date(validTo) : null;
        const prize = await prisma_1.prisma.prize.update({
            where: { id },
            data,
        });
        res.json(prize);
    }
    catch (error) {
        next(error);
    }
};
exports.updatePrize = updatePrize;
const deletePrize = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.prize.delete({ where: { id } });
        res.json({ message: 'Premio eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deletePrize = deletePrize;
const redeemPrize = async (req, res, next) => {
    try {
        const { dni, prizeId } = req.body;
        // Aislamiento por sucursal: la cajera solo canjea premios de clientes de su sucursal
        const user = await prisma_1.prisma.user.findFirst({
            where: { dni, role: client_1.UserRole.CLIENTE, ...staffBranchWhere(req) },
            include: { clientProfile: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        if (!user.clientProfile)
            throw new errorHandler_1.AppError(400, 'Perfil de cliente no encontrado');
        const prize = await prisma_1.prisma.prize.findUnique({ where: { id: prizeId } });
        if (!prize)
            throw new errorHandler_1.AppError(404, 'Premio no encontrado');
        if (!prize.isActive || prize.status !== 'DISPONIBLE')
            throw new errorHandler_1.AppError(400, 'Premio no disponible');
        if (prize.stock <= 0)
            throw new errorHandler_1.AppError(400, 'Premio sin stock');
        // Mínimo de puntos en saldo para poder canjear (redemption_min_points)
        const minRedemption = await systemConfig_service_1.SystemConfigService.getRedemptionMinPoints();
        if (minRedemption > 0 && user.clientProfile.currentPoints < minRedemption) {
            throw new errorHandler_1.AppError(400, `Necesitás al menos ${minRedemption} puntos en tu saldo para canjear`);
        }
        if (user.clientProfile.currentPoints < prize.pointsCost)
            throw new errorHandler_1.AppError(400, 'Puntos insuficientes');
        const redemption = await prisma_1.prisma.$transaction(async (tx) => {
            const newRedemption = await tx.redemption.create({
                data: {
                    userId: user.id,
                    prizeId: prize.id,
                    pointsSpent: prize.pointsCost,
                    status: 'COMPLETADO',
                    processedBy: req.user.id,
                    processedAt: new Date(),
                },
            });
            await tx.prize.update({
                where: { id: prize.id },
                data: { stock: { decrement: 1 } },
            });
            await points_service_1.PointsService.redeemPoints(user.id, prize.pointsCost, newRedemption.id);
            return newRedemption;
        });
        const updatedProfile = await prisma_1.prisma.clientProfile.findUnique({ where: { userId: user.id } });
        if (user.email && await systemConfig_service_1.SystemConfigService.getNotificationsEnabled('email')) {
            await email_service_1.emailService.sendRedemptionConfirmationEmail(user.email, user.firstName, prize.name, prize.pointsCost, updatedProfile.currentPoints);
        }
        res.status(201).json({
            redemption: { id: redemption.id, pointsSpent: redemption.pointsSpent, createdAt: redemption.createdAt },
            prize: { name: prize.name, pointsCost: prize.pointsCost },
            newBalance: updatedProfile.currentPoints,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.redeemPrize = redeemPrize;
const getRedemptions = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, userId } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (userId)
            where.userId = userId;
        // Aislamiento por sucursal: solo canjes de clientes de la propia sucursal
        const staffWhere = staffBranchWhere(req);
        if (staffWhere.branchId !== undefined) {
            where.user = staffWhere;
        }
        const [redemptions, total] = await Promise.all([
            prisma_1.prisma.redemption.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { user: { select: { firstName: true, lastName: true, dni: true } }, prize: true },
            }),
            prisma_1.prisma.redemption.count({ where }),
        ]);
        res.json({
            redemptions,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getRedemptions = getRedemptions;
const getAvailablePrizes = async (req, res, next) => {
    try {
        const { dni } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { dni },
            include: { clientProfile: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        const now = new Date();
        const prizes = await prisma_1.prisma.prize.findMany({
            where: {
                isActive: true,
                status: 'DISPONIBLE',
                stock: { gt: 0 },
                AND: [
                    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
                ],
            },
            orderBy: { pointsCost: 'asc' },
        });
        const currentPoints = user.clientProfile?.currentPoints || 0;
        res.json({
            prizes: prizes.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                description: p.description,
                imageUrl: p.imageUrl,
                pointsCost: p.pointsCost,
                category: p.category,
                canAfford: p.pointsCost <= currentPoints,
            })),
            currentPoints,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailablePrizes = getAvailablePrizes;
const redeemPrizeByClient = async (req, res, next) => {
    try {
        const { dni, prizeId } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { dni },
            include: { clientProfile: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        if (!user.clientProfile)
            throw new errorHandler_1.AppError(400, 'Perfil de cliente no encontrado');
        const prize = await prisma_1.prisma.prize.findUnique({ where: { id: prizeId } });
        if (!prize)
            throw new errorHandler_1.AppError(404, 'Premio no encontrado');
        if (!prize.isActive || prize.status !== 'DISPONIBLE')
            throw new errorHandler_1.AppError(400, 'Premio no disponible');
        if (prize.stock <= 0)
            throw new errorHandler_1.AppError(400, 'Premio sin stock');
        // Mínimo de puntos en saldo para poder canjear (redemption_min_points)
        const minRedemption = await systemConfig_service_1.SystemConfigService.getRedemptionMinPoints();
        if (minRedemption > 0 && user.clientProfile.currentPoints < minRedemption) {
            throw new errorHandler_1.AppError(400, `Necesitás al menos ${minRedemption} puntos en tu saldo para canjear`);
        }
        if (user.clientProfile.currentPoints < prize.pointsCost)
            throw new errorHandler_1.AppError(400, 'Puntos insuficientes');
        const redemption = await prisma_1.prisma.$transaction(async (tx) => {
            const newRedemption = await tx.redemption.create({
                data: {
                    userId: user.id,
                    prizeId: prize.id,
                    pointsSpent: prize.pointsCost,
                    status: 'COMPLETADO',
                    notes: 'Canje autogestionado por cliente',
                },
            });
            await tx.prize.update({
                where: { id: prize.id },
                data: { stock: { decrement: 1 } },
            });
            await points_service_1.PointsService.redeemPoints(user.id, prize.pointsCost, newRedemption.id);
            return newRedemption;
        });
        const updatedProfile = await prisma_1.prisma.clientProfile.findUnique({ where: { userId: user.id } });
        if (user.email && await systemConfig_service_1.SystemConfigService.getNotificationsEnabled('email')) {
            await email_service_1.emailService.sendRedemptionConfirmationEmail(user.email, user.firstName, prize.name, prize.pointsCost, updatedProfile.currentPoints);
        }
        res.status(201).json({
            redemption: { id: redemption.id, pointsSpent: redemption.pointsSpent, createdAt: redemption.createdAt },
            prize: { name: prize.name, pointsCost: prize.pointsCost },
            newBalance: updatedProfile.currentPoints,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.redeemPrizeByClient = redeemPrizeByClient;
//# sourceMappingURL=prize.controller.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePointRule = exports.updatePointRule = exports.createPointRule = exports.getPointRuleById = exports.getPointRules = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
const getPointRules = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isActive } = req.query;
        const where = {};
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [rules, total] = await Promise.all([
            prisma_1.prisma.pointRule.findMany({
                where,
                orderBy: { priority: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { products: true },
            }),
            prisma_1.prisma.pointRule.count({ where }),
        ]);
        res.json({
            rules,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPointRules = getPointRules;
const getPointRuleById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const rule = await prisma_1.prisma.pointRule.findUnique({
            where: { id },
            include: { products: true },
        });
        if (!rule)
            throw new errorHandler_1.AppError(404, 'Regla no encontrada');
        res.json(rule);
    }
    catch (error) {
        next(error);
    }
};
exports.getPointRuleById = getPointRuleById;
const createPointRule = async (req, res, next) => {
    try {
        const { name, description, type, config, priority, validFrom, validTo, productIds } = req.body;
        if (!Object.values(client_1.RuleType).includes(type)) {
            throw new errorHandler_1.AppError(400, 'Tipo de regla inválido');
        }
        const rule = await prisma_1.prisma.pointRule.create({
            data: {
                name,
                description,
                type,
                config,
                priority: priority || 0,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
                products: productIds ? { connect: productIds.map((id) => ({ id })) } : undefined,
            },
            include: { products: true },
        });
        res.status(201).json(rule);
    }
    catch (error) {
        next(error);
    }
};
exports.createPointRule = createPointRule;
const updatePointRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, type, config, priority, isActive, validFrom, validTo, productIds } = req.body;
        const rule = await prisma_1.prisma.pointRule.update({
            where: { id },
            data: {
                name,
                description,
                type,
                config,
                priority,
                isActive,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
                products: productIds ? { set: productIds.map((id) => ({ id })) } : undefined,
            },
            include: { products: true },
        });
        res.json(rule);
    }
    catch (error) {
        next(error);
    }
};
exports.updatePointRule = updatePointRule;
const deletePointRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.pointRule.delete({ where: { id } });
        res.json({ message: 'Regla eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deletePointRule = deletePointRule;
//# sourceMappingURL=pointRule.controller.js.map
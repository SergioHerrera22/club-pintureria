"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBranch = exports.updateBranch = exports.createBranch = exports.getBranchById = exports.getBranches = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const getBranches = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, isActive } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [branches, total] = await Promise.all([
            prisma_1.prisma.branch.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.prisma.branch.count({ where }),
        ]);
        res.json({
            branches,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBranches = getBranches;
const getBranchById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const branch = await prisma_1.prisma.branch.findUnique({ where: { id } });
        if (!branch)
            throw new errorHandler_1.AppError(404, 'Sucursal no encontrada');
        res.json(branch);
    }
    catch (error) {
        next(error);
    }
};
exports.getBranchById = getBranchById;
const createBranch = async (req, res, next) => {
    try {
        const { name, code, address, phone, email } = req.body;
        const existing = await prisma_1.prisma.branch.findUnique({ where: { code } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Código de sucursal ya existe');
        const branch = await prisma_1.prisma.branch.create({
            data: { name, code, address, phone, email },
        });
        res.status(201).json(branch);
    }
    catch (error) {
        next(error);
    }
};
exports.createBranch = createBranch;
const updateBranch = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, address, phone, email, isActive } = req.body;
        const branch = await prisma_1.prisma.branch.update({
            where: { id },
            data: { name, address, phone, email, isActive },
        });
        res.json(branch);
    }
    catch (error) {
        next(error);
    }
};
exports.updateBranch = updateBranch;
const deleteBranch = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.branch.delete({ where: { id } });
        res.json({ message: 'Sucursal eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteBranch = deleteBranch;
//# sourceMappingURL=branch.controller.js.map
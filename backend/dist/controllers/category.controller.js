"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategoryTree = exports.getCategories = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const getCategories = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, isActive, parentId } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        if (parentId !== undefined)
            where.parentId = parentId === 'null' ? null : parentId;
        const [categories, total] = await Promise.all([
            prisma_1.prisma.category.findMany({
                where,
                orderBy: { sortOrder: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { children: true, parent: true },
            }),
            prisma_1.prisma.category.count({ where }),
        ]);
        res.json({
            categories,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
const getCategoryTree = async (req, res, next) => {
    try {
        const categories = await prisma_1.prisma.category.findMany({
            where: { parentId: null, isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        children: {
                            where: { isActive: true },
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                },
            },
        });
        res.json({ categories });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategoryTree = getCategoryTree;
const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await prisma_1.prisma.category.findUnique({
            where: { id },
            include: { children: true, parent: true },
        });
        if (!category)
            throw new errorHandler_1.AppError(404, 'Categoría no encontrada');
        res.json(category);
    }
    catch (error) {
        next(error);
    }
};
exports.getCategoryById = getCategoryById;
const createCategory = async (req, res, next) => {
    try {
        const { name, code, description, parentId, sortOrder } = req.body;
        const existing = await prisma_1.prisma.category.findUnique({ where: { code } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Código de categoría ya existe');
        const category = await prisma_1.prisma.category.create({
            data: { name, code, description, parentId, sortOrder: sortOrder || 0 },
        });
        res.status(201).json(category);
    }
    catch (error) {
        next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, parentId, sortOrder, isActive } = req.body;
        const category = await prisma_1.prisma.category.update({
            where: { id },
            data: { name, description, parentId, sortOrder, isActive },
        });
        res.json(category);
    }
    catch (error) {
        next(error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.category.delete({ where: { id } });
        res.json({ message: 'Categoría eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCategory = deleteCategory;
//# sourceMappingURL=category.controller.js.map
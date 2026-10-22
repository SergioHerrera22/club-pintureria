"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategories = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const getProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, category, isActive } = req.query;
        const where = {};
        const searchStr = Array.isArray(search) ? search[0] : search;
        const categoryStr = Array.isArray(category) ? category[0] : category;
        const isActiveStr = Array.isArray(isActive) ? isActive[0] : isActive;
        if (searchStr) {
            where.OR = [
                { name: { contains: searchStr, mode: 'insensitive' } },
                { code: { contains: searchStr, mode: 'insensitive' } },
                { brand: { contains: searchStr, mode: 'insensitive' } },
            ];
        }
        if (categoryStr)
            where.category = categoryStr;
        if (isActiveStr !== undefined)
            where.isActive = isActiveStr === 'true';
        const [products, total] = await Promise.all([
            prisma_1.prisma.product.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.prisma.product.count({ where }),
        ]);
        res.json({
            products: products.map(p => ({
                ...p,
                unitPrice: Number(p.unitPrice),
            })),
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await prisma_1.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new errorHandler_1.AppError(404, 'Producto no encontrado');
        res.json({ ...product, unitPrice: Number(product.unitPrice) });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductById = getProductById;
const createProduct = async (req, res, next) => {
    try {
        const { code, name, description, category, brand, unitPrice } = req.body;
        const existing = await prisma_1.prisma.product.findUnique({ where: { code } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Código de producto ya existe');
        const product = await prisma_1.prisma.product.create({
            data: { code, name, description, category, brand, unitPrice },
        });
        res.status(201).json({ ...product, unitPrice: Number(product.unitPrice) });
    }
    catch (error) {
        next(error);
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, category, brand, unitPrice, isActive } = req.body;
        const product = await prisma_1.prisma.product.update({
            where: { id },
            data: { name, description, category, brand, unitPrice, isActive },
        });
        res.json({ ...product, unitPrice: Number(product.unitPrice) });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.product.delete({ where: { id } });
        res.json({ message: 'Producto eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteProduct = deleteProduct;
const getCategories = async (req, res, next) => {
    try {
        const categories = await prisma_1.prisma.product.groupBy({
            by: ['category'],
            where: { isActive: true },
            _count: { category: true },
        });
        res.json(categories.map(c => ({ name: c.category, count: c._count.category })));
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
//# sourceMappingURL=product.controller.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBrand = exports.updateBrand = exports.createBrand = exports.getBrandById = exports.getBrands = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const getBrands = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, isActive } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [brands, total] = await Promise.all([
            prisma_1.prisma.brand.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.prisma.brand.count({ where }),
        ]);
        res.json({
            brands,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBrands = getBrands;
const getBrandById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const brand = await prisma_1.prisma.brand.findUnique({ where: { id } });
        if (!brand)
            throw new errorHandler_1.AppError(404, 'Marca no encontrada');
        res.json(brand);
    }
    catch (error) {
        next(error);
    }
};
exports.getBrandById = getBrandById;
const createBrand = async (req, res, next) => {
    try {
        const { name, code, description, logoUrl } = req.body;
        const existing = await prisma_1.prisma.brand.findUnique({ where: { code } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Código de marca ya existe');
        const brand = await prisma_1.prisma.brand.create({
            data: { name, code, description, logoUrl },
        });
        res.status(201).json(brand);
    }
    catch (error) {
        next(error);
    }
};
exports.createBrand = createBrand;
const updateBrand = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, logoUrl, isActive } = req.body;
        const brand = await prisma_1.prisma.brand.update({
            where: { id },
            data: { name, description, logoUrl, isActive },
        });
        res.json(brand);
    }
    catch (error) {
        next(error);
    }
};
exports.updateBrand = updateBrand;
const deleteBrand = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.brand.delete({ where: { id } });
        res.json({ message: 'Marca eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteBrand = deleteBrand;
//# sourceMappingURL=brand.controller.js.map
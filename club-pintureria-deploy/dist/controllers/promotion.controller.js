"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePromotion = exports.deactivatePromotion = exports.activatePromotion = exports.deletePromotion = exports.updatePromotion = exports.createPromotion = exports.getPromotionById = exports.getPromotions = void 0;
const promotion_service_1 = require("../services/promotion.service");
const errorHandler_1 = require("../middleware/errorHandler");
const getPromotions = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isActive, category, brand, productId, startDate, endDate } = req.query;
        const filters = {};
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        if (category)
            filters.category = category;
        if (brand)
            filters.brand = brand;
        if (productId)
            filters.productId = productId;
        if (startDate)
            filters.startDate = new Date(startDate);
        if (endDate)
            filters.endDate = new Date(endDate);
        if (page)
            filters.page = Number(page);
        if (limit)
            filters.limit = Number(limit);
        const result = await promotion_service_1.PromotionService.getPromotions(filters);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getPromotions = getPromotions;
const getPromotionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const promotion = await promotion_service_1.PromotionService.getPromotionById(id);
        res.json(promotion);
    }
    catch (error) {
        next(error);
    }
};
exports.getPromotionById = getPromotionById;
const createPromotion = async (req, res, next) => {
    try {
        const { name, description, imageUrl, type, multiplier, bonusPoints, discount, startDate, endDate, isActive, categories, brands, products, conditions } = req.body;
        const promotion = await promotion_service_1.PromotionService.createPromotion({
            name,
            description,
            imageUrl,
            type,
            multiplier,
            bonusPoints,
            discount,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive,
            categories,
            brands,
            products,
            conditions,
        });
        res.status(201).json(promotion);
    }
    catch (error) {
        next(error);
    }
};
exports.createPromotion = createPromotion;
const updatePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, imageUrl, type, multiplier, bonusPoints, discount, startDate, endDate, isActive, categories, brands, products, conditions } = req.body;
        const promotion = await promotion_service_1.PromotionService.updatePromotion(id, {
            name,
            description,
            imageUrl,
            type,
            multiplier,
            bonusPoints,
            discount,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            isActive,
            categories,
            brands,
            products,
            conditions,
        });
        res.json(promotion);
    }
    catch (error) {
        next(error);
    }
};
exports.updatePromotion = updatePromotion;
const deletePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        await promotion_service_1.PromotionService.deletePromotion(id);
        res.json({ message: 'Promoción eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deletePromotion = deletePromotion;
const activatePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const promotion = await promotion_service_1.PromotionService.activatePromotion(id);
        res.json(promotion);
    }
    catch (error) {
        next(error);
    }
};
exports.activatePromotion = activatePromotion;
const deactivatePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const promotion = await promotion_service_1.PromotionService.deactivatePromotion(id);
        res.json(promotion);
    }
    catch (error) {
        next(error);
    }
};
exports.deactivatePromotion = deactivatePromotion;
const validatePromotion = async (req, res, next) => {
    try {
        const { items, subtotal, categoryIds, brandIds, productIds } = req.body;
        if (!items || !Array.isArray(items) || subtotal === undefined) {
            throw new errorHandler_1.AppError(400, 'Datos incompletos para validar promoción');
        }
        const applicable = await promotion_service_1.PromotionService.getActivePromotionsForClient(items, subtotal, categoryIds, brandIds, productIds);
        res.json({ applicable });
    }
    catch (error) {
        next(error);
    }
};
exports.validatePromotion = validatePromotion;
//# sourceMappingURL=promotion.controller.js.map
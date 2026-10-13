"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBenefit = exports.updateBenefit = exports.createBenefit = exports.getBenefitById = exports.getBenefits = void 0;
const benefit_service_1 = require("../services/benefit.service");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
const getBenefits = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type, isActive } = req.query;
        const filters = {};
        if (type)
            filters.type = type;
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        if (page)
            filters.page = Number(page);
        if (limit)
            filters.limit = Number(limit);
        const result = await benefit_service_1.BenefitService.getAllBenefits(filters);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getBenefits = getBenefits;
const getBenefitById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const benefit = await benefit_service_1.BenefitService.getBenefitById(id);
        if (!benefit)
            throw new errorHandler_1.AppError(404, 'Beneficio no encontrado');
        res.json(benefit);
    }
    catch (error) {
        next(error);
    }
};
exports.getBenefitById = getBenefitById;
const createBenefit = async (req, res, next) => {
    try {
        const { name, description, imageUrl, type, value, isActive, startDate, endDate, autoApply } = req.body;
        if (!Object.values(client_1.BenefitType).includes(type)) {
            throw new errorHandler_1.AppError(400, 'Tipo de beneficio inválido');
        }
        const benefit = await benefit_service_1.BenefitService.createBenefit({
            name,
            description,
            imageUrl,
            type,
            value,
            isActive,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            autoApply,
        });
        res.status(201).json(benefit);
    }
    catch (error) {
        next(error);
    }
};
exports.createBenefit = createBenefit;
const updateBenefit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, imageUrl, type, value, isActive, startDate, endDate, autoApply } = req.body;
        const benefit = await benefit_service_1.BenefitService.updateBenefit(id, {
            name,
            description,
            imageUrl,
            type,
            value,
            isActive,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            autoApply,
        });
        res.json(benefit);
    }
    catch (error) {
        next(error);
    }
};
exports.updateBenefit = updateBenefit;
const deleteBenefit = async (req, res, next) => {
    try {
        const { id } = req.params;
        await benefit_service_1.BenefitService.deleteBenefit(id);
        res.json({ message: 'Beneficio eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteBenefit = deleteBenefit;
//# sourceMappingURL=benefit.controller.js.map
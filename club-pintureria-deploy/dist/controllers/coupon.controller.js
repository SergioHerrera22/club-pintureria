"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignBulkCoupons = exports.assignCoupon = exports.useCoupon = exports.validateCoupon = exports.deleteCoupon = exports.updateCoupon = exports.createBulkCoupons = exports.createCoupon = exports.getCouponById = exports.getCoupons = void 0;
const coupon_service_1 = require("../services/coupon.service");
const errorHandler_1 = require("../middleware/errorHandler");
const getCoupons = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isActive, clientId, type } = req.query;
        const filters = {};
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        if (clientId)
            filters.clientId = clientId;
        if (type)
            filters.type = type;
        if (page)
            filters.page = Number(page);
        if (limit)
            filters.limit = Number(limit);
        const result = await coupon_service_1.CouponService.getCoupons(filters);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getCoupons = getCoupons;
const getCouponById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const coupon = await coupon_service_1.CouponService.getCouponById(id);
        res.json(coupon);
    }
    catch (error) {
        next(error);
    }
};
exports.getCouponById = getCouponById;
const createCoupon = async (req, res, next) => {
    try {
        const { code, name, description, type, value, maxUses, startDate, endDate, isActive, clientId, promotionId } = req.body;
        const coupon = await coupon_service_1.CouponService.createCoupon({
            code,
            name,
            description,
            type,
            value,
            maxUses,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive,
            clientId,
            promotionId,
        });
        res.status(201).json(coupon);
    }
    catch (error) {
        next(error);
    }
};
exports.createCoupon = createCoupon;
const createBulkCoupons = async (req, res, next) => {
    try {
        const { prefix, count, name, description, type, value, maxUses, startDate, endDate, isActive } = req.body;
        const coupons = await coupon_service_1.CouponService.createBulkCoupons({
            prefix,
            count,
            name,
            description,
            type,
            value,
            maxUses,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive,
        });
        res.status(201).json({ coupons, count: coupons.length });
    }
    catch (error) {
        next(error);
    }
};
exports.createBulkCoupons = createBulkCoupons;
const updateCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, type, value, maxUses, startDate, endDate, isActive, clientId, promotionId } = req.body;
        const coupon = await coupon_service_1.CouponService.updateCoupon(id, {
            name,
            description,
            type,
            value,
            maxUses,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            isActive,
            clientId,
            promotionId,
        });
        res.json(coupon);
    }
    catch (error) {
        next(error);
    }
};
exports.updateCoupon = updateCoupon;
const deleteCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        await coupon_service_1.CouponService.deleteCoupon(id);
        res.json({ message: 'Cupón eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCoupon = deleteCoupon;
const validateCoupon = async (req, res, next) => {
    try {
        const { code, clientId } = req.body;
        if (!code)
            throw new errorHandler_1.AppError(400, 'Código de cupón requerido');
        const result = await coupon_service_1.CouponService.validateCoupon(code, clientId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.validateCoupon = validateCoupon;
const useCoupon = async (req, res, next) => {
    try {
        const { code, clientId } = req.body;
        if (!code || !clientId)
            throw new errorHandler_1.AppError(400, 'Código y cliente requeridos');
        await coupon_service_1.CouponService.useCoupon(code, clientId);
        res.json({ message: 'Cupón utilizado correctamente' });
    }
    catch (error) {
        next(error);
    }
};
exports.useCoupon = useCoupon;
const assignCoupon = async (req, res, next) => {
    try {
        const { couponId, clientId } = req.body;
        if (!couponId || !clientId)
            throw new errorHandler_1.AppError(400, 'Cupón y cliente requeridos');
        const coupon = await coupon_service_1.CouponService.assignCouponToClient(couponId, clientId);
        res.json(coupon);
    }
    catch (error) {
        next(error);
    }
};
exports.assignCoupon = assignCoupon;
const assignBulkCoupons = async (req, res, next) => {
    try {
        const { couponIds, clientId } = req.body;
        if (!couponIds || !Array.isArray(couponIds) || !clientId) {
            throw new errorHandler_1.AppError(400, 'Lista de cupones y cliente requeridos');
        }
        const results = await coupon_service_1.CouponService.assignBulkCoupons(couponIds, clientId);
        res.json({ results });
    }
    catch (error) {
        next(error);
    }
};
exports.assignBulkCoupons = assignBulkCoupons;
//# sourceMappingURL=coupon.controller.js.map
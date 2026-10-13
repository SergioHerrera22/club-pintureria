"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../middleware/validation");
const couponController = __importStar(require("../controllers/coupon.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createCouponValidation = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().optional(),
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']),
        value: zod_1.z.number().positive(),
        maxUses: zod_1.z.number().int().positive().optional(),
        startDate: zod_1.z.string().datetime(),
        endDate: zod_1.z.string().datetime(),
        isActive: zod_1.z.boolean().optional(),
        clientId: zod_1.z.string().optional(),
        promotionId: zod_1.z.string().optional(),
    }),
});
const bulkCouponValidation = zod_1.z.object({
    body: zod_1.z.object({
        prefix: zod_1.z.string().min(1),
        count: zod_1.z.number().int().positive().max(1000),
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']),
        value: zod_1.z.number().positive(),
        maxUses: zod_1.z.number().int().positive().optional(),
        startDate: zod_1.z.string().datetime(),
        endDate: zod_1.z.string().datetime(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
const updateCouponValidation = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']).optional(),
        value: zod_1.z.number().positive().optional(),
        maxUses: zod_1.z.number().int().positive().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        isActive: zod_1.z.boolean().optional(),
        clientId: zod_1.z.string().optional(),
        promotionId: zod_1.z.string().optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), couponController.getCoupons);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), couponController.getCouponById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(createCouponValidation), couponController.createCoupon);
router.post('/bulk', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(bulkCouponValidation), couponController.createBulkCoupons);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(updateCouponValidation), couponController.updateCoupon);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), couponController.deleteCoupon);
// Validación pública para checkout
router.post('/validate', (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1),
        clientId: zod_1.z.string().optional(),
    }),
})), couponController.validateCoupon);
router.post('/use', (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1),
        clientId: zod_1.z.string().min(1),
    }),
})), couponController.useCoupon);
router.post('/assign', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        couponId: zod_1.z.string().min(1),
        clientId: zod_1.z.string().min(1),
    }),
})), couponController.assignCoupon);
router.post('/assign-bulk', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        couponIds: zod_1.z.array(zod_1.z.string()).min(1),
        clientId: zod_1.z.string().min(1),
    }),
})), couponController.assignBulkCoupons);
exports.default = router;
//# sourceMappingURL=coupon.routes.js.map
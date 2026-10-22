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
const promotionController = __importStar(require("../controllers/promotion.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const promotionValidation = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        type: zod_1.z.enum(['DOBLE_PUNTOS', 'TRIPLE_PUNTOS', 'PUNTOS_EXTRA', 'DESCUENTO_PORCENTUAL', 'PRODUCTO_BONIFICADO', 'ENVIO_GRATIS']),
        multiplier: zod_1.z.number().positive().optional(),
        bonusPoints: zod_1.z.number().int().nonnegative().optional(),
        discount: zod_1.z.number().positive().optional(),
        startDate: zod_1.z.string().datetime(),
        endDate: zod_1.z.string().datetime(),
        isActive: zod_1.z.boolean().optional(),
        categories: zod_1.z.array(zod_1.z.string()).optional(),
        brands: zod_1.z.array(zod_1.z.string()).optional(),
        products: zod_1.z.array(zod_1.z.string()).optional(),
        conditions: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
});
const updatePromotionValidation = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        type: zod_1.z.enum(['DOBLE_PUNTOS', 'TRIPLE_PUNTOS', 'PUNTOS_EXTRA', 'DESCUENTO_PORCENTUAL', 'PRODUCTO_BONIFICADO', 'ENVIO_GRATIS']).optional(),
        multiplier: zod_1.z.number().positive().optional(),
        bonusPoints: zod_1.z.number().int().nonnegative().optional(),
        discount: zod_1.z.number().positive().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        isActive: zod_1.z.boolean().optional(),
        categories: zod_1.z.array(zod_1.z.string()).optional(),
        brands: zod_1.z.array(zod_1.z.string()).optional(),
        products: zod_1.z.array(zod_1.z.string()).optional(),
        conditions: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'promociones'), promotionController.getPromotions);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'promociones'), promotionController.getPromotionById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(promotionValidation), promotionController.createPromotion);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(updatePromotionValidation), promotionController.updatePromotion);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), promotionController.deletePromotion);
router.post('/:id/activate', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), promotionController.activatePromotion);
router.post('/:id/deactivate', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), promotionController.deactivatePromotion);
// Validación pública para checkout
router.post('/validate', (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string(),
            quantity: zod_1.z.number().int().positive(),
            unitPrice: zod_1.z.number().positive(),
            lineTotal: zod_1.z.number().positive(),
        })).min(1),
        subtotal: zod_1.z.number().positive(),
        categoryIds: zod_1.z.array(zod_1.z.string()).optional(),
        brandIds: zod_1.z.array(zod_1.z.string()).optional(),
        productIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
})), promotionController.validatePromotion);
exports.default = router;
//# sourceMappingURL=promotion.routes.js.map
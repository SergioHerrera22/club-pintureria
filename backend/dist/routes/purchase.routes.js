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
const purchaseController = __importStar(require("../controllers/purchase.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createPurchaseValidation = zod_1.z.object({
    body: zod_1.z.object({
        clientId: zod_1.z.string().min(1),
        // Opcional: para staff se usa su propia sucursal; el admin puede indicarla.
        branchId: zod_1.z.string().min(1).optional(),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string().min(1),
            quantity: zod_1.z.number().int().positive(),
            unitPrice: zod_1.z.number().positive(),
            discount: zod_1.z.number().min(0).max(100).optional(),
        })).min(1),
        couponCode: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), (0, validation_1.validate)(createPurchaseValidation), purchaseController.createPurchase);
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), purchaseController.getPurchases);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), purchaseController.getPurchaseById);
router.post('/:id/cancel', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), purchaseController.cancelPurchase);
exports.default = router;
//# sourceMappingURL=purchase.routes.js.map
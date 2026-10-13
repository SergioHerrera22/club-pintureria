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
const prizeController = __importStar(require("../controllers/prize.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, prizeController.getPrizes);
router.get('/:id', auth_1.authenticate, prizeController.getPrizeById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        pointsCost: zod_1.z.number().int().positive(),
        stock: zod_1.z.number().int().nonnegative().default(0),
        category: zod_1.z.string().min(1),
        validFrom: zod_1.z.string().optional(),
        validTo: zod_1.z.string().optional(),
    }),
})), prizeController.createPrize);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        pointsCost: zod_1.z.number().int().positive().optional(),
        stock: zod_1.z.number().int().nonnegative().optional(),
        category: zod_1.z.string().optional(),
        status: zod_1.z.enum(['DISPONIBLE', 'AGOTADO', 'DESCONTINUADO']).optional(),
        isActive: zod_1.z.boolean().optional(),
        validFrom: zod_1.z.string().optional(),
        validTo: zod_1.z.string().optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
})), prizeController.updatePrize);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), prizeController.deletePrize);
router.post('/redeem', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
        prizeId: zod_1.z.string(),
    }),
})), prizeController.redeemPrize);
router.get('/available/:dni', prizeController.getAvailablePrizes);
router.post('/redeem/client', (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
        prizeId: zod_1.z.string(),
    }),
})), prizeController.redeemPrizeByClient);
router.get('/redemptions/history', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), prizeController.getRedemptions);
exports.default = router;
//# sourceMappingURL=prize.routes.js.map
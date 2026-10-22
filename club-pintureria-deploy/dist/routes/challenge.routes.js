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
const challengeController = __importStar(require("../controllers/challenge.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const challengeValidation = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().min(1),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        type: zod_1.z.enum(['CANTIDAD_PRODUCTOS', 'CANTIDAD_COMPRAS', 'MARCAS_DIFERENTES', 'CATEGORIAS_DIFERENTES', 'MONTO_ACUMULADO', 'FRECUENCIA_COMPRA']),
        target: zod_1.z.number().int().positive(),
        condition: zod_1.z.record(zod_1.z.unknown()),
        rewardPoints: zod_1.z.number().int().nonnegative(),
        rewardCoupon: zod_1.z.string().optional(),
        startDate: zod_1.z.string().datetime(),
        endDate: zod_1.z.string().datetime(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
const updateChallengeValidation = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
        type: zod_1.z.enum(['CANTIDAD_PRODUCTOS', 'CANTIDAD_COMPRAS', 'MARCAS_DIFERENTES', 'CATEGORIAS_DIFERENTES', 'MONTO_ACUMULADO', 'FRECUENCIA_COMPRA']).optional(),
        target: zod_1.z.number().int().positive().optional(),
        condition: zod_1.z.record(zod_1.z.unknown()).optional(),
        rewardPoints: zod_1.z.number().int().nonnegative().optional(),
        rewardCoupon: zod_1.z.string().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'desafios'), challengeController.getChallenges);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'desafios'), challengeController.getChallengeById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(challengeValidation), challengeController.createChallenge);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(updateChallengeValidation), challengeController.updateChallenge);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), challengeController.deleteChallenge);
exports.default = router;
//# sourceMappingURL=challenge.routes.js.map
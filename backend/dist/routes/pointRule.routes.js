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
const pointRuleController = __importStar(require("../controllers/pointRule.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createRuleSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['POR_MONTO', 'POR_PRODUCTO', 'POR_CATEGORIA', 'PRIMERA_COMPRA', 'CUMPLEANOS', 'RANGO_MONTO']),
        config: zod_1.z.record(zod_1.z.unknown()).optional(),
        priority: zod_1.z.number().int().default(0),
        validFrom: zod_1.z.string().optional(),
        validTo: zod_1.z.string().optional(),
        productIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const updateRuleSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['POR_MONTO', 'POR_PRODUCTO', 'POR_CATEGORIA', 'PRIMERA_COMPRA', 'CUMPLEANOS', 'RANGO_MONTO']).optional(),
        config: zod_1.z.record(zod_1.z.unknown()).optional(),
        priority: zod_1.z.number().int().optional(),
        isActive: zod_1.z.boolean().optional(),
        validFrom: zod_1.z.string().optional(),
        validTo: zod_1.z.string().optional(),
        productIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
});
// GET - CAJERA and ADMIN can view
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), pointRuleController.getPointRules);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), pointRuleController.getPointRuleById);
// POST/PUT/DELETE - ADMIN only
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(createRuleSchema), pointRuleController.createPointRule);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(updateRuleSchema), pointRuleController.updatePointRule);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), pointRuleController.deletePointRule);
exports.default = router;
//# sourceMappingURL=pointRule.routes.js.map
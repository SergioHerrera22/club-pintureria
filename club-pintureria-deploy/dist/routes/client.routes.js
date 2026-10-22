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
const clientController = __importStar(require("../controllers/client.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), clientController.listClients);
const createClientSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(1),
        lastName: zod_1.z.string().min(1),
        dni: zod_1.z.string().min(7).max(8),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
        password: zod_1.z.string().min(6).optional(),
    }),
});
// Alta de nuevos clientes: Admin, Cajera y Vendedor
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'CAJERA', 'VENDEDOR'), (0, auth_1.requireMenuPermission)('clientes', 'nuevo-cliente'), (0, validation_1.validate)(createClientSchema), clientController.createClient);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), clientController.getClientDetail);
router.get('/dni/:dni', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), clientController.findClientByDni);
router.get('/dni/:dni/points', clientController.getClientPoints);
router.get('/dni/:dni/history', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), clientController.getClientHistory);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), (0, auth_1.requireMenuPermission)('clientes'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(1).optional(),
        lastName: zod_1.z.string().min(1).optional(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
})), clientController.updateClient);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), clientController.deleteClient);
const purchaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string(),
            quantity: zod_1.z.number().int().positive().default(1),
        })).min(1),
        paymentMethod: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        // Vendedor acreditado con la venta (opcional)
        vendorId: zod_1.z.string().min(1).optional(),
        // Optional fields for auto-creating new client
        firstName: zod_1.z.string().min(1).optional(),
        lastName: zod_1.z.string().min(1).optional(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional(),
    }),
});
const quickPurchaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
        amount: zod_1.z.number().positive(),
        notes: zod_1.z.string().optional(),
        // Vendedor acreditado con la venta (opcional)
        vendorId: zod_1.z.string().min(1).optional(),
        // Optional fields for auto-creating new client
        firstName: zod_1.z.string().min(1).optional(),
        lastName: zod_1.z.string().min(1).optional(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional(),
    }),
});
router.post('/purchase', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'ventas'), (0, auth_1.requireMenuPermission)('ventas'), (0, validation_1.validate)(purchaseSchema), clientController.registerPurchase);
router.post('/quick-purchase', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'ventas'), (0, auth_1.requireMenuPermission)('ventas'), (0, validation_1.validate)(quickPurchaseSchema), clientController.registerQuickPurchase);
exports.default = router;
//# sourceMappingURL=client.routes.js.map
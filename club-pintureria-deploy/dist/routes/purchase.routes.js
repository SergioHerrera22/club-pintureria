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
const saleRevisionController = __importStar(require("../controllers/saleRevision.controller"));
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
// ===== MIS VENTAS + REVISIONES =====
// Importante: declarar ANTES de las rutas /:id para que "mine" y "revisions"
// no sean interpretados como un id de compra.
// Ventas propias del usuario (vendedor/cajera/admin)
router.get('/mine', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), saleRevisionController.getMyPurchases);
// Vendedores activos para el selector al registrar una venta (cajera/admin)
router.get('/vendors', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN'), saleRevisionController.getVendorsForSale);
// Solicitudes de revisión (admin)
router.get('/revisions', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), saleRevisionController.listRevisions);
// Estado de mis solicitudes de revisión
router.get('/revisions/mine', auth_1.authenticate, (0, auth_1.authorize)('CAJERA', 'ADMIN', 'VENDEDOR'), saleRevisionController.getMyRevisions);
// Aprobar / rechazar una solicitud (admin)
const approveRevisionValidation = zod_1.z.object({
    body: zod_1.z.object({
        note: zod_1.z.string().max(1000).optional(),
    }),
});
const rejectRevisionValidation = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(5, 'Indicá el motivo del rechazo (mínimo 5 caracteres)').max(1000),
    }),
});
router.post('/revisions/:id/approve', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(approveRevisionValidation), saleRevisionController.approveRevision);
router.post('/revisions/:id/reject', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(rejectRevisionValidation), saleRevisionController.rejectRevision);
// El vendedor/cajera solicita la revisión de una venta propia del día
const revisionRequestValidation = zod_1.z.object({
    body: zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string().min(1),
            quantity: zod_1.z.number().int().positive(),
            discount: zod_1.z.number().min(0).max(100).optional(),
        })).min(1).optional(),
        newClientDni: zod_1.z.string().regex(/^\d{7,8}$/, 'DNI inválido').optional(),
        notes: zod_1.z.string().max(500).optional(),
        observation: zod_1.z.string().min(10, 'Explicá el motivo de la revisión (mínimo 10 caracteres)').max(1000),
    }),
});
router.post('/:id/revision', auth_1.authenticate, (0, auth_1.authorize)('VENDEDOR', 'CAJERA'), (0, validation_1.validate)(revisionRequestValidation), saleRevisionController.requestRevision);
// ===== VENTAS =====
router.post('/', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'ventas'), (0, auth_1.requireMenuPermission)('ventas'), (0, validation_1.validate)(createPurchaseValidation), purchaseController.createPurchase);
router.get('/', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'ventas'), purchaseController.getPurchases);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'ventas'), purchaseController.getPurchaseById);
router.post('/:id/cancel', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), purchaseController.cancelPurchase);
exports.default = router;
//# sourceMappingURL=purchase.routes.js.map
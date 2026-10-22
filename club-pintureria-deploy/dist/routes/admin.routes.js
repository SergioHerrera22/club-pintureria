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
const adminController = __importStar(require("../controllers/admin.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.authorize)('ADMIN'));
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
const createUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
        firstName: zod_1.z.string().min(1),
        lastName: zod_1.z.string().min(1),
        dni: zod_1.z.string().min(7).max(8),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
        role: zod_1.z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
        branchId: zod_1.z.string().optional(),
    }),
});
router.post('/users', (0, validation_1.validate)(createUserSchema), adminController.createUser);
const PERMISSION_KEYS = [
    'dashboard',
    'nuevo-cliente',
    'clientes',
    'ventas',
    'usuarios',
    'campanas',
    'productos',
    'reglas-puntos',
    'premios',
    'sucursales',
    'marcas',
    'categorias',
    'promociones',
    'cupones',
    'desafios',
    'beneficios',
    'configuracion',
];
const updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
        role: zod_1.z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
        isActive: zod_1.z.boolean().optional(),
        branchId: zod_1.z.string().optional().nullable(),
        permissions: zod_1.z.array(zod_1.z.enum(PERMISSION_KEYS)).nullable().optional(),
        confirmationKey: zod_1.z.string().optional(),
    }),
    params: zod_1.z.object({ id: zod_1.z.string() }),
});
router.put('/users/:id', (0, validation_1.validate)(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
const adjustPointsSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string(),
        points: zod_1.z.number().int(),
        reason: zod_1.z.string().min(1),
    }),
});
router.post('/adjust-points', (0, validation_1.validate)(adjustPointsSchema), adminController.adjustPoints);
exports.default = router;
//# sourceMappingURL=admin.routes.js.map
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
const authController = __importStar(require("../controllers/auth.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6).optional().default('123456'),
        firstName: zod_1.z.string().min(1),
        lastName: zod_1.z.string().min(1),
        dni: zod_1.z.string().min(7).max(8),
        phone: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
        role: zod_1.z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
    }),
});
const loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string(),
    }),
});
const refreshSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string(),
    }),
});
const changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string(),
        newPassword: zod_1.z.string().min(6),
    }),
});
router.post('/register', auth_1.optionalAuth, (0, validation_1.validate)(registerSchema), authController.register);
router.post('/login', (0, validation_1.validate)(loginSchema), authController.login);
router.post('/refresh', (0, validation_1.validate)(refreshSchema), authController.refreshToken);
router.post('/logout', auth_1.authenticate, authController.logout);
router.get('/me', auth_1.authenticate, authController.getMe);
router.put('/me', auth_1.authenticate, authController.updateProfile);
router.put('/me/password', auth_1.authenticate, (0, validation_1.validate)(changePasswordSchema), authController.changePassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map
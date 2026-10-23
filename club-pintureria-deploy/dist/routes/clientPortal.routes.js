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
const clientPortalController = __importStar(require("../controllers/clientPortal.controller"));
const router = (0, express_1.Router)();
/**
 * Limitador de intentos en memoria (por IP). El rate limit global está
 * deshabilitado, pero el portal es público: limitamos fuerza bruta sobre
 * check/claim/login.
 */
const attempts = new Map();
const portalRateLimit = (max, windowMs) => {
    return (req, res, next) => {
        const ip = req.ip || 'unknown';
        const now = Date.now();
        const entry = attempts.get(ip);
        if (!entry || entry.resetAt < now) {
            attempts.set(ip, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }
        entry.count += 1;
        if (entry.count > max) {
            res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
            return;
        }
        next();
    };
};
// Limpieza periódica para que el mapa no crezca indefinidamente
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attempts) {
        if (entry.resetAt < now)
            attempts.delete(ip);
    }
}, 10 * 60 * 1000).unref();
const dniSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(6, 'DNI inválido').max(12, 'DNI inválido'),
    }),
});
const claimSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(6).max(12),
        phone: zod_1.z.string().max(30).optional(),
        email: zod_1.z.string().email('Email inválido').optional(),
        password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
    }),
});
const portalLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(6).max(12),
        password: zod_1.z.string().min(1, 'Contraseña requerida').max(72),
    }),
});
const portalRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(6).max(12),
        firstName: zod_1.z.string().min(1, 'Nombre requerido').max(50),
        lastName: zod_1.z.string().min(1, 'Apellido requerido').max(50),
        phone: zod_1.z.string().min(6, 'Teléfono requerido').max(30),
        email: zod_1.z.string().email('Email inválido').optional().or(zod_1.z.literal('')),
        password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
    }),
});
const portalRecoverSchema = zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(6).max(12),
        password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
        phone: zod_1.z.string().max(30).optional(),
        email: zod_1.z.string().email('Email inválido').optional().or(zod_1.z.literal('')),
    }),
});
router.post('/check', portalRateLimit(30, 15 * 60 * 1000), (0, validation_1.validate)(dniSchema), clientPortalController.checkDni);
router.post('/claim', portalRateLimit(10, 15 * 60 * 1000), (0, validation_1.validate)(claimSchema), clientPortalController.claimAccount);
router.post('/recover-password', portalRateLimit(10, 15 * 60 * 1000), (0, validation_1.validate)(portalRecoverSchema), clientPortalController.recoverClientPassword);
router.post('/login', portalRateLimit(15, 15 * 60 * 1000), (0, validation_1.validate)(portalLoginSchema), clientPortalController.loginClient);
router.post('/register', portalRateLimit(10, 15 * 60 * 1000), (0, validation_1.validate)(portalRegisterSchema), clientPortalController.registerClient);
exports.default = router;
//# sourceMappingURL=clientPortal.routes.js.map
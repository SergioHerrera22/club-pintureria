"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorize = exports.authenticate = exports.resolveBranchScope = exports.NO_BRANCH = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
exports.NO_BRANCH = '__NO_BRANCH__';
/**
 * Resuelve el scope de sucursal para el usuario autenticado.
 * - ADMIN: ve todo (scope global, isGlobal=true, branchId null).
 * - CAJERA/VENDEDOR: solo datos de su propia sucursal.
 * - Sin sucursal asignada: no ve datos de nadie (sentinel NO_BRANCH).
 */
const resolveBranchScope = (user) => {
    if (!user)
        return { isGlobal: false, branchId: exports.NO_BRANCH };
    if (user.role === client_1.UserRole.ADMIN)
        return { isGlobal: true, branchId: null };
    return { isGlobal: false, branchId: user.branchId || exports.NO_BRANCH };
};
exports.resolveBranchScope = resolveBranchScope;
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token no proporcionado' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true },
        });
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'Usuario no válido o inactivo' });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ error: 'Token expirado' });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({ error: 'Token inválido' });
            return;
        }
        next(error);
    }
};
exports.authenticate = authenticate;
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'No autorizado' });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true },
        });
        if (user && user.isActive) {
            req.user = user;
        }
        next();
    }
    catch {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map
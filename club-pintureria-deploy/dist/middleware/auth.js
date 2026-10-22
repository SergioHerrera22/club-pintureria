"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireStaffMenuPermission = exports.requireMenuPermissionForWrite = exports.requireMenuPermission = exports.hasMenuPermission = exports.authorizeWithPermission = exports.authorize = exports.authenticate = exports.resolveBranchScope = exports.NO_BRANCH = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
/**
 * Normaliza el campo permissions que llega de Prisma (Json) a string[] | null.
 */
function normalizePermissions(value) {
    if (!Array.isArray(value))
        return null;
    return value.filter((p) => typeof p === 'string');
}
exports.NO_BRANCH = '__NO_BRANCH__';
/**
 * Caché en memoria de usuarios autenticados (TTL corto).
 * Evita consultar la DB en CADA request autenticado, lo que satura el pool
 * de conexiones cuando el frontend dispara varias requests en paralelo.
 * TTL de 15s: un usuario desactivado deja de pasar en ese plazo.
 */
const USER_CACHE_TTL_MS = 3_000;
const userCache = new Map();
function getCachedUser(id) {
    const cached = userCache.get(id);
    if (cached && cached.expiresAt > Date.now())
        return cached.user;
    if (cached)
        userCache.delete(id);
    return null;
}
function setCachedUser(id, user) {
    // Limpieza simple para que el mapa no crezca indefinidamente
    if (userCache.size > 500) {
        const now = Date.now();
        for (const [key, value] of userCache) {
            if (value.expiresAt <= now)
                userCache.delete(key);
        }
    }
    userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}
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
        let user = getCachedUser(decoded.id);
        if (!user) {
            const dbUser = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true, permissions: true },
            });
            if (!dbUser || !dbUser.isActive) {
                res.status(401).json({ error: 'Usuario no válido o inactivo' });
                return;
            }
            user = { ...dbUser, permissions: normalizePermissions(dbUser.permissions) };
            setCachedUser(decoded.id, user);
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
        // Errores de conexión/timeouts de DB: no son un fallo del token ni un error
        // lógico. 503 le indica al frontend que reintente sin desloguear al usuario.
        const isDbError = typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof error.code === 'string' &&
            error.code.startsWith('P');
        if (isDbError) {
            res.status(503).json({ error: 'Servicio temporalmente no disponible, intente nuevamente' });
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
/**
 * Como authorize(), pero permite además el acceso a un usuario con
 * permisos personalizados que incluyan alguna de las secciones indicadas.
 * Así el admin puede otorgar a un vendedor acceso a secciones de nivel
 * cajera (ej: Clientes, Ventas, Dashboard) sin cambiarle el rol.
 * - El rol por defecto pasa siempre (luego requireMenuPermission puede
 *   bloquear si tiene permisos personalizados que excluyen la sección).
 * - CLIENTE nunca pasa por aquí.
 */
const authorizeWithPermission = (allowedRoles, ...permissionKeys) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (req.user.role === client_1.UserRole.CLIENTE) {
            res.status(403).json({ error: 'No autorizado' });
            return;
        }
        if (allowedRoles.includes(req.user.role)) {
            next();
            return;
        }
        const permissions = req.user.permissions;
        if (Array.isArray(permissions) && permissionKeys.some((k) => permissions.includes(k))) {
            next();
            return;
        }
        res.status(403).json({ error: 'No autorizado' });
    };
};
exports.authorizeWithPermission = authorizeWithPermission;
/**
 * Indica si el usuario tiene habilitada una sección del menú.
 * - ADMIN: siempre true (no se puede bloquear para no perder acceso al panel).
 * - Sin permisos personalizados (permissions null): true (usa los defaults del rol).
 * - Con permisos personalizados: true solo si la clave está en la lista.
 */
const hasMenuPermission = (user, ...keys) => {
    if (!user)
        return false;
    if (user.role === client_1.UserRole.ADMIN)
        return true;
    const permissions = user.permissions;
    if (!Array.isArray(permissions))
        return true;
    return keys.some((k) => permissions.includes(k));
};
exports.hasMenuPermission = hasMenuPermission;
/**
 * Bloquea la acción si el usuario tiene permisos personalizados y ninguno
 * de las claves indicadas está habilitado. ADMIN y usuarios sin
 * personalización pasan siempre.
 */
const requireMenuPermission = (...keys) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if ((0, exports.hasMenuPermission)(req.user, ...keys)) {
            next();
            return;
        }
        res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
    };
};
exports.requireMenuPermission = requireMenuPermission;
/**
 * Variante para módulos donde las lecturas (GET) se usan desde varias
 * pantallas: solo exige el permiso para métodos de escritura.
 */
const requireMenuPermissionForWrite = (...keys) => {
    const check = (0, exports.requireMenuPermission)(...keys);
    return (req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            next();
            return;
        }
        check(req, res, next);
    };
};
exports.requireMenuPermissionForWrite = requireMenuPermissionForWrite;
/**
 * Para rutas públicas/semi-públicas (ej. POST /auth/register con optionalAuth):
 * si el que llama es un empleado autenticado con permisos personalizados,
 * exige que alguna de las claves esté habilitada. Los anónimos pasan.
 */
const requireStaffMenuPermission = (...keys) => {
    return (req, res, next) => {
        if (!req.user) {
            next();
            return;
        }
        if ((0, exports.hasMenuPermission)(req.user, ...keys)) {
            next();
            return;
        }
        res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
    };
};
exports.requireStaffMenuPermission = requireStaffMenuPermission;
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
            select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true, permissions: true },
        });
        if (user && user.isActive) {
            req.user = { ...user, permissions: normalizePermissions(user.permissions) };
        }
        next();
    }
    catch {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map
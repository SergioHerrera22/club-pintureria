"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustPoints = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const prisma_1 = require("../config/prisma");
const points_service_1 = require("../services/points.service");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
/**
 * Verifica la clave de confirmación para operaciones sensibles sobre administradores
 * (eliminar o editar un usuario con rol ADMIN).
 */
const assertAdminConfirmation = (confirmationKey) => {
    if (!confirmationKey || confirmationKey !== config_1.config.adminConfirmationKey) {
        throw new errorHandler_1.AppError(403, 'Clave de confirmación incorrecta para modificar un administrador');
    }
};
const getUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, role, isActive, branchId } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { dni: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (role)
            where.role = role;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        if (branchId)
            where.branchId = branchId;
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { clientProfile: true, branch: true },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        res.json({
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                dni: u.dni,
                phone: u.phone,
                role: u.role,
                isActive: u.isActive,
                createdAt: u.createdAt,
                clientProfile: u.clientProfile,
                branch: u.branch,
                permissions: Array.isArray(u.permissions) ? u.permissions : null,
            })),
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: { clientProfile: true, branch: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Usuario no encontrado');
        // Últimos movimientos del cliente (para el modal de detalle del ojito)
        const recentTransactions = await prisma_1.prisma.transaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { items: { include: { product: true } } },
        });
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            phone: user.phone,
            birthDate: user.birthDate,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            clientProfile: user.clientProfile,
            branch: user.branch,
            permissions: Array.isArray(user.permissions) ? user.permissions : null,
            recentTransactions: recentTransactions.map(t => ({
                id: t.id,
                type: t.type,
                total: Number(t.total),
                pointsEarned: t.pointsEarned,
                pointsBalance: t.pointsBalance,
                description: t.description,
                createdAt: t.createdAt,
                items: t.items.map(i => ({
                    productName: i.product.name,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    lineTotal: Number(i.lineTotal),
                })),
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const createUser = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, dni, phone, birthDate, role = 'CLIENTE', branchId } = req.body;
        const existing = await prisma_1.prisma.user.findFirst({ where: { OR: [{ email }, { dni }] } });
        if (existing)
            throw new errorHandler_1.AppError(409, 'Email o DNI ya registrado');
        // Cajeras y vendedores deben pertenecer a una sucursal
        if ((role === 'CAJERA' || role === 'VENDEDOR') && !branchId) {
            throw new errorHandler_1.AppError(400, 'Las cajeras y vendedores deben tener una sucursal asignada');
        }
        if (branchId) {
            const branch = await prisma_1.prisma.branch.findUnique({ where: { id: branchId } });
            if (!branch)
                throw new errorHandler_1.AppError(404, 'Sucursal no encontrada');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                dni,
                phone,
                birthDate: birthDate ? new Date(birthDate) : null,
                role: role,
                branchId: branchId || null,
            },
            include: { branch: true },
        });
        if (role === 'CLIENTE') {
            await prisma_1.prisma.clientProfile.create({ data: { userId: user.id } });
        }
        res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, dni: user.dni, role: user.role, branch: user.branch });
    }
    catch (error) {
        next(error);
    }
};
exports.createUser = createUser;
/**
 * Secciones reservadas para administradores: aunque el body las incluya,
 * no se guardan en usuarios no-admin (los permisos personalizados expanden
 * al personal dentro de las secciones de nivel cajera, nunca a admin).
 */
const ADMIN_ONLY_PERMISSION_KEYS = new Set([
    'usuarios', 'productos', 'reglas-puntos', 'sucursales', 'marcas', 'categorias', 'configuracion',
]);
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, birthDate, role, isActive, branchId, permissions, confirmationKey } = req.body;
        // Cajeras y vendedores deben pertenecer a una sucursal
        const targetUser = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!targetUser)
            throw new errorHandler_1.AppError(404, 'Usuario no encontrado');
        // Editar un administrador (o promover a admin) requiere clave de confirmación
        if (targetUser.role === client_1.UserRole.ADMIN || role === 'ADMIN') {
            assertAdminConfirmation(confirmationKey);
        }
        const effectiveRole = (role ?? targetUser.role);
        const normalizedBranchId = branchId === '' ? null : branchId;
        const effectiveBranchId = normalizedBranchId !== undefined ? normalizedBranchId : targetUser.branchId;
        if ((effectiveRole === 'CAJERA' || effectiveRole === 'VENDEDOR') && !effectiveBranchId) {
            throw new errorHandler_1.AppError(400, 'Las cajeras y vendedores deben tener una sucursal asignada');
        }
        if (normalizedBranchId) {
            const branch = await prisma_1.prisma.branch.findUnique({ where: { id: normalizedBranchId } });
            if (!branch)
                throw new errorHandler_1.AppError(404, 'Sucursal no encontrada');
        }
        // Los administradores siempre tienen acceso total: se ignoran los permisos personalizados.
        // - Body sin `permissions` (undefined) → no se toca lo guardado.
        // - `permissions: null` → vuelve a los permisos por defecto del rol.
        // - `permissions: [...]` → se guardan solo claves válidas.
        let permissionsUpdate = undefined;
        if (effectiveRole === client_1.UserRole.ADMIN) {
            permissionsUpdate = client_1.Prisma.JsonNull;
        }
        else if (Array.isArray(permissions)) {
            const valid = permissions.filter((p) => typeof p === 'string');
            permissionsUpdate = valid.filter((p) => !ADMIN_ONLY_PERMISSION_KEYS.has(p));
        }
        else if (permissions === null) {
            permissionsUpdate = client_1.Prisma.JsonNull;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                phone,
                birthDate: birthDate ? new Date(birthDate) : undefined,
                role,
                isActive,
                branchId: normalizedBranchId !== undefined ? normalizedBranchId : undefined,
                permissions: permissionsUpdate,
            },
            include: { branch: true },
        });
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, dni: user.dni, role: user.role, isActive: user.isActive, branch: user.branch, permissions: Array.isArray(user.permissions) ? user.permissions : null });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Eliminar un administrador requiere clave de confirmación
        const targetUser = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!targetUser)
            throw new errorHandler_1.AppError(404, 'Usuario no encontrado');
        if (targetUser.role === client_1.UserRole.ADMIN) {
            assertAdminConfirmation(req.body?.confirmationKey);
        }
        await prisma_1.prisma.user.delete({ where: { id } });
        res.json({ message: 'Usuario eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const adjustPoints = async (req, res, next) => {
    try {
        const { userId, points, reason } = req.body;
        await points_service_1.PointsService.adjustPoints(userId, points, reason, req.user.id);
        const profile = await prisma_1.prisma.clientProfile.findUnique({ where: { userId } });
        res.json({ message: 'Puntos ajustados', currentPoints: profile?.currentPoints });
    }
    catch (error) {
        next(error);
    }
};
exports.adjustPoints = adjustPoints;
//# sourceMappingURL=admin.controller.js.map
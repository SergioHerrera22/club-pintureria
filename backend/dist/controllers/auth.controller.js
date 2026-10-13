"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.changePassword = exports.updateProfile = exports.getMe = exports.refreshToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const config_1 = require("../config");
const email_service_1 = require("../services/email.service");
const errorHandler_1 = require("../middleware/errorHandler");
const generateTokens = (user) => {
    const accessOptions = { expiresIn: config_1.config.jwt.expiresIn };
    const refreshOptions = { expiresIn: config_1.config.jwt.refreshExpiresIn };
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, dni: user.dni, branchId: user.branchId ?? null }, config_1.config.jwt.secret, accessOptions);
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, type: 'refresh' }, config_1.config.jwt.secret, refreshOptions);
    return { accessToken, refreshToken };
};
const register = async (req, res, next) => {
    try {
        const { email, password = '123456', firstName, lastName, dni, phone, birthDate } = req.body;
        // El registro público solo crea clientes. El personal (cajeras/vendedores/admins)
        // se da de alta desde el panel de administración.
        // Si el alta la hace un empleado autenticado, el cliente queda asociado a su sucursal.
        const requester = req.user;
        let branchId = null;
        if (requester && (requester.role === 'CAJERA' || requester.role === 'VENDEDOR')) {
            if (!requester.branchId) {
                throw new errorHandler_1.AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
            }
            branchId = requester.branchId;
        }
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: { OR: [{ email }, { dni }] },
        });
        if (existingUser) {
            throw new errorHandler_1.AppError(409, 'Email o DNI ya registrado');
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
                role: 'CLIENTE',
                branchId,
            },
        });
        await prisma_1.prisma.clientProfile.create({
            data: { userId: user.id },
        });
        const { accessToken, refreshToken } = generateTokens(user);
        if (user.role === 'CLIENTE' && user.email) {
            await email_service_1.emailService.sendWelcomeEmail(user.email, user.firstName);
        }
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                dni: user.dni,
                role: user.role,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email }, include: { branch: true } });
        if (!user || !user.isActive) {
            throw new errorHandler_1.AppError(401, 'Credenciales inválidas');
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Credenciales inválidas');
        }
        const { accessToken, refreshToken } = generateTokens(user);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                dni: user.dni,
                role: user.role,
                branchId: user.branchId,
                branch: user.branch,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new errorHandler_1.AppError(400, 'Refresh token requerido');
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.config.jwt.secret);
        if (decoded.type !== 'refresh') {
            throw new errorHandler_1.AppError(401, 'Token inválido');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, dni: true, isActive: true, branchId: true },
        });
        if (!user || !user.isActive) {
            throw new errorHandler_1.AppError(401, 'Usuario no válido');
        }
        const tokens = generateTokens(user);
        res.json(tokens);
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.AppError(401, 'Refresh token inválido'));
            return;
        }
        next(error);
    }
};
exports.refreshToken = refreshToken;
const getMe = async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { clientProfile: true, branch: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'Usuario no encontrado');
        }
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            phone: user.phone,
            birthDate: user.birthDate,
            role: user.role,
            branchId: user.branchId,
            branch: user.branch,
            clientProfile: user.clientProfile,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName, phone, birthDate } = req.body;
        const user = await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: { firstName, lastName, phone, birthDate: birthDate ? new Date(birthDate) : undefined },
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
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Usuario no encontrado');
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid)
            throw new errorHandler_1.AppError(401, 'Contraseña actual incorrecta');
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        res.json({ message: 'Contraseña actualizada correctamente' });
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
const logout = async (req, res) => {
    res.json({ message: 'Sesión cerrada correctamente' });
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map
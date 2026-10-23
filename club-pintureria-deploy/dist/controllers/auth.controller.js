"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.logout = exports.changePassword = exports.updateProfile = exports.getMe = exports.refreshToken = exports.login = exports.register = exports.generateTokens = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
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
exports.generateTokens = generateTokens;
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
        const { accessToken, refreshToken } = (0, exports.generateTokens)(user);
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
        const { accessToken, refreshToken } = (0, exports.generateTokens)(user);
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
                permissions: Array.isArray(user.permissions) ? user.permissions : null,
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
        const tokens = (0, exports.generateTokens)(user);
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
            permissions: Array.isArray(user.permissions) ? user.permissions : null,
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
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos
const hashResetToken = (token) => crypto_1.default.createHash('sha256').update(token).digest('hex');
/** URL base del frontend: FRONTEND_URL si está definida, si no el mismo origen. */
const buildFrontendUrl = (req) => {
    const envUrl = (process.env.FRONTEND_URL || '').trim();
    if (envUrl)
        return envUrl.replace(/\/$/, '');
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : config_1.config.frontendUrl.replace(/\/$/, '');
};
/**
 * Recuperación de contraseña (empleados/admin). Siempre responde lo mismo para
 * no revelar si el correo existe; el enlace se envía sólo a usuarios activos
 * que no sean clientes (los clientes usan el portal /users).
 */
const forgotPassword = async (req, res, next) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const user = email
            ? await prisma_1.prisma.user.findFirst({
                where: { email, isActive: true, role: { not: 'CLIENTE' } },
            })
            : null;
        if (user) {
            try {
                const token = crypto_1.default.randomBytes(32).toString('hex');
                await prisma_1.prisma.passwordResetToken.create({
                    data: {
                        userId: user.id,
                        tokenHash: hashResetToken(token),
                        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                    },
                });
                const link = `${buildFrontendUrl(req)}/reset-password?token=${token}`;
                const sent = await email_service_1.emailService.sendPasswordResetEmail(user.email, user.firstName, link);
                if (!sent) {
                    console.warn('No se pudo enviar el correo de recuperación (SMTP sin configurar o con error)');
                }
            }
            catch (err) {
                // Nunca filtramos el detalle al cliente final; lo dejamos en el log.
                console.error('Error al generar el enlace de recuperación:', err);
            }
        }
        res.json({
            message: 'Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
/** Consumo del enlace: valida el token (un solo uso y no vencido) y guarda la clave nueva. */
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const record = await prisma_1.prisma.passwordResetToken.findUnique({
            where: { tokenHash: hashResetToken(String(token || '')) },
        });
        if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
            throw new errorHandler_1.AppError(400, 'El enlace no es válido o venció. Pedí uno nuevo.');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
            prisma_1.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
        ]);
        res.json({ message: 'Contraseña actualizada. Ya podés iniciar sesión.' });
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=auth.controller.js.map
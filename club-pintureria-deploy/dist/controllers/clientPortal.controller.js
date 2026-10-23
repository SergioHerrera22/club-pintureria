"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClient = exports.loginClient = exports.recoverClientPassword = exports.claimAccount = exports.checkDni = exports.cleanDni = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_controller_1 = require("./auth.controller");
/**
 * Portal de clientes (/users): alta y login autogestionados por DNI.
 *
 - Clientes dados de alta por el personal con passwordHash vacío (o la
   contraseña temporal '123456') deben CREAR su contraseña la primera vez.
 - La creación de contraseña exige verificar el teléfono registrado
   (o el email si no hay teléfono) para evitar que un tercero con el DNI
   tome la cuenta.
 */
const DEFAULT_TEMP_PASSWORD = '123456';
const TEMP_EMAIL_SUFFIX = '@cliente.temp';
const cleanDni = (raw) => String(raw || '').replace(/[.\-\s]/g, '');
exports.cleanDni = cleanDni;
/** Normaliza teléfonos para comparar: solo dígitos. Si ambos tienen al menos
 *  8 dígitos se comparan los últimos 8 (ignora característica/país). */
const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '');
const phonesMatch = (a, b) => {
    const na = normalizePhone(a);
    const nb = normalizePhone(b);
    if (!na || !nb)
        return false;
    if (na.length < 6 || nb.length < 6)
        return na === nb;
    return na.slice(-8) === nb.slice(-8);
};
/** Indica si el cliente ya definió su propia contraseña. */
const hasOwnPassword = async (passwordHash) => {
    if (!passwordHash)
        return false;
    // Los dados de alta con la contraseña temporal cuentan como "sin contraseña"
    const isTemp = await bcryptjs_1.default.compare(DEFAULT_TEMP_PASSWORD, passwordHash).catch(() => false);
    return !isTemp;
};
const clientSessionResponse = (user) => {
    const { accessToken, refreshToken } = (0, auth_controller_1.generateTokens)(user);
    return {
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
    };
};
// ===== CHECK: ¿existe el DNI? ¿tiene contraseña? =====
const checkDni = async (req, res, next) => {
    try {
        const dni = (0, exports.cleanDni)(req.body?.dni);
        if (dni.length < 7 || dni.length > 8) {
            throw new errorHandler_1.AppError(400, 'Ingresá un DNI válido (7 u 8 dígitos)');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { dni },
            select: { firstName: true, passwordHash: true, phone: true, email: true, role: true, isActive: true },
        });
        if (!user || user.role !== client_1.UserRole.CLIENTE || !user.isActive) {
            res.json({ status: 'NOT_FOUND' });
            return;
        }
        const needsPassword = !(await hasOwnPassword(user.passwordHash));
        const verifyBy = user.phone ? 'phone' : user.email && !user.email.endsWith(TEMP_EMAIL_SUFFIX) ? 'email' : 'none';
        res.json({
            status: needsPassword ? 'NEEDS_PASSWORD' : 'READY',
            firstName: user.firstName,
            verifyBy,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.checkDni = checkDni;
// ===== CLAIM: crear contraseña para una cuenta dada de alta por el local =====
const claimAccount = async (req, res, next) => {
    try {
        const dni = (0, exports.cleanDni)(req.body?.dni);
        const { password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { dni }, include: { branch: true } });
        if (!user || user.role !== client_1.UserRole.CLIENTE) {
            throw new errorHandler_1.AppError(404, 'No encontramos un cliente con ese DNI. Si sos nuevo, registrate.');
        }
        if (!user.isActive) {
            throw new errorHandler_1.AppError(403, 'Tu cuenta está desactivada. Contactate con el local.');
        }
        if (await hasOwnPassword(user.passwordHash)) {
            throw new errorHandler_1.AppError(400, 'Tu cuenta ya tiene una contraseña. Iniciá sesión con ella.');
        }
        // Verificación de identidad: teléfono registrado (o email si no hay teléfono)
        if (user.phone) {
            const providedPhone = String(req.body?.phone || '');
            if (!normalizePhone(providedPhone)) {
                throw new errorHandler_1.AppError(400, 'Necesitamos el teléfono registrado para verificar tu identidad');
            }
            if (!phonesMatch(providedPhone, user.phone)) {
                throw new errorHandler_1.AppError(400, 'El teléfono no coincide con el que tenemos registrado. Verificalo o contactá al local.');
            }
        }
        else if (user.email && !user.email.endsWith(TEMP_EMAIL_SUFFIX)) {
            const providedEmail = String(req.body?.email || '').trim().toLowerCase();
            if (!providedEmail || providedEmail !== user.email.toLowerCase()) {
                throw new errorHandler_1.AppError(400, 'El email no coincide con el que tenemos registrado. Verificalo o contactá al local.');
            }
        }
        // Sin teléfono ni email real registrado: se permite la creación (no hay con qué verificar)
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        res.json(clientSessionResponse(user));
    }
    catch (error) {
        next(error);
    }
};
exports.claimAccount = claimAccount;
// ===== RECUPERAR CONTRASEÑA: verifica DNI + teléfono (o email) registrado =====
const recoverClientPassword = async (req, res, next) => {
    try {
        const dni = (0, exports.cleanDni)(req.body?.dni);
        const password = String(req.body?.password || '');
        const user = await prisma_1.prisma.user.findUnique({ where: { dni }, include: { branch: true } });
        if (!user || user.role !== client_1.UserRole.CLIENTE) {
            throw new errorHandler_1.AppError(404, 'No encontramos un cliente con ese DNI.');
        }
        if (!user.isActive) {
            throw new errorHandler_1.AppError(403, 'Tu cuenta está desactivada. Contactate con el local.');
        }
        // Misma verificación que "crear contraseña": el teléfono registrado (o el
        // email si no hay teléfono). Sin esos datos no hay forma de verificar.
        if (user.phone) {
            const providedPhone = String(req.body?.phone || '');
            if (!normalizePhone(providedPhone)) {
                throw new errorHandler_1.AppError(400, 'Necesitamos el teléfono registrado para verificar tu identidad');
            }
            if (!phonesMatch(providedPhone, user.phone)) {
                throw new errorHandler_1.AppError(400, 'El teléfono no coincide con el que tenemos registrado. Verificalo o contactá al local.');
            }
        }
        else if (user.email && !user.email.endsWith(TEMP_EMAIL_SUFFIX)) {
            const providedEmail = String(req.body?.email || '').trim().toLowerCase();
            if (!providedEmail || providedEmail !== user.email.toLowerCase()) {
                throw new errorHandler_1.AppError(400, 'El email no coincide con el que tenemos registrado. Verificalo o contactá al local.');
            }
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        res.json(clientSessionResponse(user));
    }
    catch (error) {
        next(error);
    }
};
exports.recoverClientPassword = recoverClientPassword;
// ===== LOGIN: cliente con contraseña creada =====
const loginClient = async (req, res, next) => {
    try {
        const dni = (0, exports.cleanDni)(req.body?.dni);
        const { password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { dni }, include: { branch: true } });
        if (!user || user.role !== client_1.UserRole.CLIENTE || !user.isActive || !user.passwordHash) {
            throw new errorHandler_1.AppError(401, 'Credenciales inválidas');
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Credenciales inválidas');
        }
        res.json(clientSessionResponse(user));
    }
    catch (error) {
        next(error);
    }
};
exports.loginClient = loginClient;
// ===== REGISTER: autogestión de nuevos clientes =====
const registerClient = async (req, res, next) => {
    try {
        const dni = (0, exports.cleanDni)(req.body?.dni);
        const { firstName, lastName, phone, password } = req.body;
        const email = String(req.body?.email || '').trim();
        if (dni.length < 7 || dni.length > 8) {
            throw new errorHandler_1.AppError(400, 'Ingresá un DNI válido (7 u 8 dígitos)');
        }
        const existingByDni = await prisma_1.prisma.user.findUnique({ where: { dni } });
        if (existingByDni) {
            throw new errorHandler_1.AppError(409, 'Ya existe un cliente con ese DNI. Ingresá tu DNI para crear tu contraseña.');
        }
        const finalEmail = email || `${dni}@cliente.temp`;
        if (email) {
            const existingByEmail = await prisma_1.prisma.user.findUnique({ where: { email: finalEmail } });
            if (existingByEmail) {
                throw new errorHandler_1.AppError(409, 'Ya hay una cuenta registrada con ese email');
            }
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                email: finalEmail,
                passwordHash,
                firstName,
                lastName,
                dni,
                phone: phone || null,
                role: client_1.UserRole.CLIENTE,
                branchId: null,
            },
            include: { branch: true },
        });
        await prisma_1.prisma.clientProfile.create({
            data: { userId: user.id },
        });
        res.status(201).json(clientSessionResponse(user));
    }
    catch (error) {
        next(error);
    }
};
exports.registerClient = registerClient;
//# sourceMappingURL=clientPortal.controller.js.map
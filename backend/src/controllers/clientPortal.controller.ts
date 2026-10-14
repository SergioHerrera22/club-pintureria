import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateTokens } from './auth.controller';

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

export const cleanDni = (raw: string): string => String(raw || '').replace(/[.\-\s]/g, '');

/** Normaliza teléfonos para comparar: solo dígitos. Si ambos tienen al menos
 *  8 dígitos se comparan los últimos 8 (ignora característica/país). */
const normalizePhone = (raw: string): string => String(raw || '').replace(/\D/g, '');

const phonesMatch = (a: string, b: string): boolean => {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na.length < 6 || nb.length < 6) return na === nb;
  return na.slice(-8) === nb.slice(-8);
};

/** Indica si el cliente ya definió su propia contraseña. */
const hasOwnPassword = async (passwordHash: string): Promise<boolean> => {
  if (!passwordHash) return false;
  // Los dados de alta con la contraseña temporal cuentan como "sin contraseña"
  const isTemp = await bcrypt.compare(DEFAULT_TEMP_PASSWORD, passwordHash).catch(() => false);
  return !isTemp;
};

const clientSessionResponse = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  role: UserRole;
  branchId: string | null;
  branch: unknown;
}) => {
  const { accessToken, refreshToken } = generateTokens(user);
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
export const checkDni = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dni = cleanDni(req.body?.dni);
    if (dni.length < 7 || dni.length > 8) {
      throw new AppError(400, 'Ingresá un DNI válido (7 u 8 dígitos)');
    }

    const user = await prisma.user.findUnique({
      where: { dni },
      select: { firstName: true, passwordHash: true, phone: true, email: true, role: true, isActive: true },
    });

    if (!user || user.role !== UserRole.CLIENTE || !user.isActive) {
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
  } catch (error) {
    next(error);
  }
};

// ===== CLAIM: crear contraseña para una cuenta dada de alta por el local =====
export const claimAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dni = cleanDni(req.body?.dni);
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { dni }, include: { branch: true } });

    if (!user || user.role !== UserRole.CLIENTE) {
      throw new AppError(404, 'No encontramos un cliente con ese DNI. Si sos nuevo, registrate.');
    }
    if (!user.isActive) {
      throw new AppError(403, 'Tu cuenta está desactivada. Contactate con el local.');
    }
    if (await hasOwnPassword(user.passwordHash)) {
      throw new AppError(400, 'Tu cuenta ya tiene una contraseña. Iniciá sesión con ella.');
    }

    // Verificación de identidad: teléfono registrado (o email si no hay teléfono)
    if (user.phone) {
      const providedPhone = String(req.body?.phone || '');
      if (!normalizePhone(providedPhone)) {
        throw new AppError(400, 'Necesitamos el teléfono registrado para verificar tu identidad');
      }
      if (!phonesMatch(providedPhone, user.phone)) {
        throw new AppError(400, 'El teléfono no coincide con el que tenemos registrado. Verificalo o contactá al local.');
      }
    } else if (user.email && !user.email.endsWith(TEMP_EMAIL_SUFFIX)) {
      const providedEmail = String(req.body?.email || '').trim().toLowerCase();
      if (!providedEmail || providedEmail !== user.email.toLowerCase()) {
        throw new AppError(400, 'El email no coincide con el que tenemos registrado. Verificalo o contactá al local.');
      }
    }
    // Sin teléfono ni email real registrado: se permite la creación (no hay con qué verificar)

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json(clientSessionResponse(user));
  } catch (error) {
    next(error);
  }
};

// ===== LOGIN: cliente con contraseña creada =====
export const loginClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dni = cleanDni(req.body?.dni);
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { dni }, include: { branch: true } });

    if (!user || user.role !== UserRole.CLIENTE || !user.isActive || !user.passwordHash) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    res.json(clientSessionResponse(user));
  } catch (error) {
    next(error);
  }
};

// ===== REGISTER: autogestión de nuevos clientes =====
export const registerClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dni = cleanDni(req.body?.dni);
    const { firstName, lastName, phone, password } = req.body;
    const email = String(req.body?.email || '').trim();

    if (dni.length < 7 || dni.length > 8) {
      throw new AppError(400, 'Ingresá un DNI válido (7 u 8 dígitos)');
    }

    const existingByDni = await prisma.user.findUnique({ where: { dni } });
    if (existingByDni) {
      throw new AppError(409, 'Ya existe un cliente con ese DNI. Ingresá tu DNI para crear tu contraseña.');
    }

    const finalEmail = email || `${dni}@cliente.temp`;
    if (email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
      if (existingByEmail) {
        throw new AppError(409, 'Ya hay una cuenta registrada con ese email');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: finalEmail,
        passwordHash,
        firstName,
        lastName,
        dni,
        phone: phone || null,
        role: UserRole.CLIENTE,
        branchId: null,
      },
      include: { branch: true },
    });

    await prisma.clientProfile.create({
      data: { userId: user.id },
    });

    res.status(201).json(clientSessionResponse(user));
  } catch (error) {
    next(error);
  }
};

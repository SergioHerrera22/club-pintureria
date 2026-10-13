import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { config } from '../config';
import { emailService } from '../services/email.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

import { SignOptions } from 'jsonwebtoken';

const generateTokens = (user: { id: string; email: string; role: string; dni: string; branchId?: string | null }) => {
  const accessOptions: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  const refreshOptions: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'] };
  
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, dni: user.dni, branchId: user.branchId ?? null },
    config.jwt.secret,
    accessOptions
  );
  
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.secret,
    refreshOptions
  );
  
  return { accessToken, refreshToken };
};

export const register = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password = '123456', firstName, lastName, dni, phone, birthDate } = req.body;
    
    // El registro público solo crea clientes. El personal (cajeras/vendedores/admins)
    // se da de alta desde el panel de administración.
    // Si el alta la hace un empleado autenticado, el cliente queda asociado a su sucursal.
    const requester = req.user;
    let branchId: string | null = null;
    if (requester && (requester.role === 'CAJERA' || requester.role === 'VENDEDOR')) {
      if (!requester.branchId) {
        throw new AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
      }
      branchId = requester.branchId;
    }
    
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { dni }] },
    });
    
    if (existingUser) {
      throw new AppError(409, 'Email o DNI ya registrado');
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
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
    
    await prisma.clientProfile.create({
      data: { userId: user.id },
    });
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    if (user.role === 'CLIENTE' && user.email) {
      await emailService.sendWelcomeEmail(user.email, user.firstName);
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
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email }, include: { branch: true } });
    if (!user || !user.isActive) {
      throw new AppError(401, 'Credenciales inválidas');
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Credenciales inválidas');
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
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError(400, 'Refresh token requerido');
    }
    
    const decoded = jwt.verify(refreshToken, config.jwt.secret) as { id: string; type: string };
    
    if (decoded.type !== 'refresh') {
      throw new AppError(401, 'Token inválido');
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, dni: true, isActive: true, branchId: true },
    });
    
    if (!user || !user.isActive) {
      throw new AppError(401, 'Usuario no válido');
    }
    
    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Refresh token inválido'));
      return;
    }
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { clientProfile: true, branch: true },
    });
    
    if (!user) {
      throw new AppError(404, 'Usuario no encontrado');
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
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, birthDate } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user!.id },
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
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError(401, 'Contraseña actual incorrecta');
    
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Sesión cerrada correctamente' });
};
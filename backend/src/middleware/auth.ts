import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    dni: string;
    firstName: string;
    lastName: string;
    branchId: string | null;
  };
}

export const NO_BRANCH = '__NO_BRANCH__';

/**
 * Resuelve el scope de sucursal para el usuario autenticado.
 * - ADMIN: ve todo (scope global, isGlobal=true, branchId null).
 * - CAJERA/VENDEDOR: solo datos de su propia sucursal.
 * - Sin sucursal asignada: no ve datos de nadie (sentinel NO_BRANCH).
 */
export const resolveBranchScope = (
  user?: { role: UserRole; branchId: string | null }
): { isGlobal: boolean; branchId: string | null } => {
  if (!user) return { isGlobal: false, branchId: NO_BRANCH };
  if (user.role === UserRole.ADMIN) return { isGlobal: true, branchId: null };
  return { isGlobal: false, branchId: user.branchId || NO_BRANCH };
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: UserRole;
      dni: string;
    };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true },
    });
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Usuario no válido o inactivo' });
      return;
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    next(error);
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
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

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: UserRole;
      dni: string;
    };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true },
    });
    
    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch {
    next();
  }
};
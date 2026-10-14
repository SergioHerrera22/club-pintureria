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
 * Caché en memoria de usuarios autenticados (TTL corto).
 * Evita consultar la DB en CADA request autenticado, lo que satura el pool
 * de conexiones cuando el frontend dispara varias requests en paralelo.
 * TTL de 15s: un usuario desactivado deja de pasar en ese plazo.
 */
const USER_CACHE_TTL_MS = 15_000;
const userCache = new Map<string, { user: AuthRequest['user']; expiresAt: number }>();

function getCachedUser(id: string) {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  if (cached) userCache.delete(id);
  return null;
}

function setCachedUser(id: string, user: AuthRequest['user']) {
  // Limpieza simple para que el mapa no crezca indefinidamente
  if (userCache.size > 500) {
    const now = Date.now();
    for (const [key, value] of userCache) {
      if (value.expiresAt <= now) userCache.delete(key);
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
    
    let user = getCachedUser(decoded.id);
    
    if (!user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true },
      });
      
      if (!dbUser || !dbUser.isActive) {
        res.status(401).json({ error: 'Usuario no válido o inactivo' });
        return;
      }
      
      user = dbUser;
      setCachedUser(decoded.id, user);
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
    // Errores de conexión/timeouts de DB: no son un fallo del token ni un error
    // lógico. 503 le indica al frontend que reintente sin desloguear al usuario.
    const isDbError =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code.startsWith('P');
    if (isDbError) {
      res.status(503).json({ error: 'Servicio temporalmente no disponible, intente nuevamente' });
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
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
    /** Permisos de menú personalizados. null/undefined = usar los del rol. */
    permissions: string[] | null;
  };
}

/**
 * Normaliza el campo permissions que llega de Prisma (Json) a string[] | null.
 */
function normalizePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((p): p is string => typeof p === 'string');
}

export const NO_BRANCH = '__NO_BRANCH__';

/**
 * Caché en memoria de usuarios autenticados (TTL corto).
 * Evita consultar la DB en CADA request autenticado, lo que satura el pool
 * de conexiones cuando el frontend dispara varias requests en paralelo.
 * TTL de 15s: un usuario desactivado deja de pasar en ese plazo.
 */
const USER_CACHE_TTL_MS = 3_000;
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

/**
 * Como authorize(), pero permite además el acceso a un usuario con
 * permisos personalizados que incluyan alguna de las secciones indicadas.
 * Así el admin puede otorgar a un vendedor acceso a secciones de nivel
 * cajera (ej: Clientes, Ventas, Dashboard) sin cambiarle el rol.
 * - El rol por defecto pasa siempre (luego requireMenuPermission puede
 *   bloquear si tiene permisos personalizados que excluyen la sección).
 * - CLIENTE nunca pasa por aquí.
 */
export const authorizeWithPermission = (allowedRoles: UserRole[], ...permissionKeys: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    
    if (req.user.role === UserRole.CLIENTE) {
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

/**
 * Indica si el usuario tiene habilitada una sección del menú.
 * - ADMIN: siempre true (no se puede bloquear para no perder acceso al panel).
 * - Sin permisos personalizados (permissions null): true (usa los defaults del rol).
 * - Con permisos personalizados: true solo si la clave está en la lista.
 */
export const hasMenuPermission = (
  user?: AuthRequest['user'],
  ...keys: string[]
): boolean => {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  const permissions = user.permissions;
  if (!Array.isArray(permissions)) return true;
  return keys.some((k) => permissions.includes(k));
};

/**
 * Bloquea la acción si el usuario tiene permisos personalizados y ninguno
 * de las claves indicadas está habilitado. ADMIN y usuarios sin
 * personalización pasan siempre.
 */
export const requireMenuPermission = (...keys: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (hasMenuPermission(req.user, ...keys)) {
      next();
      return;
    }
    res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
  };
};

/**
 * Variante para módulos donde las lecturas (GET) se usan desde varias
 * pantallas: solo exige el permiso para métodos de escritura.
 */
export const requireMenuPermissionForWrite = (...keys: string[]) => {
  const check = requireMenuPermission(...keys);
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    check(req, res, next);
  };
};

/**
 * Para rutas públicas/semi-públicas (ej. POST /auth/register con optionalAuth):
 * si el que llama es un empleado autenticado con permisos personalizados,
 * exige que alguna de las claves esté habilitada. Los anónimos pasan.
 */
export const requireStaffMenuPermission = (...keys: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }
    if (hasMenuPermission(req.user, ...keys)) {
      next();
      return;
    }
    res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
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
      select: { id: true, email: true, role: true, dni: true, firstName: true, lastName: true, isActive: true, branchId: true, permissions: true },
    });
    
    if (user && user.isActive) {
      req.user = { ...user, permissions: normalizePermissions(user.permissions) };
    }
    
    next();
  } catch {
    next();
  }
};
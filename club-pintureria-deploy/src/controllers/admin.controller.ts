import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { PointsService } from '../services/points.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../config';

/**
 * Verifica la clave de confirmación para operaciones sensibles sobre administradores
 * (eliminar o editar un usuario con rol ADMIN).
 */
const assertAdminConfirmation = (confirmationKey?: string): void => {
  if (!confirmationKey || confirmationKey !== config.adminConfirmationKey) {
    throw new AppError(403, 'Clave de confirmación incorrecta para modificar un administrador');
  }
};

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, role, isActive, branchId } = req.query;
    
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { dni: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (branchId) where.branchId = branchId as string;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { clientProfile: true, branch: true },
      }),
      prisma.user.count({ where }),
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
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { clientProfile: true, branch: true },
    });
    
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    
    // Últimos movimientos del cliente (para el modal de detalle del ojito)
    const recentTransactions = await prisma.transaction.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName, dni, phone, birthDate, role = 'CLIENTE', branchId } = req.body;
    
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { dni }] } });
    if (existing) throw new AppError(409, 'Email o DNI ya registrado');
    
    // Cajeras y vendedores deben pertenecer a una sucursal
    if ((role === 'CAJERA' || role === 'VENDEDOR') && !branchId) {
      throw new AppError(400, 'Las cajeras y vendedores deben tener una sucursal asignada');
    }
    
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new AppError(404, 'Sucursal no encontrada');
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
        role: role as UserRole,
        branchId: branchId || null,
      },
      include: { branch: true },
    });
    
    if (role === 'CLIENTE') {
      await prisma.clientProfile.create({ data: { userId: user.id } });
    }
    
    res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, dni: user.dni, role: user.role, branch: user.branch });
  } catch (error) {
    next(error);
  }
};

/**
 * Secciones reservadas para administradores: aunque el body las incluya,
 * no se guardan en usuarios no-admin (los permisos personalizados expanden
 * al personal dentro de las secciones de nivel cajera, nunca a admin).
 */
const ADMIN_ONLY_PERMISSION_KEYS = new Set([
  'usuarios', 'productos', 'reglas-puntos', 'sucursales', 'marcas', 'categorias', 'configuracion',
]);

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, birthDate, role, isActive, branchId, permissions, confirmationKey } = req.body;
    
    // Cajeras y vendedores deben pertenecer a una sucursal
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new AppError(404, 'Usuario no encontrado');
    
    // Editar un administrador (o promover a admin) requiere clave de confirmación
    if (targetUser.role === UserRole.ADMIN || role === 'ADMIN') {
      assertAdminConfirmation(confirmationKey);
    }
    
    const effectiveRole = (role ?? targetUser.role) as UserRole;
    const normalizedBranchId = branchId === '' ? null : branchId;
    const effectiveBranchId = normalizedBranchId !== undefined ? normalizedBranchId : targetUser.branchId;
    if ((effectiveRole === 'CAJERA' || effectiveRole === 'VENDEDOR') && !effectiveBranchId) {
      throw new AppError(400, 'Las cajeras y vendedores deben tener una sucursal asignada');
    }
    
    if (normalizedBranchId) {
      const branch = await prisma.branch.findUnique({ where: { id: normalizedBranchId } });
      if (!branch) throw new AppError(404, 'Sucursal no encontrada');
    }
    
    // Los administradores siempre tienen acceso total: se ignoran los permisos personalizados.
    // - Body sin `permissions` (undefined) → no se toca lo guardado.
    // - `permissions: null` → vuelve a los permisos por defecto del rol.
    // - `permissions: [...]` → se guardan solo claves válidas.
    let permissionsUpdate: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
    if (effectiveRole === UserRole.ADMIN) {
      permissionsUpdate = Prisma.JsonNull;
    } else if (Array.isArray(permissions)) {
      const valid = permissions.filter((p: unknown): p is string => typeof p === 'string');
      permissionsUpdate = valid.filter((p) => !ADMIN_ONLY_PERMISSION_KEYS.has(p));
    } else if (permissions === null) {
      permissionsUpdate = Prisma.JsonNull;
    }
    
    const user = await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Eliminar un administrador requiere clave de confirmación
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new AppError(404, 'Usuario no encontrado');
    if (targetUser.role === UserRole.ADMIN) {
      assertAdminConfirmation(req.body?.confirmationKey);
    }
    
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    next(error);
  }
};

export const adjustPoints = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, points, reason } = req.body;
    
    await PointsService.adjustPoints(userId, points, reason, req.user!.id);
    
    const profile = await prisma.clientProfile.findUnique({ where: { userId } });
    res.json({ message: 'Puntos ajustados', currentPoints: profile?.currentPoints });
  } catch (error) {
    next(error);
  }
};
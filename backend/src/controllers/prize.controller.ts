import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { PointsService } from '../services/points.service';
import { emailService } from '../services/email.service';
import { SystemConfigService } from '../services/systemConfig.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, resolveBranchScope, NO_BRANCH } from '../middleware/auth';
import { Prisma, PrizeStatus, UserRole } from '@prisma/client';

/** Scope de sucursal: staff (cajera/vendedor) solo opera con clientes de su sucursal. */
const staffBranchWhere = (req: AuthRequest): Prisma.UserWhereInput => {
  const scope = resolveBranchScope(req.user);
  if (scope.isGlobal) return {};
  return { branchId: scope.branchId };
};

export const getPrizes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, category, status, isActive } = req.query;
    
    const where: Prisma.PrizeWhereInput = {};
    const searchStr = Array.isArray(search) ? search[0] : search;
    const categoryStr = Array.isArray(category) ? category[0] : category;
    const statusStr = Array.isArray(status) ? status[0] : status;
    const isActiveStr = Array.isArray(isActive) ? isActive[0] : isActive;
    
    if (searchStr) {
      where.OR = [
        { name: { contains: searchStr as string, mode: 'insensitive' } },
        { code: { contains: searchStr as string, mode: 'insensitive' } },
      ];
    }
    if (categoryStr) where.category = categoryStr as string;
    if (statusStr) where.status = statusStr as PrizeStatus;
    if (isActiveStr !== undefined) where.isActive = isActiveStr === 'true';
    
    const [prizes, total] = await Promise.all([
      prisma.prize.findMany({
        where,
        orderBy: { pointsCost: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.prize.count({ where }),
    ]);
    
    res.json({
      prizes,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getPrizeById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const prize = await prisma.prize.findUnique({ where: { id } });
    if (!prize) throw new AppError(404, 'Premio no encontrado');
    res.json(prize);
  } catch (error) {
    next(error);
  }
};

export const createPrize = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, name, description, imageUrl, pointsCost, stock, category, validFrom, validTo } = req.body;
    
    const existing = await prisma.prize.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de premio ya existe');
    
    const prize = await prisma.prize.create({
      data: {
        code,
        name,
        description,
        imageUrl: imageUrl || null,
        pointsCost,
        stock,
        category,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
      },
    });
    
    res.status(201).json(prize);
  } catch (error) {
    next(error);
  }
};

export const updatePrize = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, pointsCost, stock, category, status, isActive, validFrom, validTo } = req.body;
    
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (pointsCost !== undefined) data.pointsCost = pointsCost;
    if (stock !== undefined) data.stock = stock;
    if (category !== undefined) data.category = category;
    if (status !== undefined) data.status = status;
    if (isActive !== undefined) data.isActive = isActive;
    if (validFrom !== undefined) data.validFrom = validFrom ? new Date(validFrom) : null;
    if (validTo !== undefined) data.validTo = validTo ? new Date(validTo) : null;
    
    const prize = await prisma.prize.update({
      where: { id },
      data,
    });
    
    res.json(prize);
  } catch (error) {
    next(error);
  }
};

export const deletePrize = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.prize.delete({ where: { id } });
    res.json({ message: 'Premio eliminado' });
  } catch (error) {
    next(error);
  }
};

export const redeemPrize = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni, prizeId } = req.body;
    
    // Aislamiento por sucursal: la cajera solo canjea premios de clientes de su sucursal
    const user = await prisma.user.findFirst({
      where: { dni, role: UserRole.CLIENTE, ...staffBranchWhere(req) },
      include: { clientProfile: true },
    });
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    if (!user.clientProfile) throw new AppError(400, 'Perfil de cliente no encontrado');
    
    const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
    if (!prize) throw new AppError(404, 'Premio no encontrado');
    if (!prize.isActive || prize.status !== 'DISPONIBLE') throw new AppError(400, 'Premio no disponible');
    if (prize.stock <= 0) throw new AppError(400, 'Premio sin stock');
    
    // Mínimo de puntos en saldo para poder canjear (redemption_min_points)
    const minRedemption = await SystemConfigService.getRedemptionMinPoints();
    if (minRedemption > 0 && user.clientProfile.currentPoints < minRedemption) {
      throw new AppError(400, `Necesitás al menos ${minRedemption} puntos en tu saldo para canjear`);
    }
    if (user.clientProfile.currentPoints < prize.pointsCost) throw new AppError(400, 'Puntos insuficientes');
    
    const redemption = await prisma.$transaction(async (tx) => {
      const newRedemption = await tx.redemption.create({
        data: {
          userId: user.id,
          prizeId: prize.id,
          pointsSpent: prize.pointsCost,
          status: 'COMPLETADO',
          processedBy: req.user!.id,
          processedAt: new Date(),
        },
      });
      
      await tx.prize.update({
        where: { id: prize.id },
        data: { stock: { decrement: 1 } },
      });
      
      await PointsService.redeemPoints(user.id, prize.pointsCost, newRedemption.id);
      
      return newRedemption;
    });
    
    const updatedProfile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
    
    if (user.email && await SystemConfigService.getNotificationsEnabled('email')) {
      await emailService.sendRedemptionConfirmationEmail(user.email, user.firstName, prize.name, prize.pointsCost, updatedProfile!.currentPoints);
    }
    
    res.status(201).json({
      redemption: { id: redemption.id, pointsSpent: redemption.pointsSpent, createdAt: redemption.createdAt },
      prize: { name: prize.name, pointsCost: prize.pointsCost },
      newBalance: updatedProfile!.currentPoints,
    });
  } catch (error) {
    next(error);
  }
};

export const getRedemptions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;
    
    const where: Prisma.RedemptionWhereInput = {};
    if (status) where.status = status as string;
    if (userId) where.userId = userId as string;
    
    // Aislamiento por sucursal: solo canjes de clientes de la propia sucursal
    const staffWhere = staffBranchWhere(req);
    if (staffWhere.branchId !== undefined) {
      where.user = staffWhere as Prisma.UserWhereInput;
    }
    
    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { user: { select: { firstName: true, lastName: true, dni: true } }, prize: true },
      }),
      prisma.redemption.count({ where }),
    ]);
    
    res.json({
      redemptions,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailablePrizes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { dni },
      include: { clientProfile: true },
    });
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    
    const now = new Date();
    const prizes = await prisma.prize.findMany({
      where: {
        isActive: true,
        status: 'DISPONIBLE',
        stock: { gt: 0 },
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { pointsCost: 'asc' },
    });
    
    const currentPoints = user.clientProfile?.currentPoints || 0;
    
    res.json({
      prizes: prizes.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        pointsCost: p.pointsCost,
        category: p.category,
        canAfford: p.pointsCost <= currentPoints,
      })),
      currentPoints,
    });
  } catch (error) {
    next(error);
  }
};

export const redeemPrizeByClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni, prizeId } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { dni },
      include: { clientProfile: true },
    });
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    if (!user.clientProfile) throw new AppError(400, 'Perfil de cliente no encontrado');
    
    const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
    if (!prize) throw new AppError(404, 'Premio no encontrado');
    if (!prize.isActive || prize.status !== 'DISPONIBLE') throw new AppError(400, 'Premio no disponible');
    if (prize.stock <= 0) throw new AppError(400, 'Premio sin stock');
    
    // Mínimo de puntos en saldo para poder canjear (redemption_min_points)
    const minRedemption = await SystemConfigService.getRedemptionMinPoints();
    if (minRedemption > 0 && user.clientProfile.currentPoints < minRedemption) {
      throw new AppError(400, `Necesitás al menos ${minRedemption} puntos en tu saldo para canjear`);
    }
    if (user.clientProfile.currentPoints < prize.pointsCost) throw new AppError(400, 'Puntos insuficientes');
    
    const redemption = await prisma.$transaction(async (tx) => {
      const newRedemption = await tx.redemption.create({
        data: {
          userId: user.id,
          prizeId: prize.id,
          pointsSpent: prize.pointsCost,
          status: 'COMPLETADO',
          notes: 'Canje autogestionado por cliente',
        },
      });
      
      await tx.prize.update({
        where: { id: prize.id },
        data: { stock: { decrement: 1 } },
      });
      
      await PointsService.redeemPoints(user.id, prize.pointsCost, newRedemption.id);
      
      return newRedemption;
    });
    
    const updatedProfile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
    
    if (user.email && await SystemConfigService.getNotificationsEnabled('email')) {
      await emailService.sendRedemptionConfirmationEmail(user.email, user.firstName, prize.name, prize.pointsCost, updatedProfile!.currentPoints);
    }
    
    res.status(201).json({
      redemption: { id: redemption.id, pointsSpent: redemption.pointsSpent, createdAt: redemption.createdAt },
      prize: { name: prize.name, pointsCost: prize.pointsCost },
      newBalance: updatedProfile!.currentPoints,
    });
  } catch (error) {
    next(error);
  }
};
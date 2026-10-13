import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma, RuleType } from '@prisma/client';

export const getPointRules = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    
    const where: Prisma.PointRuleWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const [rules, total] = await Promise.all([
      prisma.pointRule.findMany({
        where,
        orderBy: { priority: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { products: true },
      }),
      prisma.pointRule.count({ where }),
    ]);
    
    res.json({
      rules,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getPointRuleById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const rule = await prisma.pointRule.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!rule) throw new AppError(404, 'Regla no encontrada');
    res.json(rule);
  } catch (error) {
    next(error);
  }
};

export const createPointRule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, type, config, priority, validFrom, validTo, productIds } = req.body;
    
    if (!Object.values(RuleType).includes(type)) {
      throw new AppError(400, 'Tipo de regla inválido');
    }
    
    const rule = await prisma.pointRule.create({
      data: {
        name,
        description,
        type,
        config,
        priority: priority || 0,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        products: productIds ? { connect: productIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { products: true },
    });
    
    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
};

export const updatePointRule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, type, config, priority, isActive, validFrom, validTo, productIds } = req.body;
    
    const rule = await prisma.pointRule.update({
      where: { id },
      data: {
        name,
        description,
        type,
        config,
        priority,
        isActive,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        products: productIds ? { set: productIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { products: true },
    });
    
    res.json(rule);
  } catch (error) {
    next(error);
  }
};

export const deletePointRule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.pointRule.delete({ where: { id } });
    res.json({ message: 'Regla eliminada' });
  } catch (error) {
    next(error);
  }
};
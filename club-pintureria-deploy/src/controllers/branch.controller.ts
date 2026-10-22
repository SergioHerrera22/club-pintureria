import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

export const getBranches = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const where: Prisma.BranchWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.branch.count({ where }),
    ]);

    res.json({
      branches,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getBranchById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new AppError(404, 'Sucursal no encontrada');
    res.json(branch);
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, code, address, phone, email } = req.body;

    const existing = await prisma.branch.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de sucursal ya existe');

    const branch = await prisma.branch.create({
      data: { name, code, address, phone, email },
    });

    res.status(201).json(branch);
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, isActive } = req.body;

    const branch = await prisma.branch.update({
      where: { id },
      data: { name, address, phone, email, isActive },
    });

    res.json(branch);
  } catch (error) {
    next(error);
  }
};

export const deleteBranch = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.branch.delete({ where: { id } });
    res.json({ message: 'Sucursal eliminada' });
  } catch (error) {
    next(error);
  }
};
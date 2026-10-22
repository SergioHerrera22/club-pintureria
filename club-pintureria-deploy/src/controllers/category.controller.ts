import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, isActive, parentId } = req.query;

    const where: Prisma.CategoryWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (parentId !== undefined) where.parentId = parentId === 'null' ? null : parentId as string;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { children: true, parent: true },
      }),
      prisma.category.count({ where }),
    ]);

    res.json({
      categories,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryTree = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!category) throw new AppError(404, 'Categoría no encontrada');
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, code, description, parentId, sortOrder } = req.body;

    const existing = await prisma.category.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de categoría ya existe');

    const category = await prisma.category.create({
      data: { name, code, description, parentId, sortOrder: sortOrder || 0 },
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, parentId, sortOrder, isActive } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: { name, description, parentId, sortOrder, isActive },
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    next(error);
  }
};
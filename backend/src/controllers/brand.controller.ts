import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

export const getBrands = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const where: Prisma.BrandWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.brand.count({ where }),
    ]);

    res.json({
      brands,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new AppError(404, 'Marca no encontrada');
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, code, description, logoUrl } = req.body;

    const existing = await prisma.brand.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de marca ya existe');

    const brand = await prisma.brand.create({
      data: { name, code, description, logoUrl },
    });

    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, logoUrl, isActive } = req.body;

    const brand = await prisma.brand.update({
      where: { id },
      data: { name, description, logoUrl, isActive },
    });

    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.brand.delete({ where: { id } });
    res.json({ message: 'Marca eliminada' });
  } catch (error) {
    next(error);
  }
};
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, category, isActive } = req.query;
    
    const where: Prisma.ProductWhereInput = {};
    const searchStr = Array.isArray(search) ? search[0] : search;
    const categoryStr = Array.isArray(category) ? category[0] : category;
    const isActiveStr = Array.isArray(isActive) ? isActive[0] : isActive;
    
    if (searchStr) {
      where.OR = [
        { name: { contains: searchStr as string, mode: 'insensitive' } },
        { code: { contains: searchStr as string, mode: 'insensitive' } },
        { brand: { contains: searchStr as string, mode: 'insensitive' } },
      ];
    }
    if (categoryStr) where.category = categoryStr as string;
    if (isActiveStr !== undefined) where.isActive = isActiveStr === 'true';
    
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);
    
    res.json({
      products: products.map(p => ({
        ...p,
        unitPrice: Number(p.unitPrice),
      })),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError(404, 'Producto no encontrado');
    res.json({ ...product, unitPrice: Number(product.unitPrice) });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, name, description, category, brand, unitPrice } = req.body;
    
    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de producto ya existe');
    
    const product = await prisma.product.create({
      data: { code, name, description, category, brand, unitPrice },
    });
    
    res.status(201).json({ ...product, unitPrice: Number(product.unitPrice) });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, category, brand, unitPrice, isActive } = req.body;
    
    const product = await prisma.product.update({
      where: { id },
      data: { name, description, category, brand, unitPrice, isActive },
    });
    
    res.json({ ...product, unitPrice: Number(product.unitPrice) });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { category: true },
    });
    
    res.json(categories.map(c => ({ name: c.category, count: c._count.category })));
  } catch (error) {
    next(error);
  }
};
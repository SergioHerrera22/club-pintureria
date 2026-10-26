import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';
import {
  searchImageCandidates,
  settleProductImageUrl,
  ProductImageCandidate,
} from '../services/imageSearch.service';

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
    const { code, name, description, category, brand, unitPrice, imageUrl } = req.body;

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de producto ya existe');

    const resolvedImage = await settleProductImageUrl(code, imageUrl);
    const product = await prisma.product.create({
      data: {
        code,
        name,
        description,
        category,
        brand,
        unitPrice,
        ...(resolvedImage === null ? {} : { imageUrl: resolvedImage }),
      },
    });

    res.status(201).json({ ...product, unitPrice: Number(product.unitPrice) });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, category, brand, unitPrice, isActive, imageUrl } = req.body;

    // Si el admin envió una URL externa (elegida del buscador o pegada a mano),
    // se descarga y guarda en el servidor. null quita la foto; undefined no cambia.
    let imageUrlPromise: Promise<string | null | undefined> | undefined;
    if (imageUrl !== undefined) {
      const current = await prisma.product.findUnique({ where: { id }, select: { code: true } });
      if (!current) throw new AppError(404, 'Producto no encontrado');
      imageUrlPromise = Promise.resolve(settleProductImageUrl(current.code, imageUrl));
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        category,
        brand,
        unitPrice,
        isActive,
        ...(imageUrlPromise ? { imageUrl: await imageUrlPromise } : {}),
      },
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

/**
 * Busca en internet candidatas de foto para el producto (por nombre, marca y
 * categoría). Sin claves: scraping de imágenes de DuckDuckGo. Si el buscador
 * no está disponible, responde con warning para que el front lo avise.
 */
export const getImageCandidates = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? '';
    let candidates: ProductImageCandidate[] = [];
    let warning: string | undefined;
    try {
      candidates = await searchImageCandidates(q);
    } catch (err: any) {
      warning = err?.message || 'La búsqueda de internet no está disponible ahora; podés pegar una URL de foto a mano';
    }
    res.json({ candidates, warning });
  } catch (error) {
    next(error);
  }
};

/**
 * Aplica una foto al producto: descarga la URL indicada (elegida del buscador
 * o pegada a mano) y la guarda en el servidor. { url: null } quita la foto.
 */
export const setProductImage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { url } = req.body as { url: string | null };
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError(404, 'Producto no encontrado');

    const resolved = await settleProductImageUrl(product.code, url === null ? null : url ?? undefined);
    let nextValue: string | null;
    if (url === null) {
      nextValue = null; // quitar la foto
    } else {
      if (!/^https?:\/\//i.test(url ?? '')) {
        throw new AppError(400, 'La URL de la imagen no es válida');
      }
      nextValue = resolved ?? null;
    }
    const updated = await prisma.product.update({
      where: { id },
      data: { imageUrl: nextValue },
    });
    res.json({ ...updated, unitPrice: Number(updated.unitPrice), imageUrl: updated.imageUrl ?? null });
  } catch (error) {
    next(error);
  }
};
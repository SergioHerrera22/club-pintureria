import { Request, Response, NextFunction } from 'express';
import { PromotionService } from '../services/promotion.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { PromotionType, Prisma } from '@prisma/client';

export const getPromotions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, isActive, category, brand, productId, startDate, endDate } = req.query;

    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (category) filters.category = category as string;
    if (brand) filters.brand = brand as string;
    if (productId) filters.productId = productId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await PromotionService.getPromotions(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPromotionById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const promotion = await PromotionService.getPromotionById(id);
    res.json(promotion);
  } catch (error) {
    next(error);
  }
};

export const createPromotion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, imageUrl, type, multiplier, bonusPoints, discount, startDate, endDate, isActive, categories, brands, products, conditions } = req.body;

    const promotion = await PromotionService.createPromotion({
      name,
      description,
      imageUrl,
      type,
      multiplier,
      bonusPoints,
      discount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      categories,
      brands,
      products,
      conditions,
    });

    res.status(201).json(promotion);
  } catch (error) {
    next(error);
  }
};

export const updatePromotion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, type, multiplier, bonusPoints, discount, startDate, endDate, isActive, categories, brands, products, conditions } = req.body;

    const promotion = await PromotionService.updatePromotion(id, {
      name,
      description,
      imageUrl,
      type,
      multiplier,
      bonusPoints,
      discount,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isActive,
      categories,
      brands,
      products,
      conditions,
    });

    res.json(promotion);
  } catch (error) {
    next(error);
  }
};

export const deletePromotion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await PromotionService.deletePromotion(id);
    res.json({ message: 'Promoción eliminada' });
  } catch (error) {
    next(error);
  }
};

export const activatePromotion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const promotion = await PromotionService.activatePromotion(id);
    res.json(promotion);
  } catch (error) {
    next(error);
  }
};

export const deactivatePromotion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const promotion = await PromotionService.deactivatePromotion(id);
    res.json(promotion);
  } catch (error) {
    next(error);
  }
};

export const validatePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, subtotal, categoryIds, brandIds, productIds } = req.body;

    if (!items || !Array.isArray(items) || subtotal === undefined) {
      throw new AppError(400, 'Datos incompletos para validar promoción');
    }

    const applicable = await PromotionService.getActivePromotionsForClient(
      items,
      subtotal,
      categoryIds,
      brandIds,
      productIds
    );

    res.json({ applicable });
  } catch (error) {
    next(error);
  }
};
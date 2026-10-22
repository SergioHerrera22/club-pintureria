import { Request, Response, NextFunction } from 'express';
import { BenefitService } from '../services/benefit.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { BenefitType, Prisma } from '@prisma/client';

export const getBenefits = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, type, isActive } = req.query;

    const filters: any = {};
    if (type) filters.type = type as BenefitType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await BenefitService.getAllBenefits(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getBenefitById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const benefit = await BenefitService.getBenefitById(id);
    if (!benefit) throw new AppError(404, 'Beneficio no encontrado');
    res.json(benefit);
  } catch (error) {
    next(error);
  }
};

export const createBenefit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, imageUrl, type, value, isActive, startDate, endDate, autoApply } = req.body;

    if (!Object.values(BenefitType).includes(type)) {
      throw new AppError(400, 'Tipo de beneficio inválido');
    }

    const benefit = await BenefitService.createBenefit({
      name,
      description,
      imageUrl,
      type,
      value,
      isActive,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      autoApply,
    });

    res.status(201).json(benefit);
  } catch (error) {
    next(error);
  }
};

export const updateBenefit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, type, value, isActive, startDate, endDate, autoApply } = req.body;

    const benefit = await BenefitService.updateBenefit(id, {
      name,
      description,
      imageUrl,
      type,
      value,
      isActive,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      autoApply,
    });

    res.json(benefit);
  } catch (error) {
    next(error);
  }
};

export const deleteBenefit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await BenefitService.deleteBenefit(id);
    res.json({ message: 'Beneficio eliminado' });
  } catch (error) {
    next(error);
  }
};
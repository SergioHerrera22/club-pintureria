import { Request, Response, NextFunction } from 'express';
import { ChallengeService } from '../services/challenge.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { ChallengeType, Prisma } from '@prisma/client';

export const getChallenges = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, isActive, type } = req.query;

    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (type) filters.type = type as ChallengeType;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await ChallengeService.getChallenges(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getChallengeById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const challenge = await ChallengeService.getChallengeById(id);
    res.json(challenge);
  } catch (error) {
    next(error);
  }
};

export const createChallenge = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, imageUrl, type, target, condition, rewardPoints, rewardCoupon, startDate, endDate, isActive } = req.body;

    if (!Object.values(ChallengeType).includes(type)) {
      throw new AppError(400, 'Tipo de desafío inválido');
    }

    const challenge = await ChallengeService.createChallenge({
      name,
      description,
      imageUrl,
      type,
      target,
      condition,
      rewardPoints,
      rewardCoupon,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
    });

    res.status(201).json(challenge);
  } catch (error) {
    next(error);
  }
};

export const updateChallenge = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, type, target, condition, rewardPoints, rewardCoupon, startDate, endDate, isActive } = req.body;

    const challenge = await ChallengeService.updateChallenge(id, {
      name,
      description,
      imageUrl,
      type,
      target,
      condition,
      rewardPoints,
      rewardCoupon,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isActive,
    });

    res.json(challenge);
  } catch (error) {
    next(error);
  }
};

export const deleteChallenge = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await ChallengeService.deleteChallenge(id);
    res.json({ message: 'Desafío eliminado' });
  } catch (error) {
    next(error);
  }
};
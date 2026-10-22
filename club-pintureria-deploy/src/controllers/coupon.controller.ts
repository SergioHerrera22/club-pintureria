import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { CouponType, Prisma } from '@prisma/client';

export const getCoupons = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, isActive, clientId, type } = req.query;

    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (clientId) filters.clientId = clientId as string;
    if (type) filters.type = type as CouponType;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await CouponService.getCoupons(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCouponById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const coupon = await CouponService.getCouponById(id);
    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, name, description, type, value, maxUses, startDate, endDate, isActive, clientId, promotionId } = req.body;

    const coupon = await CouponService.createCoupon({
      code,
      name,
      description,
      type,
      value,
      maxUses,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      clientId,
      promotionId,
    });

    res.status(201).json(coupon);
  } catch (error) {
    next(error);
  }
};

export const createBulkCoupons = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prefix, count, name, description, type, value, maxUses, startDate, endDate, isActive } = req.body;

    const coupons = await CouponService.createBulkCoupons({
      prefix,
      count,
      name,
      description,
      type,
      value,
      maxUses,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
    });

    res.status(201).json({ coupons, count: coupons.length });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, type, value, maxUses, startDate, endDate, isActive, clientId, promotionId } = req.body;

    const coupon = await CouponService.updateCoupon(id, {
      name,
      description,
      type,
      value,
      maxUses,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isActive,
      clientId,
      promotionId,
    });

    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await CouponService.deleteCoupon(id);
    res.json({ message: 'Cupón eliminado' });
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, clientId } = req.body;

    if (!code) throw new AppError(400, 'Código de cupón requerido');

    const result = await CouponService.validateCoupon(code, clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const useCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, clientId } = req.body;

    if (!code || !clientId) throw new AppError(400, 'Código y cliente requeridos');

    await CouponService.useCoupon(code, clientId);
    res.json({ message: 'Cupón utilizado correctamente' });
  } catch (error) {
    next(error);
  }
};

export const assignCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId, clientId } = req.body;

    if (!couponId || !clientId) throw new AppError(400, 'Cupón y cliente requeridos');

    const coupon = await CouponService.assignCouponToClient(couponId, clientId);
    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

export const assignBulkCoupons = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponIds, clientId } = req.body;

    if (!couponIds || !Array.isArray(couponIds) || !clientId) {
      throw new AppError(400, 'Lista de cupones y cliente requeridos');
    }

    const results = await CouponService.assignBulkCoupons(couponIds, clientId);
    res.json({ results });
  } catch (error) {
    next(error);
  }
};
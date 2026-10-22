import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { CouponType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface CouponFilters {
  isActive?: boolean;
  clientId?: string;
  type?: CouponType;
  page?: number;
  limit?: number;
}

export class CouponService {
  static async getCoupons(filters: CouponFilters = {}) {
    const { page = 1, limit = 20, isActive, clientId, type } = filters;

    const where: Prisma.CouponWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (clientId) where.clientId = clientId;
    if (type) where.type = type;

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          client: { select: { id: true, firstName: true, lastName: true, dni: true } },
          promotion: { select: { id: true, name: true } },
        },
      }),
      prisma.coupon.count({ where }),
    ]);

    return {
      coupons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  static async getCouponById(id: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, dni: true, email: true } },
        promotion: { select: { id: true, name: true } },
      },
    });
    if (!coupon) throw new AppError(404, 'Cupón no encontrado');
    return coupon;
  }

  static async getCouponByCode(code: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, dni: true, email: true } },
        promotion: { select: { id: true, name: true, type: true, multiplier: true, bonusPoints: true, discount: true } },
      },
    });
    if (!coupon) throw new AppError(404, 'Cupón no encontrado');
    return coupon;
  }

  static async createCoupon(data: {
    code?: string;
    name: string;
    description?: string;
    type: CouponType;
    value: number;
    maxUses?: number;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
    clientId?: string;
    promotionId?: string;
  }) {
    const code = data.code || this.generateCode();

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new AppError(409, 'Código de cupón ya existe');

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name: data.name,
        description: data.description,
        type: data.type,
        value: data.value,
        maxUses: data.maxUses,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
        clientId: data.clientId,
        promotionId: data.promotionId,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, dni: true } },
        promotion: { select: { id: true, name: true } },
      },
    });

    return coupon;
  }

  static async createBulkCoupons(data: {
    prefix: string;
    count: number;
    name: string;
    description?: string;
    type: CouponType;
    value: number;
    maxUses?: number;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
  }) {
    const coupons = [];
    for (let i = 0; i < data.count; i++) {
      const code = `${data.prefix}${uuidv4().slice(0, 8).toUpperCase()}`;
      const coupon = await prisma.coupon.create({
        data: {
          code,
          name: `${data.name} ${i + 1}`,
          description: data.description,
          type: data.type,
          value: data.value,
          maxUses: data.maxUses ?? 1,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive ?? true,
        },
      });
      coupons.push(coupon);
    }
    return coupons;
  }

  static async updateCoupon(id: string, data: {
    name?: string;
    description?: string;
    type?: CouponType;
    value?: number;
    maxUses?: number;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
    clientId?: string;
    promotionId?: string;
  }) {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.promotionId !== undefined) updateData.promotionId = data.promotionId;

    const coupon = await prisma.coupon.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, dni: true } },
        promotion: { select: { id: true, name: true } },
      },
    });

    return coupon;
  }

  static async deleteCoupon(id: string) {
    await prisma.coupon.delete({ where: { id } });
    return { message: 'Cupón eliminado' };
  }

  static async validateCoupon(code: string, clientId?: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        promotion: { select: { id: true, name: true, type: true, multiplier: true, bonusPoints: true, discount: true } },
      },
    });

    if (!coupon) throw new AppError(404, 'Cupón no encontrado');
    if (!coupon.isActive) throw new AppError(400, 'Cupón inactivo');

    const now = new Date();
    if (now < coupon.startDate) throw new AppError(400, 'Cupón aún no válido');
    if (now > coupon.endDate) throw new AppError(400, 'Cupón vencido');

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new AppError(400, 'Cupón sin usos disponibles');
    }

    if (coupon.clientId && coupon.clientId !== clientId) {
      throw new AppError(400, 'Cupón no válido para este cliente');
    }

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        promotion: coupon.promotion,
      },
    };
  }

  static async useCoupon(code: string, clientId: string) {
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new AppError(404, 'Cupón no encontrado');

    await prisma.coupon.update({
      where: { code },
      data: { usedCount: { increment: 1 } },
    });

    return { message: 'Cupón utilizado correctamente' };
  }

  static async assignCouponToClient(couponId: string, clientId: string) {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new AppError(404, 'Cupón no encontrado');

    if (coupon.clientId && coupon.clientId !== clientId) {
      throw new AppError(400, 'Cupón ya asignado a otro cliente');
    }

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: { clientId },
      include: { client: { select: { id: true, firstName: true, lastName: true, dni: true } } },
    });

    return updated;
  }

  static async assignBulkCoupons(couponIds: string[], clientId: string) {
    const results = [];
    for (const id of couponIds) {
      try {
        const result = await this.assignCouponToClient(id, clientId);
        results.push({ success: true, coupon: result });
      } catch (err) {
        results.push({ success: false, couponId: id, error: (err as Error).message });
      }
    }
    return results;
  }

  private static generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
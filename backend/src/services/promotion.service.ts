import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { PromotionType, Prisma } from '@prisma/client';

interface PromotionFilters {
  isActive?: boolean;
  category?: string;
  brand?: string;
  productId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class PromotionService {
  static async getPromotions(filters: PromotionFilters = {}) {
    const { page = 1, limit = 20, isActive, category, brand, productId, startDate, endDate } = filters;

    const where: Prisma.PromotionWhereInput = {};

    if (isActive !== undefined) where.isActive = isActive;
    if (category) where.categories = { has: category };
    if (brand) where.brands = { has: brand };
    if (productId) where.products = { has: productId };
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = startDate;
      if (endDate) where.startDate.lte = endDate;
    }

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.promotion.count({ where }),
    ]);

    return {
      promotions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  static async getPromotionById(id: string) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw new AppError(404, 'Promoción no encontrada');
    return promotion;
  }

  static async createPromotion(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    type: PromotionType;
    multiplier?: number;
    bonusPoints?: number;
    discount?: number;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
    categories?: string[];
    brands?: string[];
    products?: string[];
    conditions?: any;
  }) {
    const promotion = await prisma.promotion.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        type: data.type,
        multiplier: data.multiplier ?? 1,
        bonusPoints: data.bonusPoints ?? 0,
        discount: data.discount,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
        categories: data.categories ?? [],
        brands: data.brands ?? [],
        products: data.products ?? [],
        conditions: data.conditions,
      },
    });

    return promotion;
  }

  static async updatePromotion(id: string, data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    type?: PromotionType;
    multiplier?: number;
    bonusPoints?: number;
    discount?: number;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
    categories?: string[];
    brands?: string[];
    products?: string[];
    conditions?: any;
  }) {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.multiplier !== undefined) updateData.multiplier = data.multiplier;
    if (data.bonusPoints !== undefined) updateData.bonusPoints = data.bonusPoints;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.categories !== undefined) updateData.categories = data.categories;
    if (data.brands !== undefined) updateData.brands = data.brands;
    if (data.products !== undefined) updateData.products = data.products;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;

    const promotion = await prisma.promotion.update({
      where: { id },
      data: updateData,
    });

    return promotion;
  }

  static async deletePromotion(id: string) {
    await prisma.promotion.delete({ where: { id } });
    return { message: 'Promoción eliminada' };
  }

  static async activatePromotion(id: string) {
    const promotion = await prisma.promotion.update({
      where: { id },
      data: { isActive: true },
    });
    return promotion;
  }

  static async deactivatePromotion(id: string) {
    const promotion = await prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
    return promotion;
  }

  static async getActivePromotionsForClient(
    items: Array<{ productId: string; quantity: number; unitPrice: number; lineTotal: number }>,
    subtotal: number,
    categoryIds: string[] = [],
    brandIds: string[] = [],
    productIds: string[] = []
  ) {
    const now = new Date();

    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    const applicable: Array<{ promotion: any; appliedPoints: number; appliedDiscount: number }> = [];

    for (const promo of promotions) {
      const applies = this.promotionApplies(promo, {
        categoryIds,
        brandIds,
        productIds,
        items,
        subtotal,
      });

      if (applies) {
        // Las promociones solo aplican descuentos: nunca acreditan puntos.
        let appliedDiscount = 0;

        switch (promo.type) {
          case 'DESCUENTO_PORCENTUAL':
            appliedDiscount = Math.floor(subtotal * (promo.discount || 0) / 100);
            break;
          case 'ENVIO_GRATIS':
            appliedDiscount = 0; // Se maneja en el frontend/checkout
            break;
        }

        if (appliedDiscount > 0) {
          applicable.push({
            promotion: promo,
            appliedPoints: 0,
            appliedDiscount,
          });
        }
      }
    }

    return applicable;
  }

  static promotionApplies(
    promo: any,
    context: {
      categoryIds: string[];
      brandIds: string[];
      productIds: string[];
      items: Array<{ productId: string; quantity: number; lineTotal: number }>;
      subtotal: number;
    }
  ): boolean {
    // Verificar categorías
    if (promo.categories.length > 0) {
      const hasCategory = promo.categories.some((c: string) => context.categoryIds.includes(c));
      if (!hasCategory) return false;
    }

    // Verificar marcas
    if (promo.brands.length > 0) {
      const hasBrand = promo.brands.some((b: string) => context.brandIds.includes(b));
      if (!hasBrand) return false;
    }

    // Verificar productos específicos
    if (promo.products.length > 0) {
      const hasProduct = promo.products.some((p: string) => context.productIds.includes(p));
      if (!hasProduct) return false;
    }

    // Verificar condiciones adicionales
    if (promo.conditions) {
      const cond = promo.conditions as any;
      if (cond.minSubtotal && context.subtotal < cond.minSubtotal) return false;
      if (cond.maxSubtotal && context.subtotal > cond.maxSubtotal) return false;
      if (cond.minItems && context.items.length < cond.minItems) return false;
    }

    return true;
  }

  static calculatePromotionImpact(
    promo: any,
    subtotal: number,
    _basePoints: number
  ): { points: number; discount: number } {
    let discount = 0;

    switch (promo.type) {
      case 'DESCUENTO_PORCENTUAL':
        discount = Math.floor(subtotal * (promo.discount || 0) / 100);
        break;
      case 'ENVIO_GRATIS':
        // Se maneja en checkout
        break;
    }

    // Las promociones nunca acreditan puntos.
    return { points: 0, discount };
  }
}
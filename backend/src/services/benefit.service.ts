import { prisma } from '../config/prisma';
import { BenefitType } from '@prisma/client';

export class BenefitService {
  static async getActiveBenefits() {
    const now = new Date();

    return prisma.benefit.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAllBenefits(filters: {
    type?: BenefitType;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { type, isActive, page = 1, limit = 20 } = filters;

    const where: any = {};

    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const [benefits, total] = await Promise.all([
      prisma.benefit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.benefit.count({ where }),
    ]);

    return {
      benefits,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getBenefitById(id: string) {
    return prisma.benefit.findUnique({
      where: { id },
    });
  }

  static async createBenefit(data: {
    name: string;
    description: string;
    imageUrl?: string;
    type: BenefitType;
    value: number;
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date;
    autoApply?: boolean;
  }) {
    return prisma.benefit.create({ data });
  }

  static async updateBenefit(id: string, data: Partial<{
    name: string;
    description: string;
    imageUrl?: string;
    type: BenefitType;
    value: number;
    isActive: boolean;
    startDate?: Date;
    endDate?: Date;
    autoApply: boolean;
  }>) {
    return prisma.benefit.update({
      where: { id },
      data,
    });
  }

  static async deleteBenefit(id: string) {
    return prisma.benefit.delete({ where: { id } });
  }
}
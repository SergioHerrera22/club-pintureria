import { PointsService } from '../src/services/points.service';
import { PromotionService } from '../src/services/promotion.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('PointsService', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany({ where: { description: { contains: 'TEST' } } });
    await prisma.clientProfile.updateMany({ data: { currentPoints: 0, totalPointsEarned: 0 } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('calculatePoints', () => {
    it('should calculate points based on POR_MONTO rule', async () => {
      // Create a test user with BRONZE tier
      const user = await prisma.user.create({
        data: {
          email: 'test-points@example.com',
          passwordHash: 'hash',
          firstName: 'Test',
          lastName: 'User',
          dni: '99999999',
          role: 'CLIENTE',
        },
      });

      await prisma.clientProfile.create({
        data: {
          userId: user.id,
          tier: 'BRONZE',
        },
      });

      // Create a POR_MONTO rule: 1 point per $100
      await prisma.pointRule.create({
        data: {
          name: 'Test POR_MONTO',
          type: 'POR_MONTO',
          config: { puntosPorMonto: 100, montoMinimo: 0, multiplicador: 1 },
          priority: 10,
          isActive: true,
        },
      });

      const result = await PointsService.calculatePoints(
        user.id,
        [{ productId: 'test-product-1', quantity: 1, unitPrice: 10000, lineTotal: 10000 }],
        10000
      );

      expect(result.totalPoints).toBeGreaterThanOrEqual(100); // 10000 / 100 = 100 points
      expect(result.breakdown.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.pointRule.deleteMany({ where: { name: 'Test POR_MONTO' } });
      await prisma.clientProfile.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should apply tier multiplier', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-tier@example.com',
          passwordHash: 'hash',
          firstName: 'Test',
          lastName: 'Tier',
          dni: '99999998',
          role: 'CLIENTE',
        },
      });

      await prisma.clientProfile.create({
        data: {
          userId: user.id,
          tier: 'GOLD', // 1.5x multiplier
        },
      });

      // Create a simple rule
      await prisma.pointRule.create({
        data: {
          name: 'Test Tier Multiplier',
          type: 'POR_MONTO',
          config: { puntosPorMonto: 100, montoMinimo: 0, multiplicador: 1 },
          priority: 10,
          isActive: true,
        },
      });

      const result = await PointsService.calculatePoints(
        user.id,
        [{ productId: 'test-product-1', quantity: 1, unitPrice: 10000, lineTotal: 10000 }],
        10000
      );

      // Base: 100 points, GOLD multiplier 1.5 = 150
      expect(result.totalPoints).toBe(150);

      // Cleanup
      await prisma.pointRule.deleteMany({ where: { name: 'Test Tier Multiplier' } });
      await prisma.clientProfile.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});

describe('PromotionService', () => {
  beforeAll(async () => {
    await prisma.promotion.deleteMany({ where: { name: { startsWith: 'Test' } } });
  });

  afterAll(async () => {
    await prisma.promotion.deleteMany({ where: { name: { startsWith: 'Test' } } });
    await prisma.$disconnect();
  });

  describe('createPromotion', () => {
    it('should create a DOBLE_PUNTOS promotion', async () => {
      const promotion = await PromotionService.createPromotion({
        name: 'Test Doble Puntos',
        type: 'DOBLE_PUNTOS',
        multiplier: 2,
        startDate: new Date(Date.now() - 86400000), // yesterday
        endDate: new Date(Date.now() + 86400000), // tomorrow
        tiers: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      });

      expect(promotion).toBeDefined();
      expect(promotion.name).toBe('Test Doble Puntos');
      expect(promotion.type).toBe('DOBLE_PUNTOS');
      expect(promotion.multiplier).toBe(2);
      expect(promotion.isActive).toBe(true);
    });

    it('should create a PUNTOS_EXTRA promotion', async () => {
      const promotion = await PromotionService.createPromotion({
        name: 'Test Puntos Extra',
        type: 'PUNTOS_EXTRA',
        bonusPoints: 500,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        tiers: ['GOLD', 'PLATINUM'],
      });

      expect(promotion).toBeDefined();
      expect(promotion.type).toBe('PUNTOS_EXTRA');
      expect(promotion.bonusPoints).toBe(500);
    });

    it('should create a DESCUENTO_PORCENTUAL promotion', async () => {
      const promotion = await PromotionService.createPromotion({
        name: 'Test Descuento 10%',
        type: 'DESCUENTO_PORCENTUAL',
        discount: 10,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      });

      expect(promotion.type).toBe('DESCUENTO_PORCENTUAL');
      expect(promotion.discount).toBe(10);
    });
  });

  describe('getActivePromotionsForClient', () => {
    it('should return applicable promotions for client tier', async () => {
      // Create a promotion active for GOLD tier
      await PromotionService.createPromotion({
        name: 'Test Gold Promo',
        type: 'DOBLE_PUNTOS',
        multiplier: 2,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        tiers: ['GOLD', 'PLATINUM'],
      });

      const items = [
        { productId: 'prod-1', quantity: 1, unitPrice: 10000, lineTotal: 10000 },
      ];

      const applicable = await PromotionService.getActivePromotionsForClient(
        'GOLD',
        items,
        10000,
        [],
        [],
        []
      );

      expect(applicable.length).toBeGreaterThan(0);
      expect(applicable[0].promotion.name).toBe('Test Gold Promo');
      expect(applicable[0].appliedPoints).toBeGreaterThan(0);
    });

    it('should not return promotions for wrong tier', async () => {
      const items = [
        { productId: 'prod-1', quantity: 1, unitPrice: 10000, lineTotal: 10000 },
      ];

      const applicable = await PromotionService.getActivePromotionsForClient(
        'BRONZE',
        items,
        10000,
        [],
        [],
        []
      );

      const goldOnly = applicable.filter(p => p.promotion.tiers.includes('GOLD') && !p.promotion.tiers.includes('BRONZE'));
      expect(goldOnly.length).toBe(0);
    });
  });

  describe('calculatePromotionImpact', () => {
    it('should calculate DOBLE_PUNTOS impact correctly', () => {
      const promo = { type: 'DOBLE_PUNTOS', multiplier: 2 };
      const impact = PromotionService.calculatePromotionImpact(promo, 10000, 100);

      // Base 100 points * (2 - 1) = 100 additional points
      expect(impact.points).toBe(100);
      expect(impact.discount).toBe(0);
    });

    it('should calculate PUNTOS_EXTRA impact correctly', () => {
      const promo = { type: 'PUNTOS_EXTRA', bonusPoints: 500 };
      const impact = PromotionService.calculatePromotionImpact(promo, 10000, 100);

      expect(impact.points).toBe(500);
      expect(impact.discount).toBe(0);
    });

    it('should calculate DESCUENTO_PORCENTUAL impact correctly', () => {
      const promo = { type: 'DESCUENTO_PORCENTUAL', discount: 10 };
      const impact = PromotionService.calculatePromotionImpact(promo, 10000, 100);

      expect(impact.points).toBe(0);
      expect(impact.discount).toBe(1000); // 10% of 10000
    });
  });

  describe('promotionApplies', () => {
    it('should return true when all conditions match', () => {
      const promo = {
        categories: ['automotor'],
        brands: ['marca1'],
        products: ['prod-1'],
        conditions: { minSubtotal: 1000 },
      };

      const context = {
        categoryIds: ['automotor', 'otra'],
        brandIds: ['marca1', 'marca2'],
        productIds: ['prod-1', 'prod-2'],
        items: [{ productId: 'prod-1', quantity: 1, lineTotal: 5000 }],
        subtotal: 5000,
      };

      const applies = PromotionService.promotionApplies(promo, context);
      expect(applies).toBe(true);
    });

    it('should return false when category does not match', () => {
      const promo = {
        categories: ['automotor'],
        brands: [],
        products: [],
        conditions: null,
      };

      const context = {
        categoryIds: ['otra'],
        brandIds: [],
        productIds: [],
        items: [],
        subtotal: 5000,
      };

      const applies = PromotionService.promotionApplies(promo, context);
      expect(applies).toBe(false);
    });
  });
});
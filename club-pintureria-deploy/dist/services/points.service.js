"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsService = void 0;
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
const promotion_service_1 = require("./promotion.service");
const systemConfig_service_1 = require("./systemConfig.service");
class PointsService {
    static async calculatePoints(userId, items, subtotal) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { clientProfile: true },
        });
        if (!user || !user.clientProfile) {
            throw new Error('Usuario o perfil no encontrado');
        }
        const completedPurchases = await prisma_1.prisma.purchase.count({
            where: { clientId: userId, status: client_1.PurchaseStatus.COMPLETADA },
        });
        const isFirstPurchase = completedPurchases === 0;
        const isBirthday = user.birthDate ? this.isBirthday(user.birthDate) : false;
        const [minPurchaseForPoints, maxPointsLimit, birthdayAlreadyAwarded] = await Promise.all([
            systemConfig_service_1.SystemConfigService.getMinPurchaseForPoints(),
            systemConfig_service_1.SystemConfigService.getMaxPointsPerPurchase(),
            systemConfig_service_1.SystemConfigService.hasBirthdayBonusAwardedThisYear(user.id),
        ]);
        const belowMinPurchase = minPurchaseForPoints > 0 && subtotal < minPurchaseForPoints;
        const now = new Date();
        const activeRules = await prisma_1.prisma.pointRule.findMany({
            where: {
                isActive: true,
                AND: [
                    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
                ],
            },
            orderBy: { priority: 'desc' },
            include: { products: true },
        });
        let totalPoints = 0;
        const breakdown = [];
        for (const rule of activeRules) {
            const config = rule.config;
            let rulePoints = 0;
            switch (rule.type) {
                case client_1.RuleType.POR_MONTO:
                    rulePoints = belowMinPurchase ? 0 : this.calculatePorMonto(subtotal, config);
                    break;
                case client_1.RuleType.POR_PRODUCTO:
                    rulePoints = belowMinPurchase ? 0 : this.calculatePorProducto(items, config);
                    break;
                case client_1.RuleType.POR_CATEGORIA:
                    rulePoints = belowMinPurchase ? 0 : await this.calculatePorCategoria(items, config);
                    break;
                case client_1.RuleType.PRIMERA_COMPRA:
                    if (isFirstPurchase && config.bonusPrimeraCompra) {
                        rulePoints = config.bonusPrimeraCompra;
                    }
                    break;
                case client_1.RuleType.CUMPLEANOS:
                    if (isBirthday && !birthdayAlreadyAwarded && config.bonusCumpleanos) {
                        rulePoints = config.bonusCumpleanos;
                    }
                    break;
                case client_1.RuleType.RANGO_MONTO:
                    rulePoints = belowMinPurchase ? 0 : this.calculatePorRango(subtotal, config);
                    break;
            }
            if (rulePoints > 0) {
                totalPoints += rulePoints;
                breakdown.push({
                    rule: rule.name,
                    type: rule.type,
                    points: rulePoints,
                    description: PointsService.getRuleDescription(rule.type, rulePoints),
                });
            }
        }
        if (maxPointsLimit > 0 && totalPoints > maxPointsLimit) {
            const trimmed = totalPoints - maxPointsLimit;
            totalPoints = maxPointsLimit;
            breakdown.push({
                rule: 'Tope máximo por compra',
                type: 'LIMITE',
                points: 0,
                description: `Se recortaron ${trimmed} puntos: tope de ${maxPointsLimit} por compra (max_points_per_purchase)`,
            });
        }
        return { totalPoints, breakdown };
    }
    static async calculatePointsWithPromotions(userId, items, subtotal, categoryIds = [], brandIds = [], productIds = []) {
        const baseResult = await this.calculatePoints(userId, items, subtotal);
        const promoContext = {
            items,
            subtotal,
            categoryIds,
            brandIds,
            productIds,
        };
        const applicablePromotions = await promotion_service_1.PromotionService.getActivePromotionsForClient(promoContext.items, promoContext.subtotal, promoContext.categoryIds, promoContext.brandIds, promoContext.productIds);
        // Las promociones ya no acreditan puntos: solo pueden aplicar descuentos.
        const appliedPromotions = [];
        for (const promo of applicablePromotions) {
            const impact = promotion_service_1.PromotionService.calculatePromotionImpact(promo.promotion, subtotal, baseResult.totalPoints);
            if (impact.discount > 0) {
                appliedPromotions.push({
                    promotion: promo.promotion,
                    points: 0,
                    discount: impact.discount,
                });
            }
        }
        const finalBreakdown = [...baseResult.breakdown];
        for (const promo of appliedPromotions) {
            finalBreakdown.push({
                rule: `Promoción: ${promo.promotion.name}`,
                type: 'PROMOCION',
                points: 0,
                description: `Promoción ${promo.promotion.name}: descuento $${promo.discount}`,
            });
        }
        return {
            totalPoints: baseResult.totalPoints,
            breakdown: finalBreakdown,
            appliedPromotions,
        };
    }
    static getRuleDescription(ruleType, points) {
        switch (ruleType) {
            case 'POR_MONTO':
                return `Puntos por compra: ${points} pts`;
            case 'POR_PRODUCTO':
                return `Puntos por productos específicos: ${points} pts`;
            case 'POR_CATEGORIA':
                return `Puntos por categoría: ${points} pts`;
            case 'PRIMERA_COMPRA':
                return `Puntos de bienvenida: ${points} pts`;
            case 'CUMPLEANOS':
                return `Puntos de cumpleaños: ${points} pts`;
            case 'RANGO_MONTO':
                return `Puntos por rango de monto: ${points} pts`;
            default:
                return `${ruleType}: ${points} pts`;
        }
    }
    static calculatePorMonto(subtotal, config) {
        const { puntosPorMonto, montoMinimo = 0, multiplicador = 1 } = config;
        // La regla es la única autoridad: si no define puntosPorMonto, no otorga puntos.
        if (puntosPorMonto == null)
            return 0;
        if (subtotal < montoMinimo)
            return 0;
        // Redondeo al punto más cercano para reflejar el monto nominal pagado
        // (ej: 300.000 × 0.04 = 12.000 exactos, sin perder 1 punto por centavos).
        return Math.round(subtotal * puntosPorMonto * multiplicador);
    }
    static calculatePorProducto(items, config) {
        const { productosIds = [], multiplicador = 1 } = config;
        if (productosIds.length === 0)
            return 0;
        let points = 0;
        for (const item of items) {
            if (productosIds.includes(item.productId)) {
                points += Math.floor(item.lineTotal * multiplicador);
            }
        }
        return points;
    }
    static async calculatePorCategoria(items, config) {
        const { categorias = [], multiplicador = 1 } = config;
        if (categorias.length === 0)
            return 0;
        const productIds = items.map(i => i.productId);
        const products = await prisma_1.prisma.product.findMany({
            where: { id: { in: productIds }, category: { in: categorias } },
            select: { id: true },
        });
        const categoryProductIds = new Set(products.map(p => p.id));
        let points = 0;
        for (const item of items) {
            if (categoryProductIds.has(item.productId)) {
                points += Math.floor(item.lineTotal * multiplicador);
            }
        }
        return points;
    }
    static calculatePorRango(subtotal, config) {
        const { rangos = [] } = config;
        for (const rango of rangos) {
            if (subtotal >= rango.min && subtotal <= rango.max) {
                return rango.puntos;
            }
        }
        return 0;
    }
    static isBirthday(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
    }
    static async addPoints(userId, points, transactionId, description) {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.clientProfile.update({
                where: { userId },
                data: {
                    currentPoints: { increment: points },
                    totalPointsEarned: { increment: points },
                },
            });
            await tx.notification.create({
                data: {
                    userId,
                    type: 'POINTS_EARNED',
                    title: '¡Puntos ganados!',
                    message: `Has ganado ${points} puntos${description ? `: ${description}` : ''}`,
                    metadata: { points, transactionId },
                },
            });
        });
    }
    static async redeemPoints(userId, points, redemptionId) {
        await prisma_1.prisma.$transaction(async (tx) => {
            const profile = await tx.clientProfile.findUnique({
                where: { userId },
            });
            if (!profile || profile.currentPoints < points) {
                throw new Error('Puntos insuficientes');
            }
            await tx.clientProfile.update({
                where: { userId },
                data: {
                    currentPoints: { decrement: points },
                    totalPointsRedeemed: { increment: points },
                },
            });
            await tx.notification.create({
                data: {
                    userId,
                    type: 'POINTS_REDEEMED',
                    title: 'Canje realizado',
                    message: `Has canjeado ${points} puntos`,
                    metadata: { points, redemptionId },
                },
            });
        });
    }
    static async adjustPoints(userId, points, reason, adminId) {
        await prisma_1.prisma.$transaction(async (tx) => {
            const profile = await tx.clientProfile.findUnique({ where: { userId } });
            if (!profile)
                throw new Error('Perfil no encontrado');
            const newBalance = profile.currentPoints + points;
            if (newBalance < 0)
                throw new Error('El ajuste dejaría puntos negativos');
            await tx.clientProfile.update({
                where: { userId },
                data: { currentPoints: newBalance },
            });
            await tx.transaction.create({
                data: {
                    userId,
                    type: client_1.TransactionType.AJUSTE_MANUAL,
                    subtotal: 0,
                    total: 0,
                    pointsEarned: points,
                    pointsBalance: newBalance,
                    description: `Ajuste manual: ${reason}`,
                    cashierId: adminId,
                },
            });
            await tx.notification.create({
                data: {
                    userId,
                    type: 'POINTS_ADJUSTED',
                    title: 'Ajuste de puntos',
                    message: `Tus puntos han sido ajustados: ${points > 0 ? '+' : ''}${points} (${reason})`,
                    metadata: { points, reason, adminId },
                },
            });
        });
    }
}
exports.PointsService = PointsService;
//# sourceMappingURL=points.service.js.map
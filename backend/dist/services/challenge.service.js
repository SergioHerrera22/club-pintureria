"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChallengeService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
class ChallengeService {
    static async getChallenges(filters = {}) {
        const { page = 1, limit = 20, isActive, type } = filters;
        const where = {};
        if (isActive !== undefined)
            where.isActive = isActive;
        if (type)
            where.type = type;
        const [challenges, total] = await Promise.all([
            prisma_1.prisma.challenge.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.prisma.challenge.count({ where }),
        ]);
        return {
            challenges,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        };
    }
    static async getClientChallenges(clientId) {
        const challenges = await prisma_1.prisma.challenge.findMany({
            where: {
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        const progress = await prisma_1.prisma.challengeProgress.findMany({
            where: { clientId, challengeId: { in: challenges.map(c => c.id) } },
        });
        const progressMap = new Map(progress.map(p => [p.challengeId, p]));
        return challenges.map(c => ({
            ...c,
            progress: progressMap.get(c.id) || { currentValue: 0, completed: false },
        }));
    }
    static async getChallengeById(id) {
        const challenge = await prisma_1.prisma.challenge.findUnique({
            where: { id },
            include: { progress: true },
        });
        if (!challenge)
            throw new errorHandler_1.AppError(404, 'Desafío no encontrado');
        return challenge;
    }
    static async createChallenge(data) {
        const challenge = await prisma_1.prisma.challenge.create({
            data: {
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                type: data.type,
                target: data.target,
                condition: data.condition,
                rewardPoints: data.rewardPoints,
                rewardCoupon: data.rewardCoupon,
                startDate: data.startDate,
                endDate: data.endDate,
                isActive: data.isActive ?? true,
            },
        });
        return challenge;
    }
    static async updateChallenge(id, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.imageUrl !== undefined)
            updateData.imageUrl = data.imageUrl;
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.target !== undefined)
            updateData.target = data.target;
        if (data.condition !== undefined)
            updateData.condition = data.condition;
        if (data.rewardPoints !== undefined)
            updateData.rewardPoints = data.rewardPoints;
        if (data.rewardCoupon !== undefined)
            updateData.rewardCoupon = data.rewardCoupon;
        if (data.startDate !== undefined)
            updateData.startDate = data.startDate;
        if (data.endDate !== undefined)
            updateData.endDate = data.endDate;
        if (data.isActive !== undefined)
            updateData.isActive = data.isActive;
        const challenge = await prisma_1.prisma.challenge.update({
            where: { id },
            data: updateData,
        });
        return challenge;
    }
    static async deleteChallenge(id) {
        await prisma_1.prisma.challenge.delete({ where: { id } });
        return { message: 'Desafío eliminado' };
    }
    static async updateProgressOnPurchase(clientId, items, total) {
        const activeChallenges = await prisma_1.prisma.challenge.findMany({
            where: {
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
            include: { progress: { where: { clientId } } },
        });
        for (const challenge of activeChallenges) {
            if (!this.challengeAppliesToClient(challenge, items, total))
                continue;
            let existingProgress = challenge.progress[0];
            if (!existingProgress) {
                existingProgress = await prisma_1.prisma.challengeProgress.create({
                    data: {
                        clientId,
                        challengeId: challenge.id,
                        currentValue: 0,
                        completed: false,
                    },
                });
            }
            if (existingProgress.completed)
                continue;
            const newValue = this.calculateProgress(challenge, items, total, existingProgress.currentValue);
            const completed = newValue >= challenge.target;
            await prisma_1.prisma.challengeProgress.update({
                where: { id: existingProgress.id },
                data: {
                    currentValue: newValue,
                    completed,
                    completedAt: completed ? new Date() : null,
                },
            });
            if (completed) {
                await this.completeChallenge(clientId, challenge);
            }
        }
    }
    static challengeAppliesToClient(challenge, items, total) {
        switch (challenge.type) {
            case 'CANTIDAD_PRODUCTOS':
                return items.reduce((sum, i) => sum + i.quantity, 0) > 0;
            case 'CANTIDAD_COMPRAS':
                return true; // Cada compra cuenta
            case 'MARCAS_DIFERENTES':
                const brands = new Set(items.map(i => i.product.brand).filter(Boolean));
                return brands.size > 0;
            case 'CATEGORIAS_DIFERENTES':
                const categories = new Set(items.map(i => i.product.category).filter(Boolean));
                return categories.size > 0;
            case 'MONTO_ACUMULADO':
                return total > 0;
            case 'FRECUENCIA_COMPRA':
                return true;
            default:
                return false;
        }
    }
    static calculateProgress(challenge, items, total, currentValue) {
        const condition = challenge.condition;
        let increment = 0;
        switch (challenge.type) {
            case 'CANTIDAD_PRODUCTOS':
                increment = items.reduce((sum, i) => sum + i.quantity, 0);
                break;
            case 'CANTIDAD_COMPRAS':
                increment = 1;
                break;
            case 'MARCAS_DIFERENTES':
                const brands = new Set(items.map(i => i.product.brand).filter(Boolean));
                increment = brands.size;
                break;
            case 'CATEGORIAS_DIFERENTES':
                const categories = new Set(items.map(i => i.product.category).filter(Boolean));
                increment = categories.size;
                break;
            case 'MONTO_ACUMULADO':
                increment = total;
                break;
            case 'FRECUENCIA_COMPRA':
                increment = 1;
                break;
        }
        return currentValue + increment;
    }
    static async completeChallenge(clientId, challenge) {
        // Los desafíos ya no acreditan puntos: solo registran el logro.
        await prisma_1.prisma.notification.create({
            data: {
                userId: clientId,
                type: 'CHALLENGE_COMPLETED',
                title: '¡Desafío completado!',
                message: `Completaste "${challenge.name}"`,
                metadata: { challengeId: challenge.id },
            },
        });
    }
}
exports.ChallengeService = ChallengeService;
//# sourceMappingURL=challenge.service.js.map
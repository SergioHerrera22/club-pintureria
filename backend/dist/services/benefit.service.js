"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenefitService = void 0;
const prisma_1 = require("../config/prisma");
class BenefitService {
    static async getActiveBenefits() {
        const now = new Date();
        return prisma_1.prisma.benefit.findMany({
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
    static async getAllBenefits(filters) {
        const { type, isActive, page = 1, limit = 20 } = filters;
        const where = {};
        if (type)
            where.type = type;
        if (isActive !== undefined)
            where.isActive = isActive;
        const [benefits, total] = await Promise.all([
            prisma_1.prisma.benefit.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.benefit.count({ where }),
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
    static async getBenefitById(id) {
        return prisma_1.prisma.benefit.findUnique({
            where: { id },
        });
    }
    static async createBenefit(data) {
        return prisma_1.prisma.benefit.create({ data });
    }
    static async updateBenefit(id, data) {
        return prisma_1.prisma.benefit.update({
            where: { id },
            data,
        });
    }
    static async deleteBenefit(id) {
        return prisma_1.prisma.benefit.delete({ where: { id } });
    }
}
exports.BenefitService = BenefitService;
//# sourceMappingURL=benefit.service.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coupon_service_1 = require("../services/coupon.service");
const challenge_service_1 = require("../services/challenge.service");
const purchase_service_1 = require("../services/purchase.service");
const benefit_service_1 = require("../services/benefit.service");
const systemConfig_service_1 = require("../services/systemConfig.service");
const points_service_1 = require("../services/points.service");
const email_service_1 = require("../services/email.service");
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación y rol CLIENTE
router.use(auth_1.authenticate, (0, auth_1.authorize)('CLIENTE'));
// ===== HOME CLIENTE =====
router.get('/home', async (req, res, next) => {
    try {
        const user = req.user;
        const client = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                clientProfile: true,
                qr: true,
            },
        });
        if (!client || !client.clientProfile) {
            throw new errorHandler_1.AppError(404, 'Perfil de cliente no encontrado');
        }
        const profile = client.clientProfile;
        // Todas las consultas son lecturas independientes: se ejecutan en
        // paralelo para evitar sumar la latencia de red de la base de datos
        // en cada paso (con DB remota esto era la principal causa de lentitud).
        const [promotions, challenges, coupons, recentPurchases, expiringCoupons, benefits] = await Promise.all([
            // Promociones vigentes (se muestran todas en el carrusel del inicio)
            prisma_1.prisma.promotion.findMany({
                where: {
                    isActive: true,
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // Desafíos activos
            challenge_service_1.ChallengeService.getClientChallenges(user.id),
            // Cupones disponibles
            coupon_service_1.CouponService.getCoupons({
                clientId: user.id,
                isActive: true,
                page: 1,
                limit: 5,
            }),
            // Últimas compras
            purchase_service_1.PurchaseService.getPurchases({
                clientId: user.id,
                page: 1,
                limit: 5,
            }),
            // Cupones por vencer (próximos 7 días)
            prisma_1.prisma.coupon.findMany({
                where: {
                    clientId: user.id,
                    isActive: true,
                    endDate: {
                        gte: new Date(),
                        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                },
                take: 3,
                orderBy: { endDate: 'asc' },
            }),
            // Beneficios disponibles
            benefit_service_1.BenefitService.getActiveBenefits(),
        ]);
        res.json({
            client: {
                firstName: client.firstName,
                lastName: client.lastName,
                dni: client.dni,
                email: client.email,
                phone: client.phone,
                birthDate: client.birthDate,
            },
            profile: {
                currentPoints: profile.currentPoints,
                totalPointsEarned: profile.totalPointsEarned,
                totalPointsRedeemed: profile.totalPointsRedeemed,
                lastPurchaseAt: profile.lastPurchaseAt,
            },
            stats: {
                activePromotions: promotions.length,
                activeChallenges: challenges.filter(c => !c.progress?.completed).length,
                availableCoupons: coupons.coupons.length,
                expiringCoupons: expiringCoupons.length,
            },
            promotions: promotions.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                imageUrl: p.imageUrl,
                type: p.type,
                multiplier: p.multiplier,
                bonusPoints: p.bonusPoints,
                discount: p.discount,
                endDate: p.endDate,
            })),
            challenges: challenges.slice(0, 3).map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                imageUrl: c.imageUrl,
                type: c.type,
                target: c.target,
                progress: c.progress?.currentValue || 0,
                completed: c.progress?.completed || false,
                rewardPoints: c.rewardPoints,
                endDate: c.endDate,
            })),
            coupons: coupons.coupons.slice(0, 3).map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
                type: c.type,
                value: c.value,
                endDate: c.endDate,
            })),
            expiringCoupons: expiringCoupons.map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
                daysLeft: Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            })),
            recentPurchases: recentPurchases.purchases.slice(0, 3).map(p => ({
                id: p.id,
                receiptNumber: p.receiptNumber,
                total: p.total,
                pointsEarned: p.pointsEarned,
                createdAt: p.createdAt,
            })),
            benefits: benefits.map(b => ({
                id: b.id,
                name: b.name,
                description: b.description,
                imageUrl: b.imageUrl,
                type: b.type,
                value: b.value,
                autoApply: b.autoApply,
                endDate: b.endDate,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== MIS PROMOCIONES =====
router.get('/promotions', async (req, res, next) => {
    try {
        const user = req.user;
        const client = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: { clientProfile: true },
        });
        if (!client?.clientProfile)
            throw new errorHandler_1.AppError(404, 'Perfil no encontrado');
        const { page = 1, limit = 20 } = req.query;
        const allPromotions = await prisma_1.prisma.promotion.findMany({
            where: {
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        });
        const total = await prisma_1.prisma.promotion.count({
            where: {
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
        });
        res.json({
            promotions: allPromotions.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                imageUrl: p.imageUrl,
                type: p.type,
                multiplier: p.multiplier,
                bonusPoints: p.bonusPoints,
                discount: p.discount,
                startDate: p.startDate,
                endDate: p.endDate,
                categories: p.categories,
                brands: p.brands,
                products: p.products,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== MIS CUPONES =====
router.get('/coupons', async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20, status } = req.query;
        const filters = {
            clientId: user.id,
            page: Number(page),
            limit: Number(limit),
        };
        if (status === 'available') {
            filters.isActive = true;
        }
        else if (status === 'used') {
            filters.isActive = false;
        }
        const result = await coupon_service_1.CouponService.getCoupons(filters);
        // Agregar días restantes
        const couponsWithDays = result.coupons.map(c => ({
            ...c,
            daysLeft: c.endDate ? Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
            isExpired: c.endDate ? new Date(c.endDate) < new Date() : false,
            isExpiringSoon: c.endDate ? (new Date(c.endDate).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 : false,
        }));
        res.json({
            coupons: couponsWithDays,
            pagination: result.pagination,
        });
    }
    catch (error) {
        next(error);
    }
});
// Validar cupón
router.post('/coupons/validate', async (req, res, next) => {
    try {
        const user = req.user;
        const { code } = req.body;
        if (!code)
            throw new errorHandler_1.AppError(400, 'Código requerido');
        const result = await coupon_service_1.CouponService.validateCoupon(code, user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ===== MIS DESAFÍOS =====
router.get('/challenges', async (req, res, next) => {
    try {
        const user = req.user;
        const challenges = await challenge_service_1.ChallengeService.getClientChallenges(user.id);
        res.json({
            challenges: challenges.map(c => {
                const prog = c.progress;
                return {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    imageUrl: c.imageUrl,
                    type: c.type,
                    target: c.target,
                    progress: prog?.currentValue ?? 0,
                    completed: prog?.completed ?? false,
                    completedAt: prog?.completedAt ?? null,
                    rewardPoints: c.rewardPoints,
                    rewardCoupon: c.rewardCoupon,
                    startDate: c.startDate,
                    endDate: c.endDate,
                };
            }),
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== MI QR =====
router.get('/qr', async (req, res, next) => {
    try {
        const user = req.user;
        let qr = await prisma_1.prisma.customerQR.findUnique({
            where: { clientId: user.id },
        });
        if (!qr) {
            qr = await prisma_1.prisma.customerQR.create({
                data: {
                    clientId: user.id,
                    token: require('crypto').randomBytes(32).toString('hex'),
                },
            });
        }
        // Generar URL del QR
        const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/scan/${qr.token}`;
        // Generar QR como SVG o data URL
        const QRCode = require('qrcode');
        const qrSvg = await QRCode.toString(qrUrl, { type: 'svg', width: 300 });
        res.json({
            qr: {
                id: qr.id,
                token: qr.token,
                url: qrUrl,
                svg: qrSvg,
                expiresAt: qr.expiresAt,
                createdAt: qr.createdAt,
            },
            client: {
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                dni: req.user.dni,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Regenerar QR
router.post('/qr/regenerate', async (req, res, next) => {
    try {
        const user = req.user;
        await prisma_1.prisma.customerQR.deleteMany({
            where: { clientId: user.id },
        });
        const qr = await prisma_1.prisma.customerQR.create({
            data: {
                clientId: user.id,
                token: require('crypto').randomBytes(32).toString('hex'),
            },
        });
        const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/scan/${qr.token}`;
        const QRCode = require('qrcode');
        const qrSvg = await QRCode.toString(qrUrl, { type: 'svg', width: 300 });
        res.json({
            qr: {
                id: qr.id,
                token: qr.token,
                url: qrUrl,
                svg: qrSvg,
                createdAt: qr.createdAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== MIS COMPRAS =====
router.get('/purchases', async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20, startDate, endDate } = req.query;
        const result = await purchase_service_1.PurchaseService.getPurchases({
            clientId: user.id,
            page: Number(page),
            limit: Number(limit),
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json({
            purchases: result.purchases.map(p => ({
                id: p.id,
                receiptNumber: p.receiptNumber,
                total: p.total,
                pointsEarned: p.pointsEarned,
                status: p.status,
                createdAt: p.createdAt,
                branch: p.branch,
                itemCount: p.itemCount,
            })),
            pagination: result.pagination,
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/purchases/:id', async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const purchase = await purchase_service_1.PurchaseService.getPurchaseById(id);
        if (!purchase)
            throw new errorHandler_1.AppError(404, 'Compra no encontrada');
        if (purchase.client.id !== user.id)
            throw new errorHandler_1.AppError(403, 'No autorizado');
        res.json(purchase);
    }
    catch (error) {
        next(error);
    }
});
// ===== MIS PREMIOS =====
router.get('/prizes', async (req, res, next) => {
    try {
        const user = req.user;
        const client = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: { clientProfile: true },
        });
        if (!client?.clientProfile)
            throw new errorHandler_1.AppError(404, 'Perfil no encontrado');
        const currentPoints = client.clientProfile.currentPoints;
        const now = new Date();
        const prizes = await prisma_1.prisma.prize.findMany({
            where: {
                isActive: true,
                status: 'DISPONIBLE',
                stock: { gt: 0 },
                AND: [
                    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
                ],
            },
            orderBy: { pointsCost: 'asc' },
        });
        res.json({
            currentPoints,
            prizes: prizes.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                description: p.description,
                imageUrl: p.imageUrl,
                pointsCost: p.pointsCost,
                category: p.category,
                stock: p.stock,
                canAfford: p.pointsCost <= currentPoints,
                pointsMissing: Math.max(0, p.pointsCost - currentPoints),
            })),
            // Premio más cercano que aún no puede canjear
            nextGoal: (() => {
                const next = prizes.find(p => p.pointsCost > currentPoints);
                return next ? { id: next.id, name: next.name, imageUrl: next.imageUrl, pointsCost: next.pointsCost, pointsMissing: next.pointsCost - currentPoints } : null;
            })(),
        });
    }
    catch (error) {
        next(error);
    }
});
// Canjear un premio (cliente autogestionado)
router.post('/prizes/redeem', async (req, res, next) => {
    try {
        const user = req.user;
        const { prizeId } = req.body;
        if (!prizeId)
            throw new errorHandler_1.AppError(400, 'Premio requerido');
        const client = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: { clientProfile: true },
        });
        if (!client?.clientProfile)
            throw new errorHandler_1.AppError(404, 'Perfil no encontrado');
        const prize = await prisma_1.prisma.prize.findUnique({ where: { id: prizeId } });
        if (!prize)
            throw new errorHandler_1.AppError(404, 'Premio no encontrado');
        if (!prize.isActive || prize.status !== 'DISPONIBLE')
            throw new errorHandler_1.AppError(400, 'Premio no disponible');
        if (prize.stock <= 0)
            throw new errorHandler_1.AppError(400, 'Premio sin stock');
        const now = new Date();
        const withinValidity = (!prize.validFrom || prize.validFrom <= now) && (!prize.validTo || prize.validTo >= now);
        if (!withinValidity)
            throw new errorHandler_1.AppError(400, 'Premio fuera de vigencia');
        const profile = client.clientProfile;
        if (profile.currentPoints < prize.pointsCost) {
            throw new errorHandler_1.AppError(400, `Te faltan ${prize.pointsCost - profile.currentPoints} puntos para canjear este premio`);
        }
        const minRedemption = await systemConfig_service_1.SystemConfigService.getRedemptionMinPoints();
        if (minRedemption > 0 && profile.currentPoints < minRedemption) {
            throw new errorHandler_1.AppError(400, `Necesitás al menos ${minRedemption} puntos en tu saldo para canjear`);
        }
        const redemption = await prisma_1.prisma.$transaction(async (tx) => {
            const newRedemption = await tx.redemption.create({
                data: {
                    userId: client.id,
                    prizeId: prize.id,
                    pointsSpent: prize.pointsCost,
                    status: 'PENDIENTE',
                    notes: 'Canje autogestionado desde la app del cliente',
                },
            });
            await tx.prize.update({
                where: { id: prize.id },
                data: { stock: { decrement: 1 } },
            });
            await points_service_1.PointsService.redeemPoints(client.id, prize.pointsCost, newRedemption.id);
            return newRedemption;
        });
        const updatedProfile = await prisma_1.prisma.clientProfile.findUnique({ where: { userId: client.id } });
        if (client.email && await systemConfig_service_1.SystemConfigService.getNotificationsEnabled('email')) {
            await email_service_1.emailService.sendRedemptionConfirmationEmail(client.email, client.firstName, prize.name, prize.pointsCost, updatedProfile.currentPoints);
        }
        res.status(201).json({
            redemption: { id: redemption.id, pointsSpent: redemption.pointsSpent, createdAt: redemption.createdAt },
            prize: { id: prize.id, name: prize.name, pointsCost: prize.pointsCost },
            newBalance: updatedProfile.currentPoints,
            message: '¡Canje realizado! Coordiná la retirada del premio en sucursal.',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== HISTORIAL DE PUNTOS =====
router.get('/points-history', async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20, type } = req.query;
        const client = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: { clientProfile: true },
        });
        if (!client?.clientProfile)
            throw new errorHandler_1.AppError(404, 'Perfil no encontrado');
        const [purchases, transactions, redemptions] = await Promise.all([
            prisma_1.prisma.purchase.findMany({
                where: { clientId: user.id, status: 'COMPLETADA', pointsEarned: { gt: 0 } },
                orderBy: { createdAt: 'desc' },
                select: { id: true, receiptNumber: true, pointsEarned: true, pointsBalance: true, createdAt: true },
            }),
            prisma_1.prisma.transaction.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                select: { id: true, type: true, description: true, pointsEarned: true, pointsBalance: true, createdAt: true },
            }),
            prisma_1.prisma.redemption.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                include: { prize: { select: { name: true } } },
            }),
        ]);
        const movements = [
            ...purchases.map(p => ({
                id: `purchase-${p.id}`,
                source: 'COMPRA',
                type: 'COMPRA',
                description: `Compra ${p.receiptNumber}`,
                points: p.pointsEarned,
                balanceAfter: p.pointsBalance,
                createdAt: p.createdAt,
            })),
            ...transactions.map(t => ({
                id: `tx-${t.id}`,
                source: (t.type === 'VENCIMIENTO' ? 'VENCIMIENTO' : 'AJUSTE'),
                type: t.type,
                description: t.description || t.type,
                points: t.pointsEarned,
                balanceAfter: t.pointsBalance,
                createdAt: t.createdAt,
            })),
            ...redemptions.map(r => ({
                id: `redemption-${r.id}`,
                source: 'CANJE',
                type: 'CANJE',
                description: `Canje: ${r.prize.name}`,
                points: -r.pointsSpent,
                balanceAfter: null,
                createdAt: r.createdAt,
            })),
        ];
        // type=ACREDITACION filtra solo movimientos positivos
        const filtered = type === 'ACREDITACION' ? movements.filter(m => m.points > 0) : movements;
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const total = filtered.length;
        const pageLimit = Number(limit);
        const pageNum = Number(page);
        const paged = filtered.slice((pageNum - 1) * pageLimit, pageNum * pageLimit);
        const earned = movements.filter(m => m.points > 0).reduce((s, m) => s + m.points, 0);
        const spent = movements.filter(m => m.points < 0).reduce((s, m) => s + Math.abs(m.points), 0);
        res.json({
            currentPoints: client.clientProfile.currentPoints,
            totalEarned: earned,
            totalSpent: spent,
            movements: paged,
            pagination: {
                page: pageNum,
                limit: pageLimit,
                total,
                pages: Math.ceil(total / pageLimit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===== PERFIL PROFESIONAL =====
router.get('/professional', async (req, res, next) => {
    try {
        const user = req.user;
        const profile = await prisma_1.prisma.professionalProfile.findUnique({
            where: { clientId: user.id },
        });
        res.json({ profile });
    }
    catch (error) {
        next(error);
    }
});
router.put('/professional', async (req, res, next) => {
    try {
        const user = req.user;
        const { specialty, company, position, location, phone, website, socialMedia, preferredBrands, preferredCategories } = req.body;
        const profile = await prisma_1.prisma.professionalProfile.upsert({
            where: { clientId: user.id },
            update: { specialty, company, position, location, phone, website, socialMedia, preferredBrands, preferredCategories },
            create: { clientId: user.id, specialty, company, position, location, phone, website, socialMedia, preferredBrands, preferredCategories },
        });
        res.json({ profile });
    }
    catch (error) {
        next(error);
    }
});
// ===== PERFIL DEL CLIENTE =====
router.get('/profile', async (req, res, next) => {
    try {
        const user = req.user;
        const dbUser = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true, firstName: true, lastName: true, dni: true,
                email: true, phone: true, birthDate: true, createdAt: true,
            },
        });
        if (!dbUser)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        res.json({ client: dbUser });
    }
    catch (error) {
        next(error);
    }
});
router.put('/profile', async (req, res, next) => {
    try {
        const user = req.user;
        const { firstName, lastName, phone, birthDate, email } = req.body;
        const data = {};
        if (typeof firstName === 'string' && firstName.trim())
            data.firstName = firstName.trim();
        if (typeof lastName === 'string' && lastName.trim())
            data.lastName = lastName.trim();
        if (typeof phone === 'string')
            data.phone = phone.trim() || null;
        if (typeof email === 'string' && email.trim())
            data.email = email.trim().toLowerCase();
        if (typeof birthDate === 'string') {
            if (birthDate && isNaN(Date.parse(birthDate)))
                throw new errorHandler_1.AppError(400, 'Fecha de nacimiento inválida');
            data.birthDate = birthDate ? new Date(birthDate) : null;
        }
        // El email es único: si cambió y ya existe en otro usuario, no se guarda.
        if (data.email && data.email !== user.email) {
            const taken = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
            if (taken)
                throw new errorHandler_1.AppError(400, 'Ese correo ya está registrado');
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id: user.id },
            data,
            select: {
                id: true, firstName: true, lastName: true, dni: true,
                email: true, phone: true, birthDate: true,
            },
        });
        res.json({ client: updated, message: 'Perfil actualizado' });
    }
    catch (error) {
        next(error);
    }
});
router.put('/password', async (req, res, next) => {
    try {
        const user = req.user;
        const { currentPassword, newPassword } = req.body;
        const dbUser = await prisma_1.prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        const isValid = await bcryptjs_1.default.compare(String(currentPassword || ''), dbUser.passwordHash);
        if (!isValid)
            throw new errorHandler_1.AppError(400, 'La contraseña actual no coincide');
        if (String(newPassword || '').length < 6) {
            throw new errorHandler_1.AppError(400, 'La nueva contraseña debe tener al menos 6 caracteres');
        }
        const passwordHash = await bcryptjs_1.default.hash(String(newPassword), 12);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        res.json({ message: 'Contraseña actualizada' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=clientApp.routes.js.map
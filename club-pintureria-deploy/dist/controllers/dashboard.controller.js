"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentPurchases = exports.getSalesByCashier = exports.getSalesByBranch = exports.getBranchSummary = exports.getMovementsReport = exports.getPointsReport = exports.getSalesReport = exports.getDashboardStats = void 0;
const prisma_1 = require("../config/prisma");
const auth_1 = require("../middleware/auth");
/**
 * Resuelve la sucursal obligatoria para usuarios no-admin (cajera/vendedor).
 * Devuelve null si el usuario es admin (ve todo) y NO_BRANCH si es staff sin sucursal.
 */
const forcedBranchScope = (req) => (0, auth_1.resolveBranchScope)(req.user);
const getDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const scope = forcedBranchScope(req);
        // No-admin: siempre forzado a su sucursal (ignora query). Admin: filtro opcional.
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        const noData = !scope.isGlobal && branchId === auth_1.NO_BRANCH;
        const purchaseWhere = branchId ? { status: 'COMPLETADA', branchId } : { status: 'COMPLETADA' };
        // Clientes: al filtrar por sucursal se incluyen también los clientes sin
        // sucursal asignada (clientes "del club"), igual que en el listado de clientes.
        const userBranchWhere = branchId ? { OR: [{ branchId }, { branchId: null }] } : {};
        const profileBranchWhere = branchId ? { user: { OR: [{ branchId }, { branchId: null }] } } : undefined;
        // Staff sin sucursal asignada: no ve datos de ninguna sucursal
        if (noData) {
            res.json({
                users: { total: 0, active: 0, newThisMonth: 0 },
                points: { totalEarned: 0, totalRedeemed: 0, inCirculation: 0 },
                sales: { totalPurchases: 0, revenueThisMonth: 0, purchasesToday: 0 },
                topClients: [],
                lowStockPrizes: [],
            });
            return;
        }
        const [totalUsers, activeUsers, newUsersThisMonth, totalPointsEarned, totalPointsRedeemed, totalPurchases, revenueThisMonth, purchasesToday, topClients, lowStockPrizes,] = await Promise.all([
            prisma_1.prisma.user.count({ where: { role: 'CLIENTE', ...userBranchWhere } }),
            prisma_1.prisma.user.count({ where: { role: 'CLIENTE', isActive: true, ...userBranchWhere } }),
            prisma_1.prisma.user.count({ where: { role: 'CLIENTE', createdAt: { gte: startOfMonth }, ...userBranchWhere } }),
            prisma_1.prisma.clientProfile.aggregate({
                _sum: { totalPointsEarned: true },
                where: profileBranchWhere,
            }),
            prisma_1.prisma.clientProfile.aggregate({
                _sum: { totalPointsRedeemed: true },
                where: profileBranchWhere,
            }),
            prisma_1.prisma.purchase.count({ where: { status: 'COMPLETADA', ...(branchId ? { branchId: branchId } : {}) } }),
            prisma_1.prisma.purchase.aggregate({
                where: { status: 'COMPLETADA', createdAt: { gte: startOfMonth }, ...(branchId ? { branchId: branchId } : {}) },
                _sum: { total: true },
            }),
            prisma_1.prisma.purchase.count({ where: { status: 'COMPLETADA', createdAt: { gte: startOfDay }, ...(branchId ? { branchId } : {}) } }),
            prisma_1.prisma.clientProfile.findMany({
                take: 10,
                orderBy: { currentPoints: 'desc' },
                where: profileBranchWhere,
                include: { user: { select: { firstName: true, lastName: true, dni: true } } },
            }),
            prisma_1.prisma.prize.findMany({
                where: { isActive: true, status: 'DISPONIBLE', stock: { lte: 5, gt: 0 } },
                take: 10,
                select: { id: true, name: true, stock: true, pointsCost: true },
            }),
        ]);
        res.json({
            users: {
                total: totalUsers,
                active: activeUsers,
                newThisMonth: newUsersThisMonth,
            },
            points: {
                totalEarned: totalPointsEarned._sum.totalPointsEarned || 0,
                totalRedeemed: totalPointsRedeemed._sum.totalPointsRedeemed || 0,
                inCirculation: (totalPointsEarned._sum.totalPointsEarned || 0) - (totalPointsRedeemed._sum.totalPointsRedeemed || 0),
            },
            sales: {
                totalPurchases,
                revenueThisMonth: Number(revenueThisMonth._sum.total || 0),
                purchasesToday,
            },
            topClients: topClients.map(c => ({
                dni: c.user.dni,
                name: `${c.user.firstName} ${c.user.lastName}`,
                currentPoints: c.currentPoints,
            })),
            lowStockPrizes,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardStats = getDashboardStats;
const getSalesReport = async (req, res, next) => {
    try {
        const { from, to, groupBy = 'day' } = req.query;
        const scope = forcedBranchScope(req);
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        if (!scope.isGlobal && branchId === auth_1.NO_BRANCH) {
            res.json([]);
            return;
        }
        const purchaseWhere = { status: 'COMPLETADA' };
        if (branchId)
            purchaseWhere.branchId = branchId;
        if (from || to) {
            purchaseWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
        }
        const purchases = await prisma_1.prisma.purchase.findMany({
            where: purchaseWhere,
            orderBy: { createdAt: 'asc' },
            select: { total: true, pointsEarned: true, createdAt: true },
        });
        const grouped = purchases.reduce((acc, p) => {
            let key;
            const date = new Date(p.createdAt);
            if (groupBy === 'day')
                key = date.toISOString().split('T')[0];
            else if (groupBy === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            }
            else
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[key])
                acc[key] = { revenue: 0, points: 0, count: 0 };
            acc[key].revenue += Number(p.total);
            acc[key].points += p.pointsEarned;
            acc[key].count += 1;
            return acc;
        }, {});
        res.json(Object.entries(grouped).map(([period, data]) => ({ period, ...data })));
    }
    catch (error) {
        next(error);
    }
};
exports.getSalesReport = getSalesReport;
const getPointsReport = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const scope = forcedBranchScope(req);
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        if (!scope.isGlobal && branchId === auth_1.NO_BRANCH) {
            res.json({ earned: 0, redeemed: 0, adjusted: 0, net: 0 });
            return;
        }
        const purchaseWhere = { status: 'COMPLETADA' };
        if (branchId)
            purchaseWhere.branchId = branchId;
        if (from || to) {
            purchaseWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
        }
        const [earned, redeemed, adjusted] = await Promise.all([
            prisma_1.prisma.purchase.aggregate({ where: { ...purchaseWhere, status: 'COMPLETADA' }, _sum: { pointsEarned: true } }),
            prisma_1.prisma.purchase.aggregate({ where: { ...purchaseWhere, status: 'COMPLETADA' }, _sum: { pointsEarned: true } }),
            prisma_1.prisma.purchase.aggregate({ where: { ...purchaseWhere, status: 'COMPLETADA' }, _sum: { pointsEarned: true } }),
        ]);
        res.json({
            earned: earned._sum.pointsEarned || 0,
            redeemed: Math.abs(redeemed._sum.pointsEarned || 0),
            adjusted: adjusted._sum.pointsEarned || 0,
            net: (earned._sum.pointsEarned || 0) + (redeemed._sum.pointsEarned || 0) + (adjusted._sum.pointsEarned || 0),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPointsReport = getPointsReport;
const getMovementsReport = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const scope = forcedBranchScope(req);
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        const purchaseWhere = { status: 'COMPLETADA' };
        const transactionWhere = { type: 'AJUSTE_MANUAL' };
        if (branchId) {
            purchaseWhere.branchId = branchId;
        }
        // Staff sin sucursal: no ve movimientos
        if (!scope.isGlobal && branchId === auth_1.NO_BRANCH) {
            res.json({ movements: [], totalPurchases: 0, totalTransactions: 0 });
            return;
        }
        if (!scope.isGlobal && branchId) {
            // Ajustes manuales hechos sobre clientes de su sucursal
            transactionWhere.user = { branchId };
        }
        if (from || to) {
            purchaseWhere.createdAt = {};
            transactionWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
            if (from)
                transactionWhere.createdAt.gte = new Date(from);
            if (to)
                transactionWhere.createdAt.lte = new Date(to);
        }
        const [purchases, transactions] = await Promise.all([
            prisma_1.prisma.purchase.findMany({
                where: purchaseWhere,
                include: { client: { select: { firstName: true, lastName: true, dni: true } }, branch: { select: { name: true, code: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.transaction.findMany({
                where: transactionWhere,
                include: { user: { select: { firstName: true, lastName: true, dni: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const movements = [
            ...purchases.map(p => ({
                id: p.id,
                type: 'COMPRA',
                receiptNumber: p.receiptNumber,
                userDni: p.client.dni,
                userName: `${p.client.firstName} ${p.client.lastName}`,
                branch: p.branch.name,
                total: Number(p.total),
                points: p.pointsEarned,
                date: p.createdAt,
            })),
            ...transactions.map(t => ({
                id: t.id,
                type: t.type,
                description: t.description,
                userDni: t.user?.dni || 'N/A',
                userName: `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim() || 'N/A',
                branch: 'N/A',
                total: 0,
                points: t.pointsEarned,
                date: t.createdAt,
            })),
        ];
        res.json({ movements, totalPurchases: purchases.length, totalTransactions: transactions.length });
    }
    catch (error) {
        next(error);
    }
};
exports.getMovementsReport = getMovementsReport;
const getBranchSummary = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const scope = forcedBranchScope(req);
        const purchaseWhere = { status: 'COMPLETADA' };
        if (from || to) {
            purchaseWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
        }
        // Staff no-admin: solo ve el resumen de su propia sucursal
        const branches = await prisma_1.prisma.branch.findMany({
            where: scope.isGlobal ? undefined : { id: scope.branchId === auth_1.NO_BRANCH ? auth_1.NO_BRANCH : scope.branchId },
            include: {
                purchases: {
                    where: purchaseWhere,
                    include: {
                        client: { select: { firstName: true, lastName: true, dni: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                _count: { select: { purchases: { where: { status: 'COMPLETADA' } } } },
            },
            orderBy: { name: 'asc' },
        });
        const summary = branches.map(branch => ({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            totalPurchases: branch._count.purchases,
            lastPurchase: branch.purchases.length > 0 ? {
                receiptNumber: branch.purchases[0].receiptNumber,
                date: branch.purchases[0].createdAt,
                total: Number(branch.purchases[0].total),
                points: branch.purchases[0].pointsEarned,
                client: branch.purchases[0]?.client?.dni ? `${branch.purchases[0]?.client?.firstName} ${branch.purchases[0]?.client?.lastName}` : 'N/A',
            } : null,
        }));
        res.json({ branches: summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getBranchSummary = getBranchSummary;
const getSalesByBranch = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const scope = forcedBranchScope(req);
        const purchaseWhere = { status: 'COMPLETADA' };
        if (from || to) {
            purchaseWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
        }
        // Staff no-admin: solo su sucursal
        const branchListWhere = scope.isGlobal
            ? {}
            : { id: scope.branchId === auth_1.NO_BRANCH ? auth_1.NO_BRANCH : scope.branchId };
        const [branches, grouped] = await Promise.all([
            prisma_1.prisma.branch.findMany({
                where: branchListWhere,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, code: true },
            }),
            prisma_1.prisma.purchase.groupBy({
                by: ['branchId'],
                where: purchaseWhere,
                _sum: { total: true, pointsEarned: true },
                _count: { _all: true },
            }),
        ]);
        const groupedMap = new Map(grouped.map(g => [g.branchId, g]));
        res.json(branches.map(b => {
            const g = groupedMap.get(b.id);
            return {
                branchId: b.id,
                name: b.name,
                code: b.code,
                revenue: Number(g?._sum.total || 0),
                points: g?._sum.pointsEarned || 0,
                count: g?._count?._all || 0,
            };
        }));
    }
    catch (error) {
        next(error);
    }
};
exports.getSalesByBranch = getSalesByBranch;
const getSalesByCashier = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const scope = forcedBranchScope(req);
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        const purchaseWhere = { status: 'COMPLETADA' };
        if (branchId && branchId !== auth_1.NO_BRANCH)
            purchaseWhere.branchId = branchId;
        if (from || to) {
            purchaseWhere.createdAt = {};
            if (from)
                purchaseWhere.createdAt.gte = new Date(from);
            if (to)
                purchaseWhere.createdAt.lte = new Date(to);
        }
        // Staff no-admin: solo cajeras de su sucursal
        const cashierWhere = { role: 'CAJERA' };
        if (!scope.isGlobal) {
            cashierWhere.branchId = branchId === auth_1.NO_BRANCH ? auth_1.NO_BRANCH : branchId;
        }
        const [cashiers, grouped] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where: cashierWhere,
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
                select: { id: true, firstName: true, lastName: true },
            }),
            prisma_1.prisma.purchase.groupBy({
                by: ['cashierId'],
                where: purchaseWhere,
                _sum: { total: true, pointsEarned: true },
                _count: { _all: true },
            }),
        ]);
        const groupedMap = new Map(grouped.map(g => [g.cashierId, g]));
        res.json(cashiers.map(c => {
            const g = groupedMap.get(c.id);
            return {
                cashierId: c.id,
                name: `${c.firstName} ${c.lastName}`.trim(),
                revenue: Number(g?._sum.total || 0),
                points: g?._sum.pointsEarned || 0,
                count: g?._count?._all || 0,
            };
        }));
    }
    catch (error) {
        next(error);
    }
};
exports.getSalesByCashier = getSalesByCashier;
const getRecentPurchases = async (req, res, next) => {
    try {
        const { limit = 5 } = req.query;
        const scope = forcedBranchScope(req);
        const branchId = scope.isGlobal ? req.query.branchId : scope.branchId;
        const purchaseWhere = { status: 'COMPLETADA' };
        if (!scope.isGlobal && branchId === auth_1.NO_BRANCH) {
            res.json([]);
            return;
        }
        if (branchId)
            purchaseWhere.branchId = branchId;
        const purchases = await prisma_1.prisma.purchase.findMany({
            where: purchaseWhere,
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            include: {
                client: {
                    select: { firstName: true, lastName: true, dni: true },
                },
                items: {
                    include: { product: { select: { name: true, code: true } } },
                },
                branch: {
                    select: { name: true, code: true },
                },
            },
        });
        res.json(purchases.map(p => ({
            id: p.id,
            receiptNumber: p.receiptNumber,
            total: Number(p.total),
            pointsEarned: p.pointsEarned,
            createdAt: p.createdAt,
            client: {
                name: `${p.client.firstName} ${p.client.lastName}`,
                dni: p.client.dni,
            },
            branch: {
                name: p.branch.name,
                code: p.branch.code,
            },
            itemCount: p.items.length,
            items: p.items.map(i => ({ productName: i.product.name, productCode: i.product.code, quantity: i.quantity })),
        })));
    }
    catch (error) {
        next(error);
    }
};
exports.getRecentPurchases = getRecentPurchases;
//# sourceMappingURL=dashboard.controller.js.map
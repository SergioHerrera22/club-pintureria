"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientPoints = exports.registerQuickPurchase = exports.getClientHistory = exports.registerPurchase = exports.createClient = exports.findClientByDni = exports.getClientDetail = exports.deleteClient = exports.updateClient = exports.listClients = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const purchase_service_1 = require("../services/purchase.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const systemConfig_service_1 = require("../services/systemConfig.service");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
/**
 * Devuelve el filtro de sucursal a aplicar sobre User para el usuario autenticado.
 * - ADMIN: sin filtro (ve todas las sucursales).
 * - CAJERA/VENDEDOR: solo su sucursal; si no tiene, un sentinel que no matchea nada.
 */
const userBranchFilter = (req) => {
    const scope = (0, auth_1.resolveBranchScope)(req.user);
    return { isGlobal: scope.isGlobal, branchId: scope.branchId };
};
/** Objeto de filtro Prisma para User según scope.
 * Los clientes sin sucursal (creados por un admin sin asignarla, o autogestionados
 * desde el portal público) los ve todo el personal: son clientes "del club".
 */
const branchWhere = (scope) => scope.isGlobal
    ? {}
    : { OR: [{ branchId: scope.branchId }, { branchId: null }] };
/**
 * ¿Es la primera compra del cliente? Considera sólo ventas completadas y
 * excluye la recién creada (para el aviso de WhatsApp de la carga).
 */
const isFirstPurchaseFor = async (clientId, excludePurchaseId) => {
    const previous = await prisma_1.prisma.purchase.count({
        where: { clientId, status: 'COMPLETADA', id: { not: excludePurchaseId } },
    });
    return previous === 0;
};
/**
 * Mensaje de WhatsApp Web para la compra recién cargada: si el cliente es
 * nuevo en el club (primera compra) manda la bienvenida, si no, los puntos
 * ganados y el saldo acumulado. Devuelve null sin teléfono válido.
 */
const buildSaleWhatsapp = async (clientUser, purchase) => {
    const isFirstPurchase = await isFirstPurchaseFor(clientUser.id, purchase.id);
    return whatsapp_service_1.whatsappService.buildPurchaseMessage({
        phone: clientUser.phone,
        firstName: clientUser.firstName,
        lastName: clientUser.lastName,
        dni: clientUser.dni,
        pointsEarned: purchase.pointsEarned,
        pointsBalance: purchase.pointsBalance,
        amount: purchase.total,
        receiptNumber: purchase.receiptNumber,
        branchName: purchase.branch?.name ?? null,
        purchasedAt: purchase.createdAt,
        isFirstPurchase,
    });
};
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Estado de vencimiento de puntos de un cliente, con la misma lógica que
 * PointsExpirationService: la última actividad (compra/canje) + points_expiry_days
 * define la fecha de vencimiento.
 * - expired: ya perdió puntos por vencimiento (transacción VENCIMIENTO y saldo 0),
 *   o tiene saldo y la fecha de vencimiento ya pasó sin que corra el proceso.
 * - expiring: tiene saldo y le quedan `windowDays` días o menos.
 * - ok: resto.
 */
const computePointsExpiry = (user, lastActivityAt, hadExpiryLoss, expiryConfigDays, windowDays, now) => {
    const currentPoints = user.clientProfile?.currentPoints ?? 0;
    let status = 'ok';
    let daysLeft = null;
    if (expiryConfigDays > 0 && lastActivityAt) {
        const daysSinceActivity = Math.floor((now - new Date(lastActivityAt).getTime()) / DAY_MS);
        daysLeft = expiryConfigDays - daysSinceActivity;
        if (currentPoints > 0) {
            if (daysLeft <= 0) {
                status = 'expired';
                daysLeft = null;
            }
            else if (daysLeft <= windowDays) {
                status = 'expiring';
            }
        }
    }
    if (status === 'ok' && hadExpiryLoss && currentPoints === 0) {
        status = 'expired';
        daysLeft = null;
    }
    return { status, daysLeft, lastActivityAt };
};
/** Adjunta el estado de vencimiento a cada cliente y lo mapea al formato de respuesta. */
const withPointsExpiry = async (users, expiryConfigDays, windowDays, now) => {
    const ids = users.map((u) => u.id);
    const emptyGroups = [];
    const emptyLossRows = [];
    const [lastActivityGroups, expiryLossRows] = await Promise.all([
        ids.length > 0
            ? prisma_1.prisma.transaction.groupBy({
                by: ['userId'],
                where: { userId: { in: ids }, type: { in: [client_1.TransactionType.COMPRA, client_1.TransactionType.CANJE] } },
                _max: { createdAt: true },
            })
            : Promise.resolve(emptyGroups),
        ids.length > 0
            ? prisma_1.prisma.transaction.findMany({
                where: { userId: { in: ids }, type: client_1.TransactionType.VENCIMIENTO },
                select: { userId: true },
                distinct: ['userId'],
            })
            : Promise.resolve(emptyLossRows),
    ]);
    const lastActivityMap = new Map(lastActivityGroups.map((g) => [g.userId, g._max.createdAt]));
    const expiryLossSet = new Set(expiryLossRows.map((r) => r.userId));
    return users.map((u) => {
        const lastActivityAt = lastActivityMap.get(u.id) || u.clientProfile?.lastPurchaseAt || u.createdAt;
        const pointsExpiry = computePointsExpiry(u, lastActivityAt, expiryLossSet.has(u.id), expiryConfigDays, windowDays, now);
        return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            dni: u.dni,
            email: u.email,
            phone: u.phone,
            birthDate: u.birthDate,
            isActive: u.isActive,
            createdAt: u.createdAt,
            clientProfile: u.clientProfile ? {
                currentPoints: u.clientProfile.currentPoints,
                totalPointsEarned: u.clientProfile.totalPointsEarned,
                totalPointsRedeemed: u.clientProfile.totalPointsRedeemed,
                lastPurchaseAt: u.clientProfile.lastPurchaseAt,
            } : null,
            pointsExpiry,
        };
    });
};
const listClients = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, isActive, sortBy = 'createdAt', sortOrder = 'desc', expiryStatus, expiryDays, } = req.query;
        const scope = userBranchFilter(req);
        const where = { role: client_1.UserRole.CLIENTE, ...branchWhere(scope) };
        // El admin puede filtrar por sucursal específica
        if (scope.isGlobal && req.query.branchId) {
            where.branchId = req.query.branchId;
        }
        if (search) {
            const searchStr = search;
            where.OR = [
                { firstName: { contains: searchStr, mode: 'insensitive' } },
                { lastName: { contains: searchStr, mode: 'insensitive' } },
                { dni: { contains: searchStr, mode: 'insensitive' } },
                { email: { contains: searchStr, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }
        const validSortFields = ['createdAt', 'firstName', 'lastName', 'dni', 'email'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const dir = sortOrder === 'asc' ? 1 : -1;
        const statusFilter = ['expiring', 'expired', 'ok'].includes(String(expiryStatus))
            ? String(expiryStatus)
            : null;
        const windowDays = Math.min(Math.max(Number(expiryDays) || 30, 1), 365);
        const expiryConfigDays = await systemConfig_service_1.SystemConfigService.getPointsExpiryDays();
        const now = Date.now();
        if (statusFilter) {
            // El estado de vencimiento no es una columna: se calcula en memoria sobre
            // todos los clientes que cumplen los demás filtros y luego se pagina.
            const users = await prisma_1.prisma.user.findMany({
                where,
                include: { clientProfile: true },
            });
            const allClients = await withPointsExpiry(users, expiryConfigDays, windowDays, now);
            const filtered = allClients.filter((c) => c.pointsExpiry.status === statusFilter);
            filtered.sort((a, b) => {
                if (sortField === 'createdAt') {
                    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
                }
                return String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''), 'es') * dir;
            });
            const total = filtered.length;
            const start = (Number(page) - 1) * Number(limit);
            const clients = filtered.slice(start, start + Number(limit));
            res.json({
                clients,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            });
            return;
        }
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                orderBy: { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { clientProfile: true },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        const clients = await withPointsExpiry(users, expiryConfigDays, windowDays, now);
        res.json({
            clients,
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
};
exports.listClients = listClients;
const updateClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone, birthDate, isActive } = req.body;
        const scope = userBranchFilter(req);
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
        });
        if (!existing)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: { firstName, lastName, email, phone, birthDate: birthDate ? new Date(birthDate) : null, isActive },
            include: { clientProfile: true },
        });
        res.json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            email: user.email,
            phone: user.phone,
            birthDate: user.birthDate,
            isActive: user.isActive,
            clientProfile: user.clientProfile,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateClient = updateClient;
const deleteClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const scope = userBranchFilter(req);
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
        });
        if (!existing)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        await prisma_1.prisma.$transaction(async (tx) => {
            // Delete related records in order (due to foreign key constraints)
            await tx.purchaseItem.deleteMany({
                where: { purchase: { clientId: id } },
            });
            await tx.purchase.deleteMany({
                where: { clientId: id },
            });
            await tx.transactionItem.deleteMany({
                where: { transaction: { userId: id } },
            });
            await tx.transaction.deleteMany({
                where: { userId: id },
            });
            await tx.redemption.deleteMany({
                where: { userId: id },
            });
            await tx.notification.deleteMany({
                where: { userId: id },
            });
            await tx.coupon.deleteMany({
                where: { clientId: id },
            });
            await tx.challengeProgress.deleteMany({
                where: { clientId: id },
            });
            await tx.professionalProfile.deleteMany({
                where: { clientId: id },
            });
            await tx.customerQR.deleteMany({
                where: { clientId: id },
            });
            await tx.clientProfile.deleteMany({
                where: { userId: id },
            });
            // Finally delete the user
            await tx.user.delete({ where: { id } });
        });
        res.json({ message: 'Cliente eliminado correctamente' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteClient = deleteClient;
const getClientDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const scope = userBranchFilter(req);
        const user = await prisma_1.prisma.user.findFirst({
            where: { id, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
            include: { clientProfile: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        const recentTransactions = await prisma_1.prisma.transaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { items: { include: { product: true } } },
        });
        // Also fetch purchases with points breakdown
        const recentPurchases = await prisma_1.prisma.purchase.findMany({
            where: { clientId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                items: { include: { product: { select: { id: true, name: true, code: true } } } },
            },
        });
        // Combine and sort by date
        const transactionMovements = recentTransactions.map(t => ({
            id: t.id,
            type: t.type,
            total: Number(t.total),
            pointsEarned: t.pointsEarned,
            pointsBalance: t.pointsBalance,
            description: t.description,
            createdAt: t.createdAt,
            items: t.items.map(i => ({
                productName: i.product.name,
                quantity: i.quantity,
                unitPrice: Number(i.unitPrice),
                lineTotal: Number(i.lineTotal),
            })),
            pointsBreakdown: undefined,
            receiptNumber: undefined,
        }));
        const purchaseMovements = recentPurchases.map(p => ({
            id: p.id,
            type: 'COMPRA',
            total: Number(p.total),
            pointsEarned: p.pointsEarned,
            pointsBalance: p.pointsBalance,
            description: p.notes,
            createdAt: p.createdAt,
            items: p.items.map(i => ({
                productName: i.product.name,
                quantity: i.quantity,
                unitPrice: Number(i.unitPrice),
                lineTotal: Number(i.lineTotal),
            })),
            pointsBreakdown: p.pointsBreakdown || [],
            receiptNumber: p.receiptNumber,
        }));
        const allMovements = [...transactionMovements, ...purchaseMovements]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);
        res.json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            email: user.email,
            phone: user.phone,
            birthDate: user.birthDate,
            isActive: user.isActive,
            createdAt: user.createdAt,
            clientProfile: user.clientProfile,
            recentTransactions: allMovements.map(t => ({
                id: t.id,
                type: t.type,
                total: Number(t.total),
                pointsEarned: t.pointsEarned,
                pointsBalance: t.pointsBalance,
                description: t.description,
                createdAt: t.createdAt,
                items: t.items || [],
                pointsBreakdown: t.pointsBreakdown || [],
                receiptNumber: t.receiptNumber,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getClientDetail = getClientDetail;
const findClientByDni = async (req, res, next) => {
    try {
        const { dni } = req.params;
        // Clean DNI - remove dots, dashes, spaces
        const cleanDni = dni.replace(/[.\-\s]/g, '');
        const scope = userBranchFilter(req);
        // Try exact match first
        let user = await prisma_1.prisma.user.findFirst({
            where: { dni: cleanDni, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
            include: { clientProfile: true },
        });
        // If not found, try finding by contains in BOTH directions
        if (!user) {
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: client_1.UserRole.CLIENTE,
                    ...branchWhere(scope),
                },
                include: { clientProfile: true },
            });
            // Find best match: compare cleaned versions
            user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
                || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
                || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
                || null;
        }
        if (!user) {
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        }
        if (!user.isActive) {
            throw new errorHandler_1.AppError(403, 'Cliente inactivo');
        }
        // Ensure clientProfile exists
        let clientProfile = user.clientProfile;
        if (!clientProfile) {
            clientProfile = await prisma_1.prisma.clientProfile.create({
                data: { userId: user.id },
            });
        }
        res.json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            email: user.email,
            phone: user.phone,
            birthDate: user.birthDate,
            isActive: user.isActive,
            clientProfile,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.findClientByDni = findClientByDni;
const createClient = async (req, res, next) => {
    try {
        const { email, password = '123456', firstName, lastName, dni, phone, birthDate } = req.body;
        if (!firstName || !lastName || !dni) {
            throw new errorHandler_1.AppError(400, 'Nombre, apellido y DNI son requeridos');
        }
        // Aislamiento por sucursal: el nuevo cliente pertenece a la sucursal del
        // vendedor/cajera que lo carga. Solo el admin puede elegir la sucursal.
        const scope = userBranchFilter(req);
        let branchId = null;
        if (scope.isGlobal) {
            branchId = req.body.branchId || null;
            if (branchId) {
                const branch = await prisma_1.prisma.branch.findUnique({ where: { id: branchId } });
                if (!branch)
                    throw new errorHandler_1.AppError(404, 'Sucursal no encontrada');
            }
        }
        else {
            if (!scope.branchId || scope.branchId === auth_1.NO_BRANCH) {
                throw new errorHandler_1.AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
            }
            branchId = scope.branchId;
        }
        const cleanDni = String(dni).replace(/[.\-\s]/g, '');
        const finalEmail = (email && String(email).trim()) || `${cleanDni}@cliente.temp`;
        const existing = await prisma_1.prisma.user.findFirst({
            where: { OR: [{ email: finalEmail }, { dni: cleanDni }] },
        });
        if (existing) {
            throw new errorHandler_1.AppError(409, 'Ya existe un cliente con ese email o DNI');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                email: finalEmail,
                passwordHash,
                firstName,
                lastName,
                dni: cleanDni,
                phone: phone || null,
                birthDate: birthDate ? new Date(birthDate) : null,
                role: client_1.UserRole.CLIENTE,
                branchId,
            },
        });
        await prisma_1.prisma.clientProfile.create({ data: { userId: user.id } });
        const whatsappEnabled = await systemConfig_service_1.SystemConfigService.getNotificationsEnabled('whatsapp');
        if (whatsappEnabled && phone) {
            await whatsapp_service_1.whatsappService.sendWelcomeNotification(phone, firstName);
        }
        const clientProfile = await prisma_1.prisma.clientProfile.findUnique({ where: { userId: user.id } });
        res.status(201).json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            email: user.email,
            phone: user.phone,
            clientProfile,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createClient = createClient;
const registerPurchase = async (req, res, next) => {
    try {
        const { dni, items, paymentMethod, notes, firstName, lastName, email, phone, birthDate } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new errorHandler_1.AppError(400, 'Debe agregar al menos un producto');
        }
        // Clean DNI - remove dots, dashes, spaces
        const cleanDni = dni.replace(/[.\-\s]/g, '');
        const scope = userBranchFilter(req);
        // Try exact match first
        let user = await prisma_1.prisma.user.findFirst({
            where: { dni: cleanDni, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
            include: { clientProfile: true },
        });
        // If not found, try finding by contains
        if (!user) {
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    dni: {
                        contains: cleanDni,
                        mode: 'insensitive',
                    },
                    role: client_1.UserRole.CLIENTE,
                    ...branchWhere(scope),
                },
                include: { clientProfile: true },
            });
            user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni) || users[0] || null;
        }
        // If still not found, create new client
        let isNewClient = false;
        if (!user) {
            if (!firstName || !lastName) {
                throw new errorHandler_1.AppError(400, 'Para crear un nuevo cliente se requieren nombre y apellido');
            }
            if (!scope.isGlobal && (!scope.branchId || scope.branchId === auth_1.NO_BRANCH)) {
                throw new errorHandler_1.AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
            }
            // Generate a temporary email if not provided
            const tempEmail = email || `${cleanDni}@cliente.temp`;
            user = await prisma_1.prisma.user.create({
                data: {
                    dni: cleanDni,
                    firstName,
                    lastName,
                    email: tempEmail,
                    phone: phone || null,
                    birthDate: birthDate ? new Date(birthDate) : null,
                    role: 'CLIENTE',
                    passwordHash: '', // Will be set if client creates account later
                    branchId: scope.isGlobal ? null : scope.branchId,
                },
                include: { clientProfile: true },
            });
            // Create client profile
            await prisma_1.prisma.clientProfile.create({
                data: { userId: user.id },
            });
            // Reload user with profile
            user = await prisma_1.prisma.user.findUnique({
                where: { id: user.id },
                include: { clientProfile: true },
            });
            isNewClient = true;
        }
        // At this point user is guaranteed to exist (either found or created)
        const clientUser = user;
        if (!clientUser.clientProfile) {
            throw new errorHandler_1.AppError(400, 'Perfil de cliente no encontrado');
        }
        // Sucursal de la compra: la del empleado que registra la venta.
        // Solo un admin sin sucursal asignada cae a la primera sucursal activa.
        let purchaseBranchId = null;
        if (!scope.isGlobal) {
            purchaseBranchId = scope.branchId && scope.branchId !== auth_1.NO_BRANCH ? scope.branchId : null;
        }
        else {
            purchaseBranchId = req.body.branchId || null;
        }
        if (!purchaseBranchId) {
            const defaultBranch = await prisma_1.prisma.branch.findFirst({ where: { isActive: true } });
            if (!defaultBranch) {
                throw new errorHandler_1.AppError(400, 'No hay sucursales activas');
            }
            purchaseBranchId = defaultBranch.id;
        }
        // Use PurchaseService which handles promotions, coupons, challenges, etc.
        const purchase = await purchase_service_1.PurchaseService.createPurchase({
            clientId: clientUser.id,
            branchId: purchaseBranchId,
            cashierId: req.user.id,
            vendorId: req.body.vendorId,
            items: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity || 1,
                unitPrice: 0, // Will be fetched from product
                discount: 0,
            })),
            notes,
        });
        const whatsapp = await buildSaleWhatsapp(clientUser, purchase);
        // Las notificaciones (email/WhatsApp) ya se envían dentro de PurchaseService.createPurchase
        res.status(201).json({
            transaction: {
                id: purchase.id,
                receiptNumber: purchase.receiptNumber,
                total: purchase.total,
                pointsEarned: purchase.pointsEarned,
                pointsBalance: purchase.pointsBalance,
                createdAt: purchase.createdAt,
            },
            client: {
                currentPoints: purchase.pointsBalance,
                isNewClient,
                firstName: clientUser.firstName,
                lastName: clientUser.lastName,
                dni: clientUser.dni,
            },
            appliedPromotions: purchase.appliedPromotions,
            appliedCoupon: purchase.appliedCoupon,
            whatsapp,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.registerPurchase = registerPurchase;
const getClientHistory = async (req, res, next) => {
    try {
        const { dni } = req.params;
        const { page = 1, limit = 20, type } = req.query;
        // Clean DNI - remove dots, dashes, spaces
        const cleanDni = dni.replace(/[.\-\s]/g, '');
        const scope = userBranchFilter(req);
        // Try exact match first
        let user = await prisma_1.prisma.user.findFirst({
            where: { dni: cleanDni, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
        });
        // If not found, try finding by contains in BOTH directions
        if (!user) {
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: client_1.UserRole.CLIENTE,
                    ...branchWhere(scope),
                },
            });
            user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
                || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
                || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
                || null;
        }
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        const where = { userId: user.id };
        if (type)
            where.type = type;
        const [transactions, total] = await Promise.all([
            prisma_1.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: { items: { include: { product: true } } },
            }),
            prisma_1.prisma.transaction.count({ where }),
        ]);
        res.json({
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                total: Number(t.total),
                pointsEarned: t.pointsEarned,
                pointsBalance: t.pointsBalance,
                description: t.description,
                createdAt: t.createdAt,
                items: t.items.map(i => ({
                    productName: i.product.name,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    lineTotal: Number(i.lineTotal),
                })),
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
};
exports.getClientHistory = getClientHistory;
const registerQuickPurchase = async (req, res, next) => {
    try {
        const { dni, amount, notes, firstName, lastName, email, phone, birthDate } = req.body;
        // Clean DNI - remove dots, dashes, spaces
        const cleanDni = dni.replace(/[.\-\s]/g, '');
        const scope = userBranchFilter(req);
        // Try exact match first
        let user = await prisma_1.prisma.user.findFirst({
            where: { dni: cleanDni, role: client_1.UserRole.CLIENTE, ...branchWhere(scope) },
            include: { clientProfile: true },
        });
        // If not found, try finding by contains in BOTH directions
        if (!user) {
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: client_1.UserRole.CLIENTE,
                    ...branchWhere(scope),
                },
                include: { clientProfile: true },
            });
            user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
                || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
                || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
                || null;
        }
        // If still not found, create new client
        let isNewClient = false;
        if (!user) {
            if (!firstName || !lastName) {
                throw new errorHandler_1.AppError(400, 'Para crear un nuevo cliente se requieren nombre y apellido');
            }
            if (!scope.isGlobal && (!scope.branchId || scope.branchId === auth_1.NO_BRANCH)) {
                throw new errorHandler_1.AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
            }
            // Generate a temporary email if not provided
            const tempEmail = email || `${cleanDni}@cliente.temp`;
            user = await prisma_1.prisma.user.create({
                data: {
                    dni: cleanDni,
                    firstName,
                    lastName,
                    email: tempEmail,
                    phone: phone || null,
                    birthDate: birthDate ? new Date(birthDate) : null,
                    role: 'CLIENTE',
                    passwordHash: '',
                    branchId: scope.isGlobal ? null : scope.branchId,
                },
                include: { clientProfile: true },
            });
            // Create client profile
            await prisma_1.prisma.clientProfile.create({
                data: { userId: user.id },
            });
            // Reload user with profile
            user = await prisma_1.prisma.user.findUnique({
                where: { id: user.id },
                include: { clientProfile: true },
            });
            isNewClient = true;
        }
        // At this point user is guaranteed to exist (either found or created)
        const clientUser = user;
        if (!clientUser.isActive) {
            throw new errorHandler_1.AppError(403, 'Cliente inactivo');
        }
        if (!clientUser.clientProfile) {
            throw new errorHandler_1.AppError(400, 'Perfil de cliente no encontrado');
        }
        // Use PurchaseService for quick purchase with a default product
        // For quick purchase, we create a generic item
        // Sucursal de la compra: la del empleado que registra la venta.
        let purchaseBranchId = null;
        if (!scope.isGlobal) {
            purchaseBranchId = scope.branchId && scope.branchId !== auth_1.NO_BRANCH ? scope.branchId : null;
        }
        else {
            purchaseBranchId = req.body.branchId || null;
        }
        if (!purchaseBranchId) {
            const defaultBranch = await prisma_1.prisma.branch.findFirst({ where: { isActive: true } });
            if (!defaultBranch) {
                throw new errorHandler_1.AppError(400, 'No hay sucursales activas');
            }
            purchaseBranchId = defaultBranch.id;
        }
        // Create or update generic product for quick purchase (atomic upsert)
        const quickProduct = await prisma_1.prisma.product.upsert({
            where: { code: 'QUICK_PURCHASE' },
            update: { unitPrice: amount / 1.21 },
            create: {
                code: 'QUICK_PURCHASE',
                name: 'Compra Rápida',
                category: 'Varios',
                unitPrice: amount / 1.21,
                isActive: true,
            },
        });
        const purchase = await purchase_service_1.PurchaseService.createPurchase({
            clientId: clientUser.id,
            branchId: purchaseBranchId,
            cashierId: req.user.id,
            vendorId: req.body.vendorId,
            items: [{
                    productId: quickProduct.id,
                    quantity: 1,
                    unitPrice: amount / 1.21,
                    discount: 0,
                }],
            notes: notes || 'Compra rápida',
        });
        const whatsapp = await buildSaleWhatsapp(clientUser, purchase);
        // Las notificaciones (email/WhatsApp) ya se envían dentro de PurchaseService.createPurchase
        res.status(201).json({
            transaction: {
                id: purchase.id,
                receiptNumber: purchase.receiptNumber,
                total: purchase.total,
                pointsEarned: purchase.pointsEarned,
                pointsBalance: purchase.pointsBalance,
                createdAt: purchase.createdAt,
            },
            client: {
                currentPoints: purchase.pointsBalance,
                isNewClient,
                firstName: clientUser.firstName,
                lastName: clientUser.lastName,
                dni: clientUser.dni,
            },
            appliedPromotions: purchase.appliedPromotions,
            appliedCoupon: purchase.appliedCoupon,
            whatsapp,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.registerQuickPurchase = registerQuickPurchase;
const getClientPoints = async (req, res, next) => {
    try {
        const { dni } = req.params;
        // Clean DNI - remove dots, dashes, spaces
        const cleanDni = dni.replace(/[.\-\s]/g, '');
        // Try exact match first
        let user = await prisma_1.prisma.user.findUnique({
            where: { dni: cleanDni },
            include: { clientProfile: true },
        });
        // If not found, try finding by contains in BOTH directions
        if (!user) {
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: client_1.UserRole.CLIENTE,
                },
                include: { clientProfile: true },
            });
            user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
                || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
                || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
                || null;
        }
        if (!user)
            throw new errorHandler_1.AppError(404, 'Cliente no encontrado');
        res.json({
            dni: user.dni,
            firstName: user.firstName,
            lastName: user.lastName,
            currentPoints: user.clientProfile?.currentPoints || 0,
            totalPointsEarned: user.clientProfile?.totalPointsEarned || 0,
            totalPointsRedeemed: user.clientProfile?.totalPointsRedeemed || 0,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getClientPoints = getClientPoints;
//# sourceMappingURL=client.controller.js.map
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { PointsService } from '../services/points.service';
import { PurchaseService } from '../services/purchase.service';
import { whatsappService } from '../services/whatsapp.service';
import { SystemConfigService } from '../services/systemConfig.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, resolveBranchScope, NO_BRANCH } from '../middleware/auth';
import { TransactionType, Prisma, UserRole } from '@prisma/client';

/**
 * Devuelve el filtro de sucursal a aplicar sobre User para el usuario autenticado.
 * - ADMIN: sin filtro (ve todas las sucursales).
 * - CAJERA/VENDEDOR: solo su sucursal; si no tiene, un sentinel que no matchea nada.
 */
const userBranchFilter = (req: AuthRequest): { isGlobal: boolean; branchId: string | null } => {
  const scope = resolveBranchScope(req.user);
  return { isGlobal: scope.isGlobal, branchId: scope.branchId };
};

/** Objeto de filtro Prisma para User según scope.
 * Los clientes sin sucursal (creados por un admin sin asignarla, o autogestionados
 * desde el portal público) los ve todo el personal: son clientes "del club".
 */
const branchWhere = (scope: { isGlobal: boolean; branchId: string | null }): Prisma.UserWhereInput =>
  scope.isGlobal
    ? {}
    : { OR: [{ branchId: scope.branchId }, { branchId: null }] };

const DAY_MS = 24 * 60 * 60 * 1000;

type PointsExpiryStatus = 'ok' | 'expiring' | 'expired';

interface PointsExpiryInfo {
  status: PointsExpiryStatus;
  /** Días que faltan para el vencimiento (null si el vencimiento está deshabilitado o ya pasó) */
  daysLeft: number | null;
  lastActivityAt: Date | null;
}

type UserWithProfile = Prisma.UserGetPayload<{ include: { clientProfile: true } }>;

/**
 * Estado de vencimiento de puntos de un cliente, con la misma lógica que
 * PointsExpirationService: la última actividad (compra/canje) + points_expiry_days
 * define la fecha de vencimiento.
 * - expired: ya perdió puntos por vencimiento (transacción VENCIMIENTO y saldo 0),
 *   o tiene saldo y la fecha de vencimiento ya pasó sin que corra el proceso.
 * - expiring: tiene saldo y le quedan `windowDays` días o menos.
 * - ok: resto.
 */
const computePointsExpiry = (
  user: UserWithProfile,
  lastActivityAt: Date | null,
  hadExpiryLoss: boolean,
  expiryConfigDays: number,
  windowDays: number,
  now: number,
): PointsExpiryInfo => {
  const currentPoints = user.clientProfile?.currentPoints ?? 0;
  let status: PointsExpiryStatus = 'ok';
  let daysLeft: number | null = null;

  if (expiryConfigDays > 0 && lastActivityAt) {
    const daysSinceActivity = Math.floor((now - new Date(lastActivityAt).getTime()) / DAY_MS);
    daysLeft = expiryConfigDays - daysSinceActivity;
    if (currentPoints > 0) {
      if (daysLeft <= 0) {
        status = 'expired';
        daysLeft = null;
      } else if (daysLeft <= windowDays) {
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
const withPointsExpiry = async (
  users: UserWithProfile[],
  expiryConfigDays: number,
  windowDays: number,
  now: number,
) => {
  const ids = users.map((u) => u.id);

  const emptyGroups: Array<{ userId: string; _max: { createdAt: Date | null } }> = [];
  const emptyLossRows: Array<{ userId: string }> = [];

  const [lastActivityGroups, expiryLossRows] = await Promise.all([
    ids.length > 0
      ? prisma.transaction.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, type: { in: [TransactionType.COMPRA, TransactionType.CANJE] } },
          _max: { createdAt: true },
        })
      : Promise.resolve(emptyGroups),
    ids.length > 0
      ? prisma.transaction.findMany({
          where: { userId: { in: ids }, type: TransactionType.VENCIMIENTO },
          select: { userId: true },
          distinct: ['userId'],
        })
      : Promise.resolve(emptyLossRows),
  ]);

  const lastActivityMap = new Map(lastActivityGroups.map((g) => [g.userId, g._max.createdAt]));
  const expiryLossSet = new Set(expiryLossRows.map((r) => r.userId));

  return users.map((u) => {
    const lastActivityAt = lastActivityMap.get(u.id) || u.clientProfile?.lastPurchaseAt || u.createdAt;
    const pointsExpiry = computePointsExpiry(
      u,
      lastActivityAt,
      expiryLossSet.has(u.id),
      expiryConfigDays,
      windowDays,
      now,
    );

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

export const listClients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      expiryStatus,
      expiryDays,
    } = req.query;

    const scope = userBranchFilter(req);
    const where: Prisma.UserWhereInput = { role: UserRole.CLIENTE, ...branchWhere(scope) };

    // El admin puede filtrar por sucursal específica
    if (scope.isGlobal && req.query.branchId) {
      where.branchId = req.query.branchId as string;
    }

    if (search) {
      const searchStr = search as string;
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

    const validSortFields = ['createdAt', 'firstName', 'lastName', 'dni', 'email'] as const;
    type SortField = typeof validSortFields[number];
    const sortField = validSortFields.includes(sortBy as SortField) ? sortBy as SortField : 'createdAt';
    const dir = sortOrder === 'asc' ? 1 : -1;

    const statusFilter = ['expiring', 'expired', 'ok'].includes(String(expiryStatus))
      ? String(expiryStatus) as PointsExpiryStatus
      : null;
    const windowDays = Math.min(Math.max(Number(expiryDays) || 30, 1), 365);

    const expiryConfigDays = await SystemConfigService.getPointsExpiryDays();
    const now = Date.now();

    if (statusFilter) {
      // El estado de vencimiento no es una columna: se calcula en memoria sobre
      // todos los clientes que cumplen los demás filtros y luego se pagina.
      const users = await prisma.user.findMany({
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
      prisma.user.findMany({
        where,
        orderBy: { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { clientProfile: true },
      }),
      prisma.user.count({ where }),
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
  } catch (error) {
    next(error);
  }
};

export const updateClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, birthDate, isActive } = req.body;
    
    const scope = userBranchFilter(req);
    const existing = await prisma.user.findFirst({
      where: { id, role: UserRole.CLIENTE, ...branchWhere(scope) },
    });
    if (!existing) throw new AppError(404, 'Cliente no encontrado');
    
    const user = await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    const scope = userBranchFilter(req);
    const existing = await prisma.user.findFirst({
      where: { id, role: UserRole.CLIENTE, ...branchWhere(scope) },
    });
    if (!existing) throw new AppError(404, 'Cliente no encontrado');
    
    await prisma.$transaction(async (tx) => {
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
  } catch (error) {
    next(error);
  }
};

export const getClientDetail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    const scope = userBranchFilter(req);
    const user = await prisma.user.findFirst({
      where: { id, role: UserRole.CLIENTE, ...branchWhere(scope) },
      include: { clientProfile: true },
    });
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { items: { include: { product: true } } },
    });
    
    // Also fetch purchases with points breakdown
    const recentPurchases = await prisma.purchase.findMany({
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

    const purchaseMovements = (recentPurchases as any[]).map(p => ({
      id: p.id,
      type: 'COMPRA' as const,
      total: Number(p.total),
      pointsEarned: p.pointsEarned,
      pointsBalance: p.pointsBalance,
      description: p.notes,
      createdAt: p.createdAt,
      items: (p.items as any[]).map(i => ({
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
  } catch (error) {
    next(error);
  }
};

export const findClientByDni = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni } = req.params;
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = dni.replace(/[.\-\s]/g, '');
    
    const scope = userBranchFilter(req);
    
    // Try exact match first
    let user = await prisma.user.findFirst({
      where: { dni: cleanDni, role: UserRole.CLIENTE, ...branchWhere(scope) },
      include: { clientProfile: true },
    });
    
    // If not found, try finding by contains in BOTH directions
    if (!user) {
      const users = await prisma.user.findMany({
        where: {
          role: UserRole.CLIENTE,
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
      throw new AppError(404, 'Cliente no encontrado');
    }
    
    if (!user.isActive) {
      throw new AppError(403, 'Cliente inactivo');
    }
    
    // Ensure clientProfile exists
    let clientProfile = user.clientProfile;
    if (!clientProfile) {
      clientProfile = await prisma.clientProfile.create({
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
  } catch (error) {
    next(error);
  }
};

export const createClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password = '123456', firstName, lastName, dni, phone, birthDate } = req.body;

    if (!firstName || !lastName || !dni) {
      throw new AppError(400, 'Nombre, apellido y DNI son requeridos');
    }

    // Aislamiento por sucursal: el nuevo cliente pertenece a la sucursal del
    // vendedor/cajera que lo carga. Solo el admin puede elegir la sucursal.
    const scope = userBranchFilter(req);
    let branchId: string | null = null;
    if (scope.isGlobal) {
      branchId = (req.body.branchId as string) || null;
      if (branchId) {
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) throw new AppError(404, 'Sucursal no encontrada');
      }
    } else {
      if (!scope.branchId || scope.branchId === NO_BRANCH) {
        throw new AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
      }
      branchId = scope.branchId;
    }

    const cleanDni = String(dni).replace(/[.\-\s]/g, '');
    const finalEmail = (email && String(email).trim()) || `${cleanDni}@cliente.temp`;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: finalEmail }, { dni: cleanDni }] },
    });
    if (existing) {
      throw new AppError(409, 'Ya existe un cliente con ese email o DNI');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: finalEmail,
        passwordHash,
        firstName,
        lastName,
        dni: cleanDni,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        role: UserRole.CLIENTE,
        branchId,
      },
    });

    await prisma.clientProfile.create({ data: { userId: user.id } });

    const whatsappEnabled = await SystemConfigService.getNotificationsEnabled('whatsapp');
    if (whatsappEnabled && phone) {
      await whatsappService.sendWelcomeNotification(phone, firstName);
    }

    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });

    res.status(201).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      dni: user.dni,
      email: user.email,
      phone: user.phone,
      clientProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const registerPurchase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni, items, paymentMethod, notes, firstName, lastName, email, phone, birthDate } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError(400, 'Debe agregar al menos un producto');
    }
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = dni.replace(/[.\-\s]/g, '');
    
    const scope = userBranchFilter(req);
    
    // Try exact match first
    let user = await prisma.user.findFirst({
      where: { dni: cleanDni, role: UserRole.CLIENTE, ...branchWhere(scope) },
      include: { clientProfile: true },
    });
    
    // If not found, try finding by contains
    if (!user) {
      const users = await prisma.user.findMany({
        where: {
          dni: {
            contains: cleanDni,
            mode: 'insensitive',
          },
          role: UserRole.CLIENTE,
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
        throw new AppError(400, 'Para crear un nuevo cliente se requieren nombre y apellido');
      }
      
      if (!scope.isGlobal && (!scope.branchId || scope.branchId === NO_BRANCH)) {
        throw new AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
      }
      
      // Generate a temporary email if not provided
      const tempEmail = email || `${cleanDni}@cliente.temp`;
      
      user = await prisma.user.create({
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
      await prisma.clientProfile.create({
        data: { userId: user.id },
      });
      
      // Reload user with profile
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { clientProfile: true },
      });
      
      isNewClient = true;
    }
    
    // At this point user is guaranteed to exist (either found or created)
    const clientUser = user!;
    
    if (!clientUser.clientProfile) {
      throw new AppError(400, 'Perfil de cliente no encontrado');
    }
    
    // Sucursal de la compra: la del empleado que registra la venta.
    // Solo un admin sin sucursal asignada cae a la primera sucursal activa.
    let purchaseBranchId: string | null = null;
    if (!scope.isGlobal) {
      purchaseBranchId = scope.branchId && scope.branchId !== NO_BRANCH ? scope.branchId : null;
    } else {
      purchaseBranchId = (req.body.branchId as string) || null;
    }
    
    if (!purchaseBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } });
      if (!defaultBranch) {
        throw new AppError(400, 'No hay sucursales activas');
      }
      purchaseBranchId = defaultBranch.id;
    }
    
    // Use PurchaseService which handles promotions, coupons, challenges, etc.
    const purchase = await PurchaseService.createPurchase({
      clientId: clientUser.id,
      branchId: purchaseBranchId,
      cashierId: req.user!.id,
      vendorId: req.body.vendorId as string | undefined,
      items: items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity || 1,
        unitPrice: 0, // Will be fetched from product
        discount: 0,
      })),
      notes,
    });
    
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
    });
  } catch (error) {
    next(error);
  }
};

export const getClientHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = dni.replace(/[.\-\s]/g, '');
    
    const scope = userBranchFilter(req);
    
    // Try exact match first
    let user = await prisma.user.findFirst({
      where: { dni: cleanDni, role: UserRole.CLIENTE, ...branchWhere(scope) },
    });
    
    // If not found, try finding by contains in BOTH directions
    if (!user) {
      const users = await prisma.user.findMany({
        where: {
          role: UserRole.CLIENTE,
          ...branchWhere(scope),
        },
      });
      
      user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
        || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
        || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
        || null;
    }
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    
    const where: Prisma.TransactionWhereInput = { userId: user.id };
    if (type) where.type = type as TransactionType;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { items: { include: { product: true } } },
      }),
      prisma.transaction.count({ where }),
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
  } catch (error) {
    next(error);
  }
};

export const registerQuickPurchase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni, amount, notes, firstName, lastName, email, phone, birthDate } = req.body;
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = dni.replace(/[.\-\s]/g, '');
    
    const scope = userBranchFilter(req);
    
    // Try exact match first
    let user = await prisma.user.findFirst({
      where: { dni: cleanDni, role: UserRole.CLIENTE, ...branchWhere(scope) },
      include: { clientProfile: true },
    });
    
    // If not found, try finding by contains in BOTH directions
    if (!user) {
      const users = await prisma.user.findMany({
        where: {
          role: UserRole.CLIENTE,
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
        throw new AppError(400, 'Para crear un nuevo cliente se requieren nombre y apellido');
      }
      
      if (!scope.isGlobal && (!scope.branchId || scope.branchId === NO_BRANCH)) {
        throw new AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
      }
      
      // Generate a temporary email if not provided
      const tempEmail = email || `${cleanDni}@cliente.temp`;
      
      user = await prisma.user.create({
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
      await prisma.clientProfile.create({
        data: { userId: user.id },
      });
      
      // Reload user with profile
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { clientProfile: true },
      });
      
      isNewClient = true;
    }
    
    // At this point user is guaranteed to exist (either found or created)
    const clientUser = user!;
    
    if (!clientUser.isActive) {
      throw new AppError(403, 'Cliente inactivo');
    }
    
    if (!clientUser.clientProfile) {
      throw new AppError(400, 'Perfil de cliente no encontrado');
    }
    
    // Use PurchaseService for quick purchase with a default product
    // For quick purchase, we create a generic item
    // Sucursal de la compra: la del empleado que registra la venta.
    let purchaseBranchId: string | null = null;
    if (!scope.isGlobal) {
      purchaseBranchId = scope.branchId && scope.branchId !== NO_BRANCH ? scope.branchId : null;
    } else {
      purchaseBranchId = (req.body.branchId as string) || null;
    }
    
    if (!purchaseBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } });
      if (!defaultBranch) {
        throw new AppError(400, 'No hay sucursales activas');
      }
      purchaseBranchId = defaultBranch.id;
    }
    
    // Create or update generic product for quick purchase (atomic upsert)
    const quickProduct = await prisma.product.upsert({
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
    
    const purchase = await PurchaseService.createPurchase({
      clientId: clientUser.id,
      branchId: purchaseBranchId,
      cashierId: req.user!.id,
      vendorId: req.body.vendorId as string | undefined,
      items: [{
        productId: quickProduct.id,
        quantity: 1,
        unitPrice: amount / 1.21,
        discount: 0,
      }],
      notes: notes || 'Compra rápida',
    });
    
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
    });
  } catch (error) {
    next(error);
  }
};

export const getClientPoints = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni } = req.params;
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = dni.replace(/[.\-\s]/g, '');
    
    // Try exact match first
    let user = await prisma.user.findUnique({
      where: { dni: cleanDni },
      include: { clientProfile: true },
    });
    
    // If not found, try finding by contains in BOTH directions
    if (!user) {
      const users = await prisma.user.findMany({
        where: {
          role: UserRole.CLIENTE,
        },
        include: { clientProfile: true },
      });
      
      user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleanDni)
        || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleanDni))
        || users.find(u => cleanDni.includes(u.dni.replace(/[.\-\s]/g, '')))
        || null;
    }
    
    if (!user) throw new AppError(404, 'Cliente no encontrado');
    
    res.json({
      dni: user.dni,
      firstName: user.firstName,
      lastName: user.lastName,
      currentPoints: user.clientProfile?.currentPoints || 0,
      totalPointsEarned: user.clientProfile?.totalPointsEarned || 0,
      totalPointsRedeemed: user.clientProfile?.totalPointsRedeemed || 0,
    });
  } catch (error) {
    next(error);
  }
};

import { prisma } from '../config/prisma';
import { PointsService } from './points.service';
import { AppError } from '../middleware/errorHandler';
import { SaleRevisionStatus, PurchaseStatus, TransactionType, Prisma } from '@prisma/client';
import { resolveBranchScope, NO_BRANCH } from '../middleware/auth';
import { splitPoints } from './currentAccount.service';

/**
 * Comienzo del día "hoy" en hora Argentina (UTC-3).
 * Las ventas sólo pueden revisarse el mismo día calendario local.
 */
export const startOfTodayArgentina = (): Date => {
  const now = new Date();
  const offsetMs = -3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const startLocalMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocalMs - offsetMs);
};

interface RevisionItemInput {
  productId: string;
  quantity: number;
  discount?: number;
}

interface RequestRevisionDTO {
  items?: RevisionItemInput[];
  newClientDni?: string;
  notes?: string;
  observation: string;
}

const RECEIPT_NUMBER = (p: { receiptNumber: string }) => p.receiptNumber;

export class SaleRevisionService {
  /**
   * Ventas realizadas por el usuario autenticado (cajera/vendedor/admin),
   * con el estado de su última solicitud de revisión.
   */
  static async getMySales(filters: {
    userId: string;
    dni?: string;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { userId, dni, page = 1, limit = 20, startDate, endDate } = filters;

    const where: Prisma.PurchaseWhereInput = {
      // Ventas registradas por el usuario O acreditadas a él como vendedor
      OR: [{ cashierId: userId }, { vendorId: userId }],
    };
    if (dni) where.client = { dni: { contains: dni } };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          client: { select: { id: true, firstName: true, lastName: true, dni: true } },
          branch: { select: { id: true, name: true, code: true } },
          vendor: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true, code: true } } } },
          revisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { reviewedBy: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    const startOfToday = startOfTodayArgentina();

    return {
      purchases: purchases.map(p => {
        const lastRevision = p.revisions[0] ?? null;
        return {
          id: p.id,
          receiptNumber: p.receiptNumber,
          total: Number(p.total),
          pointsEarned: p.pointsEarned,
          status: p.status,
          createdAt: p.createdAt,
          client: {
            id: p.client.id,
            firstName: p.client.firstName,
            lastName: p.client.lastName,
            dni: p.client.dni,
          },
          branch: { id: p.branch.id, name: p.branch.name, code: p.branch.code },
          vendorName: p.vendor ? `${p.vendor.firstName} ${p.vendor.lastName}` : null,
          itemCount: p.items.length,
          items: p.items.map(i => ({
            productId: i.productId,
            productName: i.product.name,
            productCode: i.product.code,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            discount: Number(i.discount),
            lineTotal: Number(i.lineTotal),
          })),
          canRequestRevision:
            p.status === PurchaseStatus.COMPLETADA &&
            p.createdAt >= startOfToday &&
            (!lastRevision || lastRevision.status !== SaleRevisionStatus.PENDIENTE),
          revision: lastRevision
            ? {
                id: lastRevision.id,
                status: lastRevision.status,
                observation: lastRevision.observation,
                adminResponse: lastRevision.adminResponse,
                reviewedByName: lastRevision.reviewedBy
                  ? `${lastRevision.reviewedBy.firstName} ${lastRevision.reviewedBy.lastName}`
                  : null,
                reviewedAt: lastRevision.reviewedAt,
                createdAt: lastRevision.createdAt,
              }
            : null,
        };
      }),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * El vendedor/cajera solicita una revisión de una venta propia del día.
   * Calcula un preview del impacto (totales y puntos) para que el admin
   * sepa qué va a cambiar antes de aprobar.
   */
  static async requestRevision(purchaseId: string, user: NonNullable<import('../middleware/auth').AuthRequest['user']>, payload: RequestRevisionDTO) {
    const { items, newClientDni, notes, observation } = payload;

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: { include: { product: true } },
        client: { select: { id: true, firstName: true, lastName: true, dni: true } },
        branch: { select: { id: true } },
      },
    });
    if (!purchase) throw new AppError(404, 'Venta no encontrada');
    if (purchase.status !== PurchaseStatus.COMPLETADA) {
      throw new AppError(400, 'La venta no está completada');
    }
    if (purchase.cashierId !== user.id && purchase.vendorId !== user.id) {
      throw new AppError(403, 'Sólo podés solicitar revisiones de tus propias ventas');
    }
    // Aislamiento por sucursal (por si el admin pide revisión de otra sucursal ajena)
    const scope = resolveBranchScope(user);
    if (!scope.isGlobal && scope.branchId !== NO_BRANCH && purchase.branchId !== scope.branchId) {
      throw new AppError(403, 'No tenés acceso a esta venta');
    }
    if (purchase.createdAt < startOfTodayArgentina()) {
      throw new AppError(400, 'Sólo se pueden solicitar revisiones de ventas del día de hoy');
    }
    const pending = await prisma.saleRevision.findFirst({
      where: { purchaseId, status: SaleRevisionStatus.PENDIENTE },
    });
    if (pending) {
      throw new AppError(400, 'Ya existe una solicitud de revisión pendiente para esta venta');
    }

    const hasItems = Array.isArray(items) && items.length > 0;
    const hasNewClient = !!newClientDni;
    const hasNotes = typeof notes === 'string' && notes.trim().length > 0 && notes.trim() !== (purchase.notes ?? '');
    if (!hasItems && !hasNewClient && !hasNotes) {
      throw new AppError(400, 'No hay cambios para solicitar (items, cliente o notas)');
    }

    // Resolver nuevo cliente (opcional)
    let newClient: { id: string; firstName: string; lastName: string; dni: string } | null = null;
    if (hasNewClient) {
      const client = await prisma.user.findFirst({
        where: { dni: newClientDni!, role: 'CLIENTE', isActive: true },
        select: { id: true, firstName: true, lastName: true, dni: true, branchId: true, clientProfile: { select: { id: true } } },
      });
      if (!client || !client.clientProfile) throw new AppError(404, `No existe un cliente activo con DNI ${newClientDni}`);
      if (client.id === purchase.clientId) throw new AppError(400, 'El cliente indicado ya es el de la venta');
      if (client.branchId && client.branchId !== purchase.branchId) {
        throw new AppError(400, 'El cliente pertenece a otra sucursal');
      }
      newClient = { id: client.id, firstName: client.firstName, lastName: client.lastName, dni: client.dni };
    }

    // Resolver items propuestos (si no vienen, se mantienen los originales)
    let proposedItems: Array<{ productId: string; productName: string; productCode: string; quantity: number; unitPrice: number; discount: number; lineTotal: number }> = [];
    if (hasItems) {
      const productIds = items!.map(i => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
      if (products.length !== new Set(productIds).size) {
        throw new AppError(400, 'Algunos productos no existen o están inactivos');
      }
      const productMap = new Map(products.map(p => [p.id, p]));
      proposedItems = items!.map(i => {
        const product = productMap.get(i.productId)!;
        const unitPrice = Number(product.unitPrice);
        const discount = i.discount || 0;
        const lineTotal = unitPrice * i.quantity * (1 - discount / 100);
        return {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          quantity: i.quantity,
          unitPrice,
          discount,
          lineTotal: Math.round(lineTotal * 100) / 100,
        };
      });
    } else {
      proposedItems = purchase.items.map(i => ({
        productId: i.productId,
        productName: i.product.name,
        productCode: i.product.code,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        lineTotal: Number(i.lineTotal),
      }));
    }

    // Preview con la misma matemática que createPurchase
    const subtotal = proposedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discount = proposedItems.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
    const taxable = subtotal - discount;
    const tax = Math.round(taxable * 0.21 * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const targetClientId = newClient?.id ?? purchase.clientId;

    // Categorías y marcas de los productos propuestos (para las reglas de puntos)
    const productsMeta = await prisma.product.findMany({
      where: { id: { in: proposedItems.map(i => i.productId) } },
      select: { id: true, category: true, brand: true },
    });
    const metaMap = new Map(productsMeta.map(p => [p.id, p]));
    const categoryIds = proposedItems.map(i => metaMap.get(i.productId)?.category).filter((c): c is string => !!c);
    const brandIds = proposedItems.map(i => metaMap.get(i.productId)?.brand).filter((b): b is string => !!b);

    const pointsResult = await PointsService.calculatePointsWithPromotions(
      targetClientId,
      proposedItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: Math.round(i.lineTotal * 1.21 * 100) / 100,
      })),
      total,
      categoryIds,
      brandIds,
      proposedItems.map(i => i.productId)
    );

    const originalData = {
      clientId: purchase.clientId,
      clientDni: purchase.client.dni,
      clientName: `${purchase.client.firstName} ${purchase.client.lastName}`,
      notes: purchase.notes,
      items: purchase.items.map(i => ({
        productId: i.productId,
        productName: i.product.name,
        productCode: i.product.code,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        lineTotal: Number(i.lineTotal),
      })),
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      total: Number(purchase.total),
      pointsEarned: purchase.pointsEarned,
    };

    const preview = {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      tax,
      total,
      pointsEarned: pointsResult.totalPoints,
      pointsDelta: pointsResult.totalPoints - purchase.pointsEarned,
    };

    const revision = await prisma.saleRevision.create({
      data: {
        purchaseId,
        requestedById: user.id,
        status: SaleRevisionStatus.PENDIENTE,
        changes: {
          items: hasItems ? items : undefined,
          newClientId: newClient?.id ?? undefined,
          newClientName: newClient ? `${newClient.firstName} ${newClient.lastName} (${newClient.dni})` : undefined,
          notes: hasNotes ? notes?.trim() : undefined,
        } as Prisma.InputJsonValue,
        originalData: originalData as Prisma.InputJsonValue,
        preview: preview as Prisma.InputJsonValue,
        observation: observation.trim(),
      },
    });

    // Notificar a los administradores (nunca falla la solicitud por esto)
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            type: 'SALE_REVISION_REQUEST',
            title: 'Nueva solicitud de revisión de venta',
            message: `${user.firstName} ${user.lastName} solicitó revisar la venta ${RECEIPT_NUMBER(purchase)}: ${observation.trim().slice(0, 120)}`,
            metadata: { saleRevisionId: revision.id, purchaseId, receiptNumber: purchase.receiptNumber },
          })),
        });
      }
    } catch (err) {
      console.error('Error notificando administradores:', err);
    }

    return { revision, preview, originalData };
  }

  /** Listado de solicitudes para el administrador */
  static async listRevisions(filters: { status?: SaleRevisionStatus; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters;
    const where: Prisma.SaleRevisionWhereInput = {};
    if (status) where.status = status;

    const [revisions, total, pendingCount] = await Promise.all([
      prisma.saleRevision.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          purchase: {
            select: {
              id: true,
              receiptNumber: true,
              total: true,
              pointsEarned: true,
              createdAt: true,
              status: true,
              client: { select: { firstName: true, lastName: true, dni: true } },
              branch: { select: { name: true, code: true } },
            },
          },
          requestedBy: { select: { firstName: true, lastName: true, dni: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.saleRevision.count({ where }),
      prisma.saleRevision.count({ where: { status: SaleRevisionStatus.PENDIENTE } }),
    ]);

    return {
      revisions: revisions.map(r => ({
        id: r.id,
        status: r.status,
        observation: r.observation,
        changes: r.changes,
        originalData: r.originalData,
        preview: r.preview,
        adminResponse: r.adminResponse,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reviewedByName: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : null,
        requestedBy: {
          name: `${r.requestedBy.firstName} ${r.requestedBy.lastName}`,
          dni: r.requestedBy.dni,
        },
        purchase: {
          id: r.purchase.id,
          receiptNumber: r.purchase.receiptNumber,
          total: Number(r.purchase.total),
          pointsEarned: r.purchase.pointsEarned,
          createdAt: r.purchase.createdAt,
          status: r.purchase.status,
          client: {
            name: `${r.purchase.client.firstName} ${r.purchase.client.lastName}`,
            dni: r.purchase.client.dni,
          },
          branch: r.purchase.branch,
        },
      })),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      pendingCount,
    };
  }

  /** Vendedores activos para el selector al registrar una venta */
  static async getVendorsForSale(user: NonNullable<import('../middleware/auth').AuthRequest['user']>) {
    const scope = resolveBranchScope(user);
    const where: Prisma.UserWhereInput = {
      role: 'VENDEDOR',
      isActive: true,
    };
    if (!scope.isGlobal) {
      // Staff no-admin: solo vendedores de su sucursal (o sin sucursal asignada)
      if (scope.branchId && scope.branchId !== NO_BRANCH) {
        where.OR = [{ branchId: scope.branchId }, { branchId: null }];
      }
    }
    const vendors = await prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, dni: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return vendors.map(v => ({
      id: v.id,
      name: `${v.firstName} ${v.lastName}`,
      dni: v.dni,
    }));
  }

  /** Solicitudes del propio usuario (con respuesta del admin si fue revisada) */
  static async getMyRevisions(userId: string, filters: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const where: Prisma.SaleRevisionWhereInput = { requestedById: userId };

    const [revisions, total] = await Promise.all([
      prisma.saleRevision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          purchase: { select: { receiptNumber: true, total: true, createdAt: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.saleRevision.count({ where }),
    ]);

    return {
      revisions: revisions.map(r => ({
        id: r.id,
        status: r.status,
        observation: r.observation,
        adminResponse: r.adminResponse,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reviewedByName: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : null,
        purchase: {
          receiptNumber: r.purchase.receiptNumber,
          total: Number(r.purchase.total),
          createdAt: r.purchase.createdAt,
        },
      })),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    };
  }

  /**
   * Aprobación por el administrador: aplica los cambios propuestos,
   * recalcula totales/puntos y ajusta los perfiles de los clientes.
   */
  static async approveRevision(revisionId: string, adminId: string, note?: string) {
    const revision = await prisma.saleRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new AppError(404, 'Solicitud no encontrada');
    if (revision.status !== SaleRevisionStatus.PENDIENTE) {
      throw new AppError(400, 'La solicitud ya fue revisada');
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: revision.purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new AppError(404, 'Venta no encontrada');
    if (purchase.status !== PurchaseStatus.COMPLETADA) {
      throw new AppError(400, 'La venta ya no está completada; no se puede aplicar la revisión');
    }

    const changes = revision.changes as { items?: RevisionItemInput[]; newClientId?: string; notes?: string };

    // Resolver productos con precios actuales
    let newItems: Array<{ productId: string; quantity: number; unitPrice: number; discount: number; lineTotal: number; category: string; brand: string | null }> = [];
    if (Array.isArray(changes.items) && changes.items.length > 0) {
      const productIds = changes.items.map(i => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
      if (products.length !== new Set(productIds).size) {
        throw new AppError(400, 'Algunos productos propuestos ya no existen o están inactivos');
      }
      const productMap = new Map(products.map(p => [p.id, p]));
      newItems = changes.items.map(i => {
        const product = productMap.get(i.productId)!;
        const unitPrice = Number(product.unitPrice);
        const discount = i.discount || 0;
        return {
          productId: product.id,
          quantity: i.quantity,
          unitPrice,
          discount,
          lineTotal: Math.round(unitPrice * i.quantity * (1 - discount / 100) * 100) / 100,
          category: product.category,
          brand: product.brand,
        };
      });
    } else {
      const productIds = purchase.items.map(i => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map(products.map(p => [p.id, p]));
      newItems = purchase.items.map(i => {
        const product = productMap.get(i.productId)!;
        return {
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount),
          lineTotal: Number(i.lineTotal),
          category: product.category,
          brand: product.brand,
        };
      });
    }

    const subtotal = newItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discount = newItems.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
    const taxable = subtotal - discount;
    const tax = Math.round(taxable * 0.21 * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const oldClientId = purchase.clientId;
    const newClientId = changes.newClientId ?? oldClientId;

    // Recalcular puntos con las reglas vigentes
    const pointsResult = await PointsService.calculatePointsWithPromotions(
      newClientId,
      newItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: Math.round(i.lineTotal * 1.21 * 100) / 100,
      })),
      total,
      newItems.map(i => i.category).filter(Boolean),
      newItems.map(i => i.brand).filter((b): b is string => !!b),
      newItems.map(i => i.productId)
    );
    const newPoints = pointsResult.totalPoints;

    // Deltas de puntos por cliente y pintor.
    // Las ventas de cuenta corriente reparten 70/30 entre cliente y pintor:
    // se revierte la parte de cada uno y se acredita la nueva parte recalculada.
    const sameClient = oldClientId === newClientId;

    // ¿El cliente destino tiene cuenta corriente activa con pintor?
    const newAccount = await prisma.currentAccount.findUnique({
      where: { clientUserId: newClientId },
      include: { painter: { select: { id: true } } },
    });
    const newHasPainter = !!(newAccount?.active && newAccount.painter);
    const newSplit = splitPoints(newPoints, newHasPainter);
    const newPainterId = newHasPainter ? newAccount!.painter!.id : null;

    // Deltas del CLIENTE
    const oldClientDelta = -purchase.clientPoints;
    const clientDelta = sameClient
      ? oldClientDelta + newSplit.clientPoints
      : newSplit.clientPoints;

    // Deltas del PINTOR: se revierte la parte histórica y se acredita la nueva al pintor vigente
    const oldPainterId = purchase.painterId;
    const oldPainterDelta = -purchase.painterPoints;
    const painterSame = !!oldPainterId && newPainterId === oldPainterId;
    // (si cambia el pintor: el viejo recibe -purchase.painterPoints y el nuevo +newSplit.painterPoints;
    //  si es el mismo pintor y mismo cliente: delta neto)
    const newPainterDelta = newPainterId
      ? (sameClient && painterSame ? newSplit.painterPoints - purchase.painterPoints : newSplit.painterPoints)
      : 0;

    // Perfiles involucrados
    const involvedUserIds = [oldClientId, newClientId, oldPainterId, newPainterId]
      .filter((v): v is string => !!v);
    const involvedProfiles = await prisma.clientProfile.findMany({
      where: { userId: { in: involvedUserIds } },
    });
    const involvedMap = new Map(involvedProfiles.map(p => [p.userId, p]));

    const deltas = new Map<string, number>();
    const addDelta = (userId: string | null, delta: number) => {
      if (!userId || delta === 0) return;
      deltas.set(userId, (deltas.get(userId) ?? 0) + delta);
    };
    addDelta(sameClient ? newClientId : oldClientId, sameClient ? clientDelta : oldClientDelta);
    if (!sameClient) addDelta(newClientId, clientDelta);
    addDelta(oldPainterId, painterSame ? oldPainterDelta + newPainterDelta : oldPainterDelta);
    if (newPainterId && !(sameClient && painterSame)) addDelta(newPainterId, newPainterDelta);

    // Validar que ningún perfil quede en negativo y que perfiles/cliente existan
    const newProfile = involvedMap.get(newClientId);
    if (!newProfile) throw new AppError(400, 'El cliente destino no tiene perfil de puntos');
    if (!sameClient && !involvedMap.has(oldClientId)) {
      throw new AppError(400, 'El cliente original no tiene perfil de puntos');
    }
    for (const [userId, delta] of deltas) {
      const prof = involvedMap.get(userId);
      if (!prof) throw new AppError(400, `El usuario ${userId} no tiene perfil de puntos (contactá al administrador)`);
      if (prof.currentPoints + delta < 0) {
        throw new AppError(400, 'Alguna de las partes no tiene puntos suficientes para revertir esta venta (puede haber canjeado). Rechazá la solicitud o ajustá los puntos manualmente.');
      }
    }

    const newBalance = newProfile.currentPoints + clientDelta;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar la venta (items + totales + puntos + reparto cuenta corriente)
      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          clientId: newClientId,
          subtotal: Math.round(subtotal * 100) / 100,
          discount: Math.round(discount * 100) / 100,
          tax,
          total,
          pointsEarned: newPoints,
          pointsBalance: newBalance,
          clientPoints: newSplit.clientPoints,
          painterPoints: newSplit.painterPoints,
          painterId: newPainterId,
          currentAccountId: newPainterId ? newAccount!.id : null,
          notes: typeof changes.notes === 'string' ? changes.notes : purchase.notes,
          items: {
            deleteMany: {},
            create: newItems.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              lineTotal: i.lineTotal,
              pointsEarned: 0,
              promotionIds: [],
            })),
          },
        },
      });

      // 2. Ajustar perfiles de puntos (cliente/s y pintor/es) con libro de movimientos
      for (const [userId, delta] of deltas) {
        const prof = involvedMap.get(userId)!;
        await tx.clientProfile.update({
          where: { userId },
          data: {
            currentPoints: { increment: delta },
            totalPointsEarned: delta >= 0 ? { increment: delta } : { decrement: Math.abs(delta) },
          },
        });
        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.AJUSTE_MANUAL,
            subtotal: 0,
            tax: 0,
            total: 0,
            pointsEarned: delta,
            pointsBalance: prof.currentPoints + delta,
            description: `Revisión de venta ${purchase.receiptNumber} aprobada (${delta >= 0 ? '+' : ''}${delta} puntos)`,
          },
        });
        if (userId === newClientId && !sameClient) {
          await tx.clientProfile.update({
            where: { userId },
            data: { lastPurchaseAt: new Date() },
          });
        }
      }

      // 3. Marcar la solicitud como aprobada
      const approved = await tx.saleRevision.update({
        where: { id: revision.id },
        data: {
          status: SaleRevisionStatus.APROBADA,
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminResponse: note?.trim() || null,
        },
      });

      return { updated, approved, newPoints, total, newBalance };
    }, { timeout: 30000, maxWait: 15000 });

    // 4. Notificar al solicitante
    try {
      await prisma.notification.create({
        data: {
          userId: revision.requestedById,
          type: 'SALE_REVISION_APPROVED',
          title: 'Revisión aprobada',
          message: `Tu revisión de la venta ${purchase.receiptNumber} fue aprobada y los cambios ya están aplicados.${note?.trim() ? ` Nota del administrador: ${note.trim()}` : ''}`,
          metadata: { saleRevisionId: revision.id, purchaseId: purchase.id },
        },
      });
    } catch (err) {
      console.error('Error notificando aprobación:', err);
    }

    return {
      message: 'Revisión aprobada y cambios aplicados',
      applied: {
        total: result.total,
        pointsEarned: result.newPoints,
        pointsDelta: result.newPoints - purchase.pointsEarned,
        clientChanged: oldClientId !== newClientId,
        newClientBalance: result.newBalance,
      },
    };
  }

  /** Rechazo por el administrador: queda constancia del motivo */
  static async rejectRevision(revisionId: string, adminId: string, reason: string) {
    const revision = await prisma.saleRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new AppError(404, 'Solicitud no encontrada');
    if (revision.status !== SaleRevisionStatus.PENDIENTE) {
      throw new AppError(400, 'La solicitud ya fue revisada');
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: revision.purchaseId },
      select: { receiptNumber: true },
    });

    const rejected = await prisma.saleRevision.update({
      where: { id: revision.id },
      data: {
        status: SaleRevisionStatus.RECHAZADA,
        adminResponse: reason.trim(),
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: revision.requestedById,
          type: 'SALE_REVISION_REJECTED',
          title: 'Revisión rechazada',
          message: `Tu revisión de la venta ${purchase?.receiptNumber ?? ''} fue rechazada. Motivo: ${reason.trim()}`,
          metadata: { saleRevisionId: revision.id, purchaseId: revision.purchaseId },
        },
      });
    } catch (err) {
      console.error('Error notificando rechazo:', err);
    }

    return { message: 'Revisión rechazada', revision: rejected };
  }
}

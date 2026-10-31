import { prisma } from '../config/prisma';
import { PointsService } from './points.service';
import { PromotionService } from './promotion.service';
import { CouponService } from './coupon.service';
import { ChallengeService } from './challenge.service';
import { emailService } from './email.service';
import { whatsappService } from './whatsapp.service';
import { SystemConfigService } from './systemConfig.service';
import { AppError } from '../middleware/errorHandler';
import { TransactionType, PurchaseStatus, Prisma } from '@prisma/client';
import { splitPoints } from './currentAccount.service';

interface CreatePurchaseDTO {
  clientId: string;
  branchId: string;
  cashierId: string;
  /// Vendedor acreditado con la venta (opcional; la registra la cajera/admin)
  vendorId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  couponCode?: string;
  notes?: string;
}

interface PurchaseWithDetails {
  id: string;
  receiptNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  promotionIds: string[];
  couponId: string | null;
  status: PurchaseStatus;
  notes: string | null;
  createdAt: Date;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
    phone: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
  cashier: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    pointsEarned: number;
    promotionIds: string[];
  }>;
  appliedPromotions: Array<{ promotion: any; points: number; discount: number }>;
  appliedCoupon: any | null;
  pointsBreakdown: any[];
  /// Si la venta es de cuenta corriente: reparto 70/30 de puntos con el pintor
  currentAccount: {
    id: string;
    clientPoints: number;
    painterPoints: number;
    painterName: string | null;
    painterDni: string | null;
  } | null;
}

export class PurchaseService {
  static async createPurchase(data: CreatePurchaseDTO): Promise<PurchaseWithDetails> {
    const txResult = await prisma.$transaction(async (tx) => {
      // Pintor acreditado en la venta (si el cliente tiene cuenta corriente con pintor)
      let painterCredit: { user: { id: string; firstName: string; lastName: string; dni: string; phone: string | null }; balance: number } | null = null;
      // 1-4. Validar cliente, sucursal, cajero, vendedor y productos en paralelo:
      // son lecturas independientes y cada una cuesta un roundtrip a la DB.
      const productIds = data.items.map(i => i.productId);
      const [client, branch, cashier, vendorUser, products] = await Promise.all([
        // 1. Validar cliente
        tx.user.findUnique({
          where: { id: data.clientId },
          include: { clientProfile: true },
        }),
        // 2. Validar sucursal
        tx.branch.findUnique({ where: { id: data.branchId } }),
        // 3. Validar cajero
        tx.user.findUnique({ where: { id: data.cashierId } }),
        // 3b. Validar vendedor acreditado (opcional)
        data.vendorId
          ? tx.user.findUnique({ where: { id: data.vendorId } })
          : Promise.resolve(null),
        // 4. Validar productos y stock
        tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
        }),
      ]);

      if (!client) throw new AppError(404, 'Cliente no encontrado');
      if (!client.clientProfile) throw new AppError(400, 'Perfil de cliente no encontrado');
      if (!client.isActive) throw new AppError(403, 'Cliente inactivo');

      if (!branch) throw new AppError(404, 'Sucursal no encontrada');
      if (!branch.isActive) throw new AppError(400, 'Sucursal inactiva');

      if (!cashier) throw new AppError(404, 'Cajero no encontrado');

      let vendor: { id: string; firstName: string; lastName: string } | null = null;
      if (data.vendorId) {
        if (!vendorUser || !vendorUser.isActive) throw new AppError(400, 'El vendedor indicado no existe o está inactivo');
        if (vendorUser.role !== 'VENDEDOR') throw new AppError(400, 'El usuario indicado no es vendedor');
        if (vendorUser.branchId && vendorUser.branchId !== branch.id) {
          throw new AppError(400, 'El vendedor pertenece a otra sucursal');
        }
        vendor = { id: vendorUser.id, firstName: vendorUser.firstName, lastName: vendorUser.lastName };
      }

      if (products.length !== productIds.length) {
        throw new AppError(400, 'Algunos productos no existen o están inactivos');
      }

      const productMap = new Map(products.map(p => [p.id, p]));

      // 5. Calcular subtotal, descuentos, impuestos
      let subtotal = 0;
      let totalDiscount = 0;
      const purchaseItems: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        lineTotal: number;
        product: typeof productMap extends Map<string, infer T> ? T : never;
      }> = [];

      for (const item of data.items) {
        const product = productMap.get(item.productId)!;
        const quantity = item.quantity;
        const unitPrice = Number(product.unitPrice);
        const itemDiscount = item.discount || 0;
        const lineSubtotal = unitPrice * quantity;
        const lineDiscount = lineSubtotal * (itemDiscount / 100);
        const lineTotal = lineSubtotal - lineDiscount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;

        purchaseItems.push({
          productId: product.id,
          quantity,
          unitPrice,
          discount: itemDiscount,
          lineTotal,
          product,
        });
      }

      const taxableAmount = subtotal - totalDiscount;

      // 6. Preparar contexto para promociones
      const categoryIds = purchaseItems.map(i => i.product.category).filter(Boolean);
      const brandIds = purchaseItems.map(i => i.product.brand).filter((b): b is string => b !== null && b !== undefined);
      const purchaseProductIds = purchaseItems.map(i => i.productId);

      // 7. Validar y aplicar cupón si existe (antes de calcular puntos, para conocer el total final pagado)
      let appliedCoupon: any = null;
      let couponDiscount = 0;

      if (data.couponCode) {
        const couponResult = await CouponService.validateCoupon(data.couponCode, client.id);

        if (couponResult.coupon.type === 'DESCUENTO_PORCENTUAL') {
          couponDiscount = Math.floor(taxableAmount * couponResult.coupon.value / 100);
        }

        // Marcar cupón como usado
        await CouponService.useCoupon(data.couponCode, client.id);

        appliedCoupon = couponResult.coupon;
      }

      const finalTaxableAmount = taxableAmount - couponDiscount;
      // Todos los montos del sistema son IVA incluido: los precios de los
      // productos ya llevan el IVA, no se agrega nada encima (tax = 0).
      const finalTax = 0;
      const finalTotal = Math.round(finalTaxableAmount * 100) / 100;

      // 8. Los puntos se calculan sobre el TOTAL pagado por el cliente (IVA incluido, tras descuentos).
      //    "0.04 puntos por $1" = 0.04 por cada peso efectivamente pagado.
      //    Ej: compra de $300.000 → 300.000 × 0.04 = 12.000 puntos.
      const pointsContext = {
        items: purchaseItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: Math.round(i.lineTotal * 100) / 100,
        })),
        subtotal: finalTotal,
      };

      // 9. Calcular puntos (exclusivamente desde las reglas de puntos)
      const pointsResult = await PointsService.calculatePointsWithPromotions(
        client.id,
        pointsContext.items,
        pointsContext.subtotal,
        categoryIds,
        brandIds,
        purchaseProductIds
      );

      // 11. Los puntos surgen exclusivamente de las reglas de puntos
      const finalPoints = pointsResult.totalPoints;

      // 11b. Cuenta corriente: si el cliente tiene una cuenta activa con pintor
      //      designado, el 70% del total de puntos va al cliente y el 30% al pintor.
      const currentAccount = await tx.currentAccount.findUnique({
        where: { clientUserId: client.id },
        include: { painter: { select: { id: true, firstName: true, lastName: true, dni: true, phone: true } } },
      });
      const hasPainter = !!(currentAccount?.active && currentAccount.painter);
      const { clientPoints, painterPoints } = splitPoints(finalPoints, hasPainter);
      const painterUser = hasPainter ? currentAccount!.painter : null;

      // 12. Generar número de comprobante.
      // Se toma el último número real del día (no se cuenta la cantidad de
      // filas: si alguna venta se eliminó, el conteo retrocede y colisionaría).
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const lastToday = await tx.purchase.findFirst({
        where: { receiptNumber: { startsWith: `VTA-${dateStr}-` } },
        orderBy: { receiptNumber: 'desc' },
        select: { receiptNumber: true },
      });
      const lastSeq = lastToday ? Number(lastToday.receiptNumber.split('-').pop()) : 0;
      const receiptNumber = `VTA-${dateStr}-${String(lastSeq + 1).padStart(4, '0')}`;

      const newBalance = client.clientProfile.currentPoints + clientPoints;

      // 13. Crear Purchase
      const purchase = await tx.purchase.create({
        data: {
          clientId: client.id,
          branchId: branch.id,
          cashierId: cashier.id,
          vendorId: data.vendorId ?? null,
          receiptNumber,
          subtotal,
          discount: totalDiscount + couponDiscount,
          tax: finalTax,
          total: finalTotal,
          pointsEarned: finalPoints,
          clientPoints,
          painterPoints,
          painterId: painterUser?.id ?? null,
          currentAccountId: hasPainter ? currentAccount!.id : null,
          pointsBalance: newBalance,
          promotionIds: pointsResult.appliedPromotions.map(p => p.promotion.id),
          couponId: data.couponCode ? (appliedCoupon?.id ?? null) : null,
          status: PurchaseStatus.COMPLETADA,
          notes: data.notes,
          items: {
            create: purchaseItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              lineTotal: item.lineTotal,
              pointsEarned: pointsResult.appliedPromotions
                .filter(p => p.promotion.type !== 'DESCUENTO_PORCENTUAL')
                .reduce((sum, p) => sum + p.points, 0), // Simplificado
              promotionIds: pointsResult.appliedPromotions
                .filter(p => p.promotion.type !== 'DESCUENTO_PORCENTUAL')
                .map(p => p.promotion.id),
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // 14. Actualizar perfil del cliente (recibe su parte: 70% si hay pintor)
      await tx.clientProfile.update({
        where: { userId: client.id },
        data: {
          currentPoints: newBalance,
          totalPointsEarned: { increment: clientPoints },
          lastPurchaseAt: new Date(),
        },
      });

      // 14b. Acreditar al pintor su parte (30%) dentro de la misma transacción:
      //      perfil de puntos + libro de movimientos + notificación in-app.
      if (painterUser && painterPoints > 0) {
        const painterProfile = await tx.clientProfile.findUnique({ where: { userId: painterUser.id } });
        if (painterProfile) {
          await tx.clientProfile.update({
            where: { userId: painterUser.id },
            data: {
              currentPoints: { increment: painterPoints },
              totalPointsEarned: { increment: painterPoints },
            },
          });
        } else {
          await tx.clientProfile.create({
            data: {
              userId: painterUser.id,
              currentPoints: painterPoints,
              totalPointsEarned: painterPoints,
            },
          });
        }
        const painterBalance = (painterProfile?.currentPoints ?? 0) + painterPoints;

        await tx.transaction.create({
          data: {
            userId: painterUser.id,
            type: TransactionType.BONIFICACION,
            subtotal: 0,
            tax: 0,
            total: 0,
            pointsEarned: painterPoints,
            pointsBalance: painterBalance,
            description: `30% de los puntos de la venta ${receiptNumber} (cliente con cuenta corriente ${client.firstName} ${client.lastName})`,
            cashierId: cashier.id,
          },
        });

        await tx.notification.create({
          data: {
            userId: painterUser.id,
            type: 'POINTS_EARNED',
            title: '¡Puntos ganados!',
            message: `Ganaste ${painterPoints} puntos (30% de la venta ${receiptNumber} del cliente ${client.firstName} ${client.lastName})`,
            metadata: { points: painterPoints, receiptNumber },
          },
        });

        painterCredit = { user: painterUser as { id: string; firstName: string; lastName: string; dni: string; phone: string | null }, balance: painterBalance };
      }

      // 17. Marcar bono de cumpleaños otorgado (idempotencia: evita doble bono con el cron)
      if (pointsResult.breakdown.some((b: any) => b.type === 'CUMPLEANOS')) {
        await tx.notification.create({
          data: {
            userId: client.id,
            type: 'BIRTHDAY_BONUS',
            title: '¡Feliz Cumpleaños!',
            message: 'Recibiste tu bono de cumpleaños con tu compra',
            metadata: { source: 'purchase' },
          },
        });
      }

      // No hace falta re-leer el cliente: la respuesta usa los datos que ya
      // teníamos (el saldo actualizado viaja en purchase.pointsBalance).
      return { purchase, clientWithProfile: client, branch, cashier, client, finalPoints, newBalance, purchaseItems, finalTotal, pointsResult, appliedCoupon, clientPoints, painterPoints, painterCredit };
    }, { timeout: 30000, maxWait: 15000 });

    const { purchase, clientWithProfile, branch, cashier, client, finalPoints, newBalance, purchaseItems, finalTotal, pointsResult, appliedCoupon, clientPoints, painterPoints, painterCredit } = txResult;

    // 15. Verificar y actualizar desafíos (fuera de la transacción)
    try {
      await ChallengeService.updateProgressOnPurchase(client.id, purchaseItems, finalTotal);
    } catch (err) {
      console.error('Error actualizando desafíos:', err);
    }

    // 16. Enviar notificaciones en segundo plano: nunca bloquean ni revierten
    // la venta. El cashier recibe la respuesta apenas la DB terminó su trabajo.
    void (async () => {
      try {
        const [emailEnabled, whatsappEnabled] = await Promise.all([
          SystemConfigService.getNotificationsEnabled('email'),
          SystemConfigService.getNotificationsEnabled('whatsapp'),
        ]);
        if (clientPoints > 0 && emailEnabled && client.email) {
          await emailService.sendPointsEarnedEmail(client.email, client.firstName, clientPoints, newBalance);
        }
        if (clientPoints > 0 && whatsappEnabled && client.phone) {
          await whatsappService.sendPointsEarnedNotification(client.phone, client.firstName, clientPoints, newBalance, {
            amount: finalTotal,
            receiptNumber: purchase.receiptNumber,
            branchName: branch?.name ?? null,
          });
        }
        // Aviso por WhatsApp al pintor si el canal está habilitado y tiene teléfono cargado
        if (painterCredit && painterPoints > 0 && whatsappEnabled && painterCredit.user.phone) {
          await whatsappService.sendPointsEarnedNotification(painterCredit.user.phone, painterCredit.user.firstName, painterPoints, painterCredit.balance, {
            amount: finalTotal,
            receiptNumber: purchase.receiptNumber,
            branchName: branch?.name ?? null,
          });
        }
      } catch (err) {
        console.error('Error enviando notificaciones:', err);
      }
    })();

    // 18. Construir respuesta
    return this.formatPurchaseResponse(purchase, clientWithProfile as any, branch, cashier, pointsResult, appliedCoupon, {
      id: purchase.currentAccountId,
      clientPoints,
      painterPoints,
      painterName: painterCredit ? `${painterCredit.user.firstName} ${painterCredit.user.lastName}` : null,
      painterDni: painterCredit?.user.dni ?? null,
    });
  }

  private static formatPurchaseResponse(
    purchase: any,
    client: any,
    branch: any,
    cashier: any,
    pointsResult: { totalPoints: number; breakdown: any[]; appliedPromotions: any[] },
    appliedCoupon: any,
    currentAccountInfo?: { id: string | null; clientPoints: number; painterPoints: number; painterName: string | null; painterDni: string | null }
  ): PurchaseWithDetails {
    return {
      id: purchase.id,
      receiptNumber: purchase.receiptNumber,
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      total: Number(purchase.total),
      pointsEarned: purchase.pointsEarned,
      pointsBalance: purchase.pointsBalance,
      promotionIds: purchase.promotionIds,
      couponId: purchase.couponId,
      status: purchase.status,
      notes: purchase.notes,
      createdAt: purchase.createdAt,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        email: client.email,
        phone: client.phone,
      },
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      cashier: {
        id: cashier.id,
        firstName: cashier.firstName,
        lastName: cashier.lastName,
      },
      items: purchase.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.code,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        lineTotal: Number(item.lineTotal),
        pointsEarned: item.pointsEarned,
        promotionIds: item.promotionIds,
      })),
      appliedPromotions: pointsResult.appliedPromotions,
      appliedCoupon,
      pointsBreakdown: pointsResult.breakdown,
      currentAccount: currentAccountInfo?.id
        ? {
            id: currentAccountInfo.id,
            clientPoints: currentAccountInfo.clientPoints,
            painterPoints: currentAccountInfo.painterPoints,
            painterName: currentAccountInfo.painterName,
            painterDni: currentAccountInfo.painterDni,
          }
        : null,
    };
  }

  static async getPurchaseById(id: string): Promise<PurchaseWithDetails | null> {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        client: { 
          select: { id: true, firstName: true, lastName: true, dni: true, email: true, phone: true },
        },
        branch: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, firstName: true, lastName: true } },
        painter: { select: { id: true, firstName: true, lastName: true, dni: true } },
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    });

    if (!purchase) return null;

    return {
      id: purchase.id,
      receiptNumber: purchase.receiptNumber,
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      total: Number(purchase.total),
      pointsEarned: purchase.pointsEarned,
      pointsBalance: purchase.pointsBalance,
      promotionIds: purchase.promotionIds,
      couponId: purchase.couponId,
      status: purchase.status,
      notes: purchase.notes,
      createdAt: purchase.createdAt,
      client: {
        id: purchase.client.id,
        firstName: purchase.client.firstName,
        lastName: purchase.client.lastName,
        dni: purchase.client.dni,
        email: purchase.client.email,
        phone: purchase.client.phone,
      },
      branch: {
        id: purchase.branch.id,
        name: purchase.branch.name,
        code: purchase.branch.code,
      },
      cashier: {
        id: purchase.cashier.id,
        firstName: purchase.cashier.firstName,
        lastName: purchase.cashier.lastName,
      },
      items: purchase.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.code,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        lineTotal: Number(item.lineTotal),
        pointsEarned: item.pointsEarned,
        promotionIds: item.promotionIds,
      })),
      appliedPromotions: [],
      appliedCoupon: null,
      pointsBreakdown: [],
      currentAccount:
        purchase.currentAccountId && (purchase.clientPoints !== purchase.pointsEarned || purchase.painterPoints > 0)
          ? {
              id: purchase.currentAccountId,
              clientPoints: purchase.clientPoints,
              painterPoints: purchase.painterPoints,
              painterName: purchase.painter ? `${purchase.painter.firstName} ${purchase.painter.lastName}` : null,
              painterDni: purchase.painter?.dni ?? null,
            }
          : null,
    };
  }

  static async getPurchases(filters: {
    page?: number;
    limit?: number;
    clientId?: string;
    branchId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: PurchaseStatus;
  }) {
    const { page = 1, limit = 20, clientId, branchId, startDate, endDate, status } = filters;

    const where: Prisma.PurchaseWhereInput = {};
    if (clientId) where.clientId = clientId;
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
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
          items: { include: { product: { select: { name: true, code: true } } } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      purchases: purchases.map(p => ({
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
        branch: {
          id: p.branch.id,
          name: p.branch.name,
          code: p.branch.code,
        },
        itemCount: p.items.length,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  static async cancelPurchase(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) throw new AppError(404, 'Compra no encontrada');
    if (purchase.status === PurchaseStatus.CANCELADA) throw new AppError(400, 'Compra ya cancelada');

    return await prisma.$transaction(async (tx) => {
      // Revertir puntos del cliente (en cuenta corriente se acreditó el 70%)
      const isSplit = !!purchase.currentAccountId;
      const clientRevert = isSplit ? purchase.clientPoints : purchase.pointsEarned;
      await tx.clientProfile.update({
        where: { userId: purchase.clientId },
        data: {
          currentPoints: { decrement: clientRevert },
          totalPointsEarned: { decrement: clientRevert },
        },
      });

      // Revertir los puntos del pintor (30% de la cuenta corriente)
      if (isSplit && purchase.painterId && purchase.painterPoints > 0) {
        await tx.clientProfile.update({
          where: { userId: purchase.painterId },
          data: {
            currentPoints: { decrement: purchase.painterPoints },
            totalPointsEarned: { decrement: purchase.painterPoints },
          },
        });
        await tx.transaction.create({
          data: {
            userId: purchase.painterId,
            type: TransactionType.AJUSTE_MANUAL,
            subtotal: 0,
            tax: 0,
            total: 0,
            pointsEarned: -purchase.painterPoints,
            pointsBalance: (await tx.clientProfile.findUnique({ where: { userId: purchase.painterId } }))!.currentPoints,
            description: `Cancelación de compra ${purchase.receiptNumber} (puntos del pintor)`,
          },
        });
      }

      // Crear transacción de reversión
      await tx.transaction.create({
        data: {
          userId: purchase.clientId,
          type: TransactionType.AJUSTE_MANUAL,
          subtotal: 0,
          total: 0,
          pointsEarned: -clientRevert,
          pointsBalance: (await tx.clientProfile.findUnique({ where: { userId: purchase.clientId } }))!.currentPoints,
          description: `Cancelación de compra ${purchase.receiptNumber}`,
        },
      });

      // Actualizar estado
      await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELADA },
      });

      return { message: 'Compra cancelada correctamente' };
    });
  }
}
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { resolveBranchScope, NO_BRANCH } from '../middleware/auth';
import { SaleRevisionStatus, Prisma } from '@prisma/client';

/**
 * Reparto de puntos para ventas de cuenta corriente: el 70% del total va al
 * cliente (redondeo hacia abajo) y el 30% restante al pintor designado.
 */
export function splitPoints(total: number, hasPainter: boolean): { clientPoints: number; painterPoints: number } {
  if (!hasPainter || total <= 0) return { clientPoints: total, painterPoints: 0 };
  const clientPoints = Math.floor(total * 0.7);
  return { clientPoints, painterPoints: total - clientPoints };
}

interface UserBrief {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
}

interface CreateAccountDTO {
  clientDni: string;
  painterDni: string;
  notes?: string;
}

interface RequestEditDTO {
  newPainterDni?: string;
  active?: boolean;
  notes?: string;
  observation?: string;
}

/** Limpia el DNI como se hace en el resto del sistema (puntos, guiones, espacios) */
const cleanDni = (dni: string) => dni.replace(/[.\-\s]/g, '');

export class CurrentAccountService {
  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  /** Busca el usuario pintor por DNI: debe ser un CLIENTE activo */
  private static async resolvePaintersUser(dni: string): Promise<{ id: string; firstName: string; lastName: string; dni: string }> {
    const cleaned = cleanDni(dni);
    if (!cleaned) throw new AppError(400, 'Indicá el DNI del pintor');

    let user = await prisma.user.findFirst({
      where: { dni: cleaned, isActive: true },
      include: { clientProfile: true },
    });

    if (!user) {
      // Igual que en ventas rápidas: match por contención (puntos/guiones cargados distinto)
      const users = await prisma.user.findMany({ where: { isActive: true }, include: { clientProfile: true } });
      user = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleaned)
        || users.find(u => u.dni.replace(/[.\-\s]/g, '').includes(cleaned))
        || null;
    }

    if (!user) throw new AppError(404, `No existe un usuario activo con DNI ${cleaned}. Dalo de alta como cliente primero.`);
    if (user.role !== 'CLIENTE') {
      throw new AppError(400, `El DNI ${user.dni} ya está registrado como ${user.role} y no puede ser designado pintor`);
    }
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, dni: user.dni };
  }

  /** Busca al cliente dueño respetando el alcance por sucursal del usuario */
  private static async resolveClient(dni: string, actor: NonNullable<import('../middleware/auth').AuthRequest['user']>): Promise<{ id: string; firstName: string; lastName: string; dni: string; branchId: string | null }> {
    const cleaned = cleanDni(dni);
    if (!cleaned) throw new AppError(400, 'Indicá el DNI del cliente');

    const scope = resolveBranchScope(actor);
    const branchWhere = !scope.isGlobal && scope.branchId
      ? (scope.branchId === NO_BRANCH ? { branchId: null } : { OR: [{ branchId: scope.branchId }, { branchId: null }] })
      : {};

    const user = await prisma.user.findFirst({
      where: { dni: { contains: cleaned }, role: 'CLIENTE', isActive: true, ...branchWhere },
      include: { clientProfile: true },
    });

    // Contención por si el DNI cargado tiene puntos/guiones
    if (user) {
      if (!user.clientProfile) throw new AppError(400, 'El cliente no tiene perfil de puntos');
      return { id: user.id, firstName: user.firstName, lastName: user.lastName, dni: user.dni, branchId: user.branchId };
    }

    const users = await prisma.user.findMany({
      where: { role: 'CLIENTE', isActive: true, ...branchWhere },
      include: { clientProfile: true },
    });
    const found = users.find(u => u.dni.replace(/[.\-\s]/g, '') === cleaned);
    if (!found || !found.clientProfile) throw new AppError(404, `No existe un cliente activo con DNI ${cleaned}`);
    return { id: found.id, firstName: found.firstName, lastName: found.lastName, dni: found.dni, branchId: found.branchId };
  }

  private static async getAccountOrThrow(accountId: string) {
    const account = await prisma.currentAccount.findUnique({
      where: { id: accountId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, dni: true } },
        painter: { select: { id: true, firstName: true, lastName: true, dni: true } },
      },
    });
    if (!account) throw new AppError(404, 'Cuenta corriente no encontrada');
    return account;
  }

  /* ------------------------------------------------------------------ */
  /* Listado (pestaña Cuentas Corrientes)                                */
  /* ------------------------------------------------------------------ */

  static async listAccounts(actor: NonNullable<import('../middleware/auth').AuthRequest['user']>) {
    const scope = resolveBranchScope(actor);
    const branchWhere = !scope.isGlobal && scope.branchId
      ? (scope.branchId === NO_BRANCH ? { branchId: null } : { OR: [{ branchId: scope.branchId }, { branchId: null }] })
      : {};

    const accounts = await prisma.currentAccount.findMany({
      where: { client: branchWhere },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, dni: true, email: true, phone: true, branch: { select: { name: true, code: true } }, clientProfile: { select: { currentPoints: true, totalPointsEarned: true } } },
        },
        painter: {
          select: { id: true, firstName: true, lastName: true, dni: true, clientProfile: { select: { currentPoints: true, totalPointsEarned: true } } },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            receiptNumber: true,
            total: true,
            pointsEarned: true,
            clientPoints: true,
            painterPoints: true,
            status: true,
            createdAt: true,
            painter: { select: { firstName: true, lastName: true } },
          },
        },
        editRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { requestedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Totales históricos del reparto por venta del pintor actual
    const painterIds = accounts.map(a => a.painterUserId).filter((v): v is string => !!v);
    const painterTotals = painterIds.length
      ? await prisma.purchase.groupBy({
          by: ['painterId'],
          where: { painterId: { in: painterIds }, status: 'COMPLETADA' },
          _sum: { painterPoints: true },
        })
      : [];
    const totalsMap = new Map(painterTotals.map(t => [t.painterId, t._sum.painterPoints ?? 0]));

    return {
      accounts: accounts.map(a => ({
        id: a.id,
        active: a.active,
        notes: a.notes,
        createdAt: a.createdAt,
        createdByName: a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : null,
        client: {
          id: a.client.id,
          name: `${a.client.firstName} ${a.client.lastName}`,
          dni: a.client.dni,
          email: a.client.email,
          phone: a.client.phone,
          branch: a.client.branch,
          currentPoints: a.client.clientProfile?.currentPoints ?? 0,
          totalPointsEarned: a.client.clientProfile?.totalPointsEarned ?? 0,
        },
        painter: a.painter
          ? {
              id: a.painter.id,
              name: `${a.painter.firstName} ${a.painter.lastName}`,
              dni: a.painter.dni,
              currentPoints: a.painter.clientProfile?.currentPoints ?? 0,
              totalPointsEarned: a.painter.clientProfile?.totalPointsEarned ?? 0,
              totalPointsFromSales: totalsMap.get(a.painter.id) ?? 0,
            }
          : null,
        recentPurchases: a.purchases.map(p => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          total: Number(p.total),
          pointsEarned: p.pointsEarned,
          clientPoints: p.clientPoints,
          painterPoints: p.painterPoints,
          status: p.status,
          createdAt: p.createdAt,
        })),
        lastRevision: a.editRequests[0]
          ? {
              id: a.editRequests[0].id,
              status: a.editRequests[0].status,
              observation: a.editRequests[0].observation,
              createdAt: a.editRequests[0].createdAt,
              requestedByName: `${a.editRequests[0].requestedBy.firstName} ${a.editRequests[0].requestedBy.lastName}`,
            }
          : null,
      })),
      pendingCount: await prisma.currentAccountRevision.count({ where: { status: 'PENDIENTE' } }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Alta de cuenta corriente (cajera / vendedor / admin)                */
  /* ------------------------------------------------------------------ */

  static async createAccount(actor: NonNullable<import('../middleware/auth').AuthRequest['user']>, payload: CreateAccountDTO) {
    const client = await this.resolveClient(payload.clientDni, actor);

    const existing = await prisma.currentAccount.findUnique({ where: { clientUserId: client.id } });
    if (existing) throw new AppError(400, 'El cliente ya tiene una cuenta corriente');

    const painter = await this.resolvePaintersUser(payload.painterDni);
    if (painter.id === client.id) throw new AppError(400, 'El cliente y el pintor no pueden ser la misma persona');

    const account = await prisma.currentAccount.create({
      data: {
        clientUserId: client.id,
        painterUserId: painter.id,
        active: true,
        notes: payload.notes?.trim() || null,
        createdById: actor.id,
      },
    });

    // Avisar al cliente y al pintor (in-app; nunca falla la alta por esto)
    try {
      await prisma.notification.createMany({
        data: [
          {
            userId: client.id,
            type: 'CURRENT_ACCOUNT_CREATED',
            title: 'Cuenta corriente creada',
            message: `Tu cuenta corriente ya está activa. En cada compra, el 70% de los puntos es tuyo y el 30% para ${painter.firstName} ${painter.lastName}.`,
          },
          {
            userId: painter.id,
            type: 'CURRENT_ACCOUNT_CREATED',
            title: 'Fuiste designado pintor',
            message: `${client.firstName} ${client.lastName} te designó como pintor de su cuenta corriente. Recibirás el 30% de los puntos de cada compra.`,
          },
        ],
      });
    } catch (err) {
      console.error('Error notificando alta de cuenta corriente:', err);
    }

    return {
      account: {
        id: account.id,
        client: { name: `${client.firstName} ${client.lastName}`, dni: client.dni },
        painter: { name: `${painter.firstName} ${painter.lastName}`, dni: painter.dni },
        active: true,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Edición directa (admin)                                             */
  /* ------------------------------------------------------------------ */

  private static async applyChanges(
    accountId: string,
    changes: { newPainterDni?: string; active?: boolean; notes?: string },
  ) {
    const account = await this.getAccountOrThrow(accountId);
    const data: { painterUserId?: string | null; active?: boolean; notes?: string | null } = {};

    if (changes.newPainterDni) {
      const painter = await this.resolvePaintersUser(changes.newPainterDni);
      if (painter.id === account.clientUserId) throw new AppError(400, 'El cliente y el pintor no pueden ser la misma persona');
      if (account.painter?.id && painter.id === account.painter.id) throw new AppError(400, 'El pintor indicado ya es el designado');
      data.painterUserId = painter.id;
    }
    if (typeof changes.active === 'boolean') data.active = changes.active;
    if (typeof changes.notes === 'string') data.notes = changes.notes || null;

    if (Object.keys(data).length === 0) throw new AppError(400, 'No hay campos para modificar');

    const updated = await prisma.currentAccount.update({ where: { id: account.id }, data });

    try {
      if (data.painterUserId) {
        await prisma.notification.create({
          data: {
            userId: data.painterUserId,
            type: 'CURRENT_ACCOUNT_CREATED',
            title: 'Fuiste designado pintor',
            message: `${account.client.firstName} ${account.client.lastName} te designó como pintor de su cuenta corriente. Recibirás el 30% de los puntos de cada compra.`,
          },
        });
      }
    } catch (err) {
      console.error('Error notificando cambio de pintor:', err);
    }

    return updated;
  }

  static async adminUpdate(accountId: string, changes: RequestEditDTO) {
    return this.applyChanges(accountId, changes);
  }

  /* ------------------------------------------------------------------ */
  /* Solicitudes de edición (cajera / vendedor -> admin)                 */
  /* ------------------------------------------------------------------ */

  static async requestEdit(
    accountId: string,
    actor: NonNullable<import('../middleware/auth').AuthRequest['user']>,
    payload: RequestEditDTO,
  ) {
    const hasPainterChange = typeof payload.newPainterDni === 'string' && payload.newPainterDni.trim() !== '';
    const hasActive = typeof payload.active === 'boolean';
    const hasNotes = typeof payload.notes === 'string';

    if (!hasPainterChange && !hasActive && !hasNotes) {
      throw new AppError(400, 'No indicaste ningún campo a cambiar');
    }
    const observation = payload.observation?.trim();
    if (!observation || observation.length < 10) {
      throw new AppError(400, 'Explicá el motivo del cambio (mínimo 10 caracteres)');
    }

    const account = await this.getAccountOrThrow(accountId);

    const pending = await prisma.currentAccountRevision.findFirst({
      where: { accountId, status: SaleRevisionStatus.PENDIENTE },
    });
    if (pending) {
      throw new AppError(400, 'Ya existe una solicitud pendiente para esta cuenta corriente');
    }

    // Validar que el pintor propuesto exista antes de crear la solicitud
    let newPainterName: string | null = null;
    if (hasPainterChange) {
      const painter = await this.resolvePaintersUser(payload.newPainterDni!);
      if (painter.id === account.clientUserId) throw new AppError(400, 'El cliente y el pintor no pueden ser la misma persona');
      if (painter.id === account.painter?.id) throw new AppError(400, 'El pintor indicado ya es el designado');
      newPainterName = `${painter.firstName} ${painter.lastName} (${painter.dni})`;
    }

    const originalData = {
      painter: account.painter ? { name: `${account.painter.firstName} ${account.painter.lastName}`, dni: account.painter.dni } : null,
      active: account.active,
      notes: account.notes,
    };

    const revision = await prisma.currentAccountRevision.create({
      data: {
        accountId,
        requestedById: actor.id,
        status: SaleRevisionStatus.PENDIENTE,
        changes: {
          newPainterDni: hasPainterChange ? payload.newPainterDni!.trim() : undefined,
          newPainterName: newPainterName ?? undefined,
          active: hasActive ? payload.active : undefined,
          notes: hasNotes ? payload.notes : undefined,
        } as Prisma.InputJsonValue,
        originalData: originalData as Prisma.InputJsonValue,
        observation,
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
            type: 'ACCOUNT_REVISION_REQUEST',
            title: 'Nueva solicitud de cambio de cuenta corriente',
            message: `${actor.firstName} ${actor.lastName} solicitó cambios en la cuenta corriente de ${account.client.firstName} ${account.client.lastName}: ${observation.slice(0, 120)}`,
            metadata: { currentAccountRevisionId: revision.id, accountId },
          })),
        });
      }
    } catch (err) {
      console.error('Error notificando administradores:', err);
    }

    return { revision };
  }

  private static async getRevisionOrThrow(revisionId: string) {
    const revision = await prisma.currentAccountRevision.findUnique({
      where: { id: revisionId },
      include: {
        account: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, dni: true } },
            painter: { select: { id: true, firstName: true, lastName: true, dni: true } },
          },
        },
      },
    });
    if (!revision) throw new AppError(404, 'Solicitud no encontrada');
    return revision;
  }

  static async listEditRequests(filters: { status?: SaleRevisionStatus; page?: number; limit?: number; requestedById?: string }) {
    const { status, requestedById, limit = 20, page = 1 } = filters;
    const where: Prisma.CurrentAccountRevisionWhereInput = {};
    if (status) where.status = status;
    if (requestedById) where.requestedById = requestedById;

    const [revisions, total, pendingCount] = await Promise.all([
      prisma.currentAccountRevision.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          account: {
            include: {
              client: { select: { firstName: true, lastName: true, dni: true } },
              painter: { select: { firstName: true, lastName: true, dni: true } },
            },
          },
          requestedBy: { select: { firstName: true, lastName: true, dni: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.currentAccountRevision.count({ where }),
      prisma.currentAccountRevision.count({ where: { status: SaleRevisionStatus.PENDIENTE } }),
    ]);

    return {
      revisions: revisions.map(r => ({
        id: r.id,
        status: r.status,
        changes: r.changes,
        originalData: r.originalData,
        observation: r.observation,
        adminResponse: r.adminResponse,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reviewedByName: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : null,
        requestedBy: { name: `${r.requestedBy.firstName} ${r.requestedBy.lastName}`, dni: r.requestedBy.dni },
        account: {
          id: r.account.id,
          client: { name: `${r.account.client.firstName} ${r.account.client.lastName}`, dni: r.account.client.dni },
          painter: r.account.painter ? { name: `${r.account.painter.firstName} ${r.account.painter.lastName}`, dni: r.account.painter.dni } : null,
          active: r.account.active,
          notes: r.account.notes,
        },
      })),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      pendingCount,
    };
  }

  static async approveEdit(revisionId: string, admin: UserBrief, note?: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    if (revision.status !== SaleRevisionStatus.PENDIENTE) {
      throw new AppError(400, 'La solicitud ya fue revisada');
    }

    const changes = revision.changes as unknown as RequestEditDTO;
    await this.applyChanges(revision.accountId, {
      newPainterDni: changes.newPainterDni,
      active: changes.active,
      notes: changes.notes,
    });

    await prisma.currentAccountRevision.update({
      where: { id: revision.id },
      data: {
        status: SaleRevisionStatus.APROBADA,
        adminResponse: note?.trim() || null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: revision.requestedById,
          type: 'ACCOUNT_REVISION_APPROVED',
          title: 'Solicitud de cambio aprobada',
          message: `Tu solicitud sobre la cuenta corriente de ${revision.account.client.firstName} ${revision.account.client.lastName} fue aprobada y los cambios ya están aplicados.${note?.trim() ? ` Nota del administrador: ${note.trim()}` : ''}`,
          metadata: { currentAccountRevisionId: revision.id, accountId: revision.accountId },
        },
      });
    } catch (err) {
      console.error('Error notificando aprobación:', err);
    }

    return { message: 'Solicitud aprobada y cambios aplicados' };
  }

  static async rejectEdit(revisionId: string, admin: UserBrief, reason: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    if (revision.status !== SaleRevisionStatus.PENDIENTE) {
      throw new AppError(400, 'La solicitud ya fue revisada');
    }

    await prisma.currentAccountRevision.update({
      where: { id: revision.id },
      data: {
        status: SaleRevisionStatus.RECHAZADA,
        adminResponse: reason.trim(),
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: revision.requestedById,
          type: 'ACCOUNT_REVISION_REJECTED',
          title: 'Solicitud de cambio rechazada',
          message: `Tu solicitud sobre la cuenta corriente de ${revision.account.client.firstName} ${revision.account.client.lastName} fue rechazada. Motivo: ${reason.trim()}`,
          metadata: { currentAccountRevisionId: revision.id, accountId: revision.accountId },
        },
      });
    } catch (err) {
      console.error('Error notificando rechazo:', err);
    }

    return { message: 'Solicitud rechazada' };
  }
}


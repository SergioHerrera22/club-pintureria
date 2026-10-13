import { Request, Response, NextFunction } from 'express';
import { PurchaseService } from '../services/purchase.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, resolveBranchScope, NO_BRANCH } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { PurchaseStatus, Prisma, UserRole } from '@prisma/client';

export const createPurchase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clientId, branchId, items, couponCode, notes } = req.body;
    const cashierId = req.user!.id;

    if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError(400, 'Datos de compra incompletos');
    }

    // Aislamiento por sucursal: la cajera/vendedor registra ventas en su sucursal.
    // El admin puede indicar la sucursal; si no, cae a la primera activa.
    const scope = resolveBranchScope(req.user);
    let effectiveBranchId: string | null = null;
    if (scope.isGlobal) {
      effectiveBranchId = branchId || null;
    } else {
      if (!scope.branchId || scope.branchId === NO_BRANCH) {
        throw new AppError(403, 'Tu usuario no tiene una sucursal asignada. Contactá al administrador.');
      }
      effectiveBranchId = scope.branchId;
    }

    if (!effectiveBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } });
      if (!defaultBranch) throw new AppError(400, 'No hay sucursales activas');
      effectiveBranchId = defaultBranch.id;
    }

    // Verificar que el cliente pertenezca a la sucursal (staff no puede vender a clientes de otra sucursal)
    if (!scope.isGlobal) {
      const client = await prisma.user.findFirst({
        where: { id: clientId, role: UserRole.CLIENTE, branchId: effectiveBranchId },
      });
      if (!client) throw new AppError(404, 'Cliente no encontrado en tu sucursal');
    }

    const purchase = await PurchaseService.createPurchase({
      clientId,
      branchId: effectiveBranchId,
      cashierId,
      items,
      couponCode: req.body.couponCode,
      notes: req.body.notes,
    });

    res.status(201).json(purchase);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const purchase = await PurchaseService.getPurchaseById(id);
    if (!purchase) throw new AppError(404, 'Compra no encontrada');
    
    // Aislamiento por sucursal
    const scope = resolveBranchScope(req.user);
    if (!scope.isGlobal && purchase.branch?.id !== scope.branchId) {
      throw new AppError(404, 'Compra no encontrada');
    }
    
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

export const getPurchases = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, clientId, branchId, startDate, endDate, status } = req.query;
    
    // Aislamiento por sucursal: no-admin siempre ve solo su sucursal
    const scope = resolveBranchScope(req.user);
    const effectiveBranchId = scope.isGlobal ? (branchId as string | undefined) : scope.branchId;

    const filters: any = {};
    if (clientId) filters.clientId = clientId as string;
    if (effectiveBranchId) filters.branchId = effectiveBranchId;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await PurchaseService.getPurchases(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const cancelPurchase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await PurchaseService.cancelPurchase(id);
    res.json({ message: 'Compra cancelada correctamente' });
  } catch (error) {
    next(error);
  }
};
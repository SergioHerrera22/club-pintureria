import { Request, Response, NextFunction } from 'express';
import { SaleRevisionService } from '../services/saleRevision.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { SaleRevisionStatus } from '@prisma/client';

export const getMyPurchases = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { dni, page = 1, limit = 20, startDate, endDate } = req.query;
    const result = await SaleRevisionService.getMySales({
      userId: req.user!.id,
      dni: dni as string | undefined,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const requestRevision = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { id } = req.params;
    const { items, newClientDni, notes, observation } = req.body;
    const result = await SaleRevisionService.requestRevision(id, req.user, {
      items,
      newClientDni,
      notes,
      observation,
    });
    res.status(201).json({
      message: 'Solicitud de revisión enviada al administrador',
      revisionId: result.revision.id,
      preview: result.preview,
    });
  } catch (error) {
    next(error);
  }
};

export const listRevisions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const validStatus = status && ['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(status as string)
      ? (status as SaleRevisionStatus)
      : undefined;
    const result = await SaleRevisionService.listRevisions({
      status: validStatus,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getMyRevisions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await SaleRevisionService.getMyRevisions(req.user!.id, {
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const approveRevision = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const result = await SaleRevisionService.approveRevision(id, req.user!.id, note);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const rejectRevision = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await SaleRevisionService.rejectRevision(id, req.user!.id, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

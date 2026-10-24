import { Request, Response, NextFunction } from 'express';
import { CurrentAccountService } from '../services/currentAccount.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { SaleRevisionStatus } from '@prisma/client';

export const listAccounts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const result = await CurrentAccountService.listAccounts(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { clientDni, painterDni, notes } = req.body;
    const result = await CurrentAccountService.createAccount(req.user, { clientDni, painterDni, notes });
    res.status(201).json({ message: 'Cuenta corriente creada', ...result });
  } catch (error) {
    next(error);
  }
};

export const adminUpdate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { id } = req.params;
    const { newPainterDni, active, notes } = req.body;
    await CurrentAccountService.adminUpdate(id, { newPainterDni, active, notes });
    res.json({ message: 'Cuenta corriente actualizada' });
  } catch (error) {
    next(error);
  }
};

export const requestEdit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { id } = req.params;
    const { newPainterDni, active, notes, observation } = req.body;
    const result = await CurrentAccountService.requestEdit(id, req.user, { newPainterDni, active, notes, observation });
    res.status(201).json({ message: 'Solicitud enviada al administrador', revisionId: result.revision.id });
  } catch (error) {
    next(error);
  }
};

export const listEditRequests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { status, page = 1, limit = 20 } = req.query;
    const validStatus = status && ['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(status as string)
      ? (status as SaleRevisionStatus)
      : undefined;
    const result = await CurrentAccountService.listEditRequests({
      status: validStatus,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getMyEditRequests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { page = 1, limit = 20 } = req.query;
    const result = await CurrentAccountService.listEditRequests({
      requestedById: req.user.id,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const approveEdit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { id } = req.params;
    const { note } = req.body;
    const result = await CurrentAccountService.approveEdit(id, { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName, dni: req.user.dni }, note);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const rejectEdit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');
    const { id } = req.params;
    const { reason } = req.body;
    const result = await CurrentAccountService.rejectEdit(id, { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName, dni: req.user.dni }, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

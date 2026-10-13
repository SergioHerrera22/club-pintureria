import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);
  
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validación fallida',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }
  
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') || 'campo';
      res.status(409).json({ error: `El ${field} ya existe` });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Recurso no encontrado' });
      return;
    }
  }
  
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }
  
  if (err instanceof SyntaxError && 'status' in err) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  
  res.status(500).json({
    error: config.nodeEnv === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
};
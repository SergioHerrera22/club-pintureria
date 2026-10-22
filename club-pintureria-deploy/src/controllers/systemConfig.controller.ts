import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { SYSTEM_CONFIG_KEYS, DEFAULT_WHATSAPP_TEMPLATES } from '../services/systemConfig.service';

const whatsappTemplatesSchema = z.object({
  points_earned: z.string().optional(),
  welcome: z.string().optional(),
  redemption: z.string().optional(),
  points_expiring: z.string().optional(),
  campaign_default: z.string().optional(),
}).passthrough();

const valueSchemas: Record<string, z.ZodTypeAny> = {
  email_notifications_enabled: z.object({ enabled: z.boolean() }),
  whatsapp_notifications_enabled: z.object({ enabled: z.boolean() }),
  points_expiry_days: z.object({ days: z.number().int().nonnegative() }),
  points_expiry_warning_days: z.object({ days: z.number().int().positive() }),
  min_purchase_for_points: z.object({ amount: z.number().nonnegative() }),
  max_points_per_purchase: z.object({ limit: z.number().nonnegative() }),
  redemption_min_points: z.object({ points: z.number().int().nonnegative() }),
  company_name: z.object({ name: z.string().min(1) }),
  company_logo_url: z.object({ url: z.string() }),
  support_email: z.object({ email: z.string().email() }),
  support_phone: z.object({ phone: z.string().min(1) }),
  whatsapp_templates: whatsappTemplatesSchema,
};

export const getSystemConfigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
    
    res.json({ configs });
  } catch (error) {
    next(error);
  }
};

export const getSystemConfigByKey = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (!config) throw new AppError(404, 'Configuración no encontrada');
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const updateSystemConfig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (!SYSTEM_CONFIG_KEYS.includes(key as any)) {
      throw new AppError(400, `Clave de configuración no válida. Claves permitidas: ${SYSTEM_CONFIG_KEYS.join(', ')}`);
    }
    
    const valueSchema = valueSchemas[key];
    let sanitizedValue = value;
    if (valueSchema) {
      const parsed = valueSchema.safeParse(value);
      if (!parsed.success) {
        const detail = parsed.error.errors.map(e => `${e.path.join('.') || 'value'}: ${e.message}`).join('; ');
        throw new AppError(400, `Valor inválido para '${key}': ${detail}`);
      }
      sanitizedValue = parsed.data;
    }
    
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: sanitizedValue, description },
      create: { key, value: sanitizedValue, description },
    });
    
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const deleteSystemConfig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    await prisma.systemConfig.delete({ where: { key } });
    res.json({ message: 'Configuración eliminada' });
  } catch (error) {
    next(error);
  }
};

export const initializeDefaultConfigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const defaultConfigs = [
      {
        key: 'email_notifications_enabled',
        value: { enabled: true },
        description: 'Habilitar notificaciones por email',
      },
      {
        key: 'whatsapp_notifications_enabled',
        value: { enabled: true },
        description: 'Habilitar notificaciones por WhatsApp',
      },
      {
        key: 'points_expiry_days',
        value: { days: 0 },
        description: 'Días de inactividad para que venzan los puntos (0 = sin vencimiento)',
      },
      {
        key: 'points_expiry_warning_days',
        value: { days: 7 },
        description: 'Días de antelación para avisar sobre vencimiento de puntos',
      },
      {
        key: 'min_purchase_for_points',
        value: { amount: 1000 },
        description: 'Monto mínimo de compra para que las reglas de puntos por compra generen puntos',
      },
      {
        key: 'max_points_per_purchase',
        value: { limit: 10000 },
        description: 'Máximo de puntos que se pueden ganar en una sola compra (0 = sin límite)',
      },
      {
        key: 'redemption_min_points',
        value: { points: 100 },
        description: 'Mínimo de puntos en saldo para poder canjear premios (0 = sin mínimo)',
      },
      {
        key: 'company_name',
        value: { name: 'Club Robles' },
        description: 'Nombre de la empresa para comunicaciones',
      },
      {
        key: 'company_logo_url',
        value: { url: '' },
        description: 'URL del logo de la empresa',
      },
      {
        key: 'support_email',
        value: { email: 'soporte@clubrobles.com' },
        description: 'Email de soporte para comunicaciones',
      },
      {
        key: 'support_phone',
        value: { phone: '+54 11 1234-5678' },
        description: 'Teléfono de soporte',
      },
      {
        key: 'whatsapp_templates',
        value: { ...DEFAULT_WHATSAPP_TEMPLATES } as Record<string, string>,
        description: 'Plantillas editables de los mensajes de WhatsApp. Variables: {nombre}, {apellido}, {dni}, {puntos}, {total}, {premio}, {dias}, {empresa}',
      },
    ];
    
    // Solo crear las que faltan: no sobrescribir valores personalizados por el admin
    const existing = await prisma.systemConfig.findMany({ select: { key: true } });
    const existingKeys = new Set(existing.map(c => c.key));
    const missing = defaultConfigs.filter(c => !existingKeys.has(c.key));
    
    if (missing.length > 0) {
      await prisma.systemConfig.createMany({ data: missing });
    }
    
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    res.json({ configs, created: missing.length, skipped: defaultConfigs.length - missing.length });
  } catch (error) {
    next(error);
  }
};
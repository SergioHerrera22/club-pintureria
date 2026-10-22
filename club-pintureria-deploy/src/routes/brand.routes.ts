import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as brandController from '../controllers/brand.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const brandValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
  }),
});

const updateBrandValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), brandController.getBrands);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), brandController.getBrandById);
router.post('/', authenticate, authorize('ADMIN'), validate(brandValidation), brandController.createBrand);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateBrandValidation), brandController.updateBrand);
router.delete('/:id', authenticate, authorize('ADMIN'), brandController.deleteBrand);

export default router;
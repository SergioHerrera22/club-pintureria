import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const categoryValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    parentId: z.string().optional(),
    sortOrder: z.number().int().default(0),
  }),
});

const updateCategoryValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    parentId: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), categoryController.getCategories);
router.get('/tree', authenticate, authorize('CAJERA', 'ADMIN'), categoryController.getCategoryTree);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), categoryController.getCategoryById);
router.post('/', authenticate, authorize('ADMIN'), validate(categoryValidation), categoryController.createCategory);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCategoryValidation), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.deleteCategory);

export default router;
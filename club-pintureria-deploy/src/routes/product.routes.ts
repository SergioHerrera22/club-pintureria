import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as productController from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, productController.getProducts);
router.get('/categories', authenticate, productController.getCategories);
router.get('/:id', authenticate, productController.getProductById);

const createProductSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().min(1),
    brand: z.string().optional(),
    unitPrice: z.number().positive(),
  }),
});

router.post('/', authenticate, authorize('ADMIN'), validate(createProductSchema), productController.createProduct);

const updateProductSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    unitPrice: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.put('/:id', authenticate, authorize('ADMIN'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', authenticate, authorize('ADMIN'), productController.deleteProduct);

export default router;
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as productController from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, productController.getProducts);
router.get('/categories', authenticate, productController.getCategories);
// Búsqueda de fotos por internet (antes de /:id para que no lo capture)
router.get('/image-candidates', authenticate, authorize('ADMIN'), productController.getImageCandidates);
router.get('/:id', authenticate, productController.getProductById);

const createProductSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().min(1),
    brand: z.string().optional(),
    unitPrice: z.number().positive(),
    // URL de foto: ruta local /uploads/... o URL externa (se descarga al guardar)
    imageUrl: z.string().max(2000).nullable().optional(),
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
    imageUrl: z.string().max(2000).nullable().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.put('/:id', authenticate, authorize('ADMIN'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', authenticate, authorize('ADMIN'), productController.deleteProduct);

// Aplicar la foto elegida del buscador (o quitarla con { url: null })
const setImageSchema = z.object({
  body: z.object({
    url: z.string().max(2000).nullable(),
  }),
  params: z.object({ id: z.string() }),
});
router.post('/:id/image', authenticate, authorize('ADMIN'), validate(setImageSchema), productController.setProductImage);

export default router;
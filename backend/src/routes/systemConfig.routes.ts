import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as systemConfigController from '../controllers/systemConfig.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', systemConfigController.getSystemConfigs);
router.get('/:key', systemConfigController.getSystemConfigByKey);
router.post('/initialize-defaults', systemConfigController.initializeDefaultConfigs);

const updateConfigValidation = z.object({
  body: z.object({
    value: z.record(z.unknown()),
    description: z.string().optional(),
  }),
  params: z.object({ key: z.string() }),
});

router.put('/:key', validate(updateConfigValidation), systemConfigController.updateSystemConfig);
router.delete('/:key', systemConfigController.deleteSystemConfig);

export default router;
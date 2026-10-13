import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as branchController from '../controllers/branch.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const branchValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    address: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
});

const updateBranchValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), branchController.getBranches);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), branchController.getBranchById);
router.post('/', authenticate, authorize('ADMIN'), validate(branchValidation), branchController.createBranch);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateBranchValidation), branchController.updateBranch);
router.delete('/:id', authenticate, authorize('ADMIN'), branchController.deleteBranch);

export default router;
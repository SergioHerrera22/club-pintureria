import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getDashboardStats);
router.get('/sales-report', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getSalesReport);
router.get('/points-report', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getPointsReport);
router.get('/sales-by-branch', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getSalesByBranch);
router.get('/sales-by-cashier', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getSalesByCashier);
router.get('/recent-purchases', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getRecentPurchases);
router.get('/recent-sales', authenticate, authorize('CAJERA', 'ADMIN'), dashboardController.getRecentPurchases);
router.get('/report/movements', authenticate, authorize('ADMIN'), dashboardController.getMovementsReport);
router.get('/report/branch-summary', authenticate, authorize('ADMIN'), dashboardController.getBranchSummary);

export default router;
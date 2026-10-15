import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize, requireMenuPermission } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/sales-report', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard'), dashboardController.getSalesReport);
router.get('/points-report', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard'), dashboardController.getPointsReport);
router.get('/sales-by-branch', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard'), dashboardController.getSalesByBranch);
router.get('/sales-by-cashier', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard'), dashboardController.getSalesByCashier);
router.get('/recent-purchases', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/recent-sales', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/report/movements', authenticate, authorize('ADMIN'), requireMenuPermission('dashboard'), dashboardController.getMovementsReport);
router.get('/report/branch-summary', authenticate, authorize('ADMIN'), requireMenuPermission('dashboard'), dashboardController.getBranchSummary);

export default router;
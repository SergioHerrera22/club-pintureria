import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize, authorizeWithPermission, requireMenuPermission } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard'), requireMenuPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/sales-report', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard'), requireMenuPermission('dashboard'), dashboardController.getSalesReport);
router.get('/points-report', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard'), requireMenuPermission('dashboard'), dashboardController.getPointsReport);
router.get('/sales-by-branch', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard'), requireMenuPermission('dashboard'), dashboardController.getSalesByBranch);
router.get('/sales-by-cashier', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard'), requireMenuPermission('dashboard'), dashboardController.getSalesByCashier);
router.get('/recent-purchases', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard', 'ventas'), requireMenuPermission('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/recent-sales', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'dashboard', 'ventas'), requireMenuPermission('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/report/movements', authenticate, authorize('ADMIN'), requireMenuPermission('dashboard'), dashboardController.getMovementsReport);
router.get('/report/branch-summary', authenticate, authorize('ADMIN'), requireMenuPermission('dashboard'), dashboardController.getBranchSummary);

export default router;
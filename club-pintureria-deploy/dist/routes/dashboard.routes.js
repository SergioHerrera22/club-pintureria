"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController = __importStar(require("../controllers/dashboard.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getDashboardStats);
router.get('/sales-report', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getSalesReport);
router.get('/points-report', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getPointsReport);
router.get('/sales-by-branch', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getSalesByBranch);
router.get('/sales-by-cashier', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getSalesByCashier);
router.get('/recent-purchases', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard', 'ventas'), (0, auth_1.requireMenuPermission)('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/recent-sales', auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['CAJERA', 'ADMIN'], 'dashboard', 'ventas'), (0, auth_1.requireMenuPermission)('dashboard', 'ventas'), dashboardController.getRecentPurchases);
router.get('/report/movements', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getMovementsReport);
router.get('/report/branch-summary', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, auth_1.requireMenuPermission)('dashboard'), dashboardController.getBranchSummary);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map
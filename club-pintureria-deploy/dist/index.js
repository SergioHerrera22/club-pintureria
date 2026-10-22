"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config");
const prisma_1 = require("./config/prisma");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const clientPortal_routes_1 = __importDefault(require("./routes/clientPortal.routes"));
const client_routes_1 = __importDefault(require("./routes/client.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const pointRule_routes_1 = __importDefault(require("./routes/pointRule.routes"));
const prize_routes_1 = __importDefault(require("./routes/prize.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const automation_routes_1 = __importDefault(require("./routes/automation.routes"));
const promotion_routes_1 = __importDefault(require("./routes/promotion.routes"));
const coupon_routes_1 = __importDefault(require("./routes/coupon.routes"));
const purchase_routes_1 = __importDefault(require("./routes/purchase.routes"));
const clientApp_routes_1 = __importDefault(require("./routes/clientApp.routes"));
const branch_routes_1 = __importDefault(require("./routes/branch.routes"));
const brand_routes_1 = __importDefault(require("./routes/brand.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const challenge_routes_1 = __importDefault(require("./routes/challenge.routes"));
const benefit_routes_1 = __importDefault(require("./routes/benefit.routes"));
const systemConfig_routes_1 = __importDefault(require("./routes/systemConfig.routes"));
const campaign_routes_1 = __importDefault(require("./routes/campaign.routes"));
const app = (0, express_1.default)();
// Detrás del proxy de Hostinger: req.ip refleja la IP real del visitante
app.set('trust proxy', 1);
// CSP configurada para permitir imagenes por URL externa (links https:// pegados en el admin)
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:'],
        },
    },
}));
app.use((0, cors_1.default)(config_1.config.cors));
app.use(express_1.default.json());
app.use((0, morgan_1.default)(config_1.config.nodeEnv === 'production' ? 'combined' : 'dev'));
// Rate limiting deshabilitado para permitir conexiones ilimitadas
// Carpeta del frontend (SPA) para despliegue en un solo origen
const frontendDistCandidates = [
    process.env.FRONTEND_DIST_PATH,
    path_1.default.resolve(__dirname, '../frontend-dist'),
    path_1.default.resolve(__dirname, 'frontend-dist'),
    path_1.default.resolve(__dirname, '../../frontend/dist'),
].filter((p) => !!p);
const frontendDist = frontendDistCandidates.find(p => fs_1.default.existsSync(path_1.default.join(p, 'index.html')));
if (!frontendDist) {
    console.warn(`⚠️ Frontend no encontrado. Rutas probadas: ${frontendDistCandidates.join(' | ')}`);
}
const APP_VERSION = 'client-portal-1';
app.get('/health', async (req, res) => {
    let db = 'ok';
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
    }
    catch {
        db = 'error';
    }
    res.json({
        status: 'ok',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        frontend: frontendDist ? 'served' : 'not-found',
        db,
    });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/client-portal', clientPortal_routes_1.default);
app.use('/api/clients', client_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/point-rules', pointRule_routes_1.default);
app.use('/api/prizes', prize_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/automation', automation_routes_1.default);
app.use('/api/promotions', promotion_routes_1.default);
app.use('/api/coupons', coupon_routes_1.default);
app.use('/api/purchases', purchase_routes_1.default);
app.use('/api/client', clientApp_routes_1.default);
app.use('/api/branches', branch_routes_1.default);
app.use('/api/brands', brand_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/challenges', challenge_routes_1.default);
app.use('/api/benefits', benefit_routes_1.default);
app.use('/api/system-config', systemConfig_routes_1.default);
app.use('/api/campaigns', campaign_routes_1.default);
// Servir el frontend (SPA) DESPUÉS de las rutas API y ANTES del 404
if (frontendDist) {
    app.use(express_1.default.static(frontendDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path === '/health')
            return next();
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
    console.log(`🌐 Frontend servido desde: ${frontendDist}`);
}
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
app.listen(config_1.config.port, () => {
    console.log(`🚀 Server running on port ${config_1.config.port} (${config_1.config.nodeEnv})`);
});
exports.default = app;
//# sourceMappingURL=index.js.map
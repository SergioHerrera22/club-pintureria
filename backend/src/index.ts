import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { prisma } from './config/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import adminRoutes from './routes/admin.routes';
import productRoutes from './routes/product.routes';
import pointRuleRoutes from './routes/pointRule.routes';
import prizeRoutes from './routes/prize.routes';
import dashboardRoutes from './routes/dashboard.routes';
import automationRoutes from './routes/automation.routes';
import promotionRoutes from './routes/promotion.routes';
import couponRoutes from './routes/coupon.routes';
import purchaseRoutes from './routes/purchase.routes';
import clientAppRoutes from './routes/clientApp.routes';
import branchRoutes from './routes/branch.routes';
import brandRoutes from './routes/brand.routes';
import categoryRoutes from './routes/category.routes';
import challengeRoutes from './routes/challenge.routes';
import benefitRoutes from './routes/benefit.routes';
import systemConfigRoutes from './routes/systemConfig.routes';
import campaignRoutes from './routes/campaign.routes';

const app = express();

app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Rate limiting deshabilitado para permitir conexiones ilimitadas

// Carpeta del frontend (SPA) para despliegue en un solo origen
const frontendDistCandidates = [
  process.env.FRONTEND_DIST_PATH,
  path.resolve(__dirname, '../frontend-dist'),
  path.resolve(__dirname, 'frontend-dist'),
  path.resolve(__dirname, '../../frontend/dist'),
].filter((p): p is string => !!p);

const frontendDist = frontendDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html')));

if (!frontendDist) {
  console.warn(`⚠️ Frontend no encontrado. Rutas probadas: ${frontendDistCandidates.join(' | ')}`);
}

const APP_VERSION = 'db-diag-1';

app.get('/health', async (req, res) => {
  let db: string = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    db = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  res.json({
    status: 'ok',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    frontend: frontendDist ? 'served' : 'not-found',
    db,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/point-rules', pointRuleRoutes);
app.use('/api/prizes', prizeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/client', clientAppRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/benefits', benefitRoutes);
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/campaigns', campaignRoutes);

// Servir el frontend (SPA) DESPUÉS de las rutas API y ANTES del 404
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log(`🌐 Frontend servido desde: ${frontendDist}`);
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port} (${config.nodeEnv})`);
});

export default app;
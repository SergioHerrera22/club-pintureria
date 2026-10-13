import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port} (${config.nodeEnv})`);
});

export default app;
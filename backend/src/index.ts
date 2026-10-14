import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import net from 'net';
import tls from 'tls';
import dns from 'dns';
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

const APP_VERSION = 'db-diag-3';

async function probeTcp(host: string, port: number, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (result: string) => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('ok'));
    socket.once('timeout', () => finish('timeout'));
    socket.once('error', (e: Error) => finish(`error: ${e.message}`));
    socket.connect(port, host);
  });
}

// Handshake real de Postgres: SSLRequest -> TLS -> StartupMessage -> 1ra respuesta del server
async function probePostgres(host: string, port: number, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    const raw = new net.Socket();
    let settled = false;
    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      try { raw.destroy(); } catch { /* noop */ }
      resolve(result);
    };
    raw.setTimeout(timeoutMs);
    raw.once('timeout', () => finish('timeout'));
    raw.once('error', (e: Error) => finish(`error: ${e.message}`));
    raw.once('connect', () => {
      const sslReq = Buffer.alloc(8);
      sslReq.writeInt32BE(8, 0);
      sslReq.writeInt32BE(80877103, 4); // SSLRequest code
      raw.write(sslReq);
    });
    raw.once('data', (d: Buffer) => {
      raw.removeAllListeners('data');
      if (d.toString('latin1', 0, 1) !== 'S') return finish('server-no-ssl');
      const tlsSock = tls.connect({ socket: raw, servername: host, rejectUnauthorized: false });
      tlsSock.once('secureConnect', () => {
        // StartupMessage protocolo 3.0, user=postgres database=postgres
        const params = Buffer.from('user\0postgres\0database\0postgres\0', 'latin1');
        const len = 8 + params.length;
        const start = Buffer.alloc(len);
        start.writeInt32BE(len, 0);
        start.writeInt32BE(196608, 4);
        params.copy(start, 8);
        tlsSock.write(start);
      });
      tlsSock.once('error', (e: Error) => finish(`tls-error: ${e.message}`));
      tlsSock.once('data', (d2: Buffer) => {
        const tag = d2.toString('latin1', 0, 1);
        if (tag === 'R') return finish('pg-auth-request (backend de la DB esta vivo)');
        if (tag === 'E') {
          const segs = d2.slice(5).toString('latin1').split('\0').filter(s => s.length > 0);
          return finish(`pg-error [${segs.join(' | ')}]`);
        }
        return finish(`pg-unexpected: ${d2.toString('latin1', 0, 60)}`);
      });
    });
    raw.connect(port, host);
  });
}

app.get('/health', async (req, res) => {
  let db: string = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    db = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  let dbHost = 'desconocido';
  try {
    dbHost = new URL(process.env.DATABASE_URL || '').hostname || dbHost;
  } catch { /* URL invalida */ }

  const network: Record<string, string> = {};
  try {
    const addrs = await dns.promises.lookup(dbHost, { all: true });
    network.dns = addrs.map(a => `${a.address}(${a.family})`).join(', ');
  } catch (e) {
    network.dns = `fail: ${(e as Error).message}`;
  }
  network[`tcp_${dbHost}:5432`] = await probeTcp(dbHost, 5432);
  network[`tcp_${dbHost}:6543`] = await probeTcp(dbHost, 6543);
  network['tcp_control_registry.npmjs.org:443'] = await probeTcp('registry.npmjs.org', 443);
  network['postgres_handshake'] = await probePostgres(dbHost, 5432);
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
  network.proxy = proxyVars.filter(v => process.env[v]).join(',') || 'none';

  res.json({
    status: 'ok',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    frontend: frontendDist ? 'served' : 'not-found',
    db,
    network,
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
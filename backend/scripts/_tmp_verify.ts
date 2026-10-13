import { PrismaClient } from '@prisma/client';
import { PointsService } from '../src/services/points.service';

const API = 'http://localhost:3000/api';
const prisma = new PrismaClient();

async function post(path: string, body: any, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

async function get(path: string, token?: string) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

async function del(path: string, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

(async () => {
  const out: string[] = [];
  const adminLogin = await post('/auth/login', { email: 'admin@clubpintureria.com', password: '123456' });
  const adminToken = adminLogin.data?.accessToken;
  out.push(`admin login: ${adminLogin.status} role=${adminLogin.data?.user?.role}`);
  if (!adminToken) { console.log(out.join('\n')); process.exit(1); }

  const rate = await get('/system-config/points_per_currency', adminToken);
  out.push(`points_per_currency: ${JSON.stringify(rate.data?.value)}`);

  const tpl = await get('/campaigns/templates', adminToken);
  out.push(`templates keys: ${Object.keys(tpl.data?.templates || {}).join(',')}`);

  const rec = await get('/campaigns/recipients', adminToken);
  out.push(`recipients: total=${rec.data?.total} withPhone=${rec.data?.withPhone} withoutPhone=${rec.data?.withoutPhone}`);

  // Create vendedor
  const vEmail = `vendedor.test.${Date.now()}@clubrobles.com`;
  const vCreate = await post('/admin/users', {
    email: vEmail, password: '123456', firstName: 'Vend', lastName: 'Test', dni: `99${Date.now() % 100000000}`, role: 'VENDEDOR',
  }, adminToken);
  out.push(`create vendedor: ${vCreate.status} id=${vCreate.data?.id}`);

  const vLogin = await post('/auth/login', { email: vEmail, password: '123456' });
  const vToken = vLogin.data?.accessToken;
  out.push(`vendedor login: ${vLogin.status} role=${vLogin.data?.user?.role}`);

  const forbidden = await get('/clients', vToken);
  out.push(`vendedor GET /clients -> ${forbidden.status} (esperado 403)`);

  const forbiddenDash = await get('/dashboard/stats', vToken);
  out.push(`vendedor GET /dashboard/stats -> ${forbiddenDash.status} (esperado 403)`);

  const cEmail = `cliente.test.${Date.now()}@clubrobles.com`;
  const createClient = await post('/clients', {
    firstName: 'Cliente', lastName: 'De Prueba', dni: `${Date.now() % 100000000}`, email: cEmail, phone: '1155550000',
  }, vToken);
  out.push(`vendedor POST /clients -> ${createClient.status} id=${createClient.data?.id}`);

  // Campaign test send (mock)
  const sendTest = await post('/campaigns/send', { message: 'Hola {nombre}, tenes {puntos} puntos en {empresa}', testPhone: '1155550000' }, adminToken);
  out.push(`campaign test send -> ${sendTest.status} sent=${sendTest.data?.sent}`);

  // Points calculation (read-only) at 0.04
  const client = await prisma.user.findUnique({ where: { dni: '20123456' } });
  const product = await prisma.product.findFirst({ where: { isActive: true }, orderBy: { unitPrice: 'desc' } });
  if (client && product) {
    const price = Number(product.unitPrice);
    const calc = await PointsService.calculatePoints(client.id, [
      { productId: product.id, quantity: 1, unitPrice: price, lineTotal: price },
    ], price);
    out.push(`points calc: price=${price} -> ${calc.totalPoints} puntos (esperado ~${Math.floor(price * 0.04)})`);
  }

  // Cleanup created test users
  if (vCreate.data?.id) out.push(`cleanup vendedor: ${(await del(`/admin/users/${vCreate.data.id}`, adminToken)).status}`);
  if (createClient.data?.id) out.push(`cleanup cliente: ${(await del(`/clients/${createClient.data.id}`, adminToken)).status}`);

  console.log(out.join('\n'));
  await prisma.$disconnect();
})();

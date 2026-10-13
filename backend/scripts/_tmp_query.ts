import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const c = await p.systemConfig.findMany({ where: { key: { in: ['points_per_currency', 'company_name', 'whatsapp_notifications_enabled', 'whatsapp_templates'] } } });
  console.log('CONFIGS', JSON.stringify(c, null, 2));
  const r = await p.pointRule.findMany({ select: { id: true, name: true, type: true, config: true, isActive: true } });
  console.log('RULES', JSON.stringify(r, null, 2));
  const u = await p.user.groupBy({ by: ['role'], _count: true });
  console.log('ROLES', JSON.stringify(u));
  const users = await p.user.findMany({ where: { role: 'CLIENTE' }, select: { firstName: true, phone: true }, take: 5 });
  console.log('USERS', JSON.stringify(users));
  await p.$disconnect();
})();

import { prisma } from '../src/config/prisma';
import { PointsService } from '../src/services/points.service';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const anyClient = await prisma.user.findFirst({ where: { role: UserRole.CLIENTE }, include: { clientProfile: true } });
  console.log('Clientes existentes:', anyClient ? anyClient.email : 'NINGUNO');

  const passwordHash = await bcrypt.hash('123456', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test.config@clubpintureria.com' },
    update: {},
    create: {
      email: 'test.config@clubpintureria.com',
      passwordHash,
      role: UserRole.CLIENTE,
      isActive: true,
      firstName: 'Test',
      lastName: 'Config',
      dni: '99999999',
      clientProfile: {
        create: {
          currentPoints: 0,
          totalPointsEarned: 0,
          tier: 'BRONZE',
        },
      } as unknown as Prisma.UserCreateInput['clientProfile'],
    } as Prisma.UserCreateInput,
  });

  let profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    profile = await prisma.clientProfile.create({
      data: { userId: user.id, currentPoints: 0, totalPointsEarned: 0, tier: 'BRONZE' },
    });
  }

  console.log('Cliente de prueba listo:', user.email, '| tier:', profile.tier, '| totalPointsEarned:', profile.totalPointsEarned);

  const rule = await prisma.pointRule.create({
    data: {
      name: 'TEST_DOUBLE_COUNT',
      type: 'POR_MONTO',
      isActive: true,
      priority: 100,
      config: { puntosPorMonto: 0.01, montoMinimo: 0, multiplicador: 1 },
    },
  });

  try {
    const subtotal = 10000;
    const result = await PointsService.calculatePoints(user.id, [], subtotal);
    const breakdownSum = result.breakdown.reduce((a: number, b: any) => a + b.finalPoints, 0);

    console.log('--- TEST DOBLE CONTEO ---');
    console.log('Subtotal:', subtotal, '| puntosPorMonto: 0.01 -> esperado teorico: 100 pts');
    console.log('totalPoints devuelto:', result.totalPoints);
    console.log('suma del breakdown:', breakdownSum);
    console.log('breakdown:', JSON.stringify(result.breakdown, null, 2));

    if (result.totalPoints === breakdownSum * 2 && breakdownSum > 0) {
      console.log('>>> BUG CONFIRMADO: totalPoints es el DOBLE de la suma del breakdown (lines 136 y 150 suman dos veces)');
    } else if (result.totalPoints === breakdownSum) {
      console.log('>>> OK: totalPoints coincide con el breakdown');
    } else {
      console.log('>>> Resultado inesperado, revisar');
    }
  } finally {
    await prisma.pointRule.deleteMany({ where: { name: 'TEST_DOUBLE_COUNT' } });
    console.log('Regla temporal eliminada.');
  }
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

import { PrismaClient, UserRole, RuleType, PrizeStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  const passwordHash = await bcrypt.hash('123456', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clubpintureria.com' },
    update: {},
    create: {
      email: 'admin@clubpintureria.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Sistema',
      dni: '00000000',
      role: UserRole.ADMIN,
    },
  });
  
  const cajera = await prisma.user.upsert({
    where: { email: 'cajera@clubpintureria.com' },
    update: {},
    create: {
      email: 'cajera@clubpintureria.com',
      passwordHash,
      firstName: 'María',
      lastName: 'González',
      dni: '11111111',
      role: UserRole.CAJERA,
    },
  });
  
  const cliente1 = await prisma.user.upsert({
    where: { dni: '20123456' },
    update: {},
    create: {
      email: 'juan.perez@email.com',
      passwordHash,
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '20123456',
      phone: '1155551234',
      birthDate: new Date('1985-05-15'),
      role: UserRole.CLIENTE,
    },
  });
  
  const cliente2 = await prisma.user.upsert({
    where: { dni: '27654321' },
    update: {},
    create: {
      email: 'maria.lopez@email.com',
      passwordHash,
      firstName: 'María',
      lastName: 'López',
      dni: '27654321',
      phone: '1144445678',
      birthDate: new Date('1990-08-22'),
      role: UserRole.CLIENTE,
    },
  });
  
  // Create default branch
  const branch = await prisma.branch.upsert({
    where: { code: 'SUC001' },
    update: {},
    create: {
      name: 'Sucursal Central',
      code: 'SUC001',
      address: 'Av. Corrientes 1234, CABA',
      phone: '11 4444-5555',
      email: 'central@clubpintureria.com',
      isActive: true,
    },
  });
  
  await prisma.clientProfile.upsert({
    where: { userId: cliente1.id },
    update: {},
    create: { userId: cliente1.id, currentPoints: 1250, totalPointsEarned: 1250 },
  });
  
  await prisma.clientProfile.upsert({
    where: { userId: cliente2.id },
    update: {},
    create: { userId: cliente2.id, currentPoints: 340, totalPointsEarned: 340 },
  });
  
  // Asignar sucursal a los usuarios de ejemplo (aislamiento por sucursal)
  await prisma.user.update({ where: { id: cajera.id }, data: { branchId: branch.id } });
  await prisma.user.update({ where: { id: cliente1.id }, data: { branchId: branch.id } });
  await prisma.user.update({ where: { id: cliente2.id }, data: { branchId: branch.id } });
  
  const products = [
    { code: 'PNT-001', name: 'Barniz Acrílico 2K Brillante 1L', category: 'Barnices', brand: 'PPG', unitPrice: 45000 },
    { code: 'PNT-002', name: 'Barniz Acrílico 2K Mate 1L', category: 'Barnices', brand: 'PPG', unitPrice: 43000 },
    { code: 'PNT-003', name: 'Base Agua Color Rojo Ferrari 500ml', category: 'Bases Agua', brand: 'Glasurit', unitPrice: 28000 },
    { code: 'PNT-004', name: 'Base Agua Color Negro Perla 500ml', category: 'Bases Agua', brand: 'Glasurit', unitPrice: 32000 },
    { code: 'PNT-005', name: 'Catalizador Rápido 1L', category: 'Catalizadores', brand: 'PPG', unitPrice: 18000 },
    { code: 'PNT-006', name: 'Catalizador Estándar 1L', category: 'Catalizadores', brand: 'PPG', unitPrice: 15000 },
    { code: 'PNT-007', name: 'Diluyente Universal 5L', category: 'Diluyentes', brand: 'Genérico', unitPrice: 12000 },
    { code: 'PNT-008', name: 'Masa Poliéster 2K 1kg', category: 'Masillas', brand: 'U-POL', unitPrice: 9500 },
    { code: 'PNT-009', name: 'Aparejo Epóxico Gris 1L', category: 'Aparejos', brand: 'Glasurit', unitPrice: 22000 },
    { code: 'PNT-010', name: 'Limpiador Antiestático 1L', category: 'Limpieza', brand: 'PPG', unitPrice: 8500 },
  ];
  
  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  
  const rule1 = await prisma.pointRule.upsert({
    where: { id: 'rule-base' },
    update: {},
    create: {
      id: 'rule-base',
      name: 'Regla Base: 0.04 puntos por $1',
      description: 'Otorga 0.04 puntos por cada $1 de compra',
      type: RuleType.POR_MONTO,
      config: { puntosPorMonto: 0.04, montoMinimo: 1000 },
      priority: 10,
    },
  });
  
  const premiumProducts = await prisma.product.findMany({
    where: { category: { in: ['Barnices', 'Bases Agua'] } },
    select: { id: true },
  });
  
  await prisma.pointRule.upsert({
    where: { id: 'rule-premium' },
    update: {},
    create: {
      id: 'rule-premium',
      name: 'Bonus Productos Premium 2x',
      description: 'Doble puntos en barnices y bases agua',
      type: RuleType.POR_CATEGORIA,
      config: { categorias: ['Barnices', 'Bases Agua'], multiplicador: 0.01 },
      priority: 20,
    },
  });
  
  await prisma.pointRule.upsert({
    where: { id: 'rule-first' },
    update: {},
    create: {
      id: 'rule-first',
      name: 'Bienvenida: 500 puntos primera compra',
      description: 'Bonus de bienvenida para nuevos clientes',
      type: RuleType.PRIMERA_COMPRA,
      config: { bonusPrimeraCompra: 500 },
      priority: 30,
    },
  });
  
  await prisma.pointRule.upsert({
    where: { id: 'rule-birthday' },
    update: {},
    create: {
      id: 'rule-birthday',
      name: 'Regalo Cumpleaños: 200 puntos',
      description: 'Bonus en el mes de cumpleaños',
      type: RuleType.CUMPLEANOS,
      config: { bonusCumpleanos: 200 },
      priority: 25,
    },
  });
  
  const prizes = [
    { code: 'PRZ-001', name: 'Descuento $5.000', description: 'Vale de descuento en próxima compra', pointsCost: 500, stock: 100, category: 'Descuentos' },
    { code: 'PRZ-002', name: 'Descuento $10.000', description: 'Vale de descuento en próxima compra', pointsCost: 900, stock: 50, category: 'Descuentos' },
    { code: 'PRZ-003', name: 'Descuento $25.000', description: 'Vale de descuento en próxima compra', pointsCost: 2000, stock: 20, category: 'Descuentos' },
    { code: 'PRZ-004', name: 'Kit Limpieza Profesional', description: 'Incluye limpiador, paños y guantes', pointsCost: 3000, stock: 10, category: 'Productos' },
    { code: 'PRZ-005', name: 'Pistola Pintura HVLP', description: 'Pistola profesional para repintado', pointsCost: 15000, stock: 3, category: 'Herramientas' },
    { code: 'PRZ-006', name: 'Curso Capacitación PPG', description: 'Curso online certificado 4 horas', pointsCost: 8000, stock: 5, category: 'Experiencias' },
  ];
  
  for (const p of prizes) {
    await prisma.prize.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  const clubPrizes = [
    {
      code: 'P001',
      name: 'Scratch Remover 3M',
      description: 'Removedor de rayones 3M para el cuidado automotor.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_902391-MLU74071632918_012024-F.webp',
      pointsCost: 29000,
      stock: 56,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P002',
      name: 'Restaurador de Cuero 3M',
      description: 'Producto restaurador de cuero de 3M.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_784309-MLA31115094774_062019-O.webp',
      pointsCost: 32000,
      stock: 4,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P003',
      name: 'Cera Sintética Wax 3M',
      description: 'Cera sintética para el cuidado automotor.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_607873-MLA99822194353_112025-F.webp',
      pointsCost: 39000,
      stock: 9,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P004',
      name: 'Lubricante Multipropósito 3M',
      description: 'Lubricante multipropósito de 3M.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_635185-MLA25801776849_072017-O.webp',
      pointsCost: 13000,
      stock: 11,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P005',
      name: 'Pistola Hamilton HVLP PG 200',
      description: 'Pistola de pintura Hamilton, modelo HVLP PG 200.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_656530-MLA49926451746_052022-F.webp',
      pointsCost: 79000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P006',
      name: 'Pistola Walcom XLight 1.3',
      description: 'Pistola de pintura Walcom XLight con pico 1.3.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_832935-MLA87119651090_072025-O.webp',
      pointsCost: 440000,
      stock: 1,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P007',
      name: 'Pistola Walcom XLight 1.8',
      description: 'Pistola de pintura Walcom XLight con pico 1.8.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_832935-MLA87119651090_072025-O.webp',
      pointsCost: 440000,
      stock: 1,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P008',
      name: 'Film Protector Roberlo',
      description: 'Film protector de la marca Roberlo.',
      imageUrl: 'https://martel.com.ar/storage/2026/07/ROBERLO-1.jpg',
      pointsCost: 87000,
      stock: 0,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P009',
      name: 'Pack de 50 Lijas 1500',
      description: 'Pack de 50 lijas de grano 1500.',
      imageUrl: 'https://acdn-us.mitiendanube.com/stores/001/142/959/products/folha-de-lixa-agua-t499-grao-1500-230x280mm-6567590-15716902383721-bbfbb0cddf00e0d8c316124494699522-480-0.webp',
      pointsCost: 65000,
      stock: 0,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P010',
      name: 'Pack de 50 Lijas 2000',
      description: 'Pack de 50 lijas de grano 2000.',
      imageUrl: 'https://www.nortonabrasives.com/sites/mac3-acs-norton/files/styles/636x636/public/2025-11/Lija%20Black%20Ice3.png?itok=eYf_cfy1',
      pointsCost: 65000,
      stock: 0,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P011',
      name: 'Lustra lijadora Dowen Pagio 180 mm 1300 W',
      description: 'Lustra lijadora Dowen Pagio de 180 mm y 1300 W.',
      imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaiVl8B04f101bMlS5xVwjC70pnrO8EO7L5H5-vqyIXkAQzKp9Zpbk088&s=10',
      pointsCost: 200000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P012',
      name: 'Amoladora Hamilton 900 W',
      description: 'Amoladora eléctrica Hamilton de 900 W.',
      imageUrl: 'https://acdn-us.mitiendanube.com/stores/001/238/493/products/amoladora-115mm-c0171444b86997e0f217060316501089-480-0.webp',
      pointsCost: 95000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P013',
      name: 'Pistola de Calor Dowen Pagio 1850 W',
      description: 'Pistola de calor eléctrica de 1850 W.',
      imageUrl: 'https://cdn.prod.website-files.com/694430392d8e2afaf2952ff4/694b0bc4adad0bd9f3d07cc8_9993460_WEB-1.webp',
      pointsCost: 57000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P014',
      name: 'Fratacho Lijador Doble 67 × 400 mm',
      description: 'Fratacho lijador doble de 67 × 400 mm.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_955106-MLA52932748000_122022-O.webp',
      pointsCost: 52000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P015',
      name: 'Autopolish 450',
      description: 'Producto Autopolish, presentación de 450 (unidad por confirmar).',
      imageUrl: 'https://gefcko.com/fotos/productos/300/d07ed4d58fbd3c55590e373c58db120e.png',
      pointsCost: 7000,
      stock: 0,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P016',
      name: 'Autocera 450 cc',
      description: 'Cera para el cuidado automotor, presentación de 450 cc.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_725755-MLA114185882877_072026-O.webp',
      pointsCost: 7000,
      stock: 0,
      category: 'Productos',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
    {
      code: 'P017',
      name: 'Pulidora Roto Orbital Dowen Pagio 150 mm',
      description: 'Pulidora roto orbital Dowen Pagio de 150 mm.',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_789044-MLA53353283157_012023-O.webp',
      pointsCost: 210000,
      stock: 0,
      category: 'Herramientas',
      status: PrizeStatus.DISPONIBLE,
      isActive: true,
    },
  ];

  for (const p of clubPrizes) {
    await prisma.prize.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  
  console.log('✅ Database seeded successfully!');
  console.log('👤 Admin: admin@clubpintureria.com / 123456');
  console.log('👤 Cajera: cajera@clubpintureria.com / 123456');
  console.log('👤 Cliente 1: 20123456 / 123456');
  console.log('👤 Cliente 2: 27654321 / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = [
  { id: 'M-01', name: 'Asha Solar', role: 'solar', pv: 4.8, baseLoad: 1.7, distance: 0 },
  { id: 'M-02', name: 'Ravi Home', role: 'consumer', pv: 0.0, baseLoad: 3.4, distance: 120 },
  { id: 'M-03', name: 'Meera House', role: 'prosumer', pv: 3.9, baseLoad: 2.0, distance: 180 },
  { id: 'M-04', name: 'Ananya Villa', role: 'solar', pv: 5.2, baseLoad: 1.6, distance: 250 },
  { id: 'M-05', name: 'Kabir Home', role: 'consumer', pv: 0.0, baseLoad: 2.7, distance: 310 },
  { id: 'M-06', name: 'Ishita Flat', role: 'prosumer', pv: 2.8, baseLoad: 2.1, distance: 380 },
  { id: 'M-07', name: 'Nikhil Home', role: 'consumer', pv: 0.0, baseLoad: 2.4, distance: 460 },
  { id: 'M-08', name: 'Tara Solar', role: 'solar', pv: 4.3, baseLoad: 1.2, distance: 510 },
  { id: 'M-09', name: 'Dev House', role: 'prosumer', pv: 3.1, baseLoad: 2.5, distance: 580 },
  { id: 'M-10', name: 'Saanvi Home', role: 'consumer', pv: 0.0, baseLoad: 2.9, distance: 640 },
  { id: 'M-11', name: 'Arjun Solar', role: 'solar', pv: 3.7, baseLoad: 1.4, distance: 700 },
  { id: 'M-12', name: 'Zoya Home', role: 'consumer', pv: 0.0, baseLoad: 2.2, distance: 760 },
];

async function main() {
  console.log('Seeding simulation database...');

  // 1. Initialize or reset SimulationState
  await prisma.simulationState.upsert({
    where: { id: 1 },
    update: {
      tick: 62,
      playing: true,
      speed: '1x',
      cumulativeBaseline: 0.0,
    },
    create: {
      id: 1,
      tick: 62,
      playing: true,
      speed: '1x',
      cumulativeBaseline: 0.0,
    },
  });

  // 2. Clear old historical logs/trades on seed (optional but recommended for a clean start)
  await prisma.meterReading.deleteMany({});
  await prisma.trade.deleteMany({});

  // 3. Upsert meters seed details
  for (const item of seedData) {
    await prisma.meter.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        role: item.role,
        pv: item.pv,
        baseLoad: item.baseLoad,
        distance: item.distance,
        earned: 0.0,
        sharedPartners: '',
      },
      create: {
        id: item.id,
        name: item.name,
        role: item.role,
        pv: item.pv,
        baseLoad: item.baseLoad,
        distance: item.distance,
        earned: 0.0,
        sharedPartners: '',
      },
    });
  }

  console.log('Database seeding finished successfully.');
}

async function run() {
  try {
    await main();
  } catch (e) {
    console.error('Error during database seed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

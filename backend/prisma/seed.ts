import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neuro-assistant.ru' },
    update: {},
    create: {
      email: 'admin@neuro-assistant.ru',
      passwordHash: adminHash,
      name: 'Администратор',
      role: 'admin',
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Create demo manager user
  const managerHash = await bcrypt.hash('manager123', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@neuro-assistant.ru' },
    update: {},
    create: {
      email: 'manager@neuro-assistant.ru',
      passwordHash: managerHash,
      name: 'Менеджер Демо',
      role: 'manager',
    },
  });
  console.log(`Manager user: ${manager.email}`);

  // Create demo project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project-1' },
    update: {},
    create: {
      id: 'demo-project-1',
      name: 'Демо-проект Авито',
      ownerId: admin.id,
    },
  });

  // Add both users as members
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: admin.id },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: admin.id,
      role: 'OWNER',
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: manager.id },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: manager.id,
      role: 'EDITOR',
    },
  });

  // Seed some demo analytics data
  const today = new Date();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await prisma.analyticsDaily.upsert({
      where: {
        projectId_date: { projectId: project.id, date },
      },
      update: {},
      create: {
        projectId: project.id,
        date,
        views: Math.floor(Math.random() * 500) + 100,
        favorites: Math.floor(Math.random() * 50) + 10,
        contacts: Math.floor(Math.random() * 30) + 5,
        chats: Math.floor(Math.random() * 20) + 3,
        calls: Math.floor(Math.random() * 15) + 2,
        spend: Math.round((Math.random() * 2000 + 500) * 100) / 100,
        cpl: Math.round((Math.random() * 200 + 50) * 100) / 100,
        roi: Math.round((Math.random() * 300 - 50) * 100) / 100,
        romi: Math.round((Math.random() * 400 - 100) * 100) / 100,
      },
    });
  }

  // Seed a demo bidder rule
  await prisma.bidderRule.upsert({
    where: { id: 'demo-bidder-rule-1' },
    update: {},
    create: {
      id: 'demo-bidder-rule-1',
      projectId: project.id,
      name: 'Удержание позиции TOP-3',
      enabled: true,
      strategy: 'HOLD_POSITION',
      minBid: 50,
      maxBid: 500,
      dailyBudget: 3000,
      schedule: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 22 },
      itemFilter: { categories: ['Электроника'], priceMin: 1000 },
    },
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

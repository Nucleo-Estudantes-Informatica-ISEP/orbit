import { PrismaClient, UserStatus, SystemPermission } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { getProductionAdminSeedConfig } from '../src/config/production-seed';

const prisma = new PrismaClient();

const ALL_PERMISSIONS: SystemPermission[] = Object.values(SystemPermission);

async function main() {
  console.log('Seeding production data...');

  // Department
  const dept = await prisma.department.upsert({
    where: { name: 'NEI-ISEP' },
    update: {},
    create: { name: 'NEI-ISEP', description: 'Núcleo de Estudantes de Informática do ISEP' },
  });

  // Role
  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: { permissions: ALL_PERMISSIONS },
    create: { name: 'ADMIN', description: 'Administrator with full access', permissions: ALL_PERMISSIONS },
  });

  // Admin user
  const { email, password, name } = getProductionAdminSeedConfig(process.env);

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, status: UserStatus.ACTIVE, departmentId: dept.id },
    create: { email, name, password: hashed, status: UserStatus.ACTIVE, departmentId: dept.id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, darkMode: false, emailNotifications: true, inAppNotifications: true, language: 'pt' },
  });

  console.log('\nProduction seed complete.');
  console.log(`  Department: ${dept.name}`);
  console.log(`  Role: ${role.name}`);
  console.log(`  Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

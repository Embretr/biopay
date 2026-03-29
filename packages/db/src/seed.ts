/**
 * Seed script for development.
 * Creates a test user with wallet and palm enrollment for use with the terminal simulator.
 *
 * Run with: pnpm db:seed
 */
import { prisma } from "./index.js";

async function main() {
  console.info("Seeding database...");

  // Create a demo user (used with mock BankID login)
  const user = await prisma.user.upsert({
    where: { email: "demo@biopay.no" },
    update: {},
    create: {
      bankidSub: "mock_sub_demo_user",
      email: "demo@biopay.no",
      name: "Demo Bruker",
      kycStatus: "VERIFIED",
      wallet: {
        create: {
          balanceCents: 50000, // 500 NOK starting balance
          currency: "NOK",
        },
      },
      palmEnrollments: {
        create: {
          palmId: "mock_palm_demo_user_001",
          status: "ACTIVE",
        },
      },
    },
    include: {
      wallet: true,
      palmEnrollments: true,
    },
  });

  console.info(`Created demo user: ${user.email}`);
  console.info(`  Palm ID: ${user.palmEnrollments[0]?.palmId}`);
  console.info(`  Wallet balance: ${(user.wallet?.balanceCents ?? 0) / 100} NOK`);
  console.info("\nDone! You can now use the terminal simulator with 'Demo Bruker'.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

console.log(process.env.DATABASE_URL);

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // Admin user
  await prisma.user.upsert({
    where: { email: 'admin@haven.ng' },
    update: {},
    create: {
      email: 'admin@haven.ng',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  // Sample customers
  const customerUser1 = await prisma.user.upsert({
    where: { email: 'chidi@example.com' },
    update: {},
    create: {
      email: 'chidi@example.com',
      passwordHash,
      role: 'CUSTOMER',
      isVerified: true,
      customer: {
        create: {
          fullName: 'Chidi Okonkwo',
          phone: '+2348012345678',
          totalPoints: 1200,
        },
      },
    },
  });

  const customerUser2 = await prisma.user.upsert({
    where: { email: 'amara@example.com' },
    update: {},
    create: {
      email: 'amara@example.com',
      passwordHash,
      role: 'CUSTOMER',
      isVerified: true,
      customer: {
        create: {
          fullName: 'Amara Eze',
          phone: '+2348098765432',
          totalPoints: 5200,
        },
      },
    },
  });

  // Sample providers
  const providers = [
    {
      email: 'cleanpro@example.com',
      businessName: 'CleanPro Services',
      ownerName: 'Ngozi Adeyemi',
      phone: '+2348123456789',
      category: 'Home Cleaning Services',
      location: 'Lagos',
      description: 'Professional home cleaning with eco-friendly products. Serving Lagos Island and Mainland.',
      services: 'Deep cleaning, Regular cleaning, Move-in/out cleaning, Office cleaning',
      experience: '5+ years',
      avgRating: 4.8,
      totalReviews: 127,

      images: [
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800',
      ],
    },
    {
      email: 'techfix@example.com',
      businessName: 'TechFix Digital',
      ownerName: 'Emeka Nwosu',
      phone: '+2348034567890',
      category: 'Digital Services',
      location: 'Abuja',
      description: 'Websites, graphics, and digital marketing for Nigerian businesses. Fast delivery guaranteed.',
      services: 'Web design, Logo design, Social media management, SEO, App development',
      experience: '7+ years',
      avgRating: 4.9,
      totalReviews: 89,

      images: [
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
      ],
    },
    {
      email: 'laundryking@example.com',
      businessName: 'LaundryKing Express',
      ownerName: 'Fatima Bello',
      phone: '+2348045678901',
      category: 'Laundry Services',
      location: 'Lagos',
      description: 'Same-day laundry and dry cleaning. Pickup and delivery available across Lagos.',
      services: 'Washing, Ironing, Dry cleaning, Pickup & delivery, Shoe cleaning',
      experience: '3+ years',
      avgRating: 4.6,
      totalReviews: 203,

      images: [
        'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800',
        'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=800',
      ],
    },
    {
      email: 'acadhelp@example.com',
      businessName: 'AcadHelp Tutors',
      ownerName: 'Dr. Tunde Adewale',
      phone: '+2348056789012',
      category: 'Academic Support',
      location: 'Ibadan',
      description: 'WAEC, JAMB, and university-level tutoring by experienced educators. Proven results.',
      services: 'Mathematics, Physics, Chemistry, Biology, English, JAMB prep, WAEC prep',
      experience: '10+ years',
      avgRating: 4.7,
      totalReviews: 156,
      images: [
        'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800',
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
      ],
    },
    {
      email: 'hairqueen@example.com',
      businessName: 'HairQueen Styling',
      ownerName: 'Blessing Okafor',
      phone: '+2348067890123',
      category: 'Hair Styling Services',
      location: 'Port Harcourt',
      description: 'Natural and relaxed hair care specialist. Home service available. Over 50 styles.',
      services: 'Braiding, Weave-on, Natural hair care, Locs, Coloring, Treatment',
      experience: '8+ years',
      avgRating: 4.5,
      totalReviews: 178,

      images: [
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
        'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800',
      ],
    },
    {
      email: 'homechef@example.com',
      businessName: 'HomeChef Catering',
      ownerName: 'Mama Chioma',
      phone: '+2348078901234',
      category: 'Cooking Services',
      location: 'Enugu',
      description: 'Authentic Nigerian meals for events and home delivery. Party cooking specialists.',
      services: 'Party cooking, Daily meal prep, Catering, Soup making, Pastries',
      experience: '12+ years',
      avgRating: 4.9,
      totalReviews: 241,
      images: [
        'https://images.unsplash.com/photo-1565299715199-866c917206bb?w=800',
        'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
      ],
    },
  ];

  for (const p of providers) {
    await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash,
        role: 'PROVIDER',
        isVerified: true,
        provider: {
          create: {
            businessName: p.businessName,
            ownerName: p.ownerName,
            phone: p.phone,
            category: p.category,
            location: p.location,
            description: p.description,
            services: p.services,
            experience: p.experience,
            isVerified: true,
            isPublished: true,
            avgRating: p.avgRating,
            totalReviews: p.totalReviews,
          },
        },
      },
    });
  }

  // Sample housing listings
  const housingListings = [
    {
      ownerId: customerUser1.id,
      title: 'Clean Hostel Room – UNILAG Area',
      category: 'HOSTEL' as const,
      description: 'Well-maintained hostel room close to UNILAG main gate. Borehole water, 24/7 security.',
      location: 'Yaba, Lagos',
      phone: '+2348012345678',
      pricePerMonth: 18000,
    },
    {
      ownerId: customerUser2.id,
      title: 'Self-Contained Lodge – UI Campus',
      category: 'LODGE' as const,
      description: 'Spacious self-con with kitchen, wardrobe, and prepaid meter. Near UI gate 2.',
      location: 'Ibadan',
      phone: '+2348098765432',
      pricePerMonth: 35000,
    },
    {
      ownerId: customerUser1.id,
      title: 'Mini Flat – Gwarinpa, Abuja',
      category: 'APARTMENT' as const,
      description: 'Neat mini flat with parking space. Steady NEPA and security estate.',
      location: 'Abuja',
      phone: '+2348012345678',
      pricePerMonth: 75000,
    },
  ];

  for (const listing of housingListings) {
    await prisma.housingListing.create({ data: listing });
  }

  console.log('✅ Seed complete!');
  console.log('\nTest accounts (all passwords: password123):');
  console.log('  Admin:    admin@haven.ng');
  console.log('  Customer: chidi@example.com | amara@example.com');
  console.log('  Provider: cleanpro@example.com | techfix@example.com | laundryking@example.com');
  console.log('  Provider: acadhelp@example.com | hairqueen@example.com | homechef@example.com');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

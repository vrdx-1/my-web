'use client';

export interface BoostPackage {
  name: string;
  price: string;
  days: number;
  qr_url: string;
}

export const BOOST_PACKAGES: BoostPackage[] = [
  {
    name: '1 ມື້',
    price: '5.000 ກີບ',
    days: 1,
    qr_url:
      'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-06-19%20at%2010.51.14.jpeg',
  },
  {
    name: '3 ມື້',
    price: '14.000 ກີບ',
    days: 3,
    qr_url:
      'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-06-19%20at%2010.53.33.jpeg',
  },
  {
    name: '7 ມື້',
    price: '29.000 ກີບ',
    days: 7,
    qr_url:
      'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-06-19%20at%2010.56.00.jpeg',
  },
  {
    name: '14 ມື້',
    price: '59.000 ກີບ',
    days: 14,
    qr_url:
      'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-06-19%20at%2010.57.11.jpeg',
  },
  {
    name: '30 ມື້',
    price: '99.000 ກີບ',
    days: 30,
    qr_url:
      'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-06-19%20at%2010.58.03.jpeg',
  },
];


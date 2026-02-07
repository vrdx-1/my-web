import type { Metadata } from 'next';
import HomeClient from './HomeClient';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const postId = params?.post;
  if (!postId) return {};
  return {
    openGraph: {
      images: [{ url: `${baseUrl}/api/og?post=${postId}`, width: 600, height: 600 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`${baseUrl}/api/og?post=${postId}`],
    },
  };
}

export default function Home() {
  return <HomeClient />;
}

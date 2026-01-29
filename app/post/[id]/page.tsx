import type { Metadata } from 'next';
import { headers } from 'next/headers';
import PostDetailClient from './PostDetailClient';

function getRequestBaseUrl(): URL {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) return new URL(`${proto}://${host}`);

  const fallback = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return new URL(fallback);
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const postId = params?.id;
  if (!postId) return {};

  const base = getRequestBaseUrl();
  const imagePath = `/api/og?post=${postId}`;

  return {
    metadataBase: base,
    openGraph: {
      images: [{ url: imagePath, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [imagePath],
    },
  };
}

export default function PostDetailPage() {
  return <PostDetailClient />;
}

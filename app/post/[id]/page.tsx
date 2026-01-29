import type { Metadata } from 'next';
import PostDetailClient from './PostDetailClient';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const postId = params?.id;
  if (!postId) return {};

  const imageUrl = `${baseUrl}/api/og?post=${postId}`;

  return {
    openGraph: {
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [imageUrl],
    },
  };
}

export default function PostDetailPage() {
  return <PostDetailClient />;
}

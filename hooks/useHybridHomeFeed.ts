import { useEffect, useState } from 'react';
import { fetchHomeFeed } from '@/utils/fetchHomeFeed';

export function useHybridHomeFeed({ province, userId, guestToken, seenList, feedSeed }: {
  province?: string;
  userId?: string | null;
  guestToken?: string | null;
  seenList?: string[];
  feedSeed?: string;
}) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchHomeFeed({ province, userId, guestToken, seenList, feedSeed })
      .then((data) => setFeed(data.posts))
      .finally(() => setLoading(false));
  }, [province, userId, guestToken, seenList, feedSeed]);

  return { feed, loading };
}

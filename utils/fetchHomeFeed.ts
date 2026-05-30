// utils/fetchHomeFeed.ts
export async function fetchHomeFeed({
  province,
  userId,
  guestToken,
  seenList,
  feedSeed,
}: {
  province?: string;
  userId?: string | null;
  guestToken?: string | null;
  seenList?: string[];
  feedSeed?: string;
}) {
  // ถ้าไม่มี userId/guestToken/seenList/seed = ขอ public feed (cache กลาง)
  const isPublicFeed = !userId && !guestToken && (!seenList || seenList.length === 0) && !feedSeed;

  const body: any = {
    startIndex: 0,
    endIndex: 19,
    province,
  };
  if (!isPublicFeed) {
    if (userId) body.activeProfileId = userId;
    if (guestToken) body.guestToken = guestToken;
    if (seenList && seenList.length > 0) body.excludePostIds = seenList;
    if (feedSeed) body.feedSeed = feedSeed;
  }

  const res = await fetch('/api/posts/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Feed fetch failed');
  return res.json();
}

/**
 * เก็บ path ที่เคยโหลดแล้ว — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook)
 * ใช้ร่วมกับ Navigation bar: โหลดครั้งแรกแสดง Skeleton, ครั้งถัดไปไม่แสดง
 */
const visited = new Set<string>();

export function markRouteVisited(pathname: string): void {
  if (pathname && typeof pathname === 'string') {
    visited.add(pathname);
  }
}

export function hasRouteVisited(pathname: string): boolean {
  return pathname ? visited.has(pathname) : false;
}

/**
 * Format a date as "time ago" in Lao (e.g. ເມື່ອສັກຄູ່, 5 ນາທີທີ່ແລ້ວ).
 */
export function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'ເມື່ອສັກຄູ່';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ນາທີທີ່ແລ້ວ`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ຊົ່ວໂມງທີ່ແລ້ວ`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ມື້ທີ່ແລ້ວ`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} ອາທິດທີ່ແລ້ວ`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} ເດືອນທີ່ແລ້ວ`;
  return `${Math.floor(diffInSeconds / 31536000)} ປີທີ່ແລ້ວ`;
}

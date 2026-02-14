'use client'

import { HomeContent } from './HomeContent';

// โหลด HomeContent ใน route chunk เดียวกับหน้าโฮม เพื่อลด round-trip และให้หน้าโฮมโหลดเร็วขึ้น
export default function HomeClient() {
  return <HomeContent />;
}

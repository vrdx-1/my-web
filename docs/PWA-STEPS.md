# ขั้นตอนทำ PWA (Progressive Web App) — Jutpai

## สรุปสิ่งที่ PWA ต้องมี

1. **Web App Manifest** — ชื่อแอป, ไอคอน, theme สี, โหมดแสดงผล (standalone/fullscreen)
2. **Service Worker** — cache เนื้อหา, ทำงานแบบ offline ได้บ้าง
3. **HTTPS** — ต้องใช้ HTTPS (production ส่วนใหญ่มีอยู่แล้ว)
4. **ไอคอนหลายขนาด** — สำหรับ Add to Home Screen / splash

---

## ขั้นตอนที่ 1: สร้าง Web App Manifest

- ไฟล์: `public/manifest.json` หรือ `manifest.webmanifest`
- ใส่: `name`, `short_name`, `description`, `start_url`, `display` (แนะนำ `standalone` หรือ `minimal-ui`), `theme_color`, `background_color`, `icons[]` (หลายขนาด เช่น 192x192, 512x512)
- เชื่อมใน HTML: ใน Next.js ใส่ใน `app/layout.tsx` ผ่าน `<link rel="manifest" href="/manifest.json" />` หรือใช้ metadata

**หมายเหตุ:** ตอนนี้ไอคอนใช้จาก Supabase (`PNG.png`) — ถ้าต้องการ PWA ครบ ควรมีไอคอนขนาด 192x192 และ 512x512 (จะใช้ URL เดิมหรืออัปโหลดไฟล์ใน `public/` ก็ได้)

---

## ขั้นตอนที่ 2: เพิ่ม meta tags สำหรับมือถือ / Add to Home Screen

ใน `app/layout.tsx` (หรือใน `<head>`) เพิ่มอย่างน้อย:

- `theme-color` — สีแถบสถานะ
- `apple-mobile-web-app-capable` — บน iOS ให้เปิดแบบแอป
- `apple-mobile-web-app-status-bar-style` — สไตล์แถบสถานะ (default/black/black-translucent)
- `apple-touch-icon` — ไอคอนเมื่อ Add to Home Screen บน iOS (แนะนำ 180x180)

---

## ขั้นตอนที่ 3: สร้าง Service Worker

- **ตัวเลือก A — ใช้ไลบรารี:** เช่น `@ducanh2912/next-pwa` (รองรับ Next.js ใหม่) จะ generate Service Worker และ inject manifest ให้
- **ตัวเลือก B — ทำเอง:** เขียน `public/sw.js` (หรือใช้ Workbox) แล้ว register ใน client (เช่น component ที่รันใน `useEffect` หรือใน layout ที่เป็น client component)

สิ่งที่ SW ทำได้:
- cache หน้าแรก / หน้าสำคัญ
- cache static assets (JS, CSS, รูปจาก domain เรา)
- แสดงหน้า offline แบบง่ายถ้าไม่มีเน็ต

---

## ขั้นตอนที่ 4: Register Service Worker

- สร้าง component หรือ utility ที่เรียก `navigator.serviceWorker.register('/sw.js')` หลังโหลดหน้า (ใน `useEffect`)
- ใส่ component นี้ใน layout หลักเพื่อให้ทุกหน้ารีจิสเตอร์ SW

---

## ขั้นตอนที่ 5: ไอคอนหลายขนาด

- PWA ต้องการไอคอนอย่างน้อย 192x192 และ 512x512 (บางที่ต้องการ 144, 384 ด้วย)
- ถ้าใช้รูปจาก Supabase แค่ URL เดิม ก็ใส่ใน `manifest.icons[]` ได้
- ถ้าต้องการไฟล์ในโปรเจกต์: วางใน `public/` เช่น `public/icons/icon-192.png`, `icon-512.png` แล้วอ้างใน manifest

---

## ขั้นตอนที่ 6: ทดสอบและตรวจสอบ

1. **Chrome DevTools**
   - Application tab → Manifest: ดู manifest โหลดได้และไม่มี error
   - Application → Service Workers: ดู SW ลงทะเบียนและสถานะ
   - Lighthouse → Progressive Web App: ตรวจคะแนน PWA

2. **มือถือ**
   - Android: Chrome → เมนู → “Add to Home screen” / “ติดตั้งแอป”
   - iOS: Safari → Share → “Add to Home Screen”

3. **ตรวจว่า**
   - เปิดจาก Home Screen แล้วเป็น fullscreen/standalone
   - theme-color ตรงที่ตั้ง
   - offline แล้วยังเห็นหน้า cached (ถ้า SW ทำไว้)

---

## ลำดับทำแนะนำ

| ลำดับ | งาน | หมายเหตุ |
|-------|-----|----------|
| 1 | สร้าง `public/manifest.json` และเชื่อมใน layout | พื้นฐาน PWA |
| 2 | เพิ่ม meta theme-color, apple-mobile-web-app-*, apple-touch-icon | มือถือ + iOS |
| 3 | ตัดสินใจใช้ next-pwa หรือเขียน SW เอง | แล้วแต่ความซับซ้อนที่ต้องการ |
| 4 | สร้าง/ตั้งค่า Service Worker + register ใน client | offline + cache |
| 5 | เตรียมไอคอน 192 & 512 (หรือใช้ URL เดิม) | ให้ครบใน manifest |
| 6 | รัน Lighthouse PWA + ทดสอบ Add to Home Screen จริง | ก่อนปล่อยให้ผู้ใช้ |

---

## โปรเจกต์นี้ตั้งค่าแล้ว (next-pwa + public/icons/)

- **Build:** ใช้ `next build --webpack` เพราะ next-pwa ใช้ webpack (Next.js 16 ใช้ Turbopack เป็นค่าเริ่มต้น)
- **Manifest:** `public/manifest.json` อ้างอิงไอคอนใน `public/icons/`
- **ไอคอน:** วางไฟล์ใน `public/icons/` ตามรายการใน `public/icons/README.md`
- **PWA ปิดในโหมด dev:** ตั้ง `disable: process.env.NODE_ENV === "development"` ใน next.config

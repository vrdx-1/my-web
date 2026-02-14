# PWA Icons

วางไฟล์ไอคอนต่อไปนี้ในโฟลเดอร์นี้:

| ไฟล์ | ขนาด | ใช้สำหรับ |
|------|------|-----------|
| `icon-192x192.png` | 192×192 px | Android Chrome, manifest |
| `icon-512x512.png` | 512×512 px | Splash / Install, manifest |
| `apple-touch-icon.png` | 180×180 px | iOS Add to Home Screen (อ้างอิงใน layout) |

- รูปแบบ: PNG (แนะนำให้เป็นสี่เหลี่ยมจัตุรัส)
- **maskable**: ไอคอน 192/512 ควรมี safe area กลาง (ประมาณ 80%) เพราะ Android อาจ crop เป็นวงกลม/rounded

ถ้ามีแค่รูปเดียว เช่น จาก Supabase สามารถ resize เป็น 192, 512, 180 แล้วบันทึกเป็น 3 ไฟล์ตามชื่อด้านบนได้

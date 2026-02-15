# วิธีตรวจสอบโหลดเพิ่ม (Load More) หน้า Notification

## ขั้นตอนที่ 1: เปิด Debug Log

1. เปิดหน้า **การแจ้งเตือน** (Notification) ในแอป
2. กด **F12** (หรือ Cmd+Option+I บน Mac) เปิด DevTools
3. ไปที่แท็บ **Console**
4. พิมพ์คำสั่งนี้แล้วกด Enter:
   ```js
   window.__NOTIFICATION_LOADMORE_DEBUG = true
   ```
5. **เลื่อนลง** ให้ถึงบริเวณล่างของรายการ (ที่เห็น spinner โหลด)

ดูใน Console ว่ามี log ขึ้นต้นด้วย `[notification loadMore]` หรือไม่:

| ถ้าเห็น log | ความหมาย |
|-------------|----------|
| `loadMore called` แล้วตามด้วย `skip: ...` | ฟังก์ชันถูกเรียก แต่ไม่โหลด (เช่น hasMore=false หรือ loadingMore=true) |
| `loadMore called` แล้วตามด้วย `cursor` และ `API returned` | มีการยิง API โหลดเพิ่ม — ดูขั้นตอนที่ 2 |
| **ไม่เห็น log เลย** | Intersection Observer ไม่ยิง loadMore — ดูขั้นตอนที่ 3 |

---

## ขั้นตอนที่ 2: ตรวจว่า API และการต่อรายการ

เมื่อมี log `API returned X items`:

- **rawRows / items = 20 และ toAdd = 0**  
  → API คืนชุดเดิม (cursor ผิดหรือ SQL ใช้ cursor ไม่ได้)  
  → ตรวจใน Network ว่า request มี `p_after_created_at` และ `p_after_id` และค่าต้อง**เก่ากว่า**แถวแรกของหน้าแรก

- **rawRows = 0 หรือ น้อยมาก**  
  → ใน DB ไม่มีแถวเก่ากว่า cursor (อาจหมดแล้ว หรือ cursor เก่าเกินไป)

- **toAdd > 0**  
  → มีการต่อรายการแล้ว ถ้ายังไม่เห็นใน UI อาจเป็นเรื่องการ re-render / key

---

## ขั้นตอนที่ 3: ตรวจว่า Observer ยิงหรือไม่

ถ้า**ไม่เห็น** `[notification loadMore] loadMore called` เลย แปลว่า `loadMore` ไม่ถูกเรียก:

1. เปิดแท็บ **Network** ใน DevTools
2. เลื่อนลงช้าๆ จนเกือบถึงล่างรายการ
3. ดูว่ามี request ไป **get_notifications_feed** (หรือ RPC) ครั้งที่ 2 หรือไม่

- **ไม่มี request ครั้งที่ 2**  
  → สาเหตุอยู่ที่ Intersection Observer (sentinel ไม่เข้า viewport ของ scroll container, หรือ root ref ผิด)
- **มี request ครั้งที่ 2**  
  → แปลว่า loadMore ถูกเรียกแล้ว ให้กลับไปดู log ในขั้นตอนที่ 1/2

---

## ขั้นตอนที่ 4: ตรวจใน Network (Request/Response)

1. แท็บ **Network** → Filter: พิมพ์ `get_notifications_feed` หรือ `rpc`
2. เลื่อนลงให้เกิดโหลดเพิ่ม แล้วคลิกที่ request **get_notifications_feed ครั้งที่ 2**

ตรวจ **Payload (Request)**:

- ต้องมี `p_owner_id`, `p_limit: 20`
- หน้าถัดไปต้องมี **`p_after_created_at`** และ **`p_after_id`**
- ค่า `p_after_created_at` ต้องเป็นเวลา**เก่ากว่า** (น้อยกว่า) แถวแรกของหน้าแรก เช่น ถ้าแถวแรกเป็น `2026-02-11T16:44:05.178Z` แล้ว cursor ควรเป็นประมาณ `2026-02-11T16:43:18.xxxZ`

ตรวจ **Response**:

- ถ้าเป็น array **ว่าง []** = ไม่มีแถวเก่ากว่า cursor (อาจหมดข้อมูลแล้ว)
- ถ้าเป็น array ชุดเดิม 20 แถว (เหมือนหน้าแรก) = cursor ผิด หรือ SQL ไม่ได้ใช้ cursor → ต้องแก้ที่ cursor หรือที่ฟังก์ชัน SQL

---

## สรุปจุดที่มักผิด

1. **Cursor ผิด**  
   ใช้รายการที่**เก่าที่สุด**ใน list (minimum `cursor_created_at`) เป็น cursor ถ้าใช้รายการใหม่กว่า จะได้ชุดเดิมซ้ำ

2. **Observer ไม่ยิง**  
   Sentinel ต้องอยู่ใน scroll container เดียวกับ list และต้องมี `rootRef` ชี้ไปที่ container นั้น

3. **toAdd = 0 ตลอด**  
   ถ้า API คืนแถวเดิม (post_id ซ้ำ) การกรอง `existingPostIds` จะทำให้ toAdd เป็น 0 จึงไม่มีการต่อรายการ

4. **SQL ไม่รับ/ไม่ใช้ cursor**  
   ตรวจใน Supabase ว่าฟังก์ชัน `get_notifications_feed` รับ `p_after_created_at`, `p_after_id` และใช้ในเงื่อนไข `(created_at, id) < (p_after_created_at, p_after_id)` จริง

---

ปิด debug เมื่อตรวจเสร็จ:

```js
window.__NOTIFICATION_LOADMORE_DEBUG = false
```

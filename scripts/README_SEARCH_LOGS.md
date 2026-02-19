# Search logs – แก้ error constraint

ถ้าเจอ Console error:

```text
Error logging search to Supabase: "new row for relation \"search_logs\" violates check constraint \"search_logs_search_type_check\""
```

แปลว่า database ยังไม่อนุญาตค่า `search_type = 'history'`

## วิธีแก้ (ทำครั้งเดียว)

1. เปิด **Supabase Dashboard** → โปรเจกต์ที่ใช้กับแอปนี้
2. เมนูซ้ายเลือก **SQL Editor**
3. กด **New query**
4. เปิดไฟล์ `scripts/search_logs_add_history_type.sql` แล้ว copy เนื้อหาทั้งหมดไปวางใน SQL Editor
5. กด **Run** (หรือ Ctrl/Cmd + Enter)
6. ตรวจว่าไม่มี error ในผลลัพธ์

หลังรันแล้ว ลองกดค้นจากประวัติการค้นหาอีกครั้ง error ควรหายไป

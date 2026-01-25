# 🔍 Shared Code Analysis Report

## 📋 สรุปส่วนที่ยังสามารถใช้ Shared Code ได้อีก

### 🚨 Priority 1: สำคัญมาก (Duplicate Code ที่มีเยอะ)

#### 1. **app/notification/[id]/page.tsx** 
**ปัญหา:**
- ❌ มี duplicate `getOnlineStatus` function (มีแล้วใน `utils/postUtils`)
- ❌ มี duplicate `formatTime` function (มีแล้วใน `utils/postUtils`)
- ❌ มี duplicate `PhotoGrid` component (มีแล้วใน `components/PhotoGrid.tsx`)
- ❌ มี duplicate `downloadImage` function (มีแล้วใน `useFullScreenViewer` hook)
- ❌ มี duplicate `onTouchStart`, `onTouchEnd` handlers (มีแล้วใน `useFullScreenViewer` hook)
- ❌ ไม่ได้ใช้ shared hooks (`useViewingPost`, `useFullScreenViewer`, `useMenu`)
- ❌ Custom viewing post modal แทนที่จะใช้ `ViewingPostModal` component

**แนะนำ:**
- ใช้ `formatTime`, `getOnlineStatus` จาก `utils/postUtils`
- ใช้ `PhotoGrid` จาก `components/PhotoGrid.tsx`
- ใช้ `useViewingPost`, `useFullScreenViewer`, `useMenu` hooks
- ใช้ `ViewingPostModal` และ `FullScreenImageViewer` components

---

#### 2. **Loading Spinner CSS Animation (Duplicate ในหลายไฟล์)**
**ไฟล์ที่มี duplicate:**
- `app/notification/[id]/page.tsx` (lines 178-189)
- `app/admin/post/page.tsx` (lines 116-127)
- `app/admin/revenue/page.tsx` (lines 105-116)
- `app/admin/overview/page.tsx` (อาจมี)
- และอื่นๆ

**แนะนำ:**
- สร้าง `components/LoadingSpinner.tsx` ที่มี CSS animation อยู่แล้ว (มีอยู่แล้ว แต่บางไฟล์ยังใช้ inline styles)
- หรือสร้าง `styles/animations.css` สำหรับ shared animations

---

#### 3. **Admin Filter UI Component (D/W/M/Y/A Filter)**
**ไฟล์ที่มี duplicate filter UI:**
- `app/admin/post/page.tsx` (lines 78-98)
- `app/admin/visitor/page.tsx` (lines 101-122)
- `app/admin/overview/page.tsx` (lines 143-150)

**แนะนำ:**
- สร้าง `components/admin/TimeFilter.tsx` component
- Props: `filter`, `onFilterChange`, `options` (default: ['D', 'W', 'M', 'Y', 'A'])

---

#### 4. **PhotoPreviewGrid Component (Duplicate ใน create/edit post)**
**ไฟล์ที่มี duplicate:**
- `app/create-post/page.tsx` (มี PhotoPreviewGrid logic)
- `app/edit-post/[id]/page.tsx` (lines 91-110, PhotoPreviewGrid component)

**แนะนำ:**
- สร้าง `components/PhotoPreviewGrid.tsx` component
- รองรับทั้ง existing images และ new previews
- รองรับการลบรูป (removeImage callback)

---

#### 5. **Profile Fetching Logic (Duplicate ในหลายไฟล์)**
**ไฟล์ที่มี duplicate profile fetching:**
- `app/create-post/page.tsx` (lines 28-46)
- `app/edit-post/[id]/page.tsx` (lines 48-54)
- `app/profile/edit-profile/page.tsx` (lines 115-127)
- และอื่นๆ

**แนะนำ:**
- สร้าง `hooks/useProfile.ts` hook
- Returns: `{ profile, loading, error, refetch }`
- Auto-fetch profile จาก session

---

### ⚠️ Priority 2: สำคัญปานกลาง

#### 6. **Admin Card Styles (Duplicate ในหลาย admin pages)**
**ไฟล์ที่มี duplicate card styles:**
- `app/admin/activity/page.tsx` (cardStyle, labelStyle, valueStyle)
- `app/admin/overview/page.tsx` (cardStyle, labelStyle, valueStyle)
- `app/admin/visitor/page.tsx` (cardStyle)

**แนะนำ:**
- สร้าง `components/admin/StatCard.tsx` component
- หรือสร้าง `styles/admin.css` สำหรับ shared admin styles

---

#### 7. **Date Filter Logic (Duplicate ในหลาย admin pages)**
**ไฟล์ที่มี duplicate date filter logic:**
- `app/admin/post/page.tsx` (lines 26-40)
- `app/admin/visitor/page.tsx` (lines 30-33)
- `app/admin/overview/page.tsx` (lines 36-39)

**แนะนำ:**
- สร้าง `utils/dateFilter.ts` utility
- Function: `getDateRange(filter: 'D' | 'W' | 'M' | 'Y' | 'A') => { startDate, endDate }`

---

#### 8. **Currency Formatting (Duplicate ใน revenue page)**
**ไฟล์:**
- `app/admin/revenue/page.tsx` (formatCurrency function, line 50-52)

**แนะนำ:**
- สร้าง `utils/currency.ts` utility
- Function: `formatCurrency(amount: number, currency: string = 'ກີບ') => string`

---

### 📝 Priority 3: ปรับปรุงเพิ่มเติม

#### 9. **isPostOwner Logic (Duplicate ในหลายไฟล์)**
**ไฟล์ที่มี duplicate:**
- `app/notification/[id]/page.tsx` (lines 119-123)
- อาจมีในไฟล์อื่นๆ

**แนะนำ:**
- ใช้ `isPostOwner` จาก `utils/postUtils` (มีอยู่แล้ว)

---

#### 10. **Supabase Client Creation (Duplicate ใน admin pages)**
**ไฟล์ที่มี duplicate:**
- ทุก admin page ใช้ `createBrowserClient` แบบเดียวกัน

**แนะนำ:**
- สร้าง `utils/supabase/adminClient.ts` สำหรับ admin client
- หรือใช้ shared client จาก `lib/supabase.js`

---

## 📊 สรุปสถิติ

- **Duplicate Functions:** 8+ functions
- **Duplicate Components:** 3+ components  
- **Duplicate Styles:** 5+ style blocks
- **Duplicate Logic:** 4+ logic patterns

## ✅ Action Items

1. ✅ Refactor `app/notification/[id]/page.tsx` - ใช้ shared components/hooks
2. ✅ สร้าง `components/admin/TimeFilter.tsx`
3. ✅ สร้าง `components/PhotoPreviewGrid.tsx`
4. ✅ สร้าง `hooks/useProfile.ts`
5. ✅ สร้าง `utils/dateFilter.ts`
6. ✅ สร้าง `utils/currency.ts`
7. ✅ สร้าง `components/admin/StatCard.tsx` (optional)
8. ✅ แก้ไข loading spinner ให้ใช้ shared component

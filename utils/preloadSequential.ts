'use client'

/**
 * Sequentially append items into a list-like state.
 *
 * ใช้สำหรับ feed ที่ต้องการให้โพสต์ / ไอเท็ม
 * ถูกเติมเข้า UI ทีละรายการ (แทนที่จะโผล่มาหลายรายการพร้อมกัน)
 * แต่ยังสามารถดึงข้อมูลจาก backend เป็นชุดได้ตามปกติ
 */
export function sequentialAppendItems<T>(options: {
  items: T[];
  append: (item: T) => void;
  onDone?: () => void;
  /** ถ้า return false จะหยุด append ทันที (เช่น คำค้นเปลี่ยนไปแล้ว) */
  shouldContinue?: () => boolean;
}) {
  const { items, append, onDone, shouldContinue } = options;

  if (!items || items.length === 0) {
    if (onDone) onDone();
    return;
  }

  let index = 0;

  const step = () => {
    if (shouldContinue && !shouldContinue()) {
      if (onDone) onDone();
      return;
    }

    if (index >= items.length) {
      if (onDone) onDone();
      return;
    }

    append(items[index++]);

    if (index < items.length) {
      // ให้ browser มีโอกาส render เฟรมปัจจุบันก่อน แล้วค่อย append รายการถัดไป
      requestAnimationFrame(step);
    } else if (onDone) {
      requestAnimationFrame(onDone);
    }
  };

  // เริ่มต้นในเฟรมถัดไปเพื่อไม่บล็อคงานอื่น
  requestAnimationFrame(step);
}

/**
 * Sequentially increase a numeric state (เช่น visibleCount) ทีละ 1
 * จนครบจำนวน step ที่ต้องการ หรือจนถึง limit สูงสุด
 *
 * ใช้กับ feed ที่ใช้ pattern "visibleCount + InfiniteScroll"
 * เช่น Notification list หรือ Viewing mode (ภาพหลายใบ)
 */
export function sequentialIncreaseCount(options: {
  /** จำนวนก้าวสูงสุดที่ต้องเพิ่มในรอบนี้ (เช่น 3 โพสต์ล่วงหน้า) */
  maxSteps: number;
  /** setter ของ state: setState(prev => next) */
  setValue: (updater: (prev: number) => number) => void;
  /** ส่งค่าจำนวนสูงสุดที่อนุญาต (เช่น ความยาว array ปัจจุบัน) */
  getLimit: () => number;
  onDone?: () => void;
}) {
  const { maxSteps, setValue, getLimit, onDone } = options;

  if (maxSteps <= 0) {
    if (onDone) onDone();
    return;
  }

  let stepsLeft = maxSteps;

  const step = () => {
    const limit = getLimit();

    if (stepsLeft <= 0 || limit <= 0) {
      if (onDone) onDone();
      return;
    }

    let reachedLimit = false;

    setValue((prev) => {
      if (prev >= limit) {
        reachedLimit = true;
        return prev;
      }
      stepsLeft -= 1;
      const next = prev + 1;
      if (next >= limit) {
        reachedLimit = true;
        return limit;
      }
      return next;
    });

    if (stepsLeft > 0 && !reachedLimit) {
      requestAnimationFrame(step);
    } else if (onDone) {
      requestAnimationFrame(onDone);
    }
  };

  requestAnimationFrame(step);
}


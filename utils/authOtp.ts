import { supabase } from '@/lib/supabase'

/**
 * ส่ง OTP ไปอีเมล — ใช้ร่วมกันทั้งหน้าลงทะเบียนและหน้าเข้าสู่ระบบ
 * @param email อีเมลปลายทาง
 * @param shouldCreateUser true = ลงทะเบียน (สร้าง user ใหม่ได้), false = เข้าสู่ระบบ (เฉพาะบัญชีที่มีอยู่)
 */
export async function sendOtpToEmail(
  email: string,
  shouldCreateUser: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser },
  })
  if (error) {
    if (error.message === 'Signups not allowed for otp') {
      return { error: 'ອີເມລນີ້ຍັງບໍ່ເຄີຍລົງທະບຽນ ກະລຸນາໄປໜ້າສ້າງບັນຊີໃໝ່' }
    }
    return { error: error.message || 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້' }
  }
  return { error: null }
}

/**
 * ยืนยัน OTP — เรียก Supabase แล้วคืนค่า data/error ให้ caller จัดการต่อ (redirect / save account ฯลฯ)
 */
export async function verifyOtpEmail(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  })
}

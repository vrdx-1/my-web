import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Shared Hooks
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
import { REGISTER_PATH } from '@/utils/authRoutes';

export function useEditProfilePage() {
  const router = useRouter();

  // Profile States
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, phone, last_seen')
      .eq('id', uid)
      .single();
    if (data) {
      setUsername(data.username || '');
      const rawAvatar = data.avatar_url || '';
      if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
        setAvatarUrl('');
      } else {
        setAvatarUrl(getDisplayAvatarUrl(rawAvatar) || '');
      }
      setPhone(data.phone || '');
    }
  }, []);


  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (cancelled) return;
      if (currentSession) {
        const uid = currentSession.user.id;
        userIdRef.current = uid;
        setUserId(uid);
        fetchProfile(uid);
      } else {
        router.push(REGISTER_PATH);
      }
    });
    return () => { cancelled = true; };
  }, [router, fetchProfile]);

  const uploadAvatar = useCallback(async (event: any) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    const file = event?.target?.files?.[0];
    if (!file) return;
    const filePath = `avatars/${uid}-${Date.now()}`;
    await supabase.storage.from('car-images').upload(filePath, file);
    const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(filePath);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid);
    setAvatarUrl(publicUrl);
  }, [userId]);

  const saveUsername = useCallback(async (name: string) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('profiles').update({ username: name }).eq('id', uid);
    if (!error) {
      setUsername(name);
      setIsEditingName(false);
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    }
  }, [userId]);

  const savePhone = useCallback(async (phoneNum: string) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('profiles').update({ phone: phoneNum }).eq('id', uid);
    if (!error) {
      setPhone(phoneNum);
      setIsEditingPhone(false);
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    }
  }, [userId]);


  // Lock background scroll while edit-name / edit-phone is open
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const shouldLock = isEditingName || isEditingPhone;
    
    if (shouldLock) {
      // บันทึกตำแหน่ง scroll ปัจจุบัน
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // ล็อก scroll ทั้ง body และ html
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      
      // ป้องกัน touch events และ wheel events
      const preventDefault = (e: TouchEvent | WheelEvent) => {
        e.preventDefault();
      };
      
      const preventDefaultPassive = (e: TouchEvent) => {
        e.preventDefault();
      };
      
      // เพิ่ม event listeners เพื่อป้องกัน scroll
      document.addEventListener('touchmove', preventDefaultPassive, { passive: false });
      document.addEventListener('touchstart', preventDefaultPassive, { passive: false });
      document.addEventListener('wheel', preventDefault, { passive: false });
      document.addEventListener('scroll', preventDefault, { passive: false });
      
      return () => {
        // ลบ event listeners
        document.removeEventListener('touchmove', preventDefaultPassive);
        document.removeEventListener('touchstart', preventDefaultPassive);
        document.removeEventListener('wheel', preventDefault);
        document.removeEventListener('scroll', preventDefault);
        
        // ปลดล็อก scroll และคืนตำแหน่ง scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.documentElement.style.overflow = '';
        
        // คืนตำแหน่ง scroll
        window.scrollTo(scrollX, scrollY);
      };
    } else {
      // ปลดล็อก scroll เมื่อไม่ต้องล็อก
      const scrollY = document.body.style.top ? parseInt(document.body.style.top.replace('px', '')) * -1 : 0;
      const scrollX = document.body.style.left ? parseInt(document.body.style.left.replace('px', '')) * -1 : 0;
      
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      
      if (scrollY !== 0 || scrollX !== 0) {
        window.scrollTo(scrollX, scrollY);
      }
    }
  }, [isEditingName, isEditingPhone]);

  const handleEditNameClick = useCallback(() => {
    setEditingUsername(username);
    setIsEditingName(true);
  }, [username]);

  const handleEditPhoneClick = useCallback(() => {
    const initialPhone = phone && phone.startsWith('020') ? phone : '020';
    setEditingPhone(initialPhone);
    setIsEditingPhone(true);
  }, [phone]);

  const handleCancelPhoneEdit = useCallback(() => {
    setIsEditingPhone(false);
    const initialPhone = phone && phone.startsWith('020') ? phone : '020';
    setEditingPhone(initialPhone);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }, [phone]);

  const handleCloseNameModal = useCallback(() => {
    setIsEditingName(false);
    setEditingUsername(username);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }, [username]);

  const handleSaveUsername = useCallback((name: string) => {
    if (name.trim().length >= 1) saveUsername(name.trim());
  }, [saveUsername]);

  const handleSavePhone = useCallback((phoneNum: string) => {
    if (phoneNum === '020' || (phoneNum.startsWith('020') && phoneNum.length === 11)) savePhone(phoneNum);
  }, [savePhone]);

  return {
    // profile
    username,
    phone,
    avatarUrl,
    isEditingName,
    isEditingPhone,
    editingUsername,
    editingPhone,
    setEditingUsername,
    setEditingPhone,

    // ui handlers
    uploadAvatar,
    handleEditNameClick,
    handleEditPhoneClick,
    handleCancelPhoneEdit,
    handleCloseNameModal,
    handleSaveUsername,
    handleSavePhone,
  };
}


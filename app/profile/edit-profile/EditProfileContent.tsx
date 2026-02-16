'use client'
import { useRouter } from 'next/navigation';

// Shared Components
import { PageHeader } from '@/components/PageHeader';
import {
  EditNameModal,
  EditPhoneModal,
  ProfileSection,
} from './EditProfileSections';
import { useEditProfilePage } from './useEditProfilePage';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export function EditProfileContent() {
 const router = useRouter();
 const {
   username,
   phone,
   avatarUrl,
   isEditingName,
   isEditingPhone,
   editingUsername,
  editingPhone,
  setEditingUsername,
  setEditingPhone,
  uploadAvatar,
   handleEditNameClick,
   handleEditPhoneClick,
   handleCancelPhoneEdit,
   handleCloseNameModal,
   handleSaveUsername,
   handleSavePhone,
 } = useEditProfilePage();

 return (
 <main 
   style={{
     ...LAYOUT_CONSTANTS.MAIN_CONTAINER,
     ...((isEditingName || isEditingPhone) && {
       overflow: 'hidden',
       touchAction: 'none',
       overscrollBehavior: 'contain',
     }),
   }}
   onTouchMove={(e) => {
     if (isEditingName || isEditingPhone) {
       e.preventDefault();
       e.stopPropagation();
     }
   }}
   onWheel={(e) => {
     if (isEditingName || isEditingPhone) {
       e.preventDefault();
       e.stopPropagation();
     }
   }}
 >

 {/* Header */}
 <PageHeader title="ໂປຣໄຟລ໌" centerTitle onBack={() => { if (typeof window !== 'undefined') sessionStorage.setItem('profileNoSlide', '1'); router.push('/profile'); }} />

 {/* Overlay when editing name or phone - คลุมทั้งจอ ส่วนอื่น dim และล็อก scroll */}
 {(isEditingName || isEditingPhone) && (
<div
 role="button"
 tabIndex={0}
 onClick={(e) => {
   e.stopPropagation();
   if (isEditingName) handleCloseNameModal();
   if (isEditingPhone) handleCancelPhoneEdit();
 }}
 onTouchStart={(e) => {
   e.stopPropagation();
   e.preventDefault();
 }}
 onTouchMove={(e) => {
   e.stopPropagation();
   e.preventDefault();
 }}
 onTouchEnd={(e) => {
   e.stopPropagation();
 }}
 onWheel={(e) => {
   e.preventDefault();
   e.stopPropagation();
 }}
 style={{ 
   position: 'fixed', 
   inset: 0, 
   background: 'rgba(0,0,0,0.4)', 
   zIndex: 999, 
   cursor: 'pointer',
   touchAction: 'none',
   overscrollBehavior: 'contain',
   overflow: 'hidden',
 } }
 aria-label="ปิด"
 />
 )}

 {/* Modal ชื่อเท่านั้น - ชัดเจนเฉพาะชื่อ (ไม่บันทึก = ใช้ค่าเดิม) */}
 <EditNameModal
   isOpen={isEditingName}
   editingUsername={editingUsername}
   setEditingUsername={setEditingUsername}
   onClose={handleCloseNameModal}
   onSave={handleSaveUsername}
 />

 {/* Modal เบอร์เท่านั้น - ชัดเจนเฉพาะเบอร์ (ไม่บันทึก = ใช้ค่าเดิม) */}
 <EditPhoneModal
   isOpen={isEditingPhone}
   editingPhone={editingPhone}
   setEditingPhone={setEditingPhone}
   onCancel={handleCancelPhoneEdit}
   onSave={handleSavePhone}
 />

 {/* Profile Section */}
 <ProfileSection
   avatarUrl={avatarUrl}
   username={username}
   phone={phone}
   onAvatarChange={uploadAvatar}
   onEditNameClick={handleEditNameClick}
   onEditPhoneClick={handleEditPhoneClick}
 />
 </main>
 );
}


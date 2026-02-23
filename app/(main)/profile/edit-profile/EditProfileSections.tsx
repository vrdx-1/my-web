import { memo } from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

const MODAL_BOX = {
  position: 'fixed' as const,
  top: '15%',
  left: '50%',
  transform: 'translate(-50%, 0)',
  zIndex: 1001,
  background: '#ffffff',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  minWidth: '280px',
  maxWidth: '90vw',
};

const ROW_GAP = { display: 'flex' as const, justifyContent: 'space-between', gap: '10px' };
const BTN_CANCEL = {
  flex: 1,
  padding: '8px 12px',
  background: '#e4e6eb',
  color: '#1c1e21',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold' as const,
  fontSize: '14px',
  cursor: 'pointer' as const,
};

function isPhoneValid(phone: string): boolean {
  return phone === '020' || (phone.startsWith('020') && phone.length === 11);
}

type EditNameModalProps = {
  isOpen: boolean;
  editingUsername: string;
  setEditingUsername: (value: string) => void;
  onClose: () => void;
  onSave: (name: string) => void;
};

const EditNameModalComponent = ({
  isOpen,
  editingUsername,
  setEditingUsername,
  onClose,
  onSave,
}: EditNameModalProps) => {
  if (!isOpen) return null;
  const canSave = editingUsername.trim().length >= 1;

  return (
    <div onClick={e => e.stopPropagation()} style={MODAL_BOX}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          value={editingUsername}
          maxLength={36}
          onChange={e => setEditingUsername(e.target.value.slice(0, 36))}
          onPaste={e => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text').slice(0, 36);
            setEditingUsername((editingUsername + pastedText).slice(0, 36));
          }}
          autoFocus
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            border: 'none',
            borderBottom: '2px solid #1877f2',
            outline: 'none',
            flex: 1,
            minWidth: 0,
            padding: '4px 0',
          }}
        />
        <div style={ROW_GAP}>
          <button type="button" onClick={onClose} style={BTN_CANCEL}>
            ຍົກເລີກ
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => canSave && onSave(editingUsername.trim())}
            style={{
              ...BTN_CANCEL,
              background: canSave ? '#1877f2' : '#e4e6eb',
              color: canSave ? '#fff' : '#5c5c5c',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            ບັນທຶກ
          </button>
        </div>
      </div>
    </div>
  );
};

export const EditNameModal = memo(EditNameModalComponent);

type EditPhoneModalProps = {
  isOpen: boolean;
  editingPhone: string;
  setEditingPhone: (value: string) => void;
  onCancel: () => void;
  onSave: (phone: string) => void;
};

const EditPhoneModalComponent = ({
  isOpen,
  editingPhone,
  setEditingPhone,
  onCancel,
  onSave,
}: EditPhoneModalProps) => {
  if (!isOpen) return null;
  const valid = isPhoneValid(editingPhone);

  return (
    <div onClick={e => e.stopPropagation()} style={MODAL_BOX}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          autoComplete="tel"
          value={editingPhone}
          onChange={e => {
            const rawValue = e.target.value;
            const inputValue = rawValue.replace(/\D/g, '');
            if (inputValue.length === 0 || inputValue.length < 3) {
              setEditingPhone('020');
            } else if (!inputValue.startsWith('020')) {
              const rest = inputValue.length >= 3 ? inputValue.slice(3).slice(0, 8) : inputValue.slice(0, 8);
              setEditingPhone('020' + rest);
            } else if (inputValue.length <= 11) {
              setEditingPhone(inputValue);
            }
          }}
          autoFocus
          placeholder="ເບີ WhatsApp"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid #ddd',
            outline: 'none',
            fontSize: '16px',
            color: '#111111',
          }}
        />
        <div style={ROW_GAP}>
          <button type="button" onClick={onCancel} style={BTN_CANCEL}>
            ຍົກເລີກ
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onSave(editingPhone)}
            style={{
              ...BTN_CANCEL,
              background: valid ? '#1877f2' : '#e4e6eb',
              color: valid ? '#fff' : '#5c5c5c',
              cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            ບັນທຶກ
          </button>
        </div>
      </div>
    </div>
  );
};

export const EditPhoneModal = memo(EditPhoneModalComponent);

type ProfileSectionProps = {
  avatarUrl: string;
  username: string;
  phone: string;
  onAvatarChange: (event: any) => void;
  onEditNameClick: () => void;
  onEditPhoneClick: () => void;
};

const ProfileSectionComponent = ({
  avatarUrl,
  username,
  phone,
  onAvatarChange,
  onEditNameClick,
  onEditPhoneClick,
}: ProfileSectionProps) => (
  <div style={{ padding: '20px', borderBottom: '1px solid #6b6b6b' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
      <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#f0f2f5',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f0f2f5',
                width: '100%',
              }}
            >
              <GuestAvatarIcon size={50} />
            </div>
          )}
        </div>
        <label
          htmlFor="avatar-up"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            background: '#e4e6eb',
            borderRadius: '50%',
            padding: 5,
            width: 28,
            height: 28,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <input id="avatar-up" type="file" hidden onChange={onAvatarChange} accept="image/*" />
        </label>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
              color: '#1c1e21',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {username || 'ຊື່ຜູ້ໃຊ້'}
          </h2>
          <button
            type="button"
            onClick={onEditNameClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 5,
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              touchAction: 'manipulation',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onEditPhoneClick}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              background: '#ffffff',
              backgroundColor: '#ffffff',
              outline: 'none',
              fontSize: '16px',
              textAlign: 'left',
              color: phone && phone !== '020' ? '#1c1e21' : '#5c5c5c',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {phone && phone !== '020' ? phone : 'ເບີ WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const ProfileSection = memo(ProfileSectionComponent);

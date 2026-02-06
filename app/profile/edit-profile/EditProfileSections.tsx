import { memo } from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

type EditNameModalProps = {
  isOpen: boolean;
  editingUsername: string;
  username: string;
  setEditingUsername: (value: string) => void;
  onClose: () => void;
  onSave: (name: string) => void;
};

const EditNameModalComponent = ({
  isOpen,
  editingUsername,
  username,
  setEditingUsername,
  onClose,
  onSave,
}: EditNameModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: '280px',
        maxWidth: '90vw',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          value={editingUsername}
          maxLength={36}
          onChange={e => setEditingUsername(e.target.value.slice(0, 36))}
          onPaste={e => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text').slice(0, 36);
            const newValue = (editingUsername + pastedText).slice(0, 36);
            setEditingUsername(newValue);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#e4e6eb',
              color: '#1c1e21',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            disabled={editingUsername.trim().length < 1}
            onClick={() => {
              if (editingUsername.trim().length >= 1) {
                onSave(editingUsername.trim());
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: editingUsername.trim().length >= 1 ? '#1877f2' : '#e4e6eb',
              color: editingUsername.trim().length >= 1 ? '#fff' : '#5c5c5c',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: editingUsername.trim().length >= 1 ? 'pointer' : 'not-allowed',
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
  phone: string;
  setEditingPhone: (value: string) => void;
  onCancel: () => void;
  onSave: (phone: string) => void;
  showPhoneCharWarning: boolean;
  setShowPhoneCharWarning: (value: boolean) => void;
};

const EditPhoneModalComponent = ({
  isOpen,
  editingPhone,
  phone,
  setEditingPhone,
  onCancel,
  onSave,
  showPhoneCharWarning,
  setShowPhoneCharWarning,
}: EditPhoneModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: '280px',
        maxWidth: '90vw',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          autoComplete="tel"
          value={editingPhone}
          onChange={e => {
            const rawValue = e.target.value;
            const hasNonDigit = /[^\d]/.test(rawValue);
            const inputValue = rawValue.replace(/\D/g, '');

            if (hasNonDigit && !showPhoneCharWarning) {
              setShowPhoneCharWarning(true);
            }

            if (inputValue.length === 0 || inputValue.length < 3) {
              setEditingPhone('020');
            } else if (!inputValue.startsWith('020')) {
              const remainingDigits =
                inputValue.length >= 3 ? inputValue.slice(3).slice(0, 8) : inputValue.slice(0, 8);
              setEditingPhone('020' + remainingDigits);
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
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#e4e6eb',
              color: '#1c1e21',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            disabled={
              !(
                editingPhone === '020' ||
                (editingPhone.startsWith('020') && editingPhone.length === 11)
              )
            }
            onClick={() => {
              if (
                editingPhone === '020' ||
                (editingPhone.startsWith('020') && editingPhone.length === 11)
              ) {
                onSave(editingPhone);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background:
                editingPhone === '020' ||
                (editingPhone.startsWith('020') && editingPhone.length === 11)
                  ? '#1877f2'
                  : '#e4e6eb',
              color:
                editingPhone === '020' ||
                (editingPhone.startsWith('020') && editingPhone.length === 11)
                  ? '#fff'
                  : '#5c5c5c',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor:
                editingPhone === '020' ||
                (editingPhone.startsWith('020') && editingPhone.length === 11)
                  ? 'pointer'
                  : 'not-allowed',
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
  <div style={{ padding: '20px' }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '20px',
        marginBottom: '20px',
      }}
    >
      <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#f0f2f5',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt=""
            />
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
            padding: '7px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="2"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <input id="avatar-up" type="file" hidden onChange={onAvatarChange} accept="image/*" />
        </label>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          minWidth: 0,
          paddingTop: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
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
            onClick={onEditNameClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', flexShrink: 0 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1c1e21"
              strokeWidth="2"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onEditPhoneClick}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              background: '#fff',
              outline: 'none',
              fontSize: '16px',
              textAlign: 'left',
              color: phone && phone !== '020' ? '#1c1e21' : '#5c5c5c',
              cursor: 'pointer',
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

type PhoneCharWarningPopupProps = {
  show: boolean;
  onClose: () => void;
};

const PhoneCharWarningPopupComponent = ({ show, onClose }: PhoneCharWarningPopupProps) => {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          ສຳລັບຕົວເລກເທົ່ານັ້ນ
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: '#1877f2',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ຕົກລົງ
        </button>
      </div>
    </div>
  );
};

export const PhoneCharWarningPopup = memo(PhoneCharWarningPopupComponent);


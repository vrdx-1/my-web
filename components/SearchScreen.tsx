'use client'

import React, { useState, useEffect, useRef } from 'react';
import { LAO_FONT } from '@/utils/constants';

interface SearchScreenProps {
  isOpen: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}

interface RecentSearch {
  id: string;
  type: 'user' | 'query';
  name: string;
  avatar_url?: string;
  hasNew?: boolean;
  newCount?: number;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  isOpen,
  searchTerm,
  onSearchChange,
  onClose,
}) => {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('recent_searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading recent searches:', e);
        }
      }
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle Escape key to close search screen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Save search to recent searches
  const saveToRecentSearches = (term: string) => {
    if (!term.trim()) return;
    
    const newSearch: RecentSearch = {
      id: Date.now().toString(),
      type: 'query',
      name: term,
    };

    const updated = [newSearch, ...recentSearches.filter(s => s.name !== term)].slice(0, 20);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      saveToRecentSearches(searchTerm);
    }
  };

  const handleRecentClick = (search: RecentSearch) => {
    onSearchChange(search.name);
    saveToRecentSearches(search.name);
  };

  const handleRemoveRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s.id !== id);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: LAO_FONT,
      }}
    >
      {/* Header with Back Button and Search Input */}
      <div
        style={{
          padding: '12px 8px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {/* Back Button */}
        <button
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            touchAction: 'manipulation',
            padding: 0,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#f0f2f5',
              borderRadius: '20px',
              padding: '10px 18px',
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ຄົ້ນຫາ"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '16px',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#c2c2c2',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  marginLeft: '8px',
                  flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!searchTerm.trim()}
            style={{
              background: searchTerm.trim() ? '#1877f2' : '#e4e6eb',
              border: searchTerm.trim() ? '1px solid #1877f2' : '1px solid #e4e6eb',
              color: searchTerm.trim() ? '#fff' : '#8a8d91',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: searchTerm.trim() ? 'pointer' : 'not-allowed',
              padding: '8px 16px',
              borderRadius: '20px',
              flexShrink: 0,
              touchAction: 'manipulation',
              opacity: searchTerm.trim() ? 1 : 0.6,
            }}
          >
            ຄົ້ນຫາ
          </button>
        </form>
      </div>

      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Section Header */}
          <div
            style={{
              padding: '12px 15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '17px', color: '#000' }}>
              Recent
            </div>
            <button
              onClick={() => {
                // Handle "See all" - could show more recent searches
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#1877f2',
                fontSize: '15px',
                cursor: 'pointer',
                padding: 0,
                touchAction: 'manipulation',
              }}
            >
              See all
            </button>
          </div>

          {/* Recent Searches List */}
          <div>
            {recentSearches.map((search) => (
              <div
                key={search.id}
                onClick={() => handleRecentClick(search)}
                style={{
                  padding: '12px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Avatar/Icon */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: search.type === 'user' ? '#e4e6eb' : '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {search.type === 'user' && search.avatar_url ? (
                    <img
                      src={search.avatar_url}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#4a4d52"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  )}
                </div>

                {/* Name/Search Term */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      color: '#000',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {search.name}
                  </div>
                  {search.hasNew && search.newCount && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#1877f2',
                        marginTop: '2px',
                      }}
                    >
                      {search.newCount} new
                    </div>
                  )}
                </div>

                {/* Options Menu */}
                <button
                  onClick={(e) => handleRemoveRecent(search.id, e)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    touchAction: 'manipulation',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e4e6eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a4d52"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentSearches.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4a4d52',
            fontSize: '15px',
          }}
        >
          No recent searches
        </div>
      )}
    </div>
  );
};

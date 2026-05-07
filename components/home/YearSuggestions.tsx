'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './YearSuggestions.module.css';

interface YearSuggestionsProps {
  query: string;
  onSuggestionSelect: (suggestion: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const YearSuggestions: React.FC<YearSuggestionsProps> = ({
  query,
  onSuggestionSelect,
  isOpen,
  onClose,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/posts/search/suggestions?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setHoveredIndex(-1);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the fetch request
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionSelect(suggestion);
    setSuggestions([]);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHoveredIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHoveredIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (hoveredIndex >= 0 && hoveredIndex < suggestions.length) {
          handleSuggestionClick(suggestions[hoveredIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  if (!isOpen || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.suggestionsContainer} ref={containerRef}>
      <div className={styles.suggestionsList}>
        {loading ? (
          <div className={styles.suggestionsLoading}>
            <span>กำลังโหลด...</span>
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion}-${index}`}
              className={`${styles.suggestionItem} ${hoveredIndex === index ? styles.hovered : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(-1)}
            >
              <span className={styles.suggestionText}>{suggestion}</span>
              <span className={styles.suggestionIcon}>🔍</span>
            </div>
          ))
        ) : (
          <div className={styles.noSuggestions}>
            <span>ไม่พบข้อเสนอแนะ</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default YearSuggestions;

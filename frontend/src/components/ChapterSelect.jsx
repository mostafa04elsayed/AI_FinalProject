import React, { useState, useRef, useEffect } from 'react';

export default function ChapterSelect({ chapters, selectedChapters, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  if (!chapters || chapters.length === 0) return null;

  const toggleChapter = (ch) => {
    const isSelected = selectedChapters.some(s => s.chapter_title === ch.chapter_title);
    if (isSelected) {
      onChange(selectedChapters.filter(s => s.chapter_title !== ch.chapter_title));
    } else {
      onChange([...selectedChapters, ch]);
    }
  };

  const isAllSelected = selectedChapters.length === 0;

  return (
    <div className="field" ref={dropdownRef} style={{ position: 'relative' }}>
      <label>Target Chapters</label>
      
      <button 
        type="button"
        className="dropdown-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{isAllSelected ? "📚 All Indexed Content" : `🎯 ${selectedChapters.length} chapter(s) selected`}</span>
        <span style={{ fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="multi-select-box dropdown-menu">
          {chapters.map((ch, idx) => (
            <label key={idx} className="ms-option">
              <input 
                type="checkbox" 
                checked={selectedChapters.some(s => s.chapter_title === ch.chapter_title)}
                onChange={() => toggleChapter(ch)}
              />
              <span className="ms-option-text">[{ch.file_name}] {ch.chapter_title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

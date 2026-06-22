import React from 'react';

export default function ChapterSelect({ chapters, selectedChapters, onChange }) {
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
    <div className="field">
      <label>Target Chapters (leave unselected for All Chapters)</label>
      <div className="multi-select-box">
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
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
        {isAllSelected ? "📚 Searching All Indexed Content" : `🎯 Selected ${selectedChapters.length} target chapter(s)`}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ChapterSelect from '../components/ChapterSelect';
import { exportToPdf, buildHeader, buildAnswerKeyHeader, buildSectionTitle } from '../utils/exportPdf';

export default function ExamPage() {
  const { projectId, triggerStamp, chapters } = useApp();
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [content, setContent]   = useState('');
  const [difficulty, setDiff]   = useState('medium');
  const [numMcq, setNumMcq]     = useState(3);
  const [numWritten, setNumW]   = useState(2);
  const [exam, setExam]         = useState(null);
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const generate = async () => {
    if (!content.trim() && selectedChapters.length === 0) return;
    setLoading(true); setMsg(null); setExam(null); setRevealed({});
    try {
      const payload = {
        difficulty,
        num_mcq: numMcq,
        num_written: numWritten,
        content
      };

      if (selectedChapters.length > 0) {
        payload.chapters = selectedChapters.map(ch => ch.original_title || ch.chapter_title);
        payload.file_chapter_filters = selectedChapters.map(ch => ({ 
          chapter_title: ch.original_title || ch.chapter_title 
        }));
      }
      const res = await api.exam(projectId, payload);
      if (res.exam) {
        setExam(res.exam);
        triggerStamp('Exam Ready');
      } else {
        setMsg({ type: 'error', text: res.error || 'Unknown error from server.' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const reveal = (idx) => setRevealed(r => ({ ...r, [idx]: true }));

  const escHtml = (str) => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const handleExportPdf = () => {
    if (!exam) return;
    const target = selectedChapters.length > 0
      ? selectedChapters.map(c => c.chapter_title || c.original_title).join(', ')
      : 'All Indexed Content';

    const mcqs = exam.mcq_questions || [];
    const writtens = exam.written_questions || [];

    // --- Build MCQ Questions Section ---
    let mcqHtml = '';
    if (mcqs.length > 0) {
      mcqHtml += buildSectionTitle('Section A — Multiple Choice Questions');
      mcqs.forEach((q, i) => {
        const choices = q.choices || q.options || [];
        mcqHtml += `<div style="margin-bottom:18px; padding:14px 18px; background:#fafbfd; border:1px solid #e8e8ef; border-radius:8px; border-left:4px solid #6366f1;">`;
        mcqHtml += `<div style="font-size:9px; font-weight:700; color:#6366f1; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Question ${i + 1}</div>`;
        mcqHtml += `<div style="font-size:13px; font-weight:600; color:#1f2937; margin-bottom:12px; line-height:1.65;">${escHtml(q.question)}</div>`;
        choices.forEach((c, j) => {
          const label = String.fromCharCode(65 + j);
          const displayText = c.replace(/^(Option\s+)?[A-D][\.\\)]\s*/i, '');
          const bg = j % 2 === 0 ? '#f3f4f6' : '#eef2ff';
          mcqHtml += `<div style="margin-left:6px; padding:7px 14px; margin-bottom:5px; font-size:12.5px; color:#374151; background:${bg}; border-radius:5px; border:1px solid #e5e7eb;">${label}. ${escHtml(displayText)}</div>`;
        });
        mcqHtml += `</div>`;
      });
    }

    // --- Build Written Questions Section ---
    let writtenHtml = '';
    if (writtens.length > 0) {
      writtenHtml += buildSectionTitle('Section B — Written Questions');
      writtens.forEach((q, i) => {
        writtenHtml += `<div style="margin-bottom:18px; padding:14px 18px; background:#fafbfd; border:1px solid #e8e8ef; border-radius:8px; border-left:4px solid #6366f1;">
          <div style="font-size:9px; font-weight:700; color:#6366f1; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Question ${i + 1}</div>
          <div style="font-size:13px; font-weight:600; color:#1f2937; margin-bottom:12px; line-height:1.65;">${escHtml(q.question)}</div>
          <div style="margin-top:10px;">
            <div style="border-bottom:1px solid #d1d5db; height:26px;"></div>
            <div style="border-bottom:1px solid #d1d5db; height:26px;"></div>
            <div style="border-bottom:1px solid #d1d5db; height:26px;"></div>
            <div style="border-bottom:1px solid #d1d5db; height:26px;"></div>
            <div style="border-bottom:1px dashed #d1d5db; height:26px;"></div>
          </div>
        </div>`;
      });
    }

    // --- Build Answer Key ---
    let answerKeyHtml = '';
    if (mcqs.length > 0) {
      answerKeyHtml += buildSectionTitle('MCQ Answers');
      mcqs.forEach((q, i) => {
        const correctAnswer = q.correct_answer || q.answer || '';
        const explanation = q.answer_explanation || q.explanation || '';
        answerKeyHtml += `<div style="margin-bottom:12px; padding:12px 16px; border-radius:6px; background:#f0fdf4; border-left:4px solid #22c55e; border:1px solid #dcfce7;">
          <div style="font-weight:700; font-size:12.5px; color:#1f2937; margin-bottom:4px;">Q${i + 1}: ${escHtml(correctAnswer)}</div>
          ${explanation ? `<div style="font-size:11px; color:#6b7280; font-style:italic; margin-top:6px; padding-top:6px; border-top:1px dashed #d1d5db;">💡 ${escHtml(explanation)}</div>` : ''}
        </div>`;
      });
    }
    if (writtens.length > 0) {
      answerKeyHtml += buildSectionTitle('Written Answers (Model Reference)');
      writtens.forEach((q, i) => {
        answerKeyHtml += `<div style="margin-bottom:12px; padding:12px 16px; border-radius:6px; background:#eff6ff; border-left:4px solid #3b82f6; border:1px solid #dbeafe;">
          <div style="font-weight:700; font-size:12.5px; color:#1f2937; margin-bottom:4px;">Q${i + 1}:</div>
          <div style="font-size:12px; color:#374151; line-height:1.7;">${escHtml(q.answer)}</div>
        </div>`;
      });
    }

    const html = `
      ${buildHeader('UniAct — Auto-Generated Exam', `<strong>Project:</strong> ${escHtml(projectId)} &nbsp;&bull;&nbsp; <strong>Difficulty:</strong> ${(exam.difficulty || difficulty).toUpperCase()} &nbsp;&bull;&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}<br/><strong>Chapters:</strong> ${escHtml(target)}`)}
      ${mcqHtml}
      ${writtenHtml}
      <div style="page-break-before:always;"></div>
      ${buildAnswerKeyHeader()}
      ${answerKeyHtml}
    `;

    exportToPdf(html, 'Exam.pdf');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Exam Generator</h2>
        <p>Generate MCQ and written questions from indexed content.</p>
      </div>
      <div className="page-body">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div className="card">
          <div className="card-title">Exam Settings</div>
          <div className="field">
            <label>Topic / Content Query (Optional if Chapter selected)</label>
            <textarea rows={2} value={content} onChange={e => setContent(e.target.value)}
              placeholder="e.g. Explain neural networks" />
          </div>
          {chapters && chapters.length > 0 && (
            <ChapterSelect 
              chapters={chapters} 
              selectedChapters={selectedChapters} 
              onChange={setSelectedChapters} 
            />
          )}
          <div className="field-row">
            <div className="field">
              <label>Difficulty</label>
              <select value={difficulty} onChange={e => setDiff(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="field">
              <label>MCQ Questions — {numMcq}</label>
              <input type="range" min={1} max={20} value={numMcq}
                onChange={e => setNumMcq(+e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Written Questions — {numWritten}</label>
            <input type="range" min={0} max={20} value={numWritten}
              onChange={e => setNumW(+e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={generate} disabled={loading || (!content.trim() && selectedChapters.length === 0)}>
              {loading ? <><span className="spinner"/>&nbsp;Generating…</> : '📝 Generate Exam'}
            </button>
          </div>
        </div>

        {exam && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 15 }}>
              <button className="btn btn-ghost" style={{ fontSize: '0.9rem', padding: '6px 14px', border: '1px solid var(--border)' }} onClick={handleExportPdf}>
                📄 Export to PDF
              </button>
            </div>

            {(exam.mcq_questions || []).length > 0 && (
              <>
                <div className="section-label">MCQ Questions</div>
                {exam.mcq_questions.map((q, i) => {
                  // Normalize: model may use 'choices' or 'options', 'correct_answer' or 'answer'
                  const choices = q.choices || q.options || [];
                  const correctAnswer = q.correct_answer || q.answer || '';
                  const explanation = q.answer_explanation || q.explanation || '';

                  return (
                    <div className="exam-q" key={i}>
                      <div className="q-label">MCQ {i + 1} · {exam.difficulty || 'medium'}</div>
                      <div className="q-text">{q.question}</div>
                      {choices.map((c, j) => {
                        // Clean the option text from any prefixes the model might have added
                        const label = String.fromCharCode(65 + j);
                        const displayText = c.replace(/^(Option\s+)?[A-D][\.\\)]\s*/i, '');
                        
                        // Clean the correct answer string similarly to find the intended match
                        const cleanAnswer = correctAnswer.replace(/^(Option\s+)?[A-D][\.\\)]\s*/i, '').trim();
                        const justLetterMatch = correctAnswer.match(/^(?:Option\s+)?([A-D])/i);
                        const answerLetter = justLetterMatch ? justLetterMatch[1].toUpperCase() : null;

                        const isCorrect = revealed[`m${i}`] && (
                          c === correctAnswer ||
                          displayText === cleanAnswer ||
                          label === correctAnswer ||
                          label === answerLetter ||
                          c.includes(cleanAnswer) ||
                          cleanAnswer.includes(displayText)
                        );

                        return (
                          <div
                            key={j}
                            className={`choice-item${isCorrect ? ' correct' : ''}`}
                            onClick={() => reveal(`m${i}`)}
                          >
                            {label}. {displayText}
                          </div>
                        );
                      })}
                      {revealed[`m${i}`] && explanation && (
                        <div className="alert alert-info" style={{ marginTop: 8, fontSize: 12 }}>
                          💡 {explanation}
                        </div>
                      )}
                      {!revealed[`m${i}`] && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', marginTop: 8 }}
                          onClick={() => reveal(`m${i}`)}>Reveal Answer</button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {(exam.written_questions || []).length > 0 && (
              <>
                <div className="section-label">Written Questions</div>
                {exam.written_questions.map((q, i) => (
                  <div className="exam-q" key={i}>
                    <div className="q-label">Written {i + 1}</div>
                    <div className="q-text">{q.question}</div>
                    {revealed[`w${i}`]
                      ? <div className="result-box" style={{ marginTop: 10, fontSize: 13 }}>{q.answer}</div>
                      : <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', marginTop: 8 }}
                          onClick={() => reveal(`w${i}`)}>Show Model Answer</button>
                    }
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

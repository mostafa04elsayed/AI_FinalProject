import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ChapterSelect from '../components/ChapterSelect';

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

  return (
    <div>
      <div className="page-header">
        <h2>Exam Generator</h2>
        <p>Generate MCQ and written questions from indexed content.</p>
      </div>
      <div className="page-body">

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
              <input type="range" min={1} max={10} value={numMcq}
                onChange={e => setNumMcq(+e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Written Questions — {numWritten}</label>
            <input type="range" min={0} max={10} value={numWritten}
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
                        const displayText = c.replace(/^(Option\s+)?[A-D][\.\)]\s*/i, '');
                        
                        // Clean the correct answer string similarly to find the intended match
                        const cleanAnswer = correctAnswer.replace(/^(Option\s+)?[A-D][\.\)]\s*/i, '').trim();
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

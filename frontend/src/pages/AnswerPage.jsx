import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChapterSelect from '../components/ChapterSelect';

export default function AnswerPage() {
  const { projectId, triggerStamp, chapters } = useApp();
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [question, setQuestion] = useState('');
  const [limit, setLimit]       = useState(5);
  const [answer, setAnswer]     = useState(null);
  const [prompt, setPrompt]     = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true); setMsg(null); setAnswer(null); setPrompt(null);
    try {
      const payload = { text: question, limit };
      if (selectedChapters.length > 0) {
        payload.chapters = selectedChapters.map(ch => ch.original_title || ch.chapter_title);
        payload.file_chapter_filters = selectedChapters.map(ch => ({ 
          chapter_title: ch.original_title || ch.chapter_title 
        }));
      }
      setAnswer(''); // Start empty so cursor shows
      const res = await api.streamAnswer(projectId, payload, (token) => {
        setAnswer(prev => (prev || '') + token);
      });
      setPrompt(res.full_prompt);
      triggerStamp('Answered');
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>RAG Answer</h2>
        <p>Ask a question — the system retrieves context and generates an answer.</p>
      </div>
      <div className="page-body">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div className="card">
          <div className="card-title">Ask a Question</div>
          <div className="field">
            <label>Question</label>
            <textarea
              rows={3}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What is…?"
            />
          </div>
          {chapters && chapters.length > 0 && (
            <ChapterSelect 
              chapters={chapters} 
              selectedChapters={selectedChapters} 
              onChange={setSelectedChapters} 
            />
          )}
          <div className="field">
            <label>Context chunks — {limit}</label>
            <input type="range" min={1} max={20} value={limit}
              onChange={e => setLimit(+e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={ask} disabled={loading || !question.trim()}>
              {loading ? <><span className="spinner"/>&nbsp;Thinking…</> : '💬 Ask'}
            </button>
          </div>
        </div>

        {answer && (
          <>
            <div className="section-label">Answer</div>
            <div className="card" style={{ borderLeft: '3px solid var(--archive)' }}>
              <div className="result-box markdown-body" style={{ border: 'none', padding: 0, background: 'transparent' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                {loading && <span className="blinking-cursor">▌</span>}
              </div>
            </div>

            {prompt && (
              <>
                <div className="section-label" style={{ marginTop: 20 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => setShowPrompt(p => !p)}
                  >
                    {showPrompt ? '▲ Hide' : '▼ Show'} Full Prompt (debug)
                  </button>
                </div>
                {showPrompt && (
                  <div className="result-box" style={{ fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                    {prompt}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

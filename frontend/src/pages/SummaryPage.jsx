import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChapterSelect from '../components/ChapterSelect';
import { exportToPdf, markdownToHtml, buildHeader } from '../utils/exportPdf';

export default function SummaryPage() {
  const { projectId, triggerStamp, chapters } = useApp();
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [text, setText]     = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  const summarize = async () => {
    if (!text.trim() && selectedChapters.length === 0) return;
    setLoading(true); setMsg(null); setSummary(null);
    try {
      const payload = { content: text };
      if (selectedChapters.length > 0) {
        payload.chapters = selectedChapters.map(ch => ch.original_title || ch.chapter_title);
        payload.file_chapter_filters = selectedChapters.map(ch => ({ 
          chapter_title: ch.original_title || ch.chapter_title 
        }));
      }
      setSummary('');
      const res = await api.streamSummarize(projectId, payload, (token) => {
        setSummary(prev => (prev || '') + token);
      });
      if (!res.summary && res.message) {
        setSummary(res.message);
      }
      triggerStamp('Summarized');
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    const target = selectedChapters.length > 0
      ? selectedChapters.map(c => c.chapter_title || c.original_title).join(', ')
      : 'All Indexed Content';

    const html = `
      ${buildHeader('UniAct — Document Summary', `<strong>Project:</strong> ${projectId} &nbsp;&bull;&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}<br/><strong>Chapters:</strong> ${target}`)}
      <div style="margin-top:8px;">
        ${markdownToHtml(summary)}
      </div>
    `;
    exportToPdf(html, 'Summary.pdf');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Summarize</h2>
        <p>Paste long text and get a concise summary from the LLM.</p>
      </div>
      <div className="page-body">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div className="card">
          <div className="card-title">Summarize Context</div>
          {chapters && chapters.length > 0 && (
            <ChapterSelect 
              chapters={chapters} 
              selectedChapters={selectedChapters} 
              onChange={setSelectedChapters} 
            />
          )}
          <div className="field">
            <label>Specific Instructions or Text (Optional if Chapter selected)</label>
            <textarea rows={6} value={text} onChange={e => setText(e.target.value)}
              placeholder="e.g. Summarize the key findings..." />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={summarize} disabled={loading || (!text.trim() && selectedChapters.length === 0)}>
              {loading ? <><span className="spinner"/>&nbsp;Summarizing…</> : '📄 Summarize'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setText(''); setSummary(null); }}>
              Clear
            </button>
          </div>
        </div>

        {summary && (
          <>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Summary</span>
              {!loading && (
                <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={handleExportPdf}>
                  📄 Export to PDF
                </button>
              )}
            </div>
            <div className="card" style={{ borderLeft: '3px solid var(--archive)' }}>
              <div className="result-box markdown-body" style={{ border: 'none', padding: 0, background: 'transparent' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                {loading && <span className="blinking-cursor">▌</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

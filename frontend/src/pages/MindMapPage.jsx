import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ChapterSelect from '../components/ChapterSelect';
import mermaid from 'mermaid';
import { exportToPdf, buildHeader } from '../utils/exportPdf';

mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    primaryColor: '#eef2ff',
    primaryTextColor: '#1e1b4b',
    primaryBorderColor: '#8b5cf6',
    lineColor: '#6366f1',
    secondaryColor: '#f3e8ff',
    tertiaryColor: '#fff',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    nodeSpacing: 50,
    rankSpacing: 80
  }
});

export default function MindMapPage() {
  const { projectId, chapters } = useApp();
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [content, setContent] = useState('');
  const [mindmapCode, setMindmapCode] = useState(null);
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const mindmapRef = useRef(null);

  const generate = async () => {
    if (!content.trim() && selectedChapters.length === 0) return;
    setLoading(true); setMsg(null); setMindmapCode(null); setSvgContent(null);
    try {
      const payload = { content };
      if (selectedChapters.length > 0) {
        payload.chapters = selectedChapters.map(ch => ch.original_title || ch.chapter_title);
        payload.file_chapter_filters = selectedChapters.map(ch => ({ 
          chapter_title: ch.original_title || ch.chapter_title 
        }));
      }

      const res = await api.mindmap(projectId, payload);
      
      if (res.mindmap) {
        setMindmapCode(res.mindmap);
      } else {
        setMsg({ type: 'error', text: 'Failed to generate mind map data.' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Error connecting to the server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    let timer;

    if (mindmapCode && mindmapRef.current) {
      const renderMap = async () => {
        try {
          // Cleanup any previous mermaid error overlays
          const cleanupErrors = () => {
            document.querySelectorAll('[id^="d3-error"], [id^="mermaid-"]').forEach(el => el.remove());
          };
          cleanupErrors();

          // mermaid requires a unique id for every render
          const id = `mermaid-render-${Date.now()}`;
          let { svg } = await mermaid.render(id, mindmapCode);
          
          // Remove max-width so the graph renders at full readable size and scrolls horizontally
          svg = svg.replace(/max-width:\s*[\d.]+px;?/, 'max-width: none;');
          svg = svg.replace(/height:\s*[\d.]+px;?/, '');

          if (!isCancelled) {
            setSvgContent(svg);
            setMsg(null); // Clear any errors if it succeeds
          }
        } catch (err) {
          console.error("Mermaid parsing error:", err);
          document.querySelectorAll('[id^="d3-error"], [id^="mermaid-"]').forEach(el => el.remove());
          if (!isCancelled) {
            setMsg({ type: 'error', text: 'The AI generated invalid mind map syntax. Please try again.' });
          }
        }
      };

      // Debounce slightly to prevent React 18 Strict Mode from calling mermaid.render twice simultaneously
      timer = setTimeout(() => {
        if (!isCancelled) renderMap();
      }, 100);
    }

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mindmapCode]);

  const handleExportPdf = () => {
    if (!svgContent) return;
    const target = selectedChapters.length > 0
      ? selectedChapters.map(c => c.chapter_title || c.original_title).join(', ')
      : 'All Indexed Content';

    const html = `
      ${buildHeader('UniAct — Concept Mind Map', `<strong>Project:</strong> ${projectId} &nbsp;&bull;&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}<br/><strong>Chapters:</strong> ${target}`)}
      <div style="text-align:center; margin-top:24px; padding:16px; background:#fafbfd; border:1px solid #e8e8ef; border-radius:8px;">
        ${svgContent}
      </div>
    `;
    exportToPdf(html, 'MindMap.pdf');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Visual Mind Map</h2>
        <p>Extract a visual concept map from your documents to see how ideas connect.</p>
      </div>
      <div className="page-body">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div className="card">
          <div className="card-title">Generate Mind Map</div>
          {chapters && chapters.length > 0 && (
            <ChapterSelect 
              chapters={chapters} 
              selectedChapters={selectedChapters} 
              onChange={setSelectedChapters} 
            />
          )}
          <div className="field">
            <label>Specific Focus (Optional)</label>
            <input
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="e.g. Map out the different machine learning algorithms mentioned"
            />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={generate} disabled={loading || (!content.trim() && selectedChapters.length === 0)}>
              {loading ? <><span className="spinner"/>&nbsp;Generating…</> : '🗺️ Generate Map'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setContent(''); setMindmapCode(null); setSvgContent(null); }}>
              Clear
            </button>
          </div>
        </div>

        {loading && (
           <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
             <span className="spinner" style={{ borderTopColor: 'var(--accent-main)', width: 30, height: 30, borderWidth: 3 }} />
           </div>
        )}

        {svgContent && !loading && (
          <>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Your Mind Map</span>
              <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={handleExportPdf}>
                📄 Export to PDF
              </button>
            </div>
            <div className="card" style={{ overflowX: 'auto', background: '#fff', textAlign: 'center' }}>
              <div 
                ref={mindmapRef} 
                dangerouslySetInnerHTML={{ __html: svgContent }} 
                style={{ minWidth: 800, padding: 20 }}
              />
            </div>
            
            <details style={{ marginTop: 20, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <summary>Show raw Mermaid syntax</summary>
              <pre className="result-box" style={{ marginTop: 10 }}>{mindmapCode}</pre>
            </details>
          </>
        )}
        
        {/* Hidden div just to trigger ref attachment early so useEffect can find it */}
        {!svgContent && mindmapCode && <div ref={mindmapRef} style={{ display: 'none' }}></div>}
      </div>
    </div>
  );
}

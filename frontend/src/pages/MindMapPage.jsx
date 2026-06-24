import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import ChapterSelect from '../components/ChapterSelect';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

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
    if (mindmapCode && mindmapRef.current) {
      const renderMap = async () => {
        try {
          // mermaid requires a unique id for every render
          const id = `mermaid-${Date.now()}`;
          const { svg } = await mermaid.render(id, mindmapCode);
          setSvgContent(svg);
        } catch (err) {
          console.error("Mermaid parsing error:", err);
          setMsg({ type: 'error', text: 'The AI generated invalid mind map syntax. Please try again.' });
        }
      };
      renderMap();
    }
  }, [mindmapCode]);

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
            <div className="section-label">Your Mind Map</div>
            <div className="card" style={{ overflowX: 'auto', background: '#fff', textAlign: 'center' }}>
              <div 
                ref={mindmapRef} 
                dangerouslySetInnerHTML={{ __html: svgContent }} 
                style={{ minWidth: 600 }}
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

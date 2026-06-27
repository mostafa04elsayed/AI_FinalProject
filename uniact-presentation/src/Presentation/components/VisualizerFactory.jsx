import React from 'react';
import CodeWalkthroughPlayer from './CodeWalkthroughPlayer';

export default function VisualizerFactory({ slideId }) {
  switch (slideId) {
    case '11_retrieval_lifecycle':
      return (
        <CodeWalkthroughPlayer 
          code={`async def qa(req: QAQuery):
  # 1. Embed query using Cohere
  query_embedding = cohere_client.embed(req.text)
  
  # 2. Vector Search against Qdrant
  context_chunks = qdrant.search(query_embedding, top_k=5)
  
  # 3. Assemble Context & Prompt
  prompt = build_prompt(context_chunks, req.text)
  
  # 4. Stream LLM Generation back to client
  return StreamingResponse(openai.stream(prompt))`}
          highlights={[2, 5, 8, 11]}
        />
      );
    case '21_demo':
      return (
        <div className="pres-embed" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', background: '#111', color: '#fff', borderBottom: '1px solid #333' }}>
            <strong>Mock Study Area Replica</strong>
          </div>
          <div style={{ flex: 1, padding: '2rem', display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 2, background: '#222', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ height: '20px', width: '60%', background: '#444', marginBottom: '1rem', borderRadius: '4px' }}></div>
              <div style={{ height: '10px', width: '100%', background: '#333', marginBottom: '0.5rem', borderRadius: '4px' }}></div>
              <div style={{ height: '10px', width: '90%', background: '#333', marginBottom: '0.5rem', borderRadius: '4px' }}></div>
              <div style={{ height: '10px', width: '95%', background: '#333', marginBottom: '0.5rem', borderRadius: '4px' }}></div>
            </div>
            <div style={{ flex: 1, background: '#222', borderRadius: '8px', padding: '1rem' }}>
              <strong style={{color: '#818cf8'}}>Your Notes</strong>
              <div style={{ height: '60px', width: '100%', background: '#333', marginTop: '1rem', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>
      );
    case '15_technical_decisions':
      return (
        <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
          <div className="pres-glass">
            <h3 style={{color: '#818cf8', margin: 0}}>FastAPI vs Django</h3>
            <p>Unmatched async performance natively required for concurrent streaming AI generations.</p>
          </div>
          <div className="pres-glass">
            <h3 style={{color: '#818cf8', margin: 0}}>Modal vs AWS Lambda</h3>
            <p>Native support for heavy AI workloads, GPU attachments, and completely instant cold-starts.</p>
          </div>
        </div>
      );
    case '05_core_workflow':
      return (
        <CodeWalkthroughPlayer 
          code={`// Real-time Chat Streaming Component
async function handleAsk() {
  const stream = await fetchSSE('/api/v1/nlp/chat');
  for await (const chunk of stream) {
    appendMessage(chunk.text);
    // UI updates instantly, zero perceived latency
  }
}`}
          highlights={[3, 4, 5]}
        />
      );
    case '16_engineering_challenges':
       return (
        <CodeWalkthroughPlayer 
          code={`# From standard Volumes
# volume = modal.Volume.from_name("uniact-storage")

# To POSIX NetworkFileSystem
nfs = modal.NetworkFileSystem.from_name(
    "uniact-storage", create_if_missing=True
)

app = modal.App("uniact-rag-backend-v2")

@app.function(network_file_systems={"/assets/files": nfs})
def web_endpoint():
    pass`}
          highlights={[4, 5, 6, 11]}
        />
      );
    default:
      return null;
  }
}

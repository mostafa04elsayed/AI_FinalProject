import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Play, CheckCircle2, Download } from 'lucide-react';
import { exportToPdf } from '../utils/exportPdf';

export default function GradingPage() {
  const { triggerStamp } = useApp();
  const [examPdf, setExamPdf] = useState(null);
  const [pagesPerStudent, setPagesPerStudent] = useState(1);
  const [modelFiles, setModelFiles] = useState([]);
  
  // Set smart default values so it works immediately without typing
  const [questionText, setQuestionText] = useState("Grade the provided student answer against the model answer.");
  const [modelAnswerText, setModelAnswerText] = useState("");
  const [rubricText, setRubricText] = useState("Q1 General Accuracy: 10pts");
  
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleExamPdfChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setExamPdf(e.target.files[0]);
    }
  };

  const handleModelFilesChange = (e) => {
    if (e.target.files) {
      setModelFiles(Array.from(e.target.files));
    }
  };

  const executeGrading = async () => {
    setMsg(null);
    setReport(null);

    if (!examPdf) {
      setMsg({ type: 'error', text: "Please select the Exam PDF file first." });
      return;
    }
    if (modelFiles.length === 0 && !modelAnswerText.trim()) {
      setMsg({ type: 'error', text: "You must provide either a Model Answer Text or upload a Model Answer File." });
      return;
    }

    setLoading(true);

    const fd = new FormData();
    fd.append('exam_pdf', examPdf);
    fd.append('pages_per_student', pagesPerStudent.toString());
    // Fallback to default texts if user cleared them completely
    fd.append('question_text', questionText.trim() || "Grade the provided student answer against the model answer.");
    fd.append('rubric', rubricText.trim() || "Q1 General Accuracy: 10pts");
    fd.append('model_answer_text', modelAnswerText);
    
    modelFiles.forEach((f) => {
      fd.append('model_answer_files', f);
    });

    setMsg({ type: 'info', text: '⏳ Grading in progress... This may take 1-2 minutes for multiple students.' });

    try {
      const res = await api.gradeExam(fd, (elapsed) => {
        setMsg({ type: 'info', text: `⏳ Grading in progress... (${elapsed}s elapsed)` });
      });
      setReport(res);
      setMsg({ type: 'success', text: 'Grading Complete! Review the report below.' });
      triggerStamp('Grading Complete');
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to grade exam. Make sure the backend server is running.' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!report) return;
    const rows = [
      ["Student ID", "Total Score", "Max Score", "OCR Confidence", "Workflow"]
    ];
    
    report.per_student_results.forEach(s => {
      rows.push([
        s.student_id,
        s.grading_results.total_points_awarded,
        s.grading_results.total_max_points,
        s.pipeline_metadata.ocr_confidence,
        s.pipeline_metadata.workflow_routing
      ]);
    });
    
    // Add Rubric Breakdown
    rows.push([]);
    rows.push(["Detailed Rubric Breakdown"]);
    rows.push(["Student ID", "Criterion", "Points Awarded", "Max Points", "Reason"]);
    report.per_student_results.forEach(s => {
      s.grading_results.rubric_breakdown.forEach(r => {
        // Enclose strings in quotes to avoid comma splitting issues
        const reason = `"${(r.deduction_reason || "Perfect.").replace(/"/g, '""')}"`;
        const criterion = `"${r.criterion_name.replace(/"/g, '""')}"`;
        rows.push([s.student_id, criterion, r.points_awarded, r.max_points, reason]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "grading_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!report) return;
    let html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Auto Grading Report</h2>
        <div style="margin-bottom: 20px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
          <strong>Total Students:</strong> ${report.class_aggregates.overall_stats.num_students}<br/>
          <strong>Average Score:</strong> ${report.class_aggregates.overall_stats.average_score} / ${report.class_aggregates.overall_stats.overall_max_possible}<br/>
          <strong>Highest Score:</strong> ${report.class_aggregates.overall_stats.max_score}<br/>
          <strong>Lowest Score:</strong> ${report.class_aggregates.overall_stats.min_score}
        </div>
        <h3 style="color: #4b5563;">Common Mistakes Summary</h3>
        <p style="font-size: 13px; background: #fffbeb; padding: 12px; border-left: 4px solid #f59e0b;">
          ${report.common_mistakes_summary}
        </p>
        <h3 style="color: #4b5563; margin-top: 24px;">Per-Student Breakdown</h3>
    `;
    
    report.per_student_results.forEach(s => {
      html += `
        <div style="margin-bottom:20px; padding:16px; background:#fafbfd; border:1px solid #e5e7eb; border-radius:8px;">
          <h4 style="margin: 0 0 10px 0; color: #111827;">Student: ${s.student_id}</h4>
          <div style="font-size: 13px; margin-bottom: 12px; font-weight: bold; color: #2563eb;">
            Total Score: ${s.grading_results.total_points_awarded} / ${s.grading_results.total_max_points}
          </div>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #d1d5db;">
                <th style="text-align: left; padding: 6px;">Criterion</th>
                <th style="text-align: left; padding: 6px;">Score</th>
                <th style="text-align: left; padding: 6px;">Reason</th>
              </tr>
            </thead>
            <tbody>
              ${s.grading_results.rubric_breakdown.map(r => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px; vertical-align: top; width: 25%;">${r.criterion_name}</td>
                  <td style="padding: 6px; vertical-align: top; width: 15%;"><strong>${r.points_awarded}/${r.max_points}</strong></td>
                  <td style="padding: 6px; vertical-align: top; color: ${r.points_awarded < r.max_points ? '#dc2626' : '#1f2937'};">
                    ${r.deduction_reason || 'Perfect.'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    html += `</div>`;
    exportToPdf(html, 'Grading_Report.pdf');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Auto Grading</h2>
        <p>Automatically grade student exams using AI vision and rubric-based analysis.</p>
      </div>

      <div className="page-body">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Left Column: Configuration */}
          <div className="card">
            <div className="card-title">Grading Configuration</div>

            <div className="field">
              <label>1. Upload Combined Exam PDF (Required)</label>
              <input type="file" accept=".pdf" onChange={handleExamPdfChange} style={{ marginTop: '8px' }} />
              {examPdf && <div style={{ fontSize: '13px', color: 'var(--green)', marginTop: '4px' }}>✓ {examPdf.name}</div>}
            </div>

            <div className="field">
              <label>2. Pages per Student</label>
              <input 
                type="number" 
                min="1" 
                value={pagesPerStudent} 
                onChange={(e) => setPagesPerStudent(parseInt(e.target.value) || 1)} 
              />
            </div>

            <div className="field">
              <label>3. Upload Model Answer Sheets (Optional)</label>
              <input type="file" multiple accept=".png,.jpg,.jpeg,.pdf" onChange={handleModelFilesChange} style={{ marginTop: '8px' }} />
              {modelFiles.length > 0 && <div style={{ fontSize: '13px', color: 'var(--green)', marginTop: '4px' }}>✓ {modelFiles.length} file(s) selected</div>}
            </div>

            <div className="field">
              <label>Official Model Solution Key (Text)</label>
              <textarea 
                rows={3} 
                placeholder="Input correct answers explicitly if not using images..."
                value={modelAnswerText}
                onChange={(e) => setModelAnswerText(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Exam Question Context</label>
              <textarea 
                rows={2} 
                placeholder="What was the question?"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Strict Point Categories Rubric</label>
              <textarea 
                rows={3} 
                placeholder="e.g., Q1 Definitions: 2pts, Q2 Core Math: 5pts..."
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
              />
            </div>

            <div className="btn-row" style={{ marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={executeGrading} disabled={loading}>
                {loading ? <><span className="spinner"/>&nbsp;Processing...</> : <><Play size={16} style={{ marginRight: 6 }} /> Execute Grading</>}
              </button>
            </div>
          </div>

          {/* Right Column: Report */}
          <div>
            <div className="card" style={{ height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="card-title" style={{ margin: 0, padding: 0, border: 'none' }}>Report & Analytics</div>
                {report && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" onClick={handleExportCsv} style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} /> CSV
                    </button>
                    <button className="btn btn-ghost" onClick={handleExportPdf} style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} /> PDF
                    </button>
                  </div>
                )}
              </div>
              
              {!report && !loading && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px' }}>
                  <CheckCircle2 size={48} opacity={0.2} style={{ marginBottom: '16px' }} />
                  <p>Run the pipeline to see the class-wide grading report.</p>
                </div>
              )}
              
              {loading && (
                <div style={{ textAlign: 'center', marginTop: '60px' }}>
                  <div className="spinner" style={{ width: '32px', height: '32px', borderBottomColor: 'var(--accent-main)' }} />
                  <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Grading exams using AI...</p>
                </div>
              )}
              
              {report && (
                <div style={{ marginTop: '16px' }}>
                  {report.page_count_warning && (
                    <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                      {report.page_count_warning}
                    </div>
                  )}
                  
                  <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '12px' }}>Class-Wide Statistics</h3>
                  <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '14px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><strong>Total Students:</strong> {report.class_aggregates.overall_stats.num_students}</div>
                      <div><strong>Average Score:</strong> {report.class_aggregates.overall_stats.average_score} / {report.class_aggregates.overall_stats.overall_max_possible}</div>
                      <div><strong>Highest Score:</strong> {report.class_aggregates.overall_stats.max_score}</div>
                      <div><strong>Lowest Score:</strong> {report.class_aggregates.overall_stats.min_score}</div>
                    </div>
                  </div>
                  
                  <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '12px' }}>Common Mistakes Analysis</h3>
                  <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', fontSize: '14px', marginBottom: '24px', border: '1px solid var(--border)' }}>
                    {report.common_mistakes_summary}
                  </div>
                  
                  <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '12px' }}>Per-Student Breakdown</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {report.per_student_results.map((student, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent-main)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '15px' }}>{student.student_id}</strong>
                          <span style={{ fontWeight: 'bold', color: 'var(--accent-main)' }}>Score: {student.grading_results.total_points_awarded} / {student.grading_results.total_max_points}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          OCR Confidence: {student.pipeline_metadata.ocr_confidence.toFixed(1)}% | 
                          Workflow: {student.pipeline_metadata.workflow_routing}
                        </div>
                        
                        {/* Breakdown Table */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>Criterion</th>
                                <th style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>Score</th>
                                <th style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.grading_results.rubric_breakdown.map((rubric, rIdx) => (
                                <tr key={rIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 4px', fontWeight: '500' }}>{rubric.criterion_name}</td>
                                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>{rubric.points_awarded} / {rubric.max_points}</td>
                                  <td style={{ padding: '8px 4px', color: rubric.points_awarded < rubric.max_points ? 'var(--red)' : 'var(--text-main)' }}>
                                    {rubric.deduction_reason || "Perfect."}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

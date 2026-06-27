import os
import json
import shutil
import tempfile
import threading
import time
from typing import List, Optional
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

from controllers.ExamGradingController import ExamGradingController

router = APIRouter(prefix="/api/v1/grading", tags=["api_v1", "grading"])


@router.post("/grade-exam")
async def grade_exam(
    exam_pdf: UploadFile = File(...),
    pages_per_student: int = Form(...),
    question_text: str = Form(...),
    rubric: str = Form(...),
    model_answer_text: str = Form(""),
    model_answer_files: Optional[List[UploadFile]] = File(None)
):
    """
    Executes the grading pipeline with a streaming response.
    Sends keepalive pings every 5s to prevent connection timeout,
    then sends the final JSON result.
    """
    if pages_per_student <= 0:
        raise HTTPException(status_code=400, detail="pages_per_student must be positive.")

    if not model_answer_text.strip() and not model_answer_files:
        raise HTTPException(status_code=400, detail="Must provide either model answer text or files.")

    # Save uploaded files
    temp_dir = tempfile.mkdtemp()
    exam_pdf_path = os.path.join(temp_dir, exam_pdf.filename)
    with open(exam_pdf_path, "wb") as f:
        shutil.copyfileobj(exam_pdf.file, f)

    saved_model_files = []
    if model_answer_files:
        for file in model_answer_files:
            if file.filename:
                path = os.path.join(temp_dir, file.filename)
                with open(path, "wb") as f:
                    shutil.copyfileobj(file.file, f)
                saved_model_files.append(path)

    # Shared state between the grading thread and the streaming generator
    state = {"done": False, "result": None, "error": None}

    def run_grading():
        try:
            controller = ExamGradingController()
            result = controller.run_production_pipeline(
                exam_pdf_path=exam_pdf_path,
                pages_per_student=pages_per_student,
                model_answer_paths=saved_model_files,
                question_text=question_text,
                model_answer_text=model_answer_text,
                rubric_criteria=rubric,
            )
            state["result"] = result
        except Exception as e:
            import traceback
            state["error"] = f"{str(e)}\n{traceback.format_exc()}"
        finally:
            state["done"] = True
            shutil.rmtree(temp_dir, ignore_errors=True)

    def stream_response():
        """Yields keepalive pings, then the final result as newline-delimited JSON."""
        t = threading.Thread(target=run_grading, daemon=True)
        t.start()

        # Send keepalive pings while grading is running
        elapsed = 0
        while not state["done"]:
            time.sleep(5)
            elapsed += 5
            yield json.dumps({"type": "ping", "elapsed": elapsed}) + "\n"

        # Send final result
        if state["error"]:
            yield json.dumps({"type": "error", "detail": state["error"]}) + "\n"
        else:
            yield json.dumps({"type": "result", "data": state["result"]}) + "\n"

    return StreamingResponse(
        stream_response(),
        media_type="application/x-ndjson",
    )

import json
import re
import os
import csv
import tempfile
import statistics
from collections import defaultdict
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import google.generativeai as genai
from PIL import Image
from pdf2image import convert_from_path
import markdown
import pdfkit

from helpers.config import get_settings

# =====================================================================
# 1. SCHEMAS
# =====================================================================
class TranscriptionSchema(BaseModel):
    extracted_text: str = Field(description="The exact text transcribed from the student's image. No corrections.")
    confidence_score: float = Field(description="Confidence score of the transcription from 0.0 to 100.0")
    uncertain_regions: List[str] = Field(description="List of phrases, formulas, or words that were blurry or ambiguous.")

class StudentIDExtractionSchema(BaseModel):
    student_id: str = Field(description="The student ID/roll number/name found on the page. If genuinely not found, return 'UNKNOWN'.")
    id_confidence: float = Field(description="Confidence score 0.0 to 100.0 that this ID was read correctly.")

class SubjectClassificationSchema(BaseModel):
    subject: str = Field(description="Must be one of: 'Mathematics', 'Programming', 'Sciences', 'Humanities'")
    justification: str = Field(description="Brief reason for routing to this subject category.")

class RubricQuestionSchema(BaseModel):
    criterion_name: str = Field(description="Short, stable, unique label for this rubric item, e.g. 'Q1', 'Q2a'.")
    description: str = Field(description="What this rubric item / question is asking for.")
    max_points: float = Field(description="Maximum points for this rubric item.")

class RubricExtractionSchema(BaseModel):
    questions: List[RubricQuestionSchema] = Field(description="The full list of distinct gradeable rubric items.")

class RubricItemEvaluation(BaseModel):
    criterion_name: str = Field(description="The name of the rubric category.")
    model_expectation: str = Field(description="Exactly what the model answer required.")
    student_evidence: str = Field(description="Exactly what the student wrote.")
    discrepancy_analysis: str = Field(description="List any missing steps, wrong signs, or logical gaps.")
    max_points: float
    points_awarded: float
    deduction_reason: str = Field(description="Why points were lost.")

class GradingReportSchema(BaseModel):
    evaluation_strategy_applied: str
    rubric_breakdown: List[RubricItemEvaluation]
    total_max_points: float
    total_points_awarded: float
    qualitative_feedback: str


class ExamGradingController:
    def __init__(self):
        self.settings = get_settings()
        api_key = self.settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in environment variables.")
        genai.configure(api_key=api_key)
        self.model_names = [
            'models/gemini-2.5-pro',
            'models/gemini-2.5-flash',
            'models/gemini-3.5-flash',
            'models/gemini-flash-latest'
        ]
        self.current_model_idx = 0
        self.model = genai.GenerativeModel(self.model_names[self.current_model_idx])
        self.PDF_RENDER_DPI = 200

    def generate_content_with_retry(self, *args, **kwargs):
        import time
        from google.api_core.exceptions import ResourceExhausted, TooManyRequests
        
        max_retries = len(self.model_names) * 2
        
        for attempt in range(max_retries):
            try:
                return self.model.generate_content(*args, **kwargs)
            except Exception as e:
                if "429" in str(e) or "Quota exceeded" in str(e) or isinstance(e, (ResourceExhausted, TooManyRequests)):
                    print(f"Rate limit hit on {self.model_names[self.current_model_idx]}. Switching model...")
                    self.current_model_idx = (self.current_model_idx + 1) % len(self.model_names)
                    self.model = genai.GenerativeModel(self.model_names[self.current_model_idx])
                    
                    if attempt > 0 and attempt % len(self.model_names) == 0:
                        time.sleep(20)
                else:
                    raise
                    
        raise Exception("All Gemini models exhausted their quota. Please try again later.")

    def render_pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        pages = convert_from_path(pdf_path, dpi=self.PDF_RENDER_DPI)
        return [self.normalize_image_mode(page) for page in pages]

    def split_pdf_to_student_blocks(self, pdf_path: str, pages_per_student: int) -> List[List[Image.Image]]:
        if pages_per_student <= 0:
            raise ValueError("Pages per student must be a positive integer.")
        all_pages = self.render_pdf_to_images(pdf_path)
        blocks = [
            all_pages[i:i + pages_per_student]
            for i in range(0, len(all_pages), pages_per_student)
        ]
        return blocks

    def normalize_image_mode(self, img: Image.Image) -> Image.Image:
        import io
        if img.mode == "RGB":
            try:
                test_buf = io.BytesIO()
                img.save(test_buf, format="webp")
                return img
            except Exception:
                pass
        if img.mode in ("P", "PA"):
            img = img.convert("RGBA")
        if img.mode in ("RGBA", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return Image.open(buf).copy()

    def load_model_answer_images(self, file_paths: List[str]) -> List[Image.Image]:
        if not file_paths:
            return []
        images = []
        for file_path in file_paths:
            if file_path.lower().endswith(".pdf"):
                images.extend(self.render_pdf_to_images(file_path))
            else:
                images.append(self.normalize_image_mode(Image.open(file_path)))
        return images

    def process_multi_page_ocr(self, images: List[Image.Image]) -> Dict[str, Any]:
        combined_text = []
        lowest_confidence = 100.0
        all_uncertain_regions = []

        ocr_prompt = """
        You are a dedicated, high-precision OCR Engine.
        Transcribe the handwritten text from this page EXACTLY as it appears.
        Do not auto-correct spelling, algebraic signs, or syntax errors.
        Provide an overall structural transcription, highlighting any illegible segments.
        """

        for idx, img in enumerate(images):
            img = self.normalize_image_mode(img)
            response = self.generate_content_with_retry(
                contents=[ocr_prompt, img],
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=TranscriptionSchema,
                    temperature=0.1
                )
            )
            data = json.loads(response.text)
            combined_text.append(f"--- Page {idx+1} ---\n{data['extracted_text']}")
            if data['confidence_score'] < lowest_confidence:
                lowest_confidence = data['confidence_score']
            all_uncertain_regions.extend(data['uncertain_regions'])

        workflow_status = "AUTOMATED_GRADED"
        if lowest_confidence < 70.0:
            workflow_status = "FLAGGED_FOR_HUMAN_REVIEW"
        elif lowest_confidence < 90.0:
            workflow_status = "AUTOMATED_WITH_WARNING"

        return {
            "final_transcript": "\n".join(combined_text),
            "overall_confidence": lowest_confidence,
            "uncertain_regions": all_uncertain_regions,
            "workflow_status": workflow_status
        }

    def extract_student_id(self, first_page_image: Image.Image) -> Dict[str, Any]:
        id_prompt = """
        Look at this exam page. Students write their ID, roll number, or name
        somewhere on the page (often top of the first page, in a header box,
        or on a cover line). Extract that identifier exactly as written.
        If you cannot find any such identifier, return 'UNKNOWN'.
        """
        response = self.generate_content_with_retry(
            contents=[id_prompt, self.normalize_image_mode(first_page_image)],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=StudentIDExtractionSchema,
                temperature=0.0
            )
        )
        return json.loads(response.text)

    def normalize_text_and_math(self, raw_text: str) -> str:
        normalized = raw_text.strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized

    def classify_subject_strategy(self, question: str, transcript: str) -> str:
        classification_prompt = "Analyze the following exam question and student context. Classify it into its dominant academic discipline."
        payload = {
            "question": question,
            "text": transcript
        }
        response = self.generate_content_with_retry(
            contents=[classification_prompt, json.dumps(payload)],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=SubjectClassificationSchema,
                temperature=0.0
            )
        )
        return json.loads(response.text)["subject"]

    def extract_rubric_questions(self, rubric_notes: str, question_text: str) -> List[Dict[str, Any]]:
        rubric_prompt = "Parse the following rubric notes into a clean, structured list of distinct gradeable rubric items. Keep criterion_name short and stable (e.g. 'Q1', 'Q2a')."
        payload = {
            "rubric_notes": rubric_notes,
            "question_text": question_text
        }
        response = self.generate_content_with_retry(
            contents=[rubric_prompt, json.dumps(payload)],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=RubricExtractionSchema,
                temperature=0.0
            )
        )
        data = json.loads(response.text)
        return data["questions"]

    def execute_rubric_grading(self, transcript: str, model_answer_text: str, model_answer_images: List[Image.Image], rubric_questions: List[Dict[str, Any]], subject_strategy: str) -> Dict[str, Any]:
        rubric_json_str = json.dumps(rubric_questions, indent=2)
        grading_prompt = f"""
        You are a STRICT, Slightly FORGIVING, and HIGHLY CRITICAL University Professor grading a student response in the field of {subject_strategy}.
        Your job is to actively look for errors, missing steps, and flawed logic.
        [CRITICAL GRADING RULES]
        1. DO NOT BE GENEROUS. Assume the student deserves 0 points until proven otherwise by their exact transcript.
        2. If a step is missing, you MUST deduct points.
        3. If the final answer is right but the steps are missing or wrong, you MUST deduct points.
        4. Compare the Model Answer and the Student Transcript line-by-line.
        5. Produce exactly one rubric_breakdown entry per rubric item below.

        [GRADING SCHEME]
        {rubric_json_str}

        Model Answer Text: {model_answer_text if model_answer_text.strip() else "Refer to the attached Model Answer Images."}
        Student Transcript: {transcript}
        """
        contents = [grading_prompt] + [self.normalize_image_mode(img) for img in model_answer_images]
        response = self.generate_content_with_retry(
            contents=contents,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=GradingReportSchema,
                temperature=0.0
            )
        )
        return json.loads(response.text)

    def verify_grading_layer(self, grading_json: Dict[str, Any]) -> Dict[str, Any]:
        calculated_total = 0.0
        max_possible = 0.0
        anomalies = []

        for item in grading_json.get("rubric_breakdown", []):
            if item["points_awarded"] > item["max_points"]:
                item["points_awarded"] = item["max_points"]
                anomalies.append(f"Fixed bounds anomaly for rule: {item['criterion_name']}")
            if item["points_awarded"] < 0:
                item["points_awarded"] = 0.0

            calculated_total += item["points_awarded"]
            max_possible += item["max_points"]

        grading_json["total_points_awarded"] = calculated_total
        grading_json["total_max_points"] = max_possible
        grading_json["verification_anomalies"] = anomalies
        grading_json["verification_passed"] = len(anomalies) == 0
        return grading_json

    def grade_single_student(self, student_images: List[Image.Image], model_answer_images: List[Image.Image], question_text: str, model_answer_text: str, rubric_questions: List[Dict[str, Any]], student_index: int) -> Dict[str, Any]:
        id_info = self.extract_student_id(student_images[0])
        ocr_results = self.process_multi_page_ocr(student_images)
        normalized_transcript = self.normalize_text_and_math(ocr_results["final_transcript"])
        subject_strategy = self.classify_subject_strategy(question_text, normalized_transcript)

        raw_grading = self.execute_rubric_grading(
            normalized_transcript,
            model_answer_text,
            model_answer_images,
            rubric_questions,
            subject_strategy
        )

        validated_grading = self.verify_grading_layer(raw_grading)

        student_id = id_info["student_id"] if id_info["student_id"] and id_info["student_id"] != "UNKNOWN" else f"UNKNOWN_STUDENT_{student_index+1}"

        return {
            "student_id": student_id,
            "id_confidence": id_info["id_confidence"],
            "pipeline_metadata": {
                "ocr_confidence": ocr_results["overall_confidence"],
                "uncertain_regions": ocr_results["uncertain_regions"],
                "workflow_routing": ocr_results["workflow_status"],
                "subject_strategy_applied": subject_strategy,
                "verification_passed": validated_grading["verification_passed"],
                "anomalies_detected": validated_grading["verification_anomalies"]
            },
            "grading_results": validated_grading
        }

    def aggregate_class_results(self, all_student_results: List[Dict[str, Any]], rubric_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        criterion_names = [q["criterion_name"] for q in rubric_questions]
        criterion_max = {q["criterion_name"]: q["max_points"] for q in rubric_questions}

        per_question_scores = defaultdict(list)
        per_question_deductions = defaultdict(list)
        overall_scores = []

        for result in all_student_results:
            grading = result["grading_results"]
            overall_scores.append((
                result["student_id"],
                grading["total_points_awarded"],
                grading["total_max_points"]
            ))
            for item in grading["rubric_breakdown"]:
                cname = item["criterion_name"]
                per_question_scores[cname].append(item["points_awarded"])
                lost = item["max_points"] - item["points_awarded"]
                if lost > 0:
                    per_question_deductions[cname].append({
                        "student_id": result["student_id"],
                        "points_lost": lost,
                        "reason": item.get("deduction_reason", "No reason provided")
                    })

        per_question_stats = {}
        for cname in criterion_names:
            scores = per_question_scores.get(cname, [])
            max_pts = criterion_max.get(cname, 0.0)
            avg = statistics.mean(scores) if scores else 0.0
            per_question_stats[cname] = {
                "average_score": round(avg, 2),
                "max_points": max_pts,
                "average_pct": round((avg / max_pts) * 100, 1) if max_pts else 0.0,
                "num_students_lost_points": len(per_question_deductions.get(cname, [])),
                "num_students_total": len(scores),
            }

        most_missed_questions = sorted(
            per_question_stats.items(),
            key=lambda kv: kv[1]["num_students_lost_points"] / kv[1]["num_students_total"] if kv[1]["num_students_total"] else 0,
            reverse=True
        )

        totals = [t[1] for t in overall_scores]
        overall_max = overall_scores[0][2] if overall_scores else 0.0
        overall_stats = {
            "num_students": len(overall_scores),
            "max_score": max(totals) if totals else 0.0,
            "min_score": min(totals) if totals else 0.0,
            "average_score": round(statistics.mean(totals), 2) if totals else 0.0,
            "overall_max_possible": overall_max,
            "best_student": max(overall_scores, key=lambda t: t[1])[0] if overall_scores else None,
            "best_student_score": max(totals) if totals else 0.0,
            "lowest_student": min(overall_scores, key=lambda t: t[1])[0] if overall_scores else None,
        }

        return {
            "overall_stats": overall_stats,
            "per_question_stats": per_question_stats,
            "most_missed_questions": most_missed_questions,
            "per_question_deductions": per_question_deductions,
        }

    def summarize_common_mistakes(self, per_question_deductions: Dict[str, List[Dict[str, Any]]], rubric_questions: List[Dict[str, Any]]) -> str:
        if not any(per_question_deductions.values()):
            return "No significant recurring mistakes were detected across the class."

        condensed = {
            cname: [d["reason"] for d in deductions][:25]
            for cname, deductions in per_question_deductions.items() if deductions
        }

        summary_prompt = f"""
        Identify the most common mistake patterns in 1-3 sentences per rubric item based on the deductions below.
        Respond in plain Markdown (no JSON).
        Rubric items and their context: {json.dumps(rubric_questions)}
        Deduction reasons per rubric item:
        {json.dumps(condensed, indent=2)}
        """
        response = self.generate_content_with_retry(contents=[summary_prompt])
        return response.text

    def run_production_pipeline(self, exam_pdf_path: str, pages_per_student: int, model_answer_paths: List[str], question_text: str, model_answer_text: str, rubric_criteria: str) -> Dict[str, Any]:
        student_blocks = self.split_pdf_to_student_blocks(exam_pdf_path, pages_per_student)
        if not student_blocks:
            raise ValueError("No pages could be extracted from the uploaded PDF.")

        page_count_warning = None
        rendered_pages_total = sum(len(b) for b in student_blocks)
        if rendered_pages_total % pages_per_student != 0:
            page_count_warning = (
                f"Total page count ({rendered_pages_total}) is not evenly divisible by "
                f"pages_per_student ({pages_per_student})."
            )

        model_answer_images = self.load_model_answer_images(model_answer_paths)
        rubric_questions = self.extract_rubric_questions(rubric_criteria, question_text)

        all_student_results = []
        for idx, block in enumerate(student_blocks):
            try:
                result = self.grade_single_student(
                    student_images=block,
                    model_answer_images=model_answer_images,
                    question_text=question_text,
                    model_answer_text=model_answer_text,
                    rubric_questions=rubric_questions,
                    student_index=idx
                )
            except Exception as e:
                result = {
                    "student_id": f"FAILED_STUDENT_{idx+1}",
                    "id_confidence": 0.0,
                    "pipeline_metadata": {
                        "ocr_confidence": 0.0, "uncertain_regions": [], "workflow_routing": "PIPELINE_ERROR",
                        "subject_strategy_applied": "N/A", "verification_passed": False,
                        "anomalies_detected": [f"Pipeline error: {e}"]
                    },
                    "grading_results": {
                        "evaluation_strategy_applied": "N/A",
                        "rubric_breakdown": [
                            {
                                "criterion_name": q["criterion_name"], "model_expectation": q["description"],
                                "student_evidence": "N/A", "discrepancy_analysis": "N/A",
                                "max_points": q["max_points"], "points_awarded": 0.0,
                                "deduction_reason": f"Pipeline error: {e}"
                            } for q in rubric_questions
                        ],
                        "total_max_points": sum(q["max_points"] for q in rubric_questions),
                        "total_points_awarded": 0.0, "qualitative_feedback": f"Failed due to error: {e}",
                        "verification_anomalies": [], "verification_passed": False
                    }
                }
            all_student_results.append(result)

        class_aggregates = self.aggregate_class_results(all_student_results, rubric_questions)
        common_mistakes_summary = self.summarize_common_mistakes(class_aggregates["per_question_deductions"], rubric_questions)
        
        return {
            "rubric_questions": rubric_questions,
            "per_student_results": all_student_results,
            "class_aggregates": class_aggregates,
            "common_mistakes_summary": common_mistakes_summary,
            "page_count_warning": page_count_warning,
        }

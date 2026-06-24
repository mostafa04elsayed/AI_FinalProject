import requests
import json

mcq_prompt = """You are an expert exam creator. Read the text below carefully and create EXACTLY 10 multiple-choice questions.
Difficulty Level: Medium

TEXT:
LLMs are powerful machine learning models that can generate text. LLMOps is the process of putting these models into production.

INSTRUCTIONS:
- Each question must test a DIFFERENT concept from the text.
- Each question must have exactly 4 distinct answer options labeled A, B, C, D.
- Only one option should be correct.
- Provide a brief explanation of why the answer is correct.

Respond with ONLY a valid JSON array of 10 questions:
[{"question":"...", "options":["A. ...","B. ...","C. ...","D. ..."], "answer":"A. ...", "answer_explanation":"..."}]"""

print("Calling MCQ API...")
try:
    resp = requests.post("https://instamostafa1--rag-mcq-api-mcqapi-generate.modal.run", json={"prompt": mcq_prompt, "max_tokens": 2000})
    print("Status Code:", resp.status_code)
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print("Raw text:", resp.text)
except Exception as e:
    print("Error:", e)

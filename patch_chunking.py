import os

file_path = "/home/mostafa/Documents/UniAct-rag-app-fixed/src/controllers/NLPController.py"
with open(file_path, "r") as f:
    content = f.read()

start_marker = "# ── 5. Generate MCQ questions via fine-tuned LoRA model ─────────────────"
end_marker = "# ── 7. Run MCQ and Written generation in parallel ──────────────────────"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

replacement = """# ── 5. Generate MCQ questions via fine-tuned LoRA model ─────────────────
        async def _generate_mcq_batch(batch_size, context_chunk):
            if batch_size <= 0: return []
            mcq_prompt = (
                f"You are an expert exam creator. Read the text below carefully and create "
                f"EXACTLY {batch_size} multiple-choice questions.\\n"
                f"Difficulty Level: {difficulty}\\n\\n"
                f"TEXT:\\n{context_chunk}\\n\\n"
                f"INSTRUCTIONS:\\n"
                f"- Each question must test a DIFFERENT concept from the text.\\n"
                f"- Each question must have exactly 4 distinct answer options labeled A, B, C, D.\\n"
                f"- Only one option should be correct.\\n"
                f"- Provide a brief explanation of why the answer is correct.\\n\\n"
                f"Respond with ONLY a valid JSON array of {batch_size} questions:\\n"
                f'[{{"question":"...", "options":["A. ...","B. ...","C. ...","D. ..."], "answer":"A. ...", "answer_explanation":"..."}}]'
            )
            mcq_max_tokens = max(1200, batch_size * 250)
            raw = await asyncio.to_thread(call_api, mcq_prompt, mcq_max_tokens, [mcq_url])
            if not raw: return []
            
            text = raw.strip()
            import re as _re2
            text = _re2.sub(r'<think>.*?</think>', '', text, flags=_re2.DOTALL).strip()
            text = _re2.sub(r'^```(?:json)?\\s*', '', text, flags=_re2.MULTILINE)
            text = _re2.sub(r'\\s*```$', '', text, flags=_re2.MULTILINE)
            text = text.strip()
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [q for q in parsed if isinstance(q, dict) and q.get("question")]
                elif isinstance(parsed, dict):
                    arr = parsed.get("mcq", parsed.get("questions", []))
                    return [q for q in arr if isinstance(q, dict) and q.get("question")]
            except Exception:
                pass
            
            obj = extract_json_fallback(raw)
            if isinstance(obj, list):
                return [q for q in obj if isinstance(q, dict) and q.get("question")]
            if isinstance(obj, dict) and obj.get("question"):
                return [obj]
            if isinstance(obj, dict):
                arr = obj.get("mcq", obj.get("questions", []))
                return [q for q in arr if isinstance(q, dict) and q.get("question")]
            return []

        async def generate_mcqs():
            if num_mcq <= 0: return []
            batch_size = 5
            num_batches = (num_mcq + batch_size - 1) // batch_size
            ctx_len = len(ctx)
            chunk_size = max(1, ctx_len // num_batches) if num_batches > 0 else ctx_len
            
            tasks = []
            for i in range(num_batches):
                current_batch_size = batch_size if (i < num_batches - 1) else (num_mcq - i * batch_size)
                start_idx = i * chunk_size
                end_idx = (i + 1) * chunk_size if i < num_batches - 1 else ctx_len
                context_chunk = ctx[start_idx:end_idx]
                tasks.append(_generate_mcq_batch(current_batch_size, context_chunk))
                
            results = await asyncio.gather(*tasks)
            all_qs = []
            for r in results:
                all_qs.extend(r)
            return all_qs[:num_mcq]

        # ── 6. Generate written questions via summarization model ──────────────
        async def _generate_written_batch(batch_size, context_chunk):
            if batch_size <= 0: return []
            written_prompt = (
                f"You are an expert exam creator. Read the text below carefully and create "
                f"EXACTLY {batch_size} short-answer questions.\\n"
                f"Difficulty Level: {difficulty}\\n\\n"
                f"TEXT:\\n{context_chunk}\\n\\n"
                f"INSTRUCTIONS:\\n"
                f"- Each question must test a DIFFERENT concept from the text.\\n"
                f"- Provide a clear question and a comprehensive model answer.\\n\\n"
                f"Respond with ONLY a valid JSON array of {batch_size} questions:\\n"
                f'[{{"question":"...", "answer":"..."}}]'
            )
            written_max_tokens = max(800, batch_size * 250)
            raw = await asyncio.to_thread(call_api, written_prompt, written_max_tokens, [summ_url, generation_url])
            if not raw: return []
            
            text = raw.strip()
            import re as _re2
            text = _re2.sub(r'<think>.*?</think>', '', text, flags=_re2.DOTALL).strip()
            text = _re2.sub(r'^```(?:json)?\\s*', '', text, flags=_re2.MULTILINE)
            text = _re2.sub(r'\\s*```$', '', text, flags=_re2.MULTILINE)
            text = text.strip()
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [q for q in parsed if isinstance(q, dict) and q.get("question")]
                elif isinstance(parsed, dict):
                    arr = parsed.get("written", parsed.get("questions", []))
                    return [q for q in arr if isinstance(q, dict) and q.get("question")]
            except Exception:
                pass
                
            obj = extract_json_fallback(raw)
            if isinstance(obj, list):
                return [q for q in obj if isinstance(q, dict) and q.get("question")]
            if isinstance(obj, dict) and obj.get("question"):
                return [obj]
            if isinstance(obj, dict):
                arr = obj.get("written", obj.get("questions", []))
                return [q for q in arr if isinstance(q, dict) and q.get("question")]
            return []

        async def generate_written():
            if num_written <= 0: return []
            batch_size = 5
            num_batches = (num_written + batch_size - 1) // batch_size
            ctx_len = len(ctx)
            chunk_size = max(1, ctx_len // num_batches) if num_batches > 0 else ctx_len
            
            tasks = []
            for i in range(num_batches):
                current_batch_size = batch_size if (i < num_batches - 1) else (num_written - i * batch_size)
                start_idx = i * chunk_size
                end_idx = (i + 1) * chunk_size if i < num_batches - 1 else ctx_len
                context_chunk = ctx[start_idx:end_idx]
                tasks.append(_generate_written_batch(current_batch_size, context_chunk))
                
            results = await asyncio.gather(*tasks)
            all_qs = []
            for r in results:
                all_qs.extend(r)
            return all_qs[:num_written]

        """

new_content = content[:start_idx] + replacement + content[end_idx:]

with open(file_path, "w") as f:
    f.write(new_content)

print("Patch applied successfully.")

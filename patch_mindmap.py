file_path = "/home/mostafa/Documents/UniAct-rag-app-fixed/src/controllers/NLPController.py"
with open(file_path, "r") as f:
    content = f.read()

old_block = '''        # ── 3. Build Prompt ─────────────────────────────────
        prompt = (
            "You are an expert at creating visual mind maps using Mermaid.js syntax.\\n"
            "Analyze the text below and extract the main topics, subtopics, and their relationships.\\n\\n"
            f"TEXT:\\n{ctx}\\n\\n"
            "INSTRUCTIONS:\\n"
            "- Output ONLY valid Mermaid.js code using `graph TD` or `mindmap` syntax.\\n"
            "- Do NOT include any markdown code fences (like ```mermaid). Just the raw mermaid code.\\n"
            "- Do NOT include any explanation or introduction.\\n"
            "- Use short, concise labels for the nodes.\\n"
            "- Avoid using special characters like quotes or brackets inside the node labels unless properly escaped.\\n"
            "Example format:\\n"
            "graph TD\\n"
            "  A[Main Topic] --> B[Subtopic 1]\\n"
            "  A --> C[Subtopic 2]\\n"
        )

        # ── 4. Call LLM ─────────────────────────────────────
        url = self.app_settings.GENERATION_API_URL or self.app_settings.SUMMARIZATION_API_URL
        raw = None
        
        if url:
            try:
                resp = requests.post(
                    url,
                    json={"prompt": prompt, "max_tokens": 1000},
                    timeout=600,
                )
                if resp.ok:
                    data = resp.json()
                    raw = data.get("response") or data.get("text") or data.get("content")
            except Exception as e:
                self.logger.warning(f"API call to {url} failed: {e}")

        if not raw:
            raw = self.generation_client.generate_text(prompt=prompt)

        if not raw:
            return {"error": "LLM returned no content for mind map generation."}

        # ── 5. Clean Output ─────────────────────────────────
        text = raw.strip()
        text = _re.sub(r\'<think>.*?</think>\', \'\', text, flags=_re.DOTALL).strip()
        text = _re.sub(r\'^```(?:mermaid)?\\s*\', \'\', text, flags=_re.MULTILINE)
        text = _re.sub(r\'\\s*```$\', \'\', text, flags=_re.MULTILINE)
        text = text.strip()

        if not text.startswith("graph") and not text.startswith("mindmap"):
            # Try to forcefully extract just the graph part if the LLM hallucinated text before it
            match = _re.search(r\'(graph\\s+TD.*|mindmap.*)\', text, _re.DOTALL)
            if match:
                text = match.group(1).strip()
            else:
                return {"error": "LLM failed to generate valid Mermaid syntax.", "raw_output": raw}

        return {"mindmap": text}'''

new_block = '''        # ── 3. Build Prompt ─────────────────────────────────
        prompt = (
            "You are a Mermaid.js expert. Your ONLY job is to output a valid Mermaid graph TD diagram.\\n"
            "Read the text below and create a structured mind map of the key concepts.\\n\\n"
            f"TEXT:\\n{ctx}\\n\\n"
            "CRITICAL RULES - you MUST follow all of these exactly:\\n"
            "1. Output ONLY raw Mermaid code. NO explanations, NO markdown fences, NO ```mermaid.\\n"
            "2. ALWAYS start with exactly: graph TD\\n"
            "3. Node labels MUST use square brackets only: [Label Here]\\n"
            "4. Node labels must be SHORT - maximum 5 words.\\n"
            "5. NEVER use quotes, colons, parentheses, or special characters inside square brackets.\\n"
            "6. Use only letters, numbers, spaces, and hyphens inside labels.\\n"
            "7. Each line must be: NodeID[Label] --> NodeID2[Label2]\\n"
            "8. Node IDs must be simple letters like A, B, C, D1, D2 etc.\\n"
            "9. Maximum 20 nodes total.\\n\\n"
            "EXAMPLE of perfect output:\\n"
            "graph TD\\n"
            "  A[Main Topic] --> B[Subtopic One]\\n"
            "  A --> C[Subtopic Two]\\n"
            "  B --> D[Detail One]\\n"
            "  B --> E[Detail Two]\\n"
            "  C --> F[Detail Three]\\n"
        )

        # ── 4. Call LLM ─────────────────────────────────────
        url = self.app_settings.GENERATION_API_URL or self.app_settings.SUMMARIZATION_API_URL
        raw = None
        
        if url:
            try:
                resp = requests.post(
                    url,
                    json={"prompt": prompt, "max_tokens": 800},
                    timeout=600,
                )
                if resp.ok:
                    data = resp.json()
                    raw = data.get("response") or data.get("text") or data.get("content")
            except Exception as e:
                self.logger.warning(f"API call to {url} failed: {e}")

        if not raw:
            raw = self.generation_client.generate_text(prompt=prompt)

        if not raw:
            return {"error": "LLM returned no content for mind map generation."}

        # ── 5. Clean & Sanitize Output ─────────────────────────────────
        text = raw.strip()
        # Strip think blocks
        text = _re.sub(r\'<think>.*?</think>\', \'\', text, flags=_re.DOTALL).strip()
        # Strip markdown fences
        text = _re.sub(r\'^```(?:mermaid)?\\s*\', \'\', text, flags=_re.MULTILINE)
        text = _re.sub(r\'\\s*```$\', \'\', text, flags=_re.MULTILINE)
        text = text.strip()

        # Extract the graph block if there is preamble text
        if not text.startswith("graph"):
            match = _re.search(r\'(graph\\s+(?:TD|LR|TB|RL).*)\', text, _re.DOTALL)
            if match:
                text = match.group(1).strip()
            else:
                # Build a simple fallback graph from the context
                words = [w for w in ctx.replace("\\n", " ").split() if len(w) > 4][:40]
                unique_words = list(dict.fromkeys(words))[:8]
                lines = ["graph TD", "  ROOT[Main Topic]"]
                for i, w in enumerate(unique_words):
                    safe = _re.sub(r\'[^A-Za-z0-9 -]\', \'\', w)[:20].strip()
                    if safe:
                        lines.append(f"  ROOT --> N{i}[{safe}]")
                text = "\\n".join(lines)

        # ── 6. Per-line sanitization ────────────────────────
        sanitized_lines = ["graph TD"]
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped == "graph TD":
                continue
            # Fix labels: remove/replace unsafe chars inside square brackets
            fixed = _re.sub(r\'\\[([^\\]]*)\\]\',
                lambda m: "[" + _re.sub(r\'[^A-Za-z0-9 \\-]\', \' \', m.group(1)).strip()[:40] + "]",
                stripped)
            # Only keep lines that look like valid mermaid edge/node lines
            if "-->" in fixed or _re.match(r\'^[A-Za-z0-9_]+\\s*\\[\', fixed):
                sanitized_lines.append("  " + fixed)

        # If we only have the header line, something went very wrong - return error
        if len(sanitized_lines) < 3:
            return {"error": "LLM failed to generate valid Mermaid syntax.", "raw_output": raw}

        return {"mindmap": "\\n".join(sanitized_lines)}'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(file_path, "w") as f:
        f.write(content)
    print("Patch applied successfully.")
else:
    print("ERROR: Could not find the target block to replace.")

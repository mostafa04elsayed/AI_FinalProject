import os

file_path = "/home/mostafa/Documents/UniAct-rag-app-fixed/src/controllers/NLPController.py"
with open(file_path, "r") as f:
    content = f.read()

content = content.replace("ctx = context_text[:1500]", "ctx = context_text[:8000]")
content = content.replace("raw = await asyncio.to_thread(call_api, mcq_prompt, 1200, [mcq_url])", "mcq_max_tokens = max(1200, num_mcq * 250)\n            raw = await asyncio.to_thread(call_api, mcq_prompt, mcq_max_tokens, [mcq_url])")
content = content.replace("raw = await asyncio.to_thread(call_api, written_prompt, 800, [summ_url, generation_url])", "written_max_tokens = max(800, num_written * 250)\n            raw = await asyncio.to_thread(call_api, written_prompt, written_max_tokens, [summ_url, generation_url])")
content = content.replace("timeout=300,", "timeout=600,")

with open(file_path, "w") as f:
    f.write(content)

print("Replaced all values correctly.")

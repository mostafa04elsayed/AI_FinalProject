import re
import json

with open('/home/mostafa/.gemini/antigravity/brain/b810017e-554a-4b7d-a63e-2d8692f57226/.system_generated/tasks/task-2723.log', 'r') as f:
    text = f.read()

# Parse the JSON log output to get the actual unescaped string
start = text.find('{')
json_part = text[start:]
data = json.loads(json_part)
raw = data['response']

mcq_pattern = re.compile(
    r'"question"\s*:\s*"(.*?)"\s*,\s*"options"\s*:\s*\[(.*?)\]\s*,\s*"answer"\s*:\s*"(.*?)"\s*,\s*"answer_explanation"\s*:\s*"(.*?)"',
    re.IGNORECASE | re.DOTALL
)

matches = mcq_pattern.findall(raw)
print(f"MCQ Matches: {len(matches)}")
if matches:
    print(matches[0][0])

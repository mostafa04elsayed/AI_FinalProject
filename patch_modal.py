import os

files = [
    "/home/mostafa/Documents/UniAct-rag-app-fixed/modal_mcq_api.py",
    "/home/mostafa/Documents/UniAct-rag-app-fixed/modal_summarization_api.py",
    "/home/mostafa/Documents/UniAct-rag-app-fixed/modal_generation_api.py"
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()
    
    content = content.replace("timeout=300,", "timeout=600,")
    
    with open(file_path, "w") as f:
        f.write(content)

print("Updated modal timeouts successfully.")

import os
import re
import json

root = r"d:\Coding\project\xingyu-hub\xingyu-web\app"
results = []

for dirpath, _, filenames in os.walk(root):
    if "page.tsx" not in filenames:
        continue
    fpath = os.path.join(dirpath, "page.tsx")
    rel = os.path.relpath(dirpath, root).replace("\\", "/")
    route = "/" if rel == "." else "/" + rel

    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    fn = re.search(r"export default (?:async )?function (\w+)", content)
    fn_name = fn.group(1) if fn else ""

    h1s = re.findall(r"<h1[^>]*>([^<{]+)</h1>", content)
    h1_jsx = re.findall(r"<h1[^>]*>\s*\{([^}]+)\}", content)
    chinese = re.findall(r'["\'`]([^"\'`]*[\u4e00-\u9fff][^"\'`]{0,80})["\'`]', content)
    redirect = "redirect(" in content or "permanentRedirect(" in content

    results.append(
        {
            "route": route,
            "fn": fn_name,
            "h1": h1s[:5],
            "h1_jsx": h1_jsx[:5],
            "chinese": chinese[:12],
            "redirect": redirect,
        }
    )

results.sort(key=lambda x: x["route"])
print(json.dumps(results, ensure_ascii=False, indent=2))

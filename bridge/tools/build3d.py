"""
build3d.py — bundles js3d/ (Three.js layer) into index.html so the page also works from file://.
Run after editing anything in js3d/:   python3 tools/build3d.py
The bundle is written between the <!--BR3:start--> and <!--BR3:end--> markers of index.html.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = 'js3d/entry.js'
IMPORT_RE = re.compile(r"^import\s+(.+?)\s+from\s+'([^']+)';\s*$", re.M)
EXPORT_RE = re.compile(r"^export\s+(?:async\s+)?(?:const|let|class|function)\s+(\w+)", re.M)
order, seen, ext_imports = [], set(), {}

def norm(base, rel):
    return os.path.normpath(os.path.join(os.path.dirname(base), rel)).replace('\\', '/')

def visit(path):
    if path in seen: return
    seen.add(path)
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    for spec, frm in IMPORT_RE.findall(src):
        if frm.startswith('.'): visit(norm(path, frm))
    order.append(path)

visit(ENTRY)
modname = lambda p: '__m_' + re.sub(r'\W', '_', p)
parts = []
for path in order:
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    exports = EXPORT_RE.findall(src)
    local = []
    def repl(m):
        spec, frm = m.group(1), m.group(2)
        if frm.startswith('.'):
            binds = []
            for n in spec.strip()[1:-1].split(','):
                n = n.strip()
                if not n: continue
                if ' as ' in n:
                    a, b = [x.strip() for x in n.split(' as ')]; binds.append(f'{a}: {b}')
                else: binds.append(n)
            local.append(f"const {{ {', '.join(binds)} }} = {modname(norm(path, frm))};")
            return ''
        ext_imports.setdefault(frm, set()).add(spec.strip())
        return ''
    body = IMPORT_RE.sub(repl, src)
    body = re.sub(r'^export\s+', '', body, flags=re.M)
    parts.append(f"// ---- {path}\nconst {modname(path)} = (() => {{\n" + '\n'.join(local) + '\n' + body +
                 f"\nreturn {{ {', '.join(exports)} }};\n}})();\n")

head = []
for frm, specs in ext_imports.items():
    named, star = set(), None
    for sp in specs:
        if sp.startswith('* as'): star = sp
        else: named.update(x.strip() for x in sp.strip()[1:-1].split(',') if x.strip())
    if star: head.append(f"import {star} from '{frm}';")
    if named: head.append(f"import {{ {', '.join(sorted(named))} }} from '{frm}';")

bundle = ('\n'.join(head) + '\n\n' + '\n'.join(parts)).replace('</script', '<\\/script')
block = '<!--BR3:start-->\n<script type="module">\n/* bundled by tools/build3d.py — source: js3d/ */\n' + bundle + '\n</script>\n<!--BR3:end-->'
p = os.path.join(ROOT, 'index.html')
html = open(p, encoding='utf-8').read()
pat = re.compile(r'<!--BR3:start-->.*?<!--BR3:end-->', re.S)
assert pat.search(html), 'markers missing in index.html'
html = pat.sub(lambda m: block, html)
open(p, 'w', encoding='utf-8').write(html)
print('bundled', len(order), 'modules,', len(block) // 1024, 'KB')

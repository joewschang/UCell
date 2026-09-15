from pathlib import Path
import hashlib, json, zipfile
import xml.etree.ElementTree as ET

sources = Path('C:/UCell/Docs')
out = Path(__file__).resolve().parent
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}
manifest = []
for i, file in enumerate(sorted(sources.iterdir()), 1):
    if file.suffix.lower() not in ('.docx', '.sql'):
        continue
    code = f'S{i:02}'
    data = file.read_bytes()
    item = {'id': code, 'path': str(file), 'sha256': hashlib.sha256(data).hexdigest()}
    if file.suffix == '.sql':
        text = data.decode('utf-8-sig')
        rows = [f'L{j:04} {line}' for j, line in enumerate(text.splitlines(), 1)]
    else:
        with zipfile.ZipFile(file) as z:
            xml = ET.fromstring(z.read('word/document.xml'))
            item['trackedInsertions'] = len(xml.findall('.//w:ins', ns))
            item['trackedDeletions'] = len(xml.findall('.//w:del', ns))
            item['coreProperties'] = z.read('docProps/core.xml').decode('utf-8') if 'docProps/core.xml' in z.namelist() else ''
            rows = []
            for j, p in enumerate(xml.findall('.//w:body//w:p', ns), 1):
                texts = [n.text or '' for n in p.iter() if n.tag in
                         (f'{{{ns["w"]}}}t', f'{{{ns["m"]}}}t', f'{{{ns["w"]}}}delText')]
                style = p.find('w:pPr/w:pStyle', ns)
                role = style.get(f'{{{ns["w"]}}}val') if style is not None else ''
                rows.append(f'P{j:04} [{role}] ' + ''.join(texts))
    target = out / f'{code}.txt'
    target.write_text('\n'.join(rows) + '\n', encoding='utf-8')
    item['extract'] = target.name
    item['records'] = len(rows)
    manifest.append(item)
(out / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for item in manifest:
    print(item['id'], Path(item['path']).name, item['records'])

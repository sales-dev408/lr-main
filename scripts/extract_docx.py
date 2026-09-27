import sys, zipfile
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'w': W}

def para_text(p, rels):
    out = []
    for node in p.iter():
        tag = node.tag.split('}')[1]
        if tag == 't':
            out.append(node.text or '')
        elif tag == 'hyperlink':
            rid = node.get('{%s}id' % R)
            if rid and rid in rels:
                pass  # handled below per-run; we append markers instead
    return ''.join(out)

def para_runs_with_links(p, rels):
    """Return text with [[URL]] markers appended after hyperlinked runs."""
    out = []
    for child in p:
        tag = child.tag.split('}')[1]
        if tag == 'r':
            out.append(''.join(t.text or '' for t in child.findall('.//w:t', NS)))
        elif tag == 'hyperlink':
            rid = child.get('{%s}id' % R)
            inner = ''.join(t.text or '' for t in child.findall('.//w:t', NS))
            if rid and rid in rels:
                out.append('%s[[%s]]' % (inner, rels[rid]))
            else:
                out.append(inner)
        elif tag == 'smartTag' or tag == 'sdt':
            for node in child.iter():
                t2 = node.tag.split('}')[1]
                if t2 == 't':
                    out.append(node.text or '')
    return ''.join(out)

def cell_text(tc, rels):
    parts = []
    for p in tc.findall('./w:p', NS):
        t = para_runs_with_links(p, rels).strip()
        if t:
            parts.append(t)
    return ' <br> '.join(parts)

def extract(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml')
    rels = {}
    try:
        rroot = ET.fromstring(z.read('word/_rels/document.xml.rels'))
        for rel in rroot:
            rels[rel.get('Id')] = rel.get('Target')
    except KeyError:
        pass
    root = ET.fromstring(xml)
    body = root.find('w:body', NS)
    out = []
    for el in body:
        tag = el.tag.split('}')[1]
        if tag == 'p':
            txt = para_runs_with_links(el, rels).strip()
            if txt:
                out.append('P: ' + txt)
        elif tag == 'tbl':
            out.append('TABLE:')
            for tr in el.findall('w:tr', NS):
                cells = [cell_text(tc, rels) for tc in tr.findall('w:tc', NS)]
                out.append('  ROW: ' + ' || '.join(cells))
            out.append('END TABLE')
    return '\n'.join(out)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(extract(sys.argv[1]))

#!/usr/bin/env python3
"""Сборка zip-архивов дополнений Kodi и репозитория дополнений.

Использование:
    python3 tools/build.py                       # только zip в dist/releases
    python3 tools/build.py --base-url https://USER.github.io/REPO
                                                 # + репозиторий Kodi в dist/site (для GitHub Pages)
Версия берётся из addon.xml каждого дополнения.
"""
import argparse, hashlib, os, shutil, sys, zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADDONS = ['webinterface.glasscontrol', 'service.glasscontrol', 'script.glassnp.patcher']
REPO_ADDON = 'repository.glasscontrol'
SKIP_DIRS = {'__pycache__', '.git', '.github', 'node_modules'}
SKIP_EXT = ('.pyc', '.glassbak', '.tmp', '.DS_Store')


def version_of(addon_dir):
    return ET.parse(os.path.join(addon_dir, 'addon.xml')).getroot().get('version')


def make_zip(src_dir, addon_id, dst_zip, replace=None):
    os.makedirs(os.path.dirname(dst_zip), exist_ok=True)
    with zipfile.ZipFile(dst_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for r, dirs, files in os.walk(src_dir):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for f in sorted(files):
                if f.endswith(SKIP_EXT):
                    continue
                full = os.path.join(r, f)
                arc = os.path.join(addon_id, os.path.relpath(full, src_dir))
                if replace and f == 'addon.xml' and r == src_dir:
                    data = open(full, encoding='utf-8').read()
                    for k, v in replace.items():
                        data = data.replace(k, v)
                    z.writestr(arc, data)
                else:
                    z.write(full, arc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base-url', default='', help='https://USER.github.io/REPO — адрес, где лежит сайт репозитория')
    a = ap.parse_args()
    base = a.base_url.rstrip('/')
    dist = os.path.join(ROOT, 'dist')
    shutil.rmtree(dist, ignore_errors=True)
    rel = os.path.join(dist, 'releases')
    items = []   # (id, version, addon.xml text)
    for aid in ADDONS:
        d = os.path.join(ROOT, aid)
        if not os.path.isdir(d):
            print('пропуск (нет папки):', aid); continue
        v = version_of(d)
        z = os.path.join(rel, '%s-%s.zip' % (aid, v))
        make_zip(d, aid, z)
        print('zip:', os.path.relpath(z, ROOT))
        items.append((aid, v, os.path.join(d, 'addon.xml'), z, d))
    if base:
        d = os.path.join(ROOT, REPO_ADDON)
        v = version_of(d)
        z = os.path.join(rel, '%s-%s.zip' % (REPO_ADDON, v))
        make_zip(d, REPO_ADDON, z, {'@BASE_URL@': base})
        print('zip:', os.path.relpath(z, ROOT))
        site = os.path.join(dist, 'site')
        parts = []
        entries = items + [(REPO_ADDON, v, os.path.join(d, 'addon.xml'), z, d)]
        for aid, ver, axml, zpath, adir in entries:
            text = open(axml, encoding='utf-8').read().replace('@BASE_URL@', base)
            body = '\n'.join(l for l in text.splitlines() if not l.startswith('<?xml'))
            parts.append(body.strip())
            dz = os.path.join(site, 'zips', aid)
            os.makedirs(dz, exist_ok=True)
            shutil.copy2(zpath, os.path.join(dz, os.path.basename(zpath)))
            for ic in ('icon.png', 'fanart.jpg'):
                if os.path.exists(os.path.join(adir, ic)):
                    shutil.copy2(os.path.join(adir, ic), os.path.join(dz, ic))
        xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<addons>\n' + '\n'.join(parts) + '\n</addons>\n'
        ET.fromstring(xml.split('\n', 1)[1])   # проверка, что XML корректен
        open(os.path.join(site, 'addons.xml'), 'w', encoding='utf-8', newline='\n').write(xml)
        open(os.path.join(site, 'addons.xml.md5'), 'w').write(hashlib.md5(xml.encode('utf-8')).hexdigest())
        open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(
            '<!doctype html><meta charset="utf-8"><title>Glass Control repository</title>'
            '<p>Репозиторий дополнений Kodi. Установите <a href="zips/%s/%s-%s.zip">%s</a> через «Установить из zip-файла».</p>' % (REPO_ADDON, REPO_ADDON, v, REPO_ADDON))
        print('репозиторий:', os.path.relpath(site, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())

"""Файловые операции и источники. Чистый Python — тестируется вне Kodi."""
import os
import xml.etree.ElementTree as ET

from . import vfs


class OpError(Exception):
    pass


def list_dir(path):
    if not path:
        raise OpError('empty path')
    if '://' in path and not path.endswith(('/', '\\')):
        path += '/'  # сетевые пути: xbmcvfs.exists() для корня шары ненадёжен, поэтому просто читаем
    try:
        dirs, files = vfs.listdir(path)
    except Exception as e:  # noqa: BLE001
        raise OpError('cannot read %s: %s' % (path, e))
    out = []
    for n in dirs:
        p = vfs.join(path, n) + vfs.sep_of(path)
        out.append({'name': n, 'path': p, 'dir': True, 'size': 0, 'mtime': 0})
    for n in files:
        p = vfs.join(path, n)
        size, mtime = vfs.stat(p)
        out.append({'name': n, 'path': p, 'dir': False, 'size': size, 'mtime': mtime})
    out.sort(key=lambda x: (not x['dir'], x['name'].lower()))
    return {'path': path, 'parent': vfs.parent(path), 'items': out}


def _copy_tree(src, dst):
    vfs.mkdir(dst.rstrip('/\\') + '/')
    dirs, files = vfs.listdir(src)
    for f in files:
        if not vfs.copy_file(vfs.join(src, f), vfs.join(dst, f)):
            raise OpError('copy failed: ' + f)
    for d in dirs:
        _copy_tree(vfs.join(src, d) + vfs.sep_of(src), vfs.join(dst, d) + vfs.sep_of(dst))


def _is_dir(p):
    return p.endswith(('/', '\\')) or vfs.isdir(p)


def _target(src, dst_dir):
    name = vfs.basename(src)
    t = vfs.join(dst_dir, name)
    return t + (vfs.sep_of(dst_dir) if _is_dir(src) else '')


def copy(srcs, dst, overwrite=False):
    res = {'ok': [], 'failed': []}
    for s in srcs:
        try:
            t = _target(s, dst)
            if vfs.exists(t) and not overwrite:
                raise OpError('exists')
            if t.rstrip('/\\') == s.rstrip('/\\') or (_is_dir(s) and t.startswith(s.rstrip('/\\') + '/')):
                raise OpError('cannot copy into itself')
            if _is_dir(s):
                _copy_tree(s, t)
            elif not vfs.copy_file(s, t):
                raise OpError('copy failed')
            res['ok'].append(s)
        except Exception as e:  # noqa: BLE001
            res['failed'].append({'path': s, 'error': str(e)})
    return res


def move(srcs, dst, overwrite=False):
    res = {'ok': [], 'failed': []}
    for s in srcs:
        try:
            if not vfs.depth_ok(s):
                raise OpError('protected path')
            t = _target(s, dst)
            if vfs.exists(t) and not overwrite:
                raise OpError('exists')
            if _is_dir(s) and t.startswith(s.rstrip('/\\') + '/'):
                raise OpError('cannot move into itself')
            ok = False
            try:
                ok = vfs.rename(s.rstrip('/\\') if _is_dir(s) else s, t.rstrip('/\\') if _is_dir(s) else t)
            except Exception:  # noqa: BLE001
                ok = False
            if not ok:                       # другая файловая система — копия + удаление
                if _is_dir(s):
                    _copy_tree(s, t)
                    vfs.rmdir(s)
                else:
                    if not vfs.copy_file(s, t):
                        raise OpError('copy failed')
                    vfs.delete_file(s)
            res['ok'].append(s)
        except Exception as e:  # noqa: BLE001
            res['failed'].append({'path': s, 'error': str(e)})
    return res


def rename(path, name):
    if not vfs.depth_ok(path):
        raise OpError('protected path')
    if not name or '/' in name or '\\' in name:
        raise OpError('bad name')
    d = _is_dir(path)
    t = vfs.join(vfs.parent(path), name)
    if vfs.exists(t):
        raise OpError('exists')
    if not vfs.rename(path.rstrip('/\\') if d else path, t):
        raise OpError('rename failed')
    return {'path': t + (vfs.sep_of(path) if d else '')}


def delete(paths):
    res = {'ok': [], 'failed': []}
    for p in paths:
        try:
            if not vfs.depth_ok(p):
                raise OpError('protected path')
            if _is_dir(p):
                vfs.rmdir(p)
            elif not vfs.delete_file(p):
                raise OpError('delete failed')
            res['ok'].append(p)
        except Exception as e:  # noqa: BLE001
            res['failed'].append({'path': p, 'error': str(e)})
    return res


def mkdir(path, name):
    if not name or '/' in name or '\\' in name:
        raise OpError('bad name')
    t = vfs.join(path, name)
    if vfs.exists(t) or vfs.exists(t + '/'):
        raise OpError('exists')
    vfs.mkdir(t + vfs.sep_of(path))
    return {'path': t + vfs.sep_of(path)}


# ---------------------------------------------------------------- sources.xml
MEDIA = ('video', 'music', 'pictures', 'programs', 'files', 'games')


def _load(path):
    if os.path.exists(path):
        try:
            return ET.parse(path).getroot()
        except ET.ParseError:
            raise OpError('sources.xml is damaged')
    root = ET.Element('sources')
    for m in ('programs', 'video', 'music', 'pictures', 'files', 'games'):
        ET.SubElement(ET.SubElement(root, m), 'default').set('pathversion', '1')
    return root


def sources_list(xml_path, media):
    root = _load(xml_path)
    sec = root.find(media)
    out = []
    if sec is not None:
        for s in sec.findall('source'):
            out.append({'name': (s.findtext('name') or ''), 'paths': [p.text or '' for p in s.findall('path')],
                        'allowsharing': (s.findtext('allowsharing') or 'true') != 'false'})
    return out


def sources_add(xml_path, media, name, path):
    if media not in MEDIA:
        raise OpError('bad media')
    if not name or not path:
        raise OpError('name and path required')
    root = _load(xml_path)
    sec = root.find(media)
    if sec is None:
        sec = ET.SubElement(root, media)
        ET.SubElement(sec, 'default').set('pathversion', '1')
    for s in sec.findall('source'):
        if s.findtext('name') == name:
            raise OpError('source with this name exists')
    if not path.endswith(('/', '\\')):
        path += vfs.sep_of(path)
    s = ET.SubElement(sec, 'source')
    ET.SubElement(s, 'name').text = name
    p = ET.SubElement(s, 'path')
    p.set('pathversion', '1')
    p.text = path
    ET.SubElement(s, 'allowsharing').text = 'true'
    _save(root, xml_path)
    return {'restart': True}


def _norm(p):
    import re
    return re.sub(r'^([a-z0-9+]+://)[^@/]*@', r'\1', (p or '').strip()).rstrip('/\\').lower()


def _nn(x):
    """Имя для сравнения: Kodi показывает «_» как пробел и меняет регистр, поэтому сравниваем только буквы и цифры."""
    return ''.join(c for c in (x or '').lower() if c.isalnum())


def sources_remove(xml_path, media, name, path=''):
    """Удаляет источник по имени, иначе по пути; ищет сначала в нужном разделе, затем во всех."""
    root = _load(xml_path)
    secs = [root.find(media)] + [root.find(m) for m in MEDIA if m != media]
    secs = [x for x in secs if x is not None]
    want = _norm(path)
    n = 0
    for sec in secs:
        for s in list(sec.findall('source')):
            same_name = _nn(s.findtext('name')) == _nn(name)
            same_path = bool(want) and any(_norm(p.text) == want for p in s.findall('path'))
            if same_name or same_path:
                sec.remove(s)
                n += 1
        if n:
            break
    if not n:
        have = ['%s: %s' % (sec.tag, (s.findtext('name') or '?')) for sec in root for s in sec.findall('source')]
        return {'restart': True, 'already': True, 'looked_for': name, 'have': have}
    _save(root, xml_path)
    return {'restart': True}


def _save(root, xml_path):
    try:
        ET.indent(root)      # py3.9+
    except AttributeError:
        pass
    tmp = xml_path + '.tmp'
    ET.ElementTree(root).write(tmp, encoding='utf-8', xml_declaration=True)
    os.replace(tmp, xml_path)


# ---------------------------------------------------------------- яркость (Linux sysfs)
def _bl():
    base = '/sys/class/backlight'
    if not os.path.isdir(base):
        return None
    for n in sorted(os.listdir(base)):
        d = os.path.join(base, n)
        if os.path.exists(os.path.join(d, 'brightness')) and os.path.exists(os.path.join(d, 'max_brightness')):
            return d
    return None


def brightness_get():
    d = _bl()
    if not d:
        return {'supported': False}
    mx = int(open(os.path.join(d, 'max_brightness')).read())
    cur = int(open(os.path.join(d, 'brightness')).read())
    return {'supported': True, 'value': round(cur * 100.0 / mx), 'max': mx}


def brightness_set(pct):
    d = _bl()
    if not d:
        raise OpError('not supported')
    mx = int(open(os.path.join(d, 'max_brightness')).read())
    v = max(1, min(mx, int(round(pct * mx / 100.0))))
    with open(os.path.join(d, 'brightness'), 'w') as f:
        f.write(str(v))
    return brightness_get()


BUILTIN_OK = ('InstallAddon(', 'UpdateAddonRepos', 'UpdateLocalAddons', 'ActivateScreensaver', 'ReloadSkin', 'CleanLibrary(', 'UpdateLibrary(')


# ---------------------------------------------------------------- полная очистка медиатеки
def _db_file(db_dir, kind):
    import glob
    pat = 'MyVideos*.db' if kind == 'video' else 'MyMusic*.db'
    found = []
    for f in glob.glob(os.path.join(db_dir, pat)):
        digits = ''.join(c for c in os.path.basename(f) if c.isdigit())
        if digits:
            found.append((int(digits), f))
    if not found:
        raise OpError('library database not found in ' + db_dir)
    return sorted(found)[-1][1]


def _cols(con, table, schema='main'):
    return [r[1] for r in con.execute('PRAGMA %s.table_info("%s")' % (schema, table))]


def lib_wipe(db_dir, kind):
    """Стирает данные библиотеки (видео или музыки), оставляя структуру БД.

    Для видео в таблице path сохраняются строки с заданным «содержимым» (тип фильмы/сериалы, скрапер, настройки):
    без них Kodi не сканирует источник. У этих строк сбрасывается хэш, чтобы папки пересканировались.
    Копия базы кладётся рядом: *.YYYYmmdd-HHMMSS.glassbak.
    """
    import shutil
    import time
    try:
        import sqlite3
    except ImportError:
        raise OpError('sqlite3 is not available in this Kodi build')
    if kind not in ('video', 'music'):
        raise OpError('bad kind')
    db = _db_file(db_dir, kind)
    bak = '%s.%s.glassbak' % (db, time.strftime('%Y%m%d-%H%M%S'))
    shutil.copy2(db, bak)
    con = sqlite3.connect(db, timeout=30)
    n = 0
    kept = 0
    try:
        con.execute('PRAGMA foreign_keys=OFF')
        names = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        con.execute('BEGIN')
        for name in names:
            if name in ('version', 'sqlite_sequence') or name.startswith('sqlite_'):
                continue
            if kind == 'video' and name == 'path':
                continue
            con.execute('DELETE FROM "%s"' % name.replace('"', '""'))
            n += 1
        if kind == 'video' and 'path' in names:
            con.execute("DELETE FROM path WHERE strContent IS NULL OR strContent = ''")
            cols = _cols(con, 'path')
            sets = [c + '=NULL' for c in ('strHash', 'idParentPath') if c in cols]
            if sets:
                con.execute('UPDATE path SET ' + ', '.join(sets))
            kept = con.execute('SELECT COUNT(*) FROM path').fetchone()[0]
        if 'sqlite_sequence' in names:
            con.execute("DELETE FROM sqlite_sequence WHERE name != 'path'")
        con.commit()
        try:
            con.execute('VACUUM')
        except Exception:  # noqa: BLE001
            pass
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
    return {'ok': True, 'tables': n, 'kept_sources': kept, 'backup': bak}


def video_restore_content(db_dir):
    """Возвращает тип содержимого и скрапер источников из копий *.glassbak (если очистка прошла старой версией)."""
    import glob
    import sqlite3
    db = _db_file(db_dir, 'video')
    baks = sorted(glob.glob(db + '*.glassbak'))
    if not baks:
        raise OpError('no backups found next to ' + db)
    con = sqlite3.connect(db, timeout=30)
    restored = 0
    try:
        for b in baks:
            con.execute("ATTACH DATABASE ? AS b", (b,))
            try:
                cols = [c for c in _cols(con, 'path') if c in _cols(con, 'path', 'b') and c != 'idPath']
                rows = con.execute("SELECT strPath, strContent, strScraper, strSettings FROM b.path WHERE strContent IS NOT NULL AND strContent != ''").fetchall()
                for sp, sc, sr, ss in rows:
                    cur = con.execute('SELECT idPath FROM main.path WHERE strPath = ?', (sp,)).fetchone()
                    if cur:
                        con.execute('UPDATE main.path SET strContent=?, strScraper=?, strSettings=?, strHash=NULL WHERE idPath=?', (sc, sr, ss, cur[0]))
                    else:
                        con.execute('INSERT INTO main.path (strPath, strContent, strScraper, strSettings) VALUES (?,?,?,?)', (sp, sc, sr, ss))
                    restored += 1
            finally:
                con.commit()
                con.execute('DETACH DATABASE b')
    finally:
        con.close()
    if not restored:
        raise OpError('backups contain no source content settings')
    return {'ok': True, 'restored': restored}

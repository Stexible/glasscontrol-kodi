"""Файловые операции и источники. Чистый Python — тестируется вне Kodi."""
import os
import re
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
        raise OpError(str(e))
    out = []
    for n in dirs:
        out.append({'name': n, 'path': vfs.join(path, n) + vfs.sep_of(path), 'dir': True, 'size': 0, 'mtime': 0})
    for n in files:
        out.append({'name': n, 'path': vfs.join(path, n), 'dir': False, 'size': 0, 'mtime': 0})
    return {'path': path, 'items': out}


def mkdir(path, name):
    if not path or not name:
        raise OpError('path and name required')
    full = vfs.join(path, name)
    if vfs.exists(full):
        raise OpError('already exists')
    if not vfs.mkdir(full):
        raise OpError('mkdir failed')
    return {'path': full}


# ---------------------------------------------------------------- sources.xml
MEDIA = ('video', 'music', 'pictures', 'programs', 'files', 'games')

_AUTH_RE = re.compile(r'^([a-z0-9+]+://)([^/@]+)@(.*)$', re.I)
_URL_RE = re.compile(r'^([a-z0-9+]+)://([^/]*)(?:/([^/]*))?', re.I)


def split_auth(path):
    p = (path or '').strip()
    m = _AUTH_RE.match(p)
    if not m:
        return p, '', ''
    user, _, pw = m.group(2).partition(':')
    return m.group(1) + m.group(3), user, pw


def share_key(path):
    clean, _, _ = split_auth(path)
    m = _URL_RE.match(clean)
    if not m:
        return ''
    scheme, host, share = m.group(1).lower(), m.group(2), m.group(3) or ''
    if host.startswith('[') and ']' in host:
        host = host[1:host.index(']')]
    elif ':' in host:
        h, _, port = host.rpartition(':')
        if port.isdigit():
            host = h
    return scheme + '://' + host + ('/' + share if share else '/')


def _with_auth(clean, user, pw):
    m = _URL_RE.match(clean or '')
    if not m:
        return clean
    scheme = m.group(1)
    return scheme + '://' + user + (':' + pw if pw else '') + '@' + clean[len(scheme) + 3:]


def _passwords_load(path):
    if os.path.exists(path):
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            raise OpError('passwords.xml is damaged')
        if root.tag == 'passwords':
            return root
    return ET.Element('passwords')


def _passwords_put(root, clean, auth):
    key = share_key(clean)
    if not key:
        return False
    for e in list(root.findall('path')):
        if (e.findtext('from') or '').strip().lower() == key.lower():
            root.remove(e)
    e = ET.SubElement(root, 'path')
    ET.SubElement(e, 'from').text = key
    ET.SubElement(e, 'to').text = auth
    return True


def passwords_upsert(path, clean, auth):
    root = _passwords_load(path)
    ok = _passwords_put(root, clean, auth)
    if ok:
        _save(root, path)
    return ok


def passwords_remove(path, clean):
    if not os.path.exists(path):
        return False
    root = _passwords_load(path)
    key = share_key(clean).lower()
    n = 0
    for e in list(root.findall('path')):
        if (e.findtext('from') or '').strip().lower() == key:
            root.remove(e)
            n += 1
    if n:
        _save(root, path)
    return bool(n)


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


def sources_add(xml_path, media, name, path, passwords_path=''):
    if media not in MEDIA:
        raise OpError('bad media')
    if not name or not path:
        raise OpError('name and path required')
    clean, user, pw = split_auth(path)
    if not clean:
        raise OpError('bad path')
    if user and not passwords_path:
        raise OpError('passwords.xml path required')
    if not clean.endswith(('/', '\\')):
        clean += vfs.sep_of(clean)
    root = _load(xml_path)
    sec = root.find(media)
    if sec is None:
        sec = ET.SubElement(root, media)
        ET.SubElement(sec, 'default').set('pathversion', '1')
    for s in sec.findall('source'):
        if s.findtext('name') == name:
            raise OpError('source with this name exists')
    s = ET.SubElement(sec, 'source')
    ET.SubElement(s, 'name').text = name
    p = ET.SubElement(s, 'path')
    p.set('pathversion', '1')
    p.text = clean
    ET.SubElement(s, 'allowsharing').text = 'true'
    _save(root, xml_path)
    auth = False
    if user:
        auth = passwords_upsert(passwords_path, clean, _with_auth(clean, user, pw))
    return {'restart': True, 'path': clean, 'auth': auth}


def _norm(p):
    return re.sub(r'^([a-z0-9+]+://)[^@/]*@', r'\1', (p or '').strip()).rstrip('/\\').lower()


def _nn(x):
    return ''.join(c for c in (x or '').lower() if c.isalnum())


def sources_remove(xml_path, media, name, path='', passwords_path=''):
    root = _load(xml_path)
    secs = [root.find(media)] + [root.find(m) for m in MEDIA if m != media]
    secs = [x for x in secs if x is not None]
    want = _norm(path)
    removed = []
    n = 0
    for sec in secs:
        for s in list(sec.findall('source')):
            same_name = _nn(s.findtext('name')) == _nn(name)
            same_path = bool(want) and any(_norm(p.text) == want for p in s.findall('path'))
            if same_name or same_path:
                removed += [p.text or '' for p in s.findall('path')]
                sec.remove(s)
                n += 1
        if n:
            break
    if not n:
        have = ['%s: %s' % (sec.tag, (s.findtext('name') or '?')) for sec in root for s in sec.findall('source')]
        return {'restart': True, 'already': True, 'looked_for': name, 'have': have}
    _save(root, xml_path)
    if passwords_path and removed:
        left = set(share_key(p.text or '') for sec in root for s in sec.findall('source') for p in s.findall('path'))
        for p in removed:
            k = share_key(p)
            if k and k not in left:
                passwords_remove(passwords_path, p)
    return {'restart': True}


def sources_sanitize(xml_path, passwords_path):
    if not passwords_path:
        return {'moved': 0}
    root = _load(xml_path)
    proot = _passwords_load(passwords_path)
    moved = 0
    for sec in root:
        for s in sec.findall('source'):
            for p in s.findall('path'):
                clean, user, pw = split_auth(p.text or '')
                if not user:
                    continue
                if not clean.endswith(('/', '\\')):
                    clean += vfs.sep_of(clean)
                p.text = clean
                if _passwords_put(proot, clean, _with_auth(clean, user, pw)):
                    moved += 1
    if moved:
        _save(root, xml_path)
        _save(proot, passwords_path)
    return {'moved': moved}


def _save(root, xml_path):
    try:
        ET.indent(root)
    except AttributeError:
        pass
    tmp = xml_path + '.tmp'
    ET.ElementTree(root).write(tmp, encoding='utf-8', xml_declaration=True)
    os.replace(tmp, xml_path)


# ---------------------------------------------------------------- brightness
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


# ---------------------------------------------------------------- library db
def _db_file(db_dir, kind):
    import glob
    pat = 'MyVideos' if kind == 'video' else 'MyMusic'
    found = []
    for f in glob.glob(os.path.join(db_dir, pat + '*.db')):
        m = re.match(r'^' + pat + r'(\d+)\.db$', os.path.basename(f))
        if m:
            found.append((int(m.group(1)), f))
    if not found:
        raise OpError('library database not found in ' + db_dir)
    return sorted(found)[-1][1]


def _cols(con, table, schema='main'):
    return [r[1] for r in con.execute('PRAGMA %s.table_info("%s")' % (schema, table))]


SCRAPERS = {'movies': 'metadata.themoviedb.org.python',
            'tvshows': 'metadata.tvshows.themoviedb.org.python',
            'musicvideos': 'metadata.local'}


def _db_opt(db_dir, kind):
    try:
        return _db_file(db_dir, kind)
    except OpError:
        return None


def _db_connect(db):
    import sqlite3
    con = sqlite3.connect(db, timeout=5)
    try:
        con.execute('PRAGMA busy_timeout=5000')
    except Exception:
        pass
    return con


def _norm_path(path):
    p, _, _ = split_auth(path)
    p = (p or '').strip()
    if p and not p.endswith(('/', '\\')):
        p += vfs.sep_of(p)
    return p


def set_video_content(db_dir, path, content, scraper=''):
    if content not in ('', 'none', 'movies', 'tvshows', 'musicvideos'):
        raise OpError('bad content')
    clean = _norm_path(path)
    if not clean:
        raise OpError('empty path')
    db = _db_opt(db_dir, 'video')
    if not db:
        return {'content': False, 'path': clean, 'warning': 'video database not found'}
    content = '' if content == 'none' else content
    scraper = (scraper or SCRAPERS.get(content, '')) if content else ''
    con = _db_connect(db)
    try:
        cols = _cols(con, 'path')
        row = con.execute('SELECT idPath, strSettings FROM path WHERE strPath=?', (clean,)).fetchone()
        settings = row[1] if row and row[1] else None
        if content and not settings:
            s = con.execute("SELECT strSettings FROM path WHERE strContent=? AND strSettings IS NOT NULL "
                            "AND strSettings != '' LIMIT 1", (content,)).fetchone()
            settings = s[0] if s else None
        vals = {'strContent': content, 'strScraper': scraper, 'strHash': None,
                'scanRecursive': 2147483647, 'useFolderNames': 0, 'noUpdate': 0, 'exclude': 0}
        if settings is not None:
            vals['strSettings'] = settings
        vals = {k: v for k, v in vals.items() if k in cols}
        if row:
            con.execute('UPDATE path SET ' + ', '.join(k + '=?' for k in vals) + ' WHERE idPath=?',
                        list(vals.values()) + [row[0]])
        else:
            keys = ['strPath'] + list(vals)
            con.execute('INSERT INTO path (%s) VALUES (%s)' % (','.join(keys), ','.join('?' * len(keys))),
                        [clean] + list(vals.values()))
        con.commit()
    finally:
        con.close()
    return {'content': True, 'path': clean, 'scraper': scraper}


def fix_video_paths(db_dir):
    db = _db_opt(db_dir, 'video')
    if not db:
        return {'fixed': 0, 'warning': 'video database not found'}
    con = _db_connect(db)
    fixed = disabled = 0
    try:
        cols = _cols(con, 'path')
        if 'strContent' not in cols or 'scanRecursive' not in cols:
            return {'fixed': 0}
        rows = con.execute("SELECT idPath, strPath, scanRecursive, useFolderNames, noUpdate, exclude FROM path "
                           "WHERE strContent IS NOT NULL AND strContent != ''").fetchall()
        for idp, _sp, rec, ufn, nu, ex in rows:
            con.execute('UPDATE path SET scanRecursive=2147483647, useFolderNames=0, noUpdate=0, exclude=0, strHash=NULL WHERE idPath=?', [idp])
            fixed += 1
        for idp, sp in con.execute("SELECT idPath, strPath FROM path WHERE strPath LIKE '%:445/%'").fetchall():
            twin = sp.replace(':445/', '/', 1)
            if con.execute('SELECT 1 FROM path WHERE strPath=?', (twin,)).fetchone():
                con.execute('UPDATE path SET exclude=1 WHERE idPath=?', (idp,))
                disabled += 1
        con.commit()
    finally:
        con.close()
    return {'fixed': fixed, 'disabled': disabled}


def music_sources(xml_path):
    root = _load(xml_path)
    out = []
    sec = root.find('music')
    if sec is not None:
        for s in sec.findall('source'):
            for p in s.findall('path'):
                c = _norm_path(p.text or '')
                if c and c not in out:
                    out.append(c)
    return out


def fix_music_paths(db_dir, xml_path):
    srcs = music_sources(xml_path)
    db = _db_opt(db_dir, 'music')
    if not db:
        return {'added': 0, 'sources': len(srcs), 'warning': 'music database not found'}
    con = _db_connect(db)
    added = 0
    try:
        cols = _cols(con, 'path')
        if 'strPath' not in cols:
            return {'added': 0, 'sources': len(srcs)}
        for idp, sp in con.execute('SELECT idPath, strPath FROM path').fetchall():
            if split_auth(sp or '')[1]:
                con.execute('DELETE FROM path WHERE idPath=?', (idp,))
        for p in srcs:
            if not con.execute('SELECT 1 FROM path WHERE strPath=?', (p,)).fetchone():
                con.execute('INSERT INTO path (strPath, strHash) VALUES (?, NULL)', (p,))
                added += 1
        con.commit()
    finally:
        con.close()
    return {'added': added, 'sources': len(srcs)}


def video_content_map(db_dir):
    db = _db_opt(db_dir, 'video')
    if not db:
        return {}
    con = _db_connect(db)
    try:
        return {sp.rstrip('/').lower(): (sc or '') for sp, sc in con.execute(
            "SELECT strPath, strContent FROM path WHERE strContent IS NOT NULL AND strContent != ''")}
    finally:
        con.close()


def lib_fix(db_dir, xml_path, passwords_path, kind=''):
    res = {'sources': sources_sanitize(xml_path, passwords_path)}
    if kind in ('', 'video'):
        res['video'] = fix_video_paths(db_dir)
    if kind in ('', 'music'):
        res['music'] = fix_music_paths(db_dir, xml_path)
    return res


def lib_reset(db_dir, kind=''):
    out = {}
    kinds = ['video', 'music'] if kind in ('', 'all') else [kind]
    for k in kinds:
        if k not in ('video', 'music'):
            continue
        db = _db_opt(db_dir, k)
        if not db:
            out[k] = {'error': 'db not found'}
            continue
        con = _db_connect(db)
        try:
            con.execute('DELETE FROM path')
            con.commit()
            out[k] = {'ok': True}
        finally:
            con.close()
    return out


def lib_reset(db_dir, kind=''):
    out = {}
    kinds = ['video', 'music'] if kind in ('', 'all') else [kind]
    for k in kinds:
        if k not in ('video', 'music'):
            continue
        db = _db_opt(db_dir, k)
        if not db:
            out[k] = {'error': 'db not found'}
            continue
        con = _db_connect(db)
        try:
            con.execute('DELETE FROM path')
            con.commit()
            out[k] = {'ok': True}
        finally:
            con.close()
    return out
    out = {'video': [], 'music': []}
    for kind, key in (('video', 'video'), ('music', 'music')):
        db = _db_opt(db_dir, kind)
        if not db:
            out[key] = {'error': 'db not found'}
            continue
        con = _db_connect(db)
        try:
            cols = _cols(con, 'path')
            rows = con.execute('SELECT * FROM path').fetchall()
            out[key] = {'db': os.path.basename(db), 'cols': cols, 'rows': [list(r) for r in rows]}
        finally:
            con.close()
    # tail of kodi.log via xbmcvfs
    tail = None
    try:
        import xbmcvfs
        f = xbmcvfs.File('special://logpath/kodi.log')
        size = f.size()
        toread = min(size, 200000)
        if size > toread:
            f.seek(size - toread, 0)
        data = f.readBytes(toread)
        f.close()
        tail = data.decode('utf-8', 'replace') if isinstance(data, (bytes, bytearray)) else str(data)
        out['log_via'] = 'xbmcvfs'
        out['log_size'] = size
    except Exception as e:
        out['log_vfs_error'] = str(e)
    if not tail:
        try:
            import xbmc
            logp = xbmc.translatePath('special://logpath/kodi.log')
            out['log_path'] = logp
            if logp and os.path.exists(logp):
                with open(logp, 'rb') as fh:
                    fh.seek(0, 2)
                    size = fh.tell()
                    fh.seek(max(0, size - 200000))
                    tail = fh.read().decode('utf-8', 'replace')
                    out['log_via'] = 'os'
                    out['log_size'] = size
        except Exception as e:
            out['log_os_error'] = str(e)
    if tail:
        out['log_tail'] = tail
    # sources.xml content
    try:
        import xbmc
        sx = xbmc.translatePath('special://profile/sources.xml')
        if os.path.exists(sx):
            with open(sx) as f:
                out['sources_xml'] = f.read()
    except Exception as e:
        out['sources_error'] = str(e)
    # passwords.xml content
    try:
        import xbmc
        pwx = xbmc.translatePath('special://profile/passwords.xml')
        if os.path.exists(pwx):
            with open(pwx) as f:
                out['passwords_xml'] = f.read()
    except Exception as e:
        out['passwords_error'] = str(e)
    # internet check
    try:
        import urllib.request
        r = urllib.request.urlopen('http://www.google.com/generate_204', timeout=8)
        out['internet'] = 'ok (google ' + str(r.getcode()) + ')'
    except Exception as e:
        out['internet'] = 'FAIL: ' + str(e)
    return out


def lib_wipe(db_dir, kind):
    import shutil
    import time
    import sqlite3
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
            for c, v in (('scanRecursive', '2147483647'), ('useFolderNames', '0'), ('noUpdate', '0'), ('exclude', '0')):
                if c in cols:
                    sets.append('%s=%s' % (c, v))
            if sets:
                con.execute('UPDATE path SET ' + ', '.join(sets))
            kept = con.execute('SELECT COUNT(*) FROM path').fetchone()[0]
        if 'sqlite_sequence' in names:
            con.execute("DELETE FROM sqlite_sequence WHERE name != 'path'")
        con.commit()
        try:
            con.execute('VACUUM')
        except Exception:
            pass
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
    return {'ok': True, 'tables': n, 'kept_sources': kept, 'backup': bak}


def video_restore_content(db_dir):
    import glob
    import sqlite3
    db = _db_file(db_dir, 'video')
    baks = sorted(glob.glob(db + '*.glassbak'))
    if not baks:
        raise OpError('no backups found next to ' + db)
    con = sqlite3.connect(db, timeout=30)
    restored = 0
    try:
        con.execute('PRAGMA busy_timeout=30000')
        for b in baks:
            con.execute("ATTACH DATABASE ? AS b", (b,))
            try:
                cols = [c for c in _cols(con, 'path') if c in _cols(con, 'path', 'b') and c != 'idPath']
                extra = [c for c in ('scanRecursive', 'useFolderNames', 'noUpdate', 'exclude') if c in cols]
                defaults = {'scanRecursive': 2147483647, 'useFolderNames': 0, 'noUpdate': 0, 'exclude': 0}
                sel = ['strPath', 'strContent', 'strScraper', 'strSettings'] + extra
                rows = con.execute('SELECT ' + ', '.join(sel) + " FROM b.path WHERE strContent IS NOT NULL AND strContent != ''").fetchall()
                for r in rows:
                    sp, sc, sr, ss = r[:4]
                    ev = {k: (v if v is not None else defaults[k]) for k, v in zip(extra, r[4:])}
                    cur = con.execute('SELECT idPath FROM main.path WHERE strPath = ?', (sp,)).fetchone()
                    tail = ''.join(', %s=?' % k for k in ev)
                    if cur:
                        con.execute('UPDATE main.path SET strContent=?, strScraper=?, strSettings=?, strHash=NULL'
                                    + tail + ' WHERE idPath=?', [sc, sr, ss] + list(ev.values()) + [cur[0]])
                    else:
                        keys = ['strPath', 'strContent', 'strScraper', 'strSettings'] + list(ev)
                        con.execute('INSERT INTO main.path (%s) VALUES (%s)' % (','.join(keys), ','.join('?' * len(keys))),
                                    [sp, sc, sr, ss] + list(ev.values()))
                    restored += 1
            finally:
                con.commit()
                con.execute('DETACH DATABASE b')
    finally:
        con.close()
    if not restored:
        raise OpError('backups contain no source content settings')
    return {'ok': True, 'restored': restored}


def debug_info(db_dir):
    out = {'db_dir': db_dir}
    try:
        import xbmcvfs
        logp = xbmcvfs.translatePath('special://logpath/kodi.log')
        f = xbmcvfs.File(logp)
        size = f.size()
        toread = min(size, 200000)
        if size > toread:
            f.seek(size - toread, 0)
        data = f.readBytes(toread)
        f.close()
        out['log_tail'] = (data.decode('utf-8', 'replace') if isinstance(data, (bytes, bytearray)) else str(data))
        out['log_size'] = size
    except Exception as e:
        out['log_error'] = str(e)
    try:
        import xbmcvfs
        sx = xbmcvfs.translatePath('special://profile/sources.xml')
        if xbmcvfs.exists(sx):
            f = xbmcvfs.File(sx)
            data = f.readBytes(f.size())
            f.close()
            out['sources_xml'] = data.decode('utf-8', 'replace') if isinstance(data, (bytes, bytearray)) else str(data)
    except Exception as e:
        out['sources_error'] = str(e)
    return out


def textures_reset():
    '''Удаляет повреждённую базу кэша текстур Kodi (Textures13.db) и её служебные файлы.'''
    try:
        import xbmcvfs
    except Exception:
        xbmcvfs = None
    base = (xbmcvfs.translatePath('special://userdata/Database/Textures13.db')
            if xbmcvfs else 'special://userdata/Database/Textures13.db')
    deleted = []
    for suf in ('', '-wal', '-shm', '-journal'):
        p = base + suf
        try:
            exists = (xbmcvfs.exists(p) if xbmcvfs else os.path.exists(p))
            if exists:
                if xbmcvfs:
                    ok = bool(xbmcvfs.delete(p))
                else:
                    os.remove(p)
                    ok = True
                if ok:
                    deleted.append(p)
        except Exception:
            pass
    return {'deleted': deleted}
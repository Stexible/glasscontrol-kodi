# -*- coding: utf-8 -*-
"""Glass Control backend: локальный HTTP-сервис для операций, которых нет в JSON-RPC Kodi."""
import json
import mimetypes
import os
import secrets
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import xbmc
import xbmcaddon
import xbmcgui
import xbmcvfs

ADDON = xbmcaddon.Addon()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import ops  # noqa: E402

TOKEN = secrets.token_hex(16)
VERSION = ADDON.getAddonInfo('version')


def sources_xml():
    return xbmcvfs.translatePath('special://profile/sources.xml')


def passwords_xml():
    return xbmcvfs.translatePath('special://profile/passwords.xml')


def db_dir():
    return xbmcvfs.translatePath('special://database/')


class Handler(BaseHTTPRequestHandler):
    server_version = 'GlassControl/' + VERSION

    def log_message(self, *a):  # тишина в логе
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'X-Token, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Max-Age', '600')

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _download(self, fpath):
        if not fpath:
            return self._send(400, {'error': 'empty path'})
        xbmc.log('[glasscontrol] fs.download start: %s' % (fpath,), xbmc.LOGINFO)
        try:
            import xbmcvfs
            vf = xbmcvfs.File(fpath)
            size = vf.size()
        except Exception as e:
            xbmc.log('[glasscontrol] fs.download err: %r' % (e,), xbmc.LOGERROR)
            return self._send(400, {'error': str(e)})
        if size < 0:
            size = 0
        _MIME = {'.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma',
                 '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t', '.ogv': 'video/ogg'}
        ext = os.path.splitext(fpath)[1].lower()
        ct = mimetypes.guess_type(fpath)[0] or _MIME.get(ext) or 'application/octet-stream'
        # Range support for video/audio seeking
        rng = self.headers.get('Range', '')
        start = 0
        end = size - 1 if size > 0 else 0
        partial = False
        if rng.startswith('bytes=') and size > 0:
            try:
                spec = rng[6:].split(',')[0].strip()
                if '-' in spec:
                    a, b = spec.split('-', 1)
                    if a:
                        start = int(a)
                    if b:
                        end = int(b)
                    if start > end or start >= size:
                        self.send_response(416)
                        self._cors()
                        self.send_header('Content-Range', 'bytes */%d' % size)
                        self.end_headers()
                        try: vf.close()
                        except Exception: pass
                        return
                    partial = True
                    if end >= size:
                        end = size - 1
            except ValueError:
                partial = False
        if size == 0:
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', ct)
            self.send_header('Content-Length', '0')
            self.end_headers()
            try: vf.close()
            except Exception: pass
            return
        if partial:
            self.send_response(206)
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        else:
            self.send_response(200)
        self._cors()
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Disposition', 'inline')
        self.end_headers()
        try:
            if start > 0:
                vf.seek(start, 0)
            remaining = end - start + 1
            chunk = 65536
            while remaining > 0:
                toread = min(chunk, remaining)
                data = vf.readBytes(toread)
                if not data:
                    break
                self.wfile.write(data)
                remaining -= len(data)
        except Exception:
            pass
        try:
            vf.close()
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _auth(self):
        tok = self.headers.get('X-Token', '')
        if not tok:
            qs = urllib.parse.urlparse(self.path).query
            tok = urllib.parse.parse_qs(qs).get('token', [''])[0]
        return secrets.compare_digest(tok, TOKEN)

    def do_GET(self):
        qs = urllib.parse.urlparse(self.path).query
        d = {k: v[0] for k, v in urllib.parse.parse_qs(qs).items()}
        self._route('GET', d)

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(n) or b'{}')
        except Exception:  # noqa: BLE001
            return self._send(400, {'error': 'bad json'})
        self._route('POST', data)

    def _route(self, method, d):
        path = self.path.split('?')[0]
        if path == '/api/ping':          # ping без токена: только признак жизни
            return self._send(200, {'ok': 1, 'version': VERSION, 'auth': self._auth()})
        if not self._auth():
            return self._send(401, {'error': 'unauthorized'})
        try:
            if path == '/api/fs/download':
                return self._download(d.get('path', ''))
            if path == '/api/caps':
                android = xbmc.getCondVisibility('System.Platform.Android')
                return self._send(200, {'version': VERSION, 'android': bool(android), 'brightness': ops.brightness_get().get('supported', False),
                                        'platform': 'android' if android else sys.platform})
            if path == '/api/fs/list':
                xbmc.log('[glasscontrol] fs.list start: %s' % (d.get('path', ''),), xbmc.LOGINFO)
                res = ops.list_dir(d.get('path', ''))
                xbmc.log('[glasscontrol] fs.list done: %s (%d items)' % (d.get('path', ''), len(res.get('items', []))), xbmc.LOGINFO)
                return self._send(200, res)
            if path == '/api/fs/copy':
                return self._send(200, ops.copy(d['src'], d['dst'], bool(d.get('overwrite'))))
            if path == '/api/fs/move':
                return self._send(200, ops.move(d['src'], d['dst'], bool(d.get('overwrite'))))
            if path == '/api/fs/rename':
                return self._send(200, ops.rename(d['path'], d['name']))
            if path == '/api/fs/delete':
                return self._send(200, ops.delete(d['paths']))
            if path == '/api/fs/mkdir':
                return self._send(200, ops.mkdir(d['path'], d['name']))
            if path == '/api/sources/list':
                res = {'sources': ops.sources_list(sources_xml(), d.get('media', 'video'))}
                if d.get('media', 'video') == 'video':
                    res['content'] = ops.video_content_map(db_dir())
                return self._send(200, res)
            if path == '/api/sources/add':
                xbmc.log('[glasscontrol] sources.add start: %s %s' % (d.get('media'), d.get('name')), xbmc.LOGINFO)
                res = ops.sources_add(sources_xml(), d['media'], d['name'], d['path'], passwords_xml())
                content = d.get('content') or ''
                if d['media'] == 'video' and content:
                    res['content'] = ops.set_video_content(db_dir(), res['path'], content)
                if d['media'] == 'music':
                    res['music'] = ops.fix_music_paths(db_dir(), sources_xml())
                xbmc.log('[glasscontrol] sources.add done: %s' % (res,), xbmc.LOGINFO)
                return self._send(200, res)
            if path == '/api/sources/remove':
                return self._send(200, ops.sources_remove(sources_xml(), d['media'], d['name'], d.get('path', ''), passwords_xml()))
            if path == '/api/sources/content':
                return self._send(200, ops.set_video_content(db_dir(), d['path'], d.get('content', ''), d.get('scraper', '')))
            if path == '/api/lib/fix':
                xbmc.log('[glasscontrol] lib.fix start: %s' % (d.get('kind'),), xbmc.LOGINFO)
                res = ops.lib_fix(db_dir(), sources_xml(), passwords_xml(), d.get('kind', ''))
                xbmc.log('[glasscontrol] lib.fix done: %s' % (res,), xbmc.LOGINFO)
                return self._send(200, res)
            if path == '/api/lib/reset':
                return self._send(200, ops.lib_reset(db_dir(), d.get('kind', '')))
            if path == '/api/textures/reset':
                xbmc.log('[glasscontrol] textures.reset start', xbmc.LOGINFO)
                res = ops.textures_reset()
                xbmc.log('[glasscontrol] textures.reset done: %s' % (res,), xbmc.LOGINFO)
                return self._send(200, res)
            if path == '/api/debug':
                res = ops.debug_info(db_dir())
                # attach sources.xml and passwords.xml
                for name, p in (('sources_xml', sources_xml()), ('passwords_xml', passwords_xml())):
                    try:
                        with open(p) as f:
                            res[name] = f.read()
                    except Exception as e:
                        res[name + '_error'] = str(e)
                return self._send(200, res)
            if path == '/api/lib/wipe':
                res = ops.lib_wipe(db_dir(), d['kind'])
                res['fix'] = ops.lib_fix(db_dir(), sources_xml(), passwords_xml(), d['kind'])
                return self._send(200, res)
            if path == '/api/lib/restore':
                res = ops.video_restore_content(db_dir())
                res['fix'] = ops.lib_fix(db_dir(), sources_xml(), passwords_xml(), 'video')
                return self._send(200, res)
            if path == '/api/brightness':
                if method == 'POST' and 'value' in d:
                    return self._send(200, ops.brightness_set(float(d['value'])))
                return self._send(200, ops.brightness_get())
            if path == '/api/exec':
                b = str(d.get('builtin', ''))
                if not b.startswith(ops.BUILTIN_OK):
                    return self._send(403, {'error': 'builtin not allowed'})
                xbmc.executebuiltin(b)
                return self._send(200, {'ok': 1})
            self._send(404, {'error': 'not found'})
        except ops.OpError as e:
            self._send(400, {'error': str(e)})
        except KeyError as e:
            self._send(400, {'error': 'missing field ' + str(e)})
        except Exception as e:  # noqa: BLE001
            xbmc.log('[glasscontrol] %r' % (e,), xbmc.LOGERROR)
            self._send(500, {'error': str(e)})


def main():
    monitor = xbmc.Monitor()
    port = int(ADDON.getSetting('port') or 8089)
    win = xbmcgui.Window(10000)
    srv = None
    for attempt in range(5):
        try:
            srv = ThreadingHTTPServer(('0.0.0.0', port), Handler)
            break
        except OSError as e:
            xbmc.log('[glasscontrol] bind attempt %d failed: %r' % (attempt + 1, e), xbmc.LOGWARNING)
            time.sleep(1)
    else:
        xbmc.log('[glasscontrol] cannot bind port %d' % port, xbmc.LOGERROR)
        srv = None
    if srv:
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        win.setProperty('glasscontrol.token', TOKEN)
        win.setProperty('glasscontrol.port', str(port))
        xbmc.log('[glasscontrol] backend on :%d' % port, xbmc.LOGINFO)
    while not monitor.waitForAbort(2):
        pass
    if srv:
        srv.shutdown()
    win.clearProperty('glasscontrol.token')
    win.clearProperty('glasscontrol.port')


if __name__ == '__main__':
    main()

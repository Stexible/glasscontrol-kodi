# -*- coding: utf-8 -*-
"""Glass Control backend: локальный HTTP-сервис для операций, которых нет в JSON-RPC Kodi."""
import json
import os
import secrets
import sys
import threading
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

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _auth(self):
        return secrets.compare_digest(self.headers.get('X-Token', ''), TOKEN)

    def do_GET(self):
        self._route('GET', {})

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
            if path == '/api/caps':
                android = xbmc.getCondVisibility('System.Platform.Android')
                return self._send(200, {'version': VERSION, 'android': bool(android), 'brightness': ops.brightness_get().get('supported', False),
                                        'platform': 'android' if android else sys.platform})
            if path == '/api/fs/list':
                return self._send(200, ops.list_dir(d.get('path', '')))
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
                res = ops.sources_add(sources_xml(), d['media'], d['name'], d['path'], passwords_xml())
                content = d.get('content') or ''
                if d['media'] == 'video' and content:
                    res['content'] = ops.set_video_content(db_dir(), res['path'], content)
                if d['media'] == 'music':
                    res['music'] = ops.fix_music_paths(db_dir(), sources_xml())
                return self._send(200, res)
            if path == '/api/sources/remove':
                return self._send(200, ops.sources_remove(sources_xml(), d['media'], d['name'], d.get('path', ''), passwords_xml()))
            if path == '/api/sources/content':
                return self._send(200, ops.set_video_content(db_dir(), d['path'], d.get('content', '')))
            if path == '/api/lib/fix':
                return self._send(200, ops.lib_fix(db_dir(), sources_xml(), passwords_xml(), d.get('kind', '')))
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
    try:
        srv = ThreadingHTTPServer(('0.0.0.0', port), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        win.setProperty('glasscontrol.token', TOKEN)
        win.setProperty('glasscontrol.port', str(port))
        xbmc.log('[glasscontrol] backend on :%d' % port, xbmc.LOGINFO)
    except OSError as e:
        xbmc.log('[glasscontrol] cannot start: %r' % (e,), xbmc.LOGERROR)
    while not monitor.waitForAbort(2):
        pass
    if srv:
        srv.shutdown()
    win.clearProperty('glasscontrol.token')
    win.clearProperty('glasscontrol.port')


if __name__ == '__main__':
    main()

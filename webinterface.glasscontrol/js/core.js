/* Glass Control — ядро: утилиты, шаблоны, иконки, RPC, события, UI-компоненты */
(function () {
  'use strict';
  var K = window.K = window.K || {};
  var t = K.t;
  K.acts = {}; K.pages = {}; K.ui = {}; K._h = {}; K.st = { online: true };

  /* ---------------- события ---------------- */
  K.on = function (e, f) { (K._h[e] = K._h[e] || []).push(f); return function () { K._h[e] = (K._h[e] || []).filter(function (x) { return x !== f; }); }; };
  K.emit = function (e, d) { (K._h[e] || []).slice().forEach(function (f) { try { f(d); } catch (x) { console.error(e, x); } }); };

  /* ---------------- безопасные шаблоны ---------------- */
  function Raw(s) { this.s = s; }
  var raw = K.raw = function (s) { return new Raw(s == null ? '' : String(s)); };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = K.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  function frag(v) {
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(frag).join('');
    if (v === false || v == null) return '';
    return esc(v);
  }
  K.frag = frag;
  K.html = function (s) {
    var v = Array.prototype.slice.call(arguments, 1), o = '';
    for (var i = 0; i < s.length; i++) o += s[i] + (i < v.length ? frag(v[i]) : '');
    return new Raw(o);
  };
  var html = K.html;
  K.mount = function (el, x, sig) { if (sig !== undefined) { if (el._sig === sig) return el; el._sig = sig; } else el._sig = undefined; el.innerHTML = frag(x); return el; };
  var $ = K.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = K.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  K.debounce = function (f, ms) { var h; return function () { var a = arguments, s = this; clearTimeout(h); h = setTimeout(function () { f.apply(s, a); }, ms); }; };
  K.store = {
    get: function (k, d) { try { var v = localStorage.getItem('glass.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('glass.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ---------------- иконки ---------------- */
  var F = ' fill="currentColor" stroke="none"';
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    play: '<path' + F + ' d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z"/>',
    pause: '<rect' + F + ' x="6" y="4" width="4.2" height="16" rx="1.2"/><rect' + F + ' x="13.8" y="4" width="4.2" height="16" rx="1.2"/>',
    stop: '<rect' + F + ' x="5" y="5" width="14" height="14" rx="2.2"/>',
    next: '<path' + F + ' d="M5 5.4v13.2a.8.8 0 0 0 1.2.7l9.6-6.6a.8.8 0 0 0 0-1.4L6.2 4.7A.8.8 0 0 0 5 5.4z"/><rect' + F + ' x="17" y="5" width="2.6" height="14" rx="1.1"/>',
    prev: '<path' + F + ' d="M19 5.4v13.2a.8.8 0 0 1-1.2.7l-9.6-6.6a.8.8 0 0 1 0-1.4l9.6-6.6A.8.8 0 0 1 19 5.4z"/><rect' + F + ' x="4.4" y="5" width="2.6" height="14" rx="1.1"/>',
    ff: '<path' + F + ' d="M3 6.2v11.6a.8.8 0 0 0 1.25.65l8-5.8a.8.8 0 0 0 0-1.3l-8-5.8A.8.8 0 0 0 3 6.2z"/><path' + F + ' d="M12 6.2v11.6a.8.8 0 0 0 1.25.65l8-5.8a.8.8 0 0 0 0-1.3l-8-5.8A.8.8 0 0 0 12 6.2z"/>',
    rew: '<path' + F + ' d="M21 6.2v11.6a.8.8 0 0 1-1.25.65l-8-5.8a.8.8 0 0 1 0-1.3l8-5.8A.8.8 0 0 1 21 6.2z"/><path' + F + ' d="M12 6.2v11.6a.8.8 0 0 1-1.25.65l-8-5.8a.8.8 0 0 1 0-1.3l8-5.8A.8.8 0 0 1 12 6.2z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 3v18M17 3v18M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4"/>',
    tv: '<rect x="2.5" y="7" width="19" height="13" rx="2.5"/><path d="m8 2.5 4 4.5 4-4.5"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>',
    mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
    clip: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.5 5 2.5-5 2.5z"/>',
    folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2.2h7.5A2.5 2.5 0 0 1 21 8.7V17.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    star: '<path d="m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.1l-5.4 3 1-6.1L3.2 9.7l6.1-.9z"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
    box: '<path d="m7.5 4.3 9 5.2M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>',
    remote: '<rect x="7" y="2.5" width="10" height="19" rx="3.2"/><circle cx="12" cy="8" r="2"/><path d="M10 14h4M10 18h4"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2.2"/><path d="M8 20h8M12 16v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    wide: '<rect x="2" y="7" width="20" height="10" rx="2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    more: '<circle' + F + ' cx="5" cy="12" r="1.7"/><circle' + F + ' cx="12" cy="12" r="1.7"/><circle' + F + ' cx="19" cy="12" r="1.7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.3A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.7L18 7M9 7V4h6v3"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    repeat1: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3M11 10h1.2v4.5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.7-6.4L21 8"/><path d="M21 3v5h-5"/>',
    download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 21h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    power: '<path d="M12 2.5v9.5M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.3 4M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    subs: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 14h3.5M13.5 14H17M7 10h2.5M12.5 10H17"/>',
    audio: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6.5" rx="1.6"/><rect x="17" y="14" width="4" height="6.5" rx="1.6"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/>',
    eraser: '<path d="m7 21-4.3-4.3a1.4 1.4 0 0 1 0-2l9.6-9.6a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L13 21M22 21H7M5 11l8 8"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    log: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    qadd: '<path d="M3 6h12M3 12h12M3 18h7M18 15v6M15 18h6"/>',
    qnext: '<path d="M3 6h11M3 12h6M3 18h6"/><path' + F + ' d="m14 13.8 7 4.2-7 4.2z"/>',
    ext: '<path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    rec: '<circle' + F + ' cx="12" cy="12" r="6.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 6-8 11-8 11z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6M11 8v6M8 11h6"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-2.7-6.4L21 8"/><path d="M21 3v5h-5"/>'
  };
  K.ic = function (n, size, cls) {
    var p = ICONS[n] || ICONS.info; size = size || 20;
    return new Raw('<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>');
  };
  var ic = K.ic;

  /* ---------------- форматирование ---------------- */
  K.tsec = function (o) {
    if (o == null) return 0;
    if (typeof o === 'number') return o;
    return (o.hours || 0) * 3600 + (o.minutes || 0) * 60 + (o.seconds || 0) + (o.milliseconds || 0) / 1000;
  };
  K.toTime = function (s) {
    s = Math.max(0, Math.round(s));
    return { hours: Math.floor(s / 3600), minutes: Math.floor(s % 3600 / 60), seconds: s % 60, milliseconds: 0 };
  };
  K.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
  };
  K.fmtDur = function (s) {
    s = Math.round(s || 0); if (!s) return '';
    var h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60);
    if (m === 60) { h++; m = 0; }
    return h ? (m ? t('{h} ч {m} мин', { h: h, m: m }) : t('{h} ч', { h: h })) : t('{m} мин', { m: m });
  };
  K.fmtSize = function (b) {
    if (!b) return '';
    var u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + ' ' + t(u[i]);
  };
  K.fmtDate = function (s) {
    if (!s) return '';
    var d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString(K.lang === 'ru' ? 'ru-RU' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  K.fmtDateTime = function (s) {
    var d = new Date(String(s || '').replace(' ', 'T'));
    if (isNaN(d)) return String(s || '');
    return d.toLocaleString(K.lang === 'ru' ? 'ru-RU' : undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  K.join = function (a) { return Array.isArray(a) ? a.filter(Boolean).join(', ') : (a || ''); };
  K.img = function (u) { return u ? '/image/' + encodeURIComponent(u) : ''; };
  K.pick = function (it) {          // лучшая миниатюра для элемента
    var a = (it && it.art) || {};
    for (var i = 1; i < arguments.length; i++) if (a[arguments[i]]) return a[arguments[i]];
    return it && (it.thumbnail || a.thumb || a.poster) || '';
  };

  /* ---------------- RPC ---------------- */
  var rid = 1;
  function RpcError(m, code, method) { var e = new Error(m); e.code = code; e.method = method; e.isRpc = true; return e; }
  function setOnline(v) {
    if (K.st.online === v) return;
    K.st.online = v; document.body.classList.toggle('offline', !v);
    K.emit(v ? 'online' : 'offline');
    if (!v) pinger();
  }
  var pingT = null;
  function pinger() {
    clearTimeout(pingT);
    pingT = setTimeout(function () {
      fetch('/jsonrpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: '{"jsonrpc":"2.0","method":"JSONRPC.Ping","id":0}' })
        .then(function (r) { if (r.ok) setOnline(true); else pinger(); }, pinger);
    }, 3000);
  }
  function post(body) {
    return fetch('/jsonrpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) throw RpcError(t('Нужна авторизация: войдите в Kodi по логину и паролю'), 401);
        if (!r.ok) throw RpcError('HTTP ' + r.status, r.status);
        setOnline(true); return r.json();
      }, function () { setOnline(false); throw RpcError(t('Нет связи с Kodi'), -1); });
  }
  K.rpc = function (method, params) {
    return post({ jsonrpc: '2.0', id: rid++, method: method, params: params || {} }).then(function (j) {
      if (j.error) {
        var d = j.error.data, det = d && d.stack && d.stack.message ? ' (' + (d.stack.name ? d.stack.name + ': ' : '') + d.stack.message + ')' : '';
        var e = RpcError((j.error.message || 'Error') + det, j.error.code, method); e.data = d;
        console.warn('[rpc]', method, j.error); throw e;
      }
      return j.result;
    });
  };
  K.batch = function (calls) {          // [[method, params], ...] -> массив результатов; ошибка элемента = Error
    var ids = calls.map(function () { return rid++; });
    var body = calls.map(function (c, i) { return { jsonrpc: '2.0', id: ids[i], method: c[0], params: c[1] || {} }; });
    return post(body).then(function (j) {
      var map = {}; (Array.isArray(j) ? j : [j]).forEach(function (x) { map[x.id] = x; });
      return ids.map(function (id, i) {
        var x = map[id]; if (!x) return RpcError('no response', -2, calls[i][0]);
        if (x.error) { console.warn('[rpc]', calls[i][0], x.error); return RpcError(x.error.message, x.error.code, calls[i][0]); }
        return x.result;
      });
    });
  };
  K.ok = function (r) { return r != null && !(r instanceof Error); };
  K.err = function (e) { K.toast((e && e.message) || t('Ошибка'), 'err'); };
  K.safe = function (f) { return function () { var r; try { r = f.apply(this, arguments); } catch (e) { K.err(e); return; } if (r && r.catch) r.catch(K.err); return r; }; };

  /* ---------------- реестр объектов (для меню и действий) ---------------- */
  var REG = {};
  K.reg = function (kind, it) { var id = it[kind + 'id'] != null ? it[kind + 'id'] : (it.id != null ? it.id : it.file); var k = kind + ':' + id; REG[k] = it; return k; };
  K.item = function (k) { return REG[k]; };
  var SPEC = { movie: 'movieid', episode: 'episodeid', musicvideo: 'musicvideoid', song: 'songid', album: 'albumid', artist: 'artistid', genre: 'genreid', channel: 'channelid', recording: 'recordingid' };
  K.spec = function (kind, id) { var o = {}; o[SPEC[kind]] = id; return o; };
  K.plOf = function (kind) { return (kind === 'movie' || kind === 'episode' || kind === 'musicvideo' || kind === 'recording') ? 1 : 0; };

  /* ---------------- воспроизведение / очередь ---------------- */
  K.play = function (spec, opts) {
    opts = opts || {};
    var p = { item: spec };
    if (opts.resume !== undefined) p.options = { resume: !!opts.resume };
    return K.rpc('Player.Open', p).then(function () {
      K.toast(t('Запускаю воспроизведение'), 'ok');
      if (K.player) K.player.refreshSoon(400);
    }).catch(K.err);
  };
  K.queue = function (spec, o) {
    o = o || {}; var pl = o.pl != null ? o.pl : 0;
    var P = K.player, call;
    if (o.next && P && P.id != null && P.props && P.props.playlistid === pl && P.props.position >= 0) {
      call = K.rpc('Playlist.Insert', { playlistid: pl, position: P.props.position + 1, item: spec });
    } else call = K.rpc('Playlist.Add', { playlistid: pl, item: spec });
    return call.then(function () { K.toast(o.next ? t('Будет следующим') : t('Добавлено в очередь'), 'ok'); K.emit('queue'); }).catch(K.err);
  };
  /* сериал/альбом: собрать очередь и начать с нужной позиции */
  K.playList = function (pl, specs, start) {
    return K.rpc('Playlist.Clear', { playlistid: pl })
      .then(function () { return K.batch(specs.map(function (s) { return ['Playlist.Add', { playlistid: pl, item: s }]; })); })
      .then(function () { return K.rpc('Player.Open', { item: { playlistid: pl, position: start || 0 } }); })
      .then(function () { K.toast(t('Запускаю воспроизведение'), 'ok'); K.emit('queue'); if (K.player) K.player.refreshSoon(400); })
      .catch(K.err);
  };

  /* ---------------- UI: тосты, модалки, меню ---------------- */
  K.toast = function (msg, type) {
    var box = $('#toasts'); if (!box) return;
    var el = document.createElement('div'); el.className = 'toast ' + (type || '');
    el.textContent = msg; box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, type === 'err' ? 5200 : 2600);
  };
  K.ui.modal = function (o) {
    var layer = $('#layer'), el = document.createElement('div');
    el.className = 'modal-wrap'; el.tabIndex = -1;
    el.innerHTML = frag(html`<div class="modal glass ${o.cls || ''}" role="dialog" aria-modal="true">
      ${o.title ? html`<div class="modal-h"><h3>${o.title}</h3><button class="icon-btn" data-close aria-label="${t('Закрыть')}">${ic('x')}</button></div>` : ''}
      <div class="modal-b"></div>${o.actions ? html`<div class="modal-f"></div>` : ''}</div>`);
    var body = $('.modal-b', el);
    if (o.body instanceof Raw) body.innerHTML = o.body.s; else if (o.body) body.appendChild(o.body);
    function close(v) { document.removeEventListener('keydown', key, true); el.classList.add('out'); setTimeout(function () { el.remove(); }, 160); if (o.onClose) o.onClose(v); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', key, true);
    if (o.actions) {
      var f = $('.modal-f', el);
      o.actions.forEach(function (a) {
        var b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
        b.onclick = function () { var r = a.onclick ? a.onclick(el) : undefined; if (r !== false) close(a.value); };
        f.appendChild(b);
      });
    }
    layer.appendChild(el);
    var first = $('input,select,textarea', el); if (first) setTimeout(function () { first.focus(); }, 30);
    return { el: el, body: body, close: close };
  };
  K.ui.confirm = function (msg, o) {
    o = o || {};
    return new Promise(function (res) {
      K.ui.modal({
        title: o.title || t('Подтверждение'), body: html`<p class="pre">${msg}</p>`, cls: 'sm',
        actions: [{ label: o.cancel || t('Отмена'), value: false }, { label: o.ok || t('Да'), cls: o.danger ? 'danger' : 'primary', value: true }],
        onClose: function (v) { res(!!v); }
      });
    });
  };
  K.ui.prompt = function (title, o) {
    o = o || {};
    return new Promise(function (res) {
      var m = K.ui.modal({
        title: title, cls: 'sm', body: html`<label class="field"><span>${o.label || ''}</span>
          <input class="inp" id="pr-in" type="${o.type || 'text'}" value="${o.value || ''}" placeholder="${o.placeholder || ''}"></label>`,
        actions: [{ label: t('Отмена'), value: null }, { label: o.ok || 'OK', cls: 'primary', onclick: function (el) { m.val = $('#pr-in', el).value; } }],
        onClose: function () { res(m.val != null ? m.val : null); }
      });
      $('#pr-in', m.el).addEventListener('keydown', function (e) { if (e.key === 'Enter') { m.val = this.value; m.close(); } });
    });
  };
  /* меню действий: items = [{label, icon, run, danger, sub}] */
  K.ui.menu = function (title, items) {
    items = items.filter(Boolean);
    var m = K.ui.modal({ title: title, cls: 'menu', body: html`<div class="menu-list">${items.map(function (it, i) {
      return html`<button class="menu-it ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? ic(it.icon, 20) : ''}<span>${it.label}${it.sub ? html`<small>${it.sub}</small>` : ''}</span></button>`; })}</div>` });
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('.menu-it'); if (!b) return;
      var it = items[+b.dataset.i]; m.close(); if (it.run) K.safe(it.run)();
    });
    return m;
  };

  /* ---------------- UI: компоненты разметки ---------------- */
  K.ui.sw = function (on, attrs) { return html`<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" ${raw(attrs || '')}><i></i></button>`; };
  K.ui.seg = function (opts, val, act, extra) {
    return html`<div class="seg" role="tablist">${opts.map(function (o) {
      return html`<button role="tab" class="${String(o[0]) === String(val) ? 'on' : ''}" data-act="${act}" data-v="${o[0]}" ${raw(extra || '')}>${o[1]}</button>`; })}</div>`;
  };
  K.ui.select = function (opts, val, attrs) {
    return html`<span class="selwrap"><select class="sel" ${raw(attrs || '')}>${opts.map(function (o) {
      return html`<option value="${o[0]}" ${String(o[0]) === String(val) ? raw('selected') : ''}>${o[1]}</option>`; })}</select>${ic('down', 16)}</span>`;
  };
  K.ui.head = function (title, o) {
    o = o || {};
    return html`<div class="page-h"><div class="page-t">${o.back ? html`<a class="icon-btn" href="${o.back}" aria-label="${t('Назад')}">${ic('back')}</a>` : ''}
      <div><h1>${title}</h1>${o.sub ? html`<p class="sub">${o.sub}</p>` : ''}</div></div><div class="page-a">${o.right || ''}</div></div>`;
  };
  K.ui.sec = function (title, right, more) {
    return html`<div class="sec-h"><h2>${title}</h2>${right ? html`<div class="sec-r">${right}</div>` : ''}${more ? html`<a class="more" href="${more}">${t('Все')} ${ic('right', 16)}</a>` : ''}</div>`;
  };
  K.ui.empty = function (icon, text, sub) { return html`<div class="empty">${ic(icon || 'info', 36)}<p>${text}</p>${sub ? html`<small>${sub}</small>` : ''}</div>`; };
  K.ui.loading = function () { return html`<div class="loading"><i></i><i></i><i></i></div>`; };
  K.ui.error = function (e, retry) {
    return html`<div class="empty err">${ic('plug', 36)}<p>${(e && e.message) || t('Ошибка')}</p>${retry ? html`<button class="btn" data-act="reload">${ic('refresh', 16)} ${t('Повторить')}</button>` : ''}</div>`;
  };
  /* карточка медиа. o: {key, img, title, sub, href, badge, prog, shape, play, watched} */
  K.ui.card = function (o) {
    return html`<div class="card ${o.shape || 'poster'}" data-id="${o.key || o.href || o.title}">
      <a class="card-img" ${o.href ? raw('href="' + esc(o.href) + '"') : ''}>
        ${o.img ? html`<img loading="lazy" decoding="async" src="${K.img(o.img)}" alt="" onerror="this.remove()">` : ''}
        <span class="ph">${ic(o.icon || 'film', 34)}</span>
        ${o.watched ? html`<span class="tick">${ic('check', 14)}</span>` : ''}
        ${o.badge ? html`<span class="badge">${o.badge}</span>` : ''}
        ${o.prog ? html`<span class="prog"><i style="width:${Math.min(100, o.prog)}%"></i></span>` : ''}
      </a>
      ${o.key ? html`<div class="card-act"><button class="round" data-act="cplay" data-k="${o.key}" aria-label="${t('Воспроизвести')}">${ic('play', 18)}</button>
        <button class="round sm" data-act="cmenu" data-k="${o.key}" aria-label="${t('Действия')}">${ic('more', 18)}</button></div>` : ''}
      <div class="card-t"><a ${o.href ? raw('href="' + esc(o.href) + '"') : ''} title="${o.title}">${o.title}</a>${o.sub ? html`<small>${o.sub}</small>` : ''}</div></div>`;
  };
  /* ряд (список) с миниатюрой */
  K.ui.row = function (o) {
    return html`<div class="row ${o.cls || ''}" ${o.id != null ? raw('data-id="' + esc(o.id) + '"') : ''} ${o.attrs ? raw(o.attrs) : ''}>
      ${o.lead != null ? html`<div class="row-lead">${o.lead}</div>` : ''}
      ${o.img !== undefined ? html`<a class="row-img ${o.shape || ''}" ${o.href ? raw('href="' + esc(o.href) + '"') : ''}>${o.img ? html`<img loading="lazy" decoding="async" src="${K.img(o.img)}" alt="" onerror="this.remove()">` : ''}<span class="ph">${ic(o.icon || 'music', 20)}</span></a>` : ''}
      <div class="row-main">${o.href ? html`<a class="row-t" href="${o.href}">${o.title}</a>` : html`<div class="row-t">${o.title}</div>`}${o.sub ? html`<div class="row-s">${o.sub}</div>` : ''}</div>
      ${o.right ? html`<div class="row-r">${o.right}</div>` : ''}</div>`;
  };

  /* глобальные действия карточек */
  K.acts.cplay = function (el) { var k = el.dataset.k, kind = k.split(':')[0], it = K.item(k); K.playItem(kind, it, k); };
  K.acts.cmenu = function (el) { var k = el.dataset.k, kind = k.split(':')[0]; K.itemMenu(kind, K.item(k)); };
  K.acts.reload = function () { K.route(true); };

  /* Универсальное воспроизведение по виду. Расширяется страницами. */
  K.playItem = function (kind, it, key) {
    if (kind === 'tvshow') return K.playShow(it.tvshowid);
    if (kind === 'album') return K.playAlbum(it.albumid, 0);
    if (kind === 'file') return K.playFile(it);
    var resume = (it.resume && it.resume.position > 0);
    if (kind === 'movie' && resume) {
      return K.ui.menu(it.title, [
        { icon: 'play', label: t('Продолжить с {t}', { t: K.fmtTime(it.resume.position) }), run: function () { return K.play(K.spec(kind, it[kind + 'id']), { resume: true }); } },
        { icon: 'rew', label: t('С начала'), run: function () { return K.play(K.spec(kind, it[kind + 'id']), { resume: false }); } }]);
    }
    return K.play(K.spec(kind, it[kind + 'id'] != null ? it[kind + 'id'] : it.id));
  };
  K.itemMenu = function (kind, it) {
    if (!it) return;
    var id = it[kind + 'id'], pl = K.plOf(kind), title = it.title || it.label || it.name || it.artist || '';
    var items = [];
    if (kind === 'tvshow') {
      items = [{ icon: 'play', label: t('Смотреть'), run: function () { return K.playShow(id); } },
        { icon: 'info', label: t('Открыть'), run: function () { K.go('/tv/' + id); } }];
    } else if (kind === 'album') {
      items = [{ icon: 'play', label: t('Играть альбом'), run: function () { return K.playAlbum(id, 0); } },
        { icon: 'qnext', label: t('Следующим'), run: function () { return K.queue({ albumid: id }, { next: true, pl: 0 }); } },
        { icon: 'qadd', label: t('В очередь'), run: function () { return K.queue({ albumid: id }, { pl: 0 }); } },
        { icon: 'info', label: t('Открыть'), run: function () { K.go('/music/album/' + id); } }];
    } else if (kind === 'artist') {
      items = [{ icon: 'play', label: t('Играть всё'), run: function () { return K.play({ artistid: id }); } },
        { icon: 'qadd', label: t('В очередь'), run: function () { return K.queue({ artistid: id }, { pl: 0 }); } },
        { icon: 'info', label: t('Открыть'), run: function () { K.go('/music/artist/' + id); } }];
    } else {
      var s = K.spec(kind, id);
      items = [{ icon: 'play', label: t('Воспроизвести'), run: function () { return K.playItem(kind, it); } },
        { icon: 'qnext', label: t('Следующим'), run: function () { return K.queue(s, { next: true, pl: pl }); } },
        { icon: 'qadd', label: t('В очередь'), run: function () { return K.queue(s, { pl: pl }); } }];
      if (kind === 'movie') items.push({ icon: 'info', label: t('Подробнее'), run: function () { K.go('/movies/' + id); } });
    }
    if (K.extraMenu) items = items.concat(K.extraMenu(kind, it) || []);
    K.ui.menu(title, items);
  };

  /* Делегирование кликов по [data-act] */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var f = K.acts[el.dataset.act]; if (!f) return;
    if (el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault();
    try { var r = f(el, e); if (r && r.catch) r.catch(K.err); } catch (x) { K.err(x); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]'); if (!el) return;
    var f = K.acts[el.dataset.change]; if (!f) return;
    try { var r = f(el, e); if (r && r.catch) r.catch(K.err); } catch (x) { K.err(x); }
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-input]'); if (!el) return;
    var f = K.acts[el.dataset.input]; if (f) f(el, e);
  });

  /* Case-insensitive фильтр: SQLite LIKE не различает регистр только для ASCII, поэтому шлём варианты написания */
  K.ci = function (field, text, op) {
    text = String(text || '').trim(); op = op || 'contains';
    var v = [text, text.toLowerCase(), text.toUpperCase(), text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
      text.toLowerCase().replace(/(^|[\s\-_.(])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }),
      text.charAt(0).toUpperCase() + text.slice(1)];
    var seen = {}, u = v.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    var f = u.map(function (x) { return { field: field, operator: op, value: x }; });
    return f.length === 1 ? f[0] : { or: f };
  };

  /* Мягкая сверка списка: существующие узлы не пересоздаются, новые плавно появляются */
  K.reconcile = function (box, htmlStr, before) {
    var tmp = document.createElement('div'); tmp.innerHTML = htmlStr;
    var fresh = Array.prototype.slice.call(tmp.children), old = {}, ok = true;
    Array.prototype.forEach.call(box.children, function (c) { if (c.dataset && c.dataset.id != null) old[c.dataset.id] = c; });
    fresh.forEach(function (n) { if (n.dataset.id == null) ok = false; });
    if (!ok) return false;
    var seen = {}, anchor = before || null;
    fresh.forEach(function (n) {
      var id = n.dataset.id, cur = old[id]; seen[id] = 1;
      if (cur) { if (cur.outerHTML !== n.outerHTML) { cur.replaceWith(n); old[id] = n; } else if (cur.className !== n.className) cur.className = n.className; if (before) box.insertBefore(old[id], before); else box.appendChild(old[id]); }
      else { n.classList.add('enter'); if (before) box.insertBefore(n, before); else box.appendChild(n); old[id] = n; }
    });
    Object.keys(old).forEach(function (id) { if (!seen[id] && old[id].parentNode === box) old[id].remove(); });
    return true;
  };

  /* бесконечная подгрузка: loader(start, count) -> Promise<{items,total}>; draw(items,start) вернёт Raw.
     Возвращает функцию очистки; у неё есть .refresh() — мягкое обновление уже загруженных элементов */
  K.ui.infinite = function (box, loader, draw, o) {
    o = o || {}; var size = o.size || 60, start = 0, total = Infinity, busy = false, dead = false, io = null;
    var sentinel = document.createElement('div'); sentinel.className = 'sentinel';
    function more() {
      if (busy || dead || start >= total) return;
      busy = true; sentinel.classList.add('on');
      loader(start, size).then(function (r) {
        if (dead) return;
        total = r.total != null ? r.total : (r.items.length < size ? start + r.items.length : Infinity);
        if (r.items.length) { sentinel.insertAdjacentHTML('beforebegin', frag(draw(r.items, start))); start += r.items.length; }
        else total = start;
        busy = false; sentinel.classList.remove('on');
        if (o.onTotal) o.onTotal(total, start);
        if (start >= total) { if (io) io.disconnect(); if (sentinel.parentNode) sentinel.remove(); if (start === 0 && o.empty) box.insertAdjacentHTML('afterbegin', frag(o.empty)); }
        else if (sentinel.getBoundingClientRect().top < innerHeight + 400) more();
      }).catch(function (e) { busy = false; sentinel.classList.remove('on'); dead = true; box.insertAdjacentHTML('beforeend', frag(K.ui.error(e, true))); });
    }
    box.innerHTML = ''; box.appendChild(sentinel);
    io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) more(); }, { rootMargin: '600px' });
    io.observe(sentinel); more();
    var stop = function () { dead = true; io.disconnect(); };
    stop.refresh = function () {
      if (dead || busy) return Promise.resolve();
      var n = Math.max(size, start); busy = true;
      return loader(0, n).then(function (r) {
        busy = false; if (dead) return;
        var items = r.items, tot = r.total != null ? r.total : items.length;
        var same = K.reconcile(box, frag(draw(items, 0)), sentinel.parentNode === box ? sentinel : null);
        if (!same) { box.innerHTML = ''; box.insertAdjacentHTML('beforeend', frag(draw(items, 0))); box.appendChild(sentinel); }
        start = items.length; total = tot;
        if (o.onTotal) o.onTotal(total, start);
        if (start >= total) { io.disconnect(); sentinel.remove(); } else { if (!sentinel.parentNode) box.appendChild(sentinel); io.observe(sentinel); }
      }).catch(function () { busy = false; });
    };
    return stop;
  };
})();

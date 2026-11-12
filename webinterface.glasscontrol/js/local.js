/* Glass Control — воспроизведение в браузере (звук и видео идут на это устройство, а не на Kodi) */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, $ = K.$;
  var L = K.local = { q: [], i: -1, el: null, theater: false };
  function saveQ() { try { localStorage.setItem('gc.lq', JSON.stringify({ q: L.q, i: L.i })); } catch (e) { /* ignore */ } }
  function loadQ() { try { var s = JSON.parse(localStorage.getItem('gc.lq') || 'null'); if (s && Array.isArray(s.q)) { L.q = s.q; L.i = (typeof s.i === 'number') ? s.i : -1; } } catch (e) { /* ignore */ } }
  loadQ();
  var V = 'VideoLibrary.', A = 'AudioLibrary.';
  K.target = function () { return K.store.get('target', 'kodi'); };

  function el() {
    if (L.el) return L.el;
    var v = document.createElement('video'); v.id = 'lvideo'; v.setAttribute('playsinline', ''); v.setAttribute('disablePictureInPicture', ''); v.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback'); v.preload = 'auto'; v.controls = false;
    document.body.appendChild(v); L.el = v;
    // drag
    (function () {
      var dragging = false, ox = 0, oy = 0, moved = false;
      v.addEventListener('mousedown', function (e) {
        if (e.button !== 0 || v.classList.contains('embedded')) return;
        dragging = true; moved = false; ox = e.clientX - v.offsetLeft; oy = e.clientY - v.offsetTop; v.style.cursor = 'grabbing';
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        if (Math.abs(e.clientX - (v.offsetLeft + ox)) > 3 || Math.abs(e.clientY - (v.offsetTop + oy)) > 3) moved = true;
        v.style.left = (e.clientX - ox) + 'px'; v.style.top = (e.clientY - oy) + 'px';
        v.style.right = 'auto'; v.style.bottom = 'auto';
      });
      document.addEventListener('mouseup', function (e) {
        if (dragging) { dragging = false; v.style.cursor = 'move'; if (moved) { e.preventDefault(); e.stopPropagation(); } }
      });
      // Prevent click (play/pause) after drag
      v.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    })();
    v.addEventListener('ended', function () { L.next(true); });
    v.addEventListener('play', function () { K.emit('local'); });
    v.addEventListener('pause', function () { K.emit('local'); });
    v.addEventListener('loadedmetadata', function () { K.emit('local'); });
    v.addEventListener('volumechange', function () { lvolUI(); });
    v.addEventListener('error', function () { K.toast(t('Браузер не может воспроизвести этот формат'), 'err'); });
    return v;
  }
  function url(file) {
    var beUrl = function () {
      if (K.be && K.be.ok) return Promise.resolve(K.be.base + '/api/fs/download?path=' + encodeURIComponent(file) + '&token=' + encodeURIComponent(K.be.token));
      if (K.be && K.be.retry) return K.be.retry().then(function (ok) { if (ok && K.be.ok) return K.be.base + '/api/fs/download?path=' + encodeURIComponent(file) + '&token=' + encodeURIComponent(K.be.token); return null; });
      return Promise.resolve(null);
    };
    return beUrl().then(function (u) {
      if (u) return u;
      return K.rpc('Files.PrepareDownload', { path: file }).then(function (r) { return '/' + r.details.path; });
    });
  }
  var KINDS = { movieid: [V + 'GetMovieDetails', 'moviedetails', 'video'], episodeid: [V + 'GetEpisodeDetails', 'episodedetails', 'video'], musicvideoid: [V + 'GetMusicVideoDetails', 'musicvideodetails', 'video'], songid: [A + 'GetSongDetails', 'songdetails', 'audio'] };
  var VID = /\.(mp4|m4v|webm|mkv|mov|avi|ogv|ts|m2ts)$/i;
  function mk(o, kind) { return { file: o.file, title: o.title || o.label || (o.file || '').split('/').pop(), sub: o.showtitle || K.join(o.artist || o.displayartist) || '', thumb: K.pick(o, 'thumb', 'poster', 'album.thumb') || o.thumbnail || '', kind: kind || (VID.test(o.file || '') ? 'video' : 'audio') }; }
  /* spec Kodi -> список элементов {file,title,sub,thumb,kind} */
  L.resolve = function (spec) {
    var P = ['title', 'file', 'art', 'thumbnail'], k = Object.keys(spec)[0];
    if (KINDS[k]) { var d = KINDS[k], p = {}; p[k] = spec[k]; p.properties = P.concat(k === 'songid' ? ['artist', 'album'] : k === 'episodeid' ? ['showtitle'] : []); return K.rpc(d[0], p).then(function (r) { return [mk(r[d[1]], d[2])]; }); }
    if (k === 'albumid' || k === 'artistid') { var f = {}; f[k] = spec[k]; return K.rpc(A + 'GetSongs', { properties: P.concat(['artist', 'album', 'track']), filter: f, sort: { method: k === 'albumid' ? 'track' : 'album', order: 'ascending' } }).then(function (r) { return (r.songs || []).map(function (s) { return mk(s, 'audio'); }); }); }
    if (k === 'file') return Promise.resolve([mk({ file: spec.file, title: spec.file.split('/').filter(Boolean).pop() })]);
    if (k === 'directory') return K.rpc('Files.GetDirectory', { directory: spec.directory, media: 'files', properties: ['file', 'title'] }).then(function (r) { return (r.files || []).filter(function (f) { return f.filetype !== 'directory'; }).map(function (f) { return mk(f); }); });
    return Promise.reject(new Error(t('Этот элемент нельзя воспроизвести в браузере')));
  };
  L.playSpecs = function (specs, start, o) {
    o = o || {};
    return Promise.all(specs.map(L.resolve)).then(function (arr) {
      var items = [].concat.apply([], arr); if (!items.length) throw new Error(t('Нечего воспроизводить'));
      if (o.append) { L.q = L.q.concat(items); if (L.i < 0) { L.i = 0; saveQ(); return L.load(); } K.toast(t('Добавлено в очередь'), 'ok'); upd(); saveQ(); return; }
      if (o.next && L.i >= 0) { L.q.splice(L.i + 1, 0); Array.prototype.splice.apply(L.q, [L.i + 1, 0].concat(items)); K.toast(t('Будет следующим'), 'ok'); return; }
      L.q = items; L.i = Math.min(start || 0, items.length - 1); saveQ(); return L.load();
    }).catch(K.err);
  };
  L.load = function () {
    var it = L.q[L.i]; if (!it) return;
    return url(it.file).then(function (u) {
      var v = el(); v.src = u; document.body.classList.add('lplay'); document.body.classList.toggle('lvid', it.kind === 'video'); v.classList.toggle('audio-only', it.kind !== 'video');
      if (K.player && K.player.id != null) K.rpc('Player.Stop', { playerid: K.player.id }).catch(function () { });   // Kodi замолкает
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () { K.toast(t('Нажмите ▶, браузер заблокировал автозапуск'), 'err'); });
      media(it); upd(); K.emit('local');
      document.body.classList.add('playing'); document.body.classList.toggle('video', it.kind === 'video');
    }).catch(K.err);
  };
  L.next = function (auto) { if (L.i + 1 < L.q.length) { L.i++; saveQ(); return L.load(); } if (auto) L.stop(); };
  L.prev = function () { var v = el(); if (v.currentTime > 4 || L.i === 0) { v.currentTime = 0; return; } L.i--; saveQ(); return L.load(); };
  L.stop = function () { var v = el(); v.pause(); v.removeAttribute('src'); v.load(); L.q = []; L.i = -1; document.body.classList.remove('lplay', 'lvid', 'playing', 'video'); saveQ(); K.emit('local'); };
  L.toggle = function () { var v = el(); if (v.paused) v.play(); else v.pause(); };
  function media(it) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: it.sub, artwork: it.thumb ? [{ src: K.img(it.thumb), sizes: '512x512' }] : [] });
      navigator.mediaSession.setActionHandler('play', function () { el().play(); }); navigator.mediaSession.setActionHandler('pause', function () { el().pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', L.prev); navigator.mediaSession.setActionHandler('nexttrack', function () { L.next(); });
    } catch (e) { /* не критично */ }
  }
  function upd() { K.emit('local'); }
  K.acts.lprev = L.prev; K.acts.lnext = function () { L.next(); }; K.acts.lstop = L.stop; K.acts.lpp = L.toggle;
  function lvolUI() {
    var v = L.el; if (!v) return;
    var val = Math.round((v.muted ? 0 : v.volume) * 100);
    var sl = Math.round(Math.sqrt(val/100)*100);
    K.$$('input[data-input=\"lvolset\"]').forEach(function (n) {
      if (document.activeElement !== n) n.value = sl;
      n.style.setProperty('--p', sl + '%');
    });
    K.$$('[data-volnum]').forEach(function (n) { n.textContent = val; });
    K.$$('[data-act=\"lmute\"]').forEach(function (n) {
      var small = !!n.closest('#mini');
      n.innerHTML = ic(v.muted ? 'mute' : 'volume', small ? 20 : 24).s;
      n.classList.toggle('on', !!v.muted);
    });
  }
  K.lvolUI = lvolUI;
  K.on('lvol', lvolUI);
  K.acts.lmute = function () { var v = L.el; if (v) { v.muted = !v.muted; lvolUI(); K.emit('lvol'); } };
  K.acts.lvolset = function (e) { var v = L.el; if (!v) return; var sl = +e.value; v.volume = Math.pow(sl/100, 2); v.muted = false; lvolUI(); K.emit('lvol'); };
  K.acts.ltheater = function () { L.theater = !L.theater; var v = L.el; if (v) v.classList.toggle('theater', L.theater); var slot = document.getElementById('now-vslot'); if (slot) slot.classList.toggle('theater', L.theater); K.emit('local'); };
  K.acts.lfullscreen = function () { var v = L.el; if (!v) return; if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } else { (v.requestFullscreen || v.webkitRequestFullscreen || v.msRequestFullscreen).call(v); } };
  K.acts.lqgoto = function (el) { L.i = +el.dataset.i; saveQ(); return L.load(); };
  K.acts.lqclear = function () { L.stop(); K.route(true); };
  K.acts.laud = function () { var v = L.el; if (!v) return; if (v.audioTracks && v.audioTracks.length > 1) { var cur = (typeof v.audioTracks.selectedIndex === 'number') ? v.audioTracks.selectedIndex : 0; var next = (cur + 1) % v.audioTracks.length; for (var i = 0; i < v.audioTracks.length; i++) v.audioTracks[i].enabled = (i === next); K.toast(t('Аудиодорожка') + ' ' + (next + 1) + '/' + v.audioTracks.length, 'ok'); } else { K.toast(t('Выбор озвучки недоступен в браузере'), 'err'); } };
  K.acts.lseek = function (e) { var v = el(); L.drag = true; clearTimeout(L._d); L._d = setTimeout(function () { L.drag = false; }, 400); if (v.duration) v.currentTime = e.value / 1000 * v.duration; };

  /* переключатель «куда играть» */
  K.paintTarget = paintTarget;
  K.paintTarget = paintTarget;
  K.acts.target = function () {
    var cur = K.target();
    // stop current playback in the active engine
    if (cur === 'kodi') {
      if (K.player && K.player.id != null) { var pid = K.player.id; K.player.id = null; K.player.props = null; K.player.item = null; K.rpc('Player.Stop', { playerid: pid }).catch(function () { }); document.body.classList.remove('playing', 'video'); K.emit('player', K.player); }
    } else {
      if (K.local && K.local.i >= 0) K.local.stop();
    }
    var n = cur === 'kodi' ? 'browser' : 'kodi';
    K.store.set('target', n); paintTarget(); K.toast(n === 'browser' ? t('Воспроизведение: в этом браузере') : t('Воспроизведение: на Kodi'), 'ok'); K.emit('target');
    if (K.cur && K.cur.path === '/now') K.route(true);
  };
  function paintTarget() { var b = $('#tgt'); if (!b) return; var br = K.target() === 'browser'; b.classList.toggle('on', br); b.innerHTML = K.frag(ic(br ? 'globe' : 'monitor', 20)); b.title = br ? t('Играет в браузере') : t('Играет на Kodi'); }

  /* перехват воспроизведения: в режиме «браузер» всё идёт в L */
  var oPlay = K.play, oQueue = K.queue, oList = K.playList;
  K.play = function (spec, o) { return K.target() === 'browser' ? L.playSpecs([spec], 0) : oPlay(spec, o); };
  K.queue = function (spec, o) { return K.target() === 'browser' ? L.playSpecs([spec], 0, { append: !(o && o.next), next: !!(o && o.next) }) : oQueue(spec, o); };
  K.playList = function (pl, specs, start) { return K.target() === 'browser' ? L.playSpecs(specs, start) : oList(pl, specs, start); };
  var oAlbum = K.playAlbum;
  K.playAlbum = function (id, pos) { return K.target() === 'browser' ? L.playSpecs([{ albumid: id }], pos) : oAlbum(id, pos); };
  var oExtra = K.extraMenu;
  K.extraMenu = function (kind, it) {
    var r = (oExtra ? oExtra(kind, it) : []) || [], map = { movie: 'movieid', episode: 'episodeid', musicvideo: 'musicvideoid', song: 'songid', album: 'albumid', artist: 'artistid' };
    if (map[kind]) { var s = {}; s[map[kind]] = it[map[kind]]; r.unshift({ icon: 'globe', label: t('Играть в браузере'), run: function () { return L.playSpecs([s], 0); } }); }
    return r;
  };
  K.on('boot', paintTarget);
  document.addEventListener('DOMContentLoaded', function () { var tg = $('#tgt'); if (tg) paintTarget(); });
  setTimeout(paintTarget, 0);
})();

/* Glass Control — воспроизведение в браузере (звук и видео идут на это устройство, а не на Kodi) */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, $ = K.$;
  var L = K.local = { q: [], i: -1, el: null };
  var V = 'VideoLibrary.', A = 'AudioLibrary.';
  K.target = function () { return K.store.get('target', 'kodi'); };

  function el() {
    if (L.el) return L.el;
    var v = document.createElement('video'); v.id = 'lvideo'; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.controls = true;
    document.body.appendChild(v); L.el = v;
    // drag
    (function () {
      var dragging = false, ox = 0, oy = 0;
      v.addEventListener('mousedown', function (e) {
        if (e.target !== v) return;
        dragging = true; ox = e.clientX - v.offsetLeft; oy = e.clientY - v.offsetTop; v.style.cursor = 'grabbing';
        e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        v.style.left = (e.clientX - ox) + 'px'; v.style.top = (e.clientY - oy) + 'px';
        v.style.right = 'auto'; v.style.bottom = 'auto';
      });
      document.addEventListener('mouseup', function () { if (dragging) { dragging = false; v.style.cursor = 'move'; } });
    })();
    v.addEventListener('ended', function () { L.next(true); });
    v.addEventListener('timeupdate', upd); v.addEventListener('play', upd); v.addEventListener('pause', upd); v.addEventListener('loadedmetadata', upd);
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
      if (o.append) { L.q = L.q.concat(items); if (L.i < 0) { L.i = 0; return L.load(); } K.toast(t('Добавлено в очередь'), 'ok'); upd(); return; }
      if (o.next && L.i >= 0) { L.q.splice(L.i + 1, 0); Array.prototype.splice.apply(L.q, [L.i + 1, 0].concat(items)); K.toast(t('Будет следующим'), 'ok'); return; }
      L.q = items; L.i = Math.min(start || 0, items.length - 1); return L.load();
    }).catch(K.err);
  };
  L.load = function () {
    var it = L.q[L.i]; if (!it) return;
    return url(it.file).then(function (u) {
      var v = el(); v.src = u; document.body.classList.add('lplay'); document.body.classList.toggle('lvid', it.kind === 'video'); v.classList.toggle('audio-only', it.kind !== 'video');
      if (K.player && K.player.id != null) K.rpc('Player.Stop', { playerid: K.player.id }).catch(function () { });   // Kodi замолкает
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () { K.toast(t('Нажмите ▶, браузер заблокировал автозапуск'), 'err'); });
      media(it); upd(); K.emit('local');
    }).catch(K.err);
  };
  L.next = function (auto) { if (L.i + 1 < L.q.length) { L.i++; return L.load(); } if (auto) L.stop(); };
  L.prev = function () { var v = el(); if (v.currentTime > 4 || L.i === 0) { v.currentTime = 0; return; } L.i--; return L.load(); };
  L.stop = function () { var v = el(); v.pause(); v.removeAttribute('src'); v.load(); L.q = []; L.i = -1; document.body.classList.remove('lplay', 'lvid'); K.emit('local'); };
  L.toggle = function () { var v = el(); if (v.paused) v.play(); else v.pause(); };
  function media(it) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: it.sub, artwork: it.thumb ? [{ src: K.img(it.thumb), sizes: '512x512' }] : [] });
      navigator.mediaSession.setActionHandler('play', function () { el().play(); }); navigator.mediaSession.setActionHandler('pause', function () { el().pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', L.prev); navigator.mediaSession.setActionHandler('nexttrack', function () { L.next(); });
    } catch (e) { /* не критично */ }
  }
  function upd() {
    var bar = $('#lbar'); if (!bar || L.i < 0) return; var v = el(), it = L.q[L.i] || {};
    var sig = L.i + '|' + L.q.length + '|' + v.paused + '|' + it.file;
    if (bar._s !== sig) {
      bar._s = sig;
      bar.innerHTML = K.frag(html`<div class="mini-art">${ic(it.kind === 'video' ? 'film' : 'music', 22)}${it.thumb ? html`<img src="${K.img(it.thumb)}" alt="" onerror="this.remove()">` : ''}</div>
        <div class="meta-l"><b>${it.title}</b><small>${t('В браузере')}${it.sub ? ' · ' + it.sub : ''} · ${L.i + 1}/${L.q.length}</small></div>
        <input type="range" min="0" max="1000" value="0" id="lseek" data-input="lseek" aria-label="${t('Перемотка')}"><span class="mini-time" id="ltime"></span>
        <div class="mini-ctl"><button class="ctl-btn" data-act="lprev">${ic('prev', 20)}</button><button class="ctl-btn big" data-act="lpp">${ic(v.paused ? 'play' : 'pause', 22)}</button><button class="ctl-btn" data-act="lnext">${ic('next', 20)}</button><button class="ctl-btn" data-act="lstop">${ic('x', 20)}</button></div>`);
    }
    var s = $('#lseek'), d = v.duration || 0;
    if (s && d && !L.drag) { s.value = v.currentTime / d * 1000; s.style.setProperty('--p', v.currentTime / d * 100 + '%'); }
    var tm = $('#ltime'); if (tm) tm.textContent = K.fmtTime(v.currentTime) + (d && isFinite(d) ? ' / ' + K.fmtTime(d) : '');
  }
  K.acts.lprev = L.prev; K.acts.lnext = function () { L.next(); }; K.acts.lstop = L.stop; K.acts.lpp = L.toggle;
  K.acts.lseek = function (e) { var v = el(); L.drag = true; clearTimeout(L._d); L._d = setTimeout(function () { L.drag = false; }, 400); if (v.duration) v.currentTime = e.value / 1000 * v.duration; };

  /* переключатель «куда играть» */
  K.acts.target = function () { var n = K.target() === 'kodi' ? 'browser' : 'kodi'; K.store.set('target', n); paintTarget(); K.toast(n === 'browser' ? t('Воспроизведение: в этом браузере') : t('Воспроизведение: на Kodi'), 'ok'); K.emit('target'); };
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
  document.addEventListener('DOMContentLoaded', function () { var tg = $('#tgt'); if (tg) paintTarget(); var b = document.createElement('div'); b.id = 'lbar'; b.className = 'glass'; document.body.appendChild(b); });
  setTimeout(paintTarget, 0);
})();

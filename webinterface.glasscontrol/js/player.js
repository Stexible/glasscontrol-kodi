/* Glass Control — плеер: состояние, мини-плеер, «Сейчас играет», громкость, события Kodi */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, $ = K.$, raw = K.raw;

  var PROPS = ['type', 'partymode', 'speed', 'time', 'totaltime', 'percentage', 'playlistid', 'position', 'repeat', 'shuffled', 'canseek', 'canchangespeed', 'canrepeat', 'canshuffle', 'canmove', 'canzoom', 'canrotate', 'live'];
  var VIDEO_EXTRA = ['currentaudiostream', 'audiostreams', 'subtitleenabled', 'currentsubtitle', 'subtitles'];
  var ITEM_PROPS = ['title', 'artist', 'albumartist', 'displayartist', 'album', 'year', 'genre', 'duration', 'runtime', 'showtitle', 'season', 'episode', 'art', 'thumbnail', 'fanart', 'file', 'plot', 'tagline', 'track', 'disc', 'rating', 'mpaa', 'firstaired', 'director', 'tvshowid', 'albumid', 'artistid', 'albumartistid'];
  var LBL_AUDIO = ['MusicPlayer.SampleRate', 'MusicPlayer.BitsPerSample', 'MusicPlayer.Codec', 'MusicPlayer.BitRate', 'MusicPlayer.Channels'];
  var LBL_VIDEO = ['VideoPlayer.VideoResolution', 'VideoPlayer.VideoCodec', 'VideoPlayer.AudioCodec', 'VideoPlayer.AudioChannels', 'VideoPlayer.VideoAspect'];

  var P = K.player = { id: null, type: null, props: null, item: null, tSync: 0, vol: { volume: 0, muted: false }, labels: {}, drag: false, _key: '', queue: null, qkey: '' };

  /* ------------ вспомогательное ------------ */
  P.pos = function () {
    if (!P.props) return 0;
    var sp = P.props.speed || 0, base = K.tsec(P.props.time), tot = K.tsec(P.props.totaltime);
    var v = base + (sp ? (performance.now() - P.tSync) / 1000 * sp : 0);
    return Math.max(0, tot ? Math.min(v, tot) : v);
  };
  P.total = function () { return P.props ? K.tsec(P.props.totaltime) : 0; };
  P.isVideo = function () { return P.type === 'video'; };
  P.title = function () {
    var i = P.item || {}; if (i.title) return i.title;
    if (i.label) return i.label;
    return (i.file || '').split(/[\\/]/).pop() || t('Без названия');
  };
  P.sub = function () {
    var i = P.item || {};
    if (P.type === 'audio') return K.join(i.displayartist || i.artist);
    if (i.showtitle) return i.showtitle + (i.season >= 0 && i.episode >= 0 ? ' · S' + (i.season < 10 ? '0' : '') + i.season + 'E' + (i.episode < 10 ? '0' : '') + i.episode : '');
    return [i.tagline, i.year || ''].filter(Boolean).join(' · ');
  };
  /* ссылки: исполнители и альбом → страницы медиатеки */
  P.artistLinks = function () {
    var i = P.item || {}, names = [].concat(i.artist && i.artist.length ? i.artist : (i.displayartist ? [i.displayartist] : [])), ids = [].concat(i.artistid || []);
    if (!names.length) return '';
    return K.raw(names.map(function (n, k) { return '<a class="lnk" data-act="nowartist" data-id="' + (ids.length === names.length && ids[k] > 0 ? ids[k] : 0) + '" data-name="' + K.esc(n) + '">' + K.esc(n) + '</a>'; }).join('<span class="sep">, </span>'));
  };
  P.thumb = function () { var i = P.item || {}; return K.pick(i, 'thumb', 'poster', 'album.thumb', 'tvshow.poster') || i.thumbnail || ''; };
  P.fan = function () { var i = P.item || {}; return i.fanart || (i.art && i.art.fanart) || ''; };
  function need() { if (P.id == null) throw new Error(t('Ничего не играет')); return P.id; }
  P.refreshSoon = function (ms) { clearTimeout(P._rs); P._rs = setTimeout(P.refresh, ms == null ? 150 : ms); };

  /* ------------ синхронизация ------------ */
  var busy = false, again = false;
  P.refresh = function () {
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    return K.rpc('Player.GetActivePlayers').then(function (list) {
      var sel = list.filter(function (x) { return x.type === 'video'; })[0] || list.filter(function (x) { return x.type === 'audio'; })[0] || list[0];
      return sel ? load(sel) : setIdle();
    }).catch(function () { /* нет связи — ничего не меняем */ }).then(function () { busy = false; if (again) { again = false; return P.refresh(); } });
  };
  function load(sel) {
    var id = sel.playerid, props = PROPS.concat(sel.type === 'video' ? VIDEO_EXTRA : []);
    return K.batch([['Player.GetProperties', { playerid: id, properties: props }], ['Player.GetItem', { playerid: id, properties: ITEM_PROPS }]]).then(function (r) {
      var item = K.ok(r[1]) ? r[1].item : null;
      if (r[0] instanceof Error) {
        return K.rpc('Player.GetProperties', { playerid: id, properties: ['type', 'speed', 'playlistid', 'position'] }).then(function (p) { apply(id, sel.type, p, item); });
      }
      apply(id, sel.type, r[0], item);
    });
  }
  function apply(id, type, props, item) {
    var key = id + '|' + (item ? (item.file || item.id || item.label || item.title) : '');
    var was = P.id; P.id = id; P.type = type; P.props = props; P.item = item || {}; P.tSync = performance.now();
    document.body.classList.add('playing'); document.body.classList.toggle('video', type === 'video');
    if (key !== P._key || was == null) { P._key = key; P.labels = {}; P.queue = null; P.fetchLabels(); }
    K.emit('player', P);
  }
  function setIdle() {
    if (P.id == null) return;
    P.id = null; P.props = null; P.item = null; P._key = ''; P.queue = null;
    document.body.classList.remove('playing'); K.emit('player', P);
  }
  P.fetchLabels = function () {
    if (P.id == null || P.type === 'picture') return;
    var key = P._key;
    K.rpc('XBMC.GetInfoLabels', { labels: P.type === 'audio' ? LBL_AUDIO : LBL_VIDEO }).then(function (l) {
      if (key !== P._key) return; P.labels = l || {}; K.emit('player', P);
    }).catch(function () { });
  };
  P.loadVol = function () {
    return K.rpc('Application.GetProperties', { properties: ['volume', 'muted'] }).then(function (a) { P.vol = { volume: a.volume, muted: a.muted }; K.emit('volume', P.vol); }).catch(function () { });
  };
  P.streamLine = function () {
    var L = P.labels, out = [], codec = '';
    if (P.type === 'audio') {
      var bits = L['MusicPlayer.BitsPerSample'], rate = L['MusicPlayer.SampleRate'], br = L['MusicPlayer.BitRate'];
      if (bits && bits !== '0') out.push('PCM ' + rate + 'kHz / ' + bits + 'bit'); else if (br) out.push(br + ' kbps' + (rate ? ' / ' + rate + 'kHz' : ''));
      codec = L['MusicPlayer.Codec'] || '';
    } else if (P.type === 'video') {
      var res = L['VideoPlayer.VideoResolution']; if (res) out.push(/^\d+$/.test(res) ? res + 'p' : res);
      if (L['VideoPlayer.VideoCodec']) out.push(L['VideoPlayer.VideoCodec'].toUpperCase());
      var ac = [L['VideoPlayer.AudioCodec'], L['VideoPlayer.AudioChannels']].filter(Boolean).join(' '); if (ac) out.push(ac.toUpperCase());
    }
    return { text: out.join(' · '), codec: codec.toUpperCase() };
  };

  /* ------------ действия ------------ */
  var A = K.acts;
  A.pp = function () { return K.rpc('Player.PlayPause', { playerid: need(), play: 'toggle' }).then(function () { P.refreshSoon(80); }); };
  A.stop = function () { return K.rpc('Player.Stop', { playerid: need() }).then(function () { P.refreshSoon(80); }); };
  A.next = function () { return K.rpc('Player.GoTo', { playerid: need(), to: 'next' }).then(function () { P.refreshSoon(300); }); };
  A.prev = function () { return K.rpc('Player.GoTo', { playerid: need(), to: 'previous' }).then(function () { P.refreshSoon(300); }); };
  A.step = function (el) { return K.rpc('Player.Seek', { playerid: need(), value: { step: el.dataset.v } }).then(function () { P.refreshSoon(150); }); };
  A.speedup = function () { return K.rpc('Player.SetSpeed', { playerid: need(), speed: el_v(arguments[0], 'increment') }).then(function () { P.refreshSoon(100); }); };
  function el_v(el, d) { return (el && el.dataset && el.dataset.v) || d; }
  A.speed = function (el) { return K.rpc('Player.SetSpeed', { playerid: need(), speed: el.dataset.v }).then(function () { P.refreshSoon(100); }); };
  A.repeat = function () { return K.rpc('Player.SetRepeat', { playerid: need(), repeat: 'cycle' }).then(function () { P.refreshSoon(80); }); };
  A.shuffle = function () { return K.rpc('Player.SetShuffle', { playerid: need(), shuffle: 'toggle' }).then(function () { P.refreshSoon(80); }); };
  A.fullscreen = function () { return K.rpc('GUI.SetFullscreen', { fullscreen: 'toggle' }); };
  A.osd = function () { return K.rpc('Input.ShowOSD'); };
  A.codec = function () { return K.rpc('Input.ShowCodec'); };
  A.zoom = function (el) { return K.rpc('Player.Zoom', { playerid: need(), zoom: el.dataset.v }); };
  A.rotate = function (el) { return K.rpc('Player.Rotate', { playerid: need(), value: el.dataset.v }); };
  A.mute = function () { return K.rpc('Application.SetMute', { mute: 'toggle' }).then(P.loadVol); };
  A.vol = function (el) { return K.rpc('Application.SetVolume', { volume: el.dataset.v === 'up' ? 'increment' : 'decrement' }).then(P.loadVol); };
  A.aud = function (el) { return K.rpc('Player.SetAudioStream', { playerid: need(), stream: +el.value }).then(function () { P.refreshSoon(300); }); };
  A.sub = function (el) {
    var v = el.value, p = { playerid: need(), subtitle: v === 'off' ? 'off' : +v };
    if (v !== 'off') p.enable = true;
    return K.rpc('Player.SetSubtitle', p).then(function () { P.refreshSoon(300); });
  };
  function jump(kind, id, name) {
    if (id > 0) return K.go('/music/' + kind + '/' + id);
    var art = kind === 'artist', f = { field: art ? 'artist' : 'album', operator: 'is', value: name };
    return K.rpc(art ? 'AudioLibrary.GetArtists' : 'AudioLibrary.GetAlbums', { filter: f, limits: { start: 0, end: 1 } }).then(function (r) {
      var l = (art ? r.artists : r.albums) || []; if (!l.length) return K.toast(t('В медиатеке не найдено'), 'err'); K.go('/music/' + kind + '/' + (art ? l[0].artistid : l[0].albumid));
    });
  }
  A.nowartist = function (el) { return jump('artist', +el.dataset.id, el.dataset.name); };
  A.nowalbum = function (el) { return jump('album', +el.dataset.id, el.dataset.name); };
  A.goto = function (el) { return K.rpc('Player.GoTo', { playerid: need(), to: +el.dataset.pos }).then(function () { P.refreshSoon(300); }); };
  A.qremove = function (el) {
    return K.rpc('Playlist.Remove', { playlistid: +el.dataset.pl, position: +el.dataset.pos }).then(function () { P.queue = null; K.emit('queue'); });
  };
  var volSend = K.debounce(function (v) { K.rpc('Application.SetVolume', { volume: v }).catch(K.err); }, 120);
  function volUI() {
    var v = P.vol.volume;
    K.$$('input[data-input="volset"]').forEach(function (n) { if (document.activeElement !== n) n.value = v; n.style.setProperty('--p', v + '%'); });
    K.$$('[data-volnum]').forEach(function (n) { n.textContent = v; });
    K.$$('[data-act="mute"]').forEach(function (n) { n.innerHTML = ic(P.vol.muted ? 'mute' : 'volume', n.closest('#mini') ? 20 : 24).s; n.classList.toggle('on', !!P.vol.muted); });
  }
  A.volset = function (el) { var v = +el.value; P.vol.volume = v; volUI(); volSend(v); };
  function $$all(s) { return K.$$(s); }
  A.seekin = function (el) { P.drag = true; var v = +el.value / 1000, tot = P.total(); el.style.setProperty('--p', (v * 100) + '%'); $$all('[data-tpos]').forEach(function (n) { n.textContent = K.fmtTime(v * tot); }); };
  A.seekgo = function (el) {
    P.drag = false; var pct = +el.value / 10;
    return K.rpc('Player.Seek', { playerid: need(), value: { percentage: pct } }).then(function () { P.refreshSoon(120); });
  };

  /* ------------ эквалайзер (оформление) ------------ */
  function eqBars(n, seed) {
    var o = '', s = seed || 7;
    for (var i = 0; i < n; i++) {
      s = (s * 9301 + 49297) % 233280; var r = s / 233280;
      var env = 0.4 + 0.6 * Math.exp(-i / (n * 0.4));
      o += '<i style="--h:' + Math.round((30 + 70 * r) * env) + '%;--d:' + (0.45 + r * 0.9).toFixed(2) + 's;--l:-' + (r * 1.2).toFixed(2) + 's"></i>';
    }
    return raw(o);
  }
  K.eqBars = eqBars;
  function eqPaused() { return !(P.props && P.props.speed === 1); }

  /* ------------ мини-плеер ------------ */
  function drawMini() {
    var m = $('#mini'); if (!m) return;
    var browser = K.target() === 'browser' && K.local && K.local.i >= 0 && P.id == null;
    if (!browser && (P.id == null)) { m.innerHTML = ''; m._sig = undefined; return; }
    if (browser) {
      var it = K.local.q[K.local.i], v = K.local.el;
      var playing = v && !v.paused;
      K.mount(m, html`<div class="mini-art">${ic(it.kind === 'video' ? 'film' : 'music', 22)}${it.thumb ? html`<img src="${K.img(it.thumb)}" alt="" onerror="this.remove()">` : ''}</div>
        <div class="mini-info"><b>${it.title}</b><small>${t('В браузере')}${it.sub ? ' · ' + it.sub : ''} · ${K.local.i + 1}/${K.local.q.length}</small></div>
        <span class="mini-time" data-pos2></span>
        <div class="mini-vol"><button class="ctl-btn" data-act="lmute" aria-label="${t('Звук')}">${ic(v && v.muted ? 'mute' : 'volume', 20)}</button><input type="range" min="0" max="100" value="${v ? Math.round(v.volume * 100) : 100}" style="--p:${v ? v.volume * 100 : 100}%" data-input="lvolset" aria-label="${t('Громкость')}"></div>
        <div class="mini-ctl">
          <button class="ctl-btn" data-act="lprev">${ic('prev', 20)}</button>
          <button class="ctl-btn big" data-act="lpp">${ic(playing ? 'pause' : 'play', 22)}</button>
          <button class="ctl-btn" data-act="lnext">${ic('next', 20)}</button>
          ${it.kind === 'video' ? html`<button class="ctl-btn" data-act="ltheater" aria-label="${t('Кинотеатр')}">${ic('wide', 20)}</button><button class="ctl-btn" data-act="laud" aria-label="${t('Озвучка')}">${ic('audio', 20)}</button><button class="ctl-btn" data-act="lfullscreen" aria-label="${t('На весь экран')}">${ic('fullscreen', 20)}</button>` : ''}
          <button class="ctl-btn" data-act="lstop">${ic('x', 20)}</button></div>
        <div class="mini-bar"><input type="range" min="0" max="1000" value="0" data-seekbar data-input="lseek" aria-label="${t('Перемотка')}"></div>`, 'lbrowser|' + it.file + '|' + playing + '|' + (v && v.muted) + '|' + (v ? Math.round(v.volume*100) : 100));
      return;
    }
    var playing = P.props && P.props.speed !== 0, thumb = P.thumb();
    K.mount(m, html`<div class="mini-art">${ic(P.type === 'audio' ? 'music' : 'film', 22)}${thumb ? html`<img src="${K.img(thumb)}" alt="" onerror="this.remove()">` : ''}</div>
      <div class="mini-info"><b>${P.title()}</b><small>${P.sub()}</small></div>
      <div class="eq mini-eq ${eqPaused() ? 'paused' : ''}">${eqBars(26, 3)}</div>
      <span class="mini-time" data-pos2></span>
      <div class="mini-vol"><button class="ctl-btn" data-act="mute" aria-label="${t('Звук')}">${ic(P.vol.muted ? 'mute' : 'volume', 20)}</button><input type="range" min="0" max="100" value="${P.vol.volume}" style="--p:${P.vol.volume}%" data-input="volset" aria-label="${t('Громкость')}"></div>
      <div class="mini-ctl">
        <button class="ctl-btn" data-act="prev" aria-label="${t('Назад')}">${ic('prev', 20)}</button>
        <button class="ctl-btn big" data-act="pp" aria-label="${t('Пауза')}">${ic(playing ? 'pause' : 'play', 22)}</button>
        <button class="ctl-btn" data-act="next" aria-label="${t('Далее')}">${ic('next', 20)}</button>
        <button class="ctl-btn" data-act="stop" aria-label="${t('Стоп')}">${ic('stop', 20)}</button></div>
      <div class="mini-bar"><input type="range" min="0" max="1000" value="0" data-seekbar data-input="seekin" data-change="seekgo" aria-label="${t('Перемотка')}"></div>`, [P.id, P.title(), P.sub(), thumb, playing, eqPaused(), P.vol.muted].join('|'));
    tick();
  }
  document.addEventListener('click', function (e) {
    var m = e.target.closest('#mini'); if (m && !e.target.closest('button, input, a')) K.go('/now');
  });

  /* ------------ тик: время/прогресс ------------ */
  function tick() {
    if (P.id != null && P.props) {
      var pos = P.pos(), tot = P.total(), pct = tot ? pos / tot * 100 : 0;
      var bar = $('#mini .mini-bar i'); if (bar) bar.style.width = pct + '%';
      var mt = $('[data-pos2]'); if (mt) mt.textContent = K.fmtTime(pos) + (tot ? ' / ' + K.fmtTime(tot) : '');
      if (!P.drag) {
        K.$$('[data-tpos]').forEach(function (n) { n.textContent = K.fmtTime(pos); });
        K.$$('[data-seekbar]').forEach(function (n) { n.value = tot ? pos / tot * 1000 : 0; n.style.setProperty('--p', pct + '%'); });
      }
    } else if (K.target() === 'browser' && K.local && K.local.i >= 0 && K.local.el) {
      var v = K.local.el, pos = v.currentTime || 0, tot = v.duration || 0, pct = tot ? pos / tot * 100 : 0;
      var bar = $('#mini .mini-bar i'); if (bar) bar.style.width = pct + '%';
      var mt = $('[data-pos2]'); if (mt) mt.textContent = K.fmtTime(pos) + (tot && isFinite(tot) ? ' / ' + K.fmtTime(tot) : '');
      if (!(K.local && K.local.drag)) {
        K.$$('[data-tpos]').forEach(function (n) { n.textContent = K.fmtTime(pos); });
        K.$$('[data-seekbar]').forEach(function (n) { n.value = tot ? pos / tot * 1000 : 0; n.style.setProperty('--p', pct + '%'); });
      }
    }
  }
  setInterval(function () { if (!document.hidden) tick(); }, 250);

  /* ------------ страница «Сейчас играет» ------------ */
  function loadQueue() {
    var pl = P.props && P.props.playlistid;
    if (pl == null || pl < 0 || pl > 1) { P.queue = []; return Promise.resolve(); }
    var key = P._key + '|' + pl;
    return K.rpc('Playlist.GetItems', { playlistid: pl, properties: ['title', 'artist', 'album', 'showtitle', 'season', 'episode', 'art', 'thumbnail', 'duration', 'runtime', 'file'], limits: { start: 0, end: 300 } }).then(function (r) {
      P.queue = r.items || []; P.qkey = key;
    });
  }
  function qLine(it) {
    if (it.showtitle) return it.showtitle + (it.season >= 0 ? ' · S' + it.season + 'E' + it.episode : '');
    return K.join(it.artist) + (it.album ? ' — ' + it.album : '');
  }
  K.pages.now = {
    nav: 'now', title: function () { return t('Сейчас играет'); },
    render: function (ctx) {
      var view = ctx.view, bg = null;
      ctx.cleanup.push(function () {
        if (K.local && K.local._embedded) {
          K.local._embedded = false;
          var v = K.local.el;
          if (v) { v.style.left = ''; v.style.top = ''; v.style.right = ''; v.style.bottom = ''; if (v.parentNode !== document.body) { document.body.appendChild(v); } v.classList.remove('embedded'); }
          K.local._embeddedFile = null;
        }
      });
      function draw() {
        if (view.contains(document.activeElement) && document.activeElement.type === 'range' && (P.drag || (K.local && K.local.drag))) return;
        if (P.id == null && !(K.target() === 'browser' && K.local && K.local.i >= 0)) {
          K.mount(view, html`${K.ui.head(t('Сейчас играет'))}${K.ui.empty('music', t('Сейчас ничего не играет'), t('Выберите фильм или музыку в медиатеке'))}
            <div class="chips" style="justify-content:center"><a class="chip" href="#/movies">${t('Фильмы')}</a><a class="chip" href="#/music">${t('Музыка')}</a><a class="chip" href="#/tv">${t('Сериалы')}</a><a class="chip" href="#/files">${t('Файлы')}</a></div>`);
          setBg(''); 
          // Move player back to floating if embedded
          if (K.local && K.local._embedded) { K.local._embedded = false; var v = K.local.el; if (v) { v.style.left = ''; v.style.top = ''; v.style.right = ''; v.style.bottom = ''; if (v.parentNode !== document.body) { document.body.appendChild(v); } v.classList.remove('embedded'); } }
          return;
        }
        if (K.target() === 'browser' && K.local && K.local.i >= 0 && P.id == null) {
          var it = K.local.q[K.local.i];
          // Already embedded and same track — just refresh play/pause icon
          if (K.local._embedded && K.local._embeddedFile === it.file) {
            var btn = view.querySelector('[data-act="lpp"]');
            if (btn) btn.innerHTML = K.frag(ic(K.local.el && K.local.el.paused ? 'play' : 'pause', 26));
            setBg(''); return;
          }
          // If embedded on a different track, detach first
          if (K.local._embedded) {
            K.local._embedded = false;
            var vv = K.local.el;
            if (vv) { vv.style.left = ''; vv.style.top = ''; vv.style.right = ''; vv.style.bottom = ''; if (vv.parentNode !== document.body) { document.body.appendChild(vv); } vv.classList.remove('embedded'); }
          }
          var isVideo = it.kind === 'video';
          if (isVideo) {
            K.mount(view, html`${K.ui.head(t('Сейчас играет') + ' — ' + t('В браузере'))}
              <div class="now browser">
                <div id="now-vslot" class="now-vslot"></div>
                <div><h1 class="now-t">${it.title}</h1>${it.sub ? html`<div class="now-a">${it.sub}</div>` : ''}
                <p class="note">${t('Воспроизведение в браузере.')}</p></div></div>`);
            setBg('');
            var v = K.local.el;
            if (v) {
              var slot = document.getElementById('now-vslot');
              if (slot) { v.style.left = ''; v.style.top = ''; v.style.right = ''; v.style.bottom = ''; slot.appendChild(v); v.classList.add('embedded'); K.local._embedded = true; K.local._embeddedFile = it.file; }
            }
          } else {
            var v = K.local.el, playing = !(v && v.paused);
            K.mount(view, html`${K.ui.head(t('Сейчас играет') + ' — ' + t('В браузере'))}
              <div class="now">
                <div><div class="now-art">${ic('music', 64)}${it.thumb ? html`<img src="${K.img(it.thumb)}" alt="" onerror="this.remove()">` : ''}</div>
                  ${html`<div class="glass now-eq"><div class="eq ${playing ? '' : 'paused'}">${eqBars(64, 11)}</div></div>`}</div>
                <div>
                  <h1 class="now-t">${it.title}</h1>
                  ${it.sub ? html`<div class="now-a">${it.sub}</div>` : ''}
                  <div class="seek"><span data-tpos>${v ? K.fmtTime(v.currentTime || 0) : '0:00'}</span><input type="range" min="0" max="1000" value="${v && v.duration ? Math.round((v.currentTime / v.duration) * 1000) : 0}" data-seekbar data-input="lseek" aria-label="${t('Перемотка')}"><span>${v && v.duration ? K.fmtTime(v.duration) : '∞'}</span></div>
                  <div class="transport">
                    <button class="ctl-btn" data-act="lprev" aria-label="${t('Предыдущий')}">${ic('prev', 24)}</button>
                    <button class="ctl-btn big" data-act="lpp" aria-label="${t('Пауза')}">${ic(playing ? 'pause' : 'play', 26)}</button>
                    <button class="ctl-btn" data-act="lnext" aria-label="${t('Следующий')}">${ic('next', 24)}</button>
                    <button class="ctl-btn" data-act="lstop" aria-label="${t('Стоп')}">${ic('stop', 22)}</button>
                  </div>
                  <div class="now-opts">
                    <div class="grp vol"><button class="icon-btn" data-act="lmute" aria-label="${t('Звук')}">${ic(v && v.muted ? 'mute' : 'volume')}</button>
                      <input type="range" min="0" max="100" value="${v ? Math.round(v.volume * 100) : 100}" style="--p:${v ? v.volume * 100 : 100}%" data-input="lvolset" aria-label="${t('Громкость')}"><span class="row-s" data-volnum style="min-width:28px">${v ? Math.round(v.volume * 100) : 100}</span></div>
                  </div>
                </div></div>
              <div id="now-q"></div>`);
            setBg('');
            // playlist at bottom
            var box = document.getElementById('now-q');
            if (box && K.local.q && K.local.q.length) {
              K.mount(box, html`${K.ui.sec(t('Очередь'), html`<a class="btn sm ghost" href="#/queue">${t('Управление')}</a>`)}
                <div class="glass panel list" style="padding:8px">${K.local.q.map(function (it, i) {
                  return K.ui.row({ cls: i === K.local.i ? 'cur' : '', lead: i === K.local.i ? ic('play', 14) : i + 1, img: it.thumb || '', icon: 'music', title: it.title || it.label,
                    sub: it.sub || '', attrs: 'style="cursor:pointer" data-act="lqgoto" data-i="' + i + '"' });
                })}</div>`);
            }
          }
          return;
        }
        var pr = P.props, vid = P.type === 'video', pic = P.type === 'picture', sl = P.streamLine(), item = P.item;
        var playing = pr.speed !== 0, thumb = P.thumb();
        var audios = pr.audiostreams || [], subs = pr.subtitles || [];
        setBg(P.fan() || thumb);
        var sig = [P._key, pr.speed, pr.repeat, pr.shuffled, pr.canseek, pr.live, JSON.stringify(sl), pr.currentaudiostream && pr.currentaudiostream.index, pr.subtitleenabled, pr.currentsubtitle && pr.currentsubtitle.index, (audios.length) + ':' + (subs.length), thumb].join('|');
        K.mount(view, html`<div class="now">
          <div><div class="now-art ${vid && item.fanart && !thumb ? 'land' : ''}">${ic(vid ? 'film' : 'music', 64)}${thumb ? html`<img src="${K.img(thumb)}" alt="" onerror="this.remove()">` : ''}</div>
            ${!vid && !pic ? html`<div class="glass now-eq"><div class="eq ${eqPaused() ? 'paused' : ''}">${eqBars(64, 11)}</div></div>` : ''}</div>
          <div>
            <h1 class="now-t">${P.title()}</h1>
            ${P.sub() ? html`<div class="now-a">${vid ? P.sub() : P.artistLinks() || P.sub()}</div>` : ''}
            ${item.album && !vid ? html`<div class="now-b"><a class="lnk" data-act="nowalbum" data-id="${item.albumid > 0 ? item.albumid : 0}" data-name="${item.album}">${item.album}</a>${item.year ? ' (' + item.year + ')' : ''}</div>` : ''}
            ${(sl.text || sl.codec) ? html`<div class="fmt">${sl.text}${sl.codec ? html`<span class="pill">${sl.codec}</span>` : ''}</div>` : ''}
            ${!pic ? html`<div class="seek"><span data-tpos>0:00</span><input type="range" min="0" max="1000" value="0" data-seekbar data-input="seekin" data-change="seekgo" ${pr.canseek === false || pr.live ? raw('disabled') : ''} aria-label="${t('Перемотка')}"><span>${P.total() ? K.fmtTime(P.total()) : '∞'}</span></div>` : ''}
            <div class="transport">
              ${pr.canrepeat !== false ? html`<button class="ctl-btn ${pr.repeat && pr.repeat !== 'off' ? 'on' : ''}" data-act="repeat" aria-label="${t('Повтор')}">${ic(pr.repeat === 'one' ? 'repeat1' : 'repeat', 22)}</button>` : ''}
              <button class="ctl-btn" data-act="prev" aria-label="${t('Предыдущий')}">${ic('prev', 24)}</button>
              ${!pic ? html`<button class="ctl-btn" data-act="step" data-v="bigbackward" aria-label="${t('Назад')}">${ic('rew', 22)}</button>` : ''}
              <button class="ctl-btn big" data-act="pp" aria-label="${t('Пауза')}">${ic(playing ? 'pause' : 'play', 26)}</button>
              ${!pic ? html`<button class="ctl-btn" data-act="step" data-v="bigforward" aria-label="${t('Вперёд')}">${ic('ff', 22)}</button>` : ''}
              <button class="ctl-btn" data-act="next" aria-label="${t('Следующий')}">${ic('next', 24)}</button>
              <button class="ctl-btn" data-act="stop" aria-label="${t('Стоп')}">${ic('stop', 22)}</button>
              ${pr.canshuffle !== false ? html`<button class="ctl-btn ${pr.shuffled ? 'on' : ''}" data-act="shuffle" aria-label="${t('Перемешать')}">${ic('shuffle', 22)}</button>` : ''}
            </div>
            <div class="now-opts">
              <div class="grp vol"><button class="icon-btn" data-act="mute" aria-label="${t('Звук')}">${ic(P.vol.muted ? 'mute' : 'volume')}</button>
                <input type="range" min="0" max="100" value="${P.vol.volume}" style="--p:${P.vol.volume}%" data-input="volset" aria-label="${t('Громкость')}"><span class="row-s" data-volnum style="min-width:28px">${P.vol.volume}</span></div>
              ${vid && pr.canchangespeed ? html`<div class="grp"><button class="icon-btn" data-act="speedup" data-v="decrement">${ic('rew', 18)}</button><span class="row-s">×${pr.speed}</span><button class="icon-btn" data-act="speedup" data-v="increment">${ic('ff', 18)}</button></div>` : ''}
              ${vid && audios.length > 1 ? html`<div class="grp">${ic('audio', 20)}${K.ui.select(audios.map(function (a) { return [a.index, [a.name || a.language || '#' + a.index, a.codec, a.channels ? a.channels + 'ch' : ''].filter(Boolean).join(' · ')]; }), pr.currentaudiostream && pr.currentaudiostream.index, 'data-change="aud"')}</div>` : ''}
              ${vid && subs.length ? html`<div class="grp">${ic('subs', 20)}${K.ui.select([['off', t('Выкл.')]].concat(subs.map(function (s) { return [s.index, s.name || s.language || '#' + s.index]; })), pr.subtitleenabled && pr.currentsubtitle ? pr.currentsubtitle.index : 'off', 'data-change="sub"')}</div>` : ''}
              ${vid ? html`<button class="btn sm ghost" data-act="osd">${ic('sliders', 16)} OSD</button><button class="btn sm ghost" data-act="codec">${ic('info', 16)} ${t('Кодеки')}</button>` : ''}
              <button class="btn sm ghost" data-act="fullscreen">${ic('fullscreen', 16)} ${t('На весь экран')}</button>
              ${pic ? html`<button class="btn sm ghost" data-act="zoom" data-v="in">${ic('zoomin', 16)}</button><button class="btn sm ghost" data-act="zoom" data-v="out">−</button><button class="btn sm ghost" data-act="rotate" data-v="clockwise">${ic('rotate', 16)}</button>` : ''}
            </div>
            ${vid && item.plot ? html`<p class="plot" style="margin-top:20px">${item.plot}</p>` : ''}
          </div></div>
          <div id="now-q"></div>`, sig);
        drawQueue(); tick(); volUI();
      }
      function setBg(img) {
        if (!img) { if (bg) { bg.remove(); bg = null; } return; }
        if (!bg) { bg = document.createElement('div'); bg.className = 'now-bg'; document.body.appendChild(bg); }
        bg.innerHTML = '<img alt="" src="' + K.img(img) + '">';
      }
      function drawQueue() {
        var box = $('#now-q'); if (!box || P.id == null) return;
        if (P.queue == null) { loadQueue().then(drawQueue).catch(function () { }); return; }
        if (!P.queue.length) { box.innerHTML = ''; return; }
        var pl = P.props.playlistid, cur = P.props.position;
        var qsig = [P.qkey, cur, P.queue.length, P.queue.map(function (i) { return i.file; }).join('|').length].join('|');
        K.mount(box, html`${K.ui.sec(t('Очередь'), html`<a class="btn sm ghost" href="#/queue">${t('Управление')}</a>`)}
          <div class="glass panel list" style="padding:8px">${P.queue.map(function (it, i) {
          return K.ui.row({ cls: i === cur ? 'cur' : '', lead: i === cur ? ic('play', 14) : i + 1, img: K.pick(it, 'thumb', 'poster') || it.thumbnail || '', shape: it.showtitle ? 'land' : '', icon: it.showtitle ? 'film' : 'music',
            title: it.title || it.label, sub: qLine(it), right: html`<span class="row-s">${K.fmtTime(it.duration || (it.runtime || 0))}</span><button class="icon-btn hov" data-act="qremove" data-pl="${pl}" data-pos="${i}" aria-label="${t('Убрать')}">${ic('x', 18)}</button>`,
            attrs: 'data-act="goto" data-pos="' + i + '" style="cursor:pointer"' });
        })}</div>`, qsig);
      }
      draw();
      ctx.cleanup.push(K.on('player', draw), K.on('local', draw), K.on('queue', function () { P.queue = null; drawQueue(); }),
        function () { if (bg) bg.remove(); });
    }
  };
  /* строки очереди кликабельны, но кнопки внутри не должны запускать goto */
  document.addEventListener('click', function (e) { if (e.target.closest('[data-act="qremove"]')) e.stopPropagation(); }, true);

  /* ------------ события Kodi ------------ */
  var libDeb = K.debounce(function () { K.emit('library'); }, 800);
  ['Player.OnPlay', 'Player.OnResume', 'Player.OnPause', 'Player.OnStop', 'Player.OnSeek', 'Player.OnSpeedChanged', 'Player.OnPropertyChanged', 'Player.OnAVChange'].forEach(function (n) {
    K.on('n:' + n, function () { P.refreshSoon(120); });
  });
  K.on('n:Player.OnAVStart', function () { P.refreshSoon(100); setTimeout(P.fetchLabels, 1200); });
  K.on('n:Application.OnVolumeChanged', function (d) { if (d) { P.vol = { volume: d.volume, muted: d.muted }; K.emit('volume', P.vol); } });
  ['Playlist.OnAdd', 'Playlist.OnRemove', 'Playlist.OnClear'].forEach(function (n) { K.on('n:' + n, function () { P.queue = null; K.emit('queue'); P.refreshSoon(200); }); });
  ['AudioLibrary', 'VideoLibrary'].forEach(function (lib) {
    K.on('n:' + lib + '.OnScanStarted', function () { K.toast(t('Сканирование медиатеки началось')); });
    K.on('n:' + lib + '.OnScanFinished', function () { K.toast(t('Сканирование завершено'), 'ok'); libDeb(); });
    K.on('n:' + lib + '.OnCleanStarted', function () { K.toast(t('Очистка медиатеки началась')); });
    K.on('n:' + lib + '.OnCleanFinished', function () { K.toast(t('Очистка завершена'), 'ok'); libDeb(); });
    K.on('n:' + lib + '.OnUpdate', libDeb); K.on('n:' + lib + '.OnRemove', libDeb);
  });
  K.on('n:System.OnQuit', function () { K.toast(t('Kodi завершает работу'), 'err'); });
  K.on('n:System.OnRestart', function () { K.toast(t('Kodi перезапускается'), 'err'); });
  K.on('n:System.OnSleep', function () { K.toast(t('Kodi уходит в сон')); });
  K.on('online', function () { P.refresh(); P.loadVol(); });
  K.on('n:Input.OnInputRequested', function (d) {
    d = d || {}; var done = false;
    var m = K.ui.modal({
      title: d.title || t('Ввод текста'), cls: 'sm',
      body: html`<label class="field"><span>${t('Kodi просит ввести текст')}</span><input class="inp" id="kin" type="${d.type === 'password' ? 'password' : d.type === 'number' ? 'number' : 'text'}" value="${d.value || ''}"></label>`,
      actions: [{ label: t('Отмена'), onclick: function () { done = true; K.rpc('Input.Back').catch(function () { }); } },
        { label: 'OK', cls: 'primary', onclick: function (el) { done = true; K.rpc('Input.SendText', { text: $('#kin', el).value, done: true }).catch(K.err); } }],
      onClose: function () { if (!done) K.rpc('Input.Back').catch(function () { }); }
    });
    $('#kin', m.el).addEventListener('keydown', function (e) { if (e.key === 'Enter') { done = true; K.rpc('Input.SendText', { text: this.value, done: true }).catch(K.err); m.close(); } });
    m.el.dataset.kodiInput = '1';
  });
  K.on('n:Input.OnInputFinished', function () { var m = $('[data-kodi-input]'); if (m) m.remove(); });

  K.on('player', drawMini);
  K.on('local', drawMini);
  K.on('volume', volUI);

  /* ------------ websocket (порт 9090) + опрос как запасной вариант ------------ */
  var E = K.events = { ok: false, tries: 0, sock: null };
  function connect() {
    var port = K.store.get('wsport', 9090); if (!port || !window.WebSocket) return;
    var s;
    try { s = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':' + port + '/jsonrpc'); } catch (e) { return; }
    E.sock = s;
    s.onopen = function () { E.ok = true; E.tries = 0; K.emit('ws', true); P.refresh(); };
    s.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && m.method) { var d = m.params && m.params.data; K.emit('n:' + m.method, d); K.emit('notify', m); }
    };
    s.onclose = function () {
      var was = E.ok; E.ok = false; E.sock = null; K.emit('ws', false);
      E.tries++; if (E.tries > 6 && !was) return;                // порт недоступен — остаёмся на опросе
      setTimeout(connect, Math.min(30000, 1000 * E.tries * E.tries));
    };
    s.onerror = function () { try { s.close(); } catch (e) { /* ignore */ } };
  }
  E.reconnect = function () { E.tries = 0; if (E.sock) { try { E.sock.close(); } catch (e) { /* ignore */ } } else connect(); };
  P.start = function () {
    P.refresh(); P.loadVol(); connect();
    var n = 0;
    setInterval(function () {
      if (document.hidden || !K.st.online) return;
      n++; var playing = P.id != null && P.props && P.props.speed !== 0;
      var every = E.ok ? (playing ? 20 : 60) : (playing ? 2 : 5);          // секунды
      if (n % every === 0) { P.refresh(); if (n % (every * 3) === 0) P.loadVol(); }
    }, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { P.refresh(); P.loadVol(); } });
  };
})();

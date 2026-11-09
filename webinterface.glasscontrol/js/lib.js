/* Glass Control — медиатека: главная, фильмы, сериалы, музыка, клипы, детали, поиск */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, raw = K.raw, $ = K.$;
  var V = 'VideoLibrary.', A = 'AudioLibrary.';

  var MOVIE_P = ['title', 'year', 'art', 'playcount', 'resume', 'rating', 'runtime', 'genre', 'dateadded', 'lastplayed'];
  var MOVIE_D = MOVIE_P.concat(['plot', 'tagline', 'mpaa', 'director', 'writer', 'studio', 'country', 'cast', 'originaltitle', 'file', 'trailer', 'set', 'streamdetails']);
  var SHOW_P = ['title', 'year', 'art', 'playcount', 'episode', 'watchedepisodes', 'rating', 'genre', 'dateadded'];
  var SHOW_D = SHOW_P.concat(['plot', 'mpaa', 'studio', 'cast', 'premiered', 'originaltitle', 'file', 'season']);
  var EP_P = ['title', 'showtitle', 'season', 'episode', 'art', 'playcount', 'resume', 'runtime', 'firstaired', 'tvshowid', 'rating', 'plot', 'dateadded'];
  var ALBUM_P = ['title', 'artist', 'year', 'art', 'genre', 'rating', 'albumlabel', 'playcount', 'dateadded'];
  var MV_P = ['title', 'artist', 'year', 'art', 'runtime', 'playcount', 'genre', 'album', 'dateadded'];

  function run(m, p) { return K.rpc(m, p); }
  function pct(it) { return it.resume && it.resume.total ? it.resume.position / it.resume.total * 100 : 0; }
  function mins(it) { var r = it.runtime || 0; return r ? Math.round(r / 60) + ' ' + t('мин') : ''; }
  function stars(r) { return r ? html`<span class="stars">${ic('star', 14)} ${(+r).toFixed(1)}</span>` : ''; }

  /* ---------- карточки ---------- */
  function movieCard(m) {
    return K.ui.card({ key: K.reg('movie', m), img: K.pick(m, 'poster', 'thumb'), title: m.title, sub: [m.year || '', mins(m)].filter(Boolean).join(' · '), href: '#/movies/' + m.movieid, watched: m.playcount > 0, prog: pct(m) });
  }
  function showCard(s) {
    var left = (s.episode || 0) - (s.watchedepisodes || 0);
    return K.ui.card({ key: K.reg('tvshow', s), img: K.pick(s, 'poster', 'thumb'), icon: 'tv', title: s.title, sub: [s.year || '', s.episode ? s.episode + ' ' + t('эп.') : ''].filter(Boolean).join(' · '), href: '#/tv/' + s.tvshowid, watched: s.episode > 0 && left === 0, badge: left > 0 && s.watchedepisodes > 0 ? left : '' });
  }
  function epCard(e) {
    return K.ui.card({ key: K.reg('episode', e), shape: 'land', icon: 'tv', img: K.pick(e, 'thumb', 'tvshow.fanart') || '', title: e.title, sub: e.showtitle + ' · S' + e.season + 'E' + e.episode, href: '#/tv/' + e.tvshowid + '/' + e.season, watched: e.playcount > 0, prog: pct(e) });
  }
  function albumCard(a) {
    return K.ui.card({ key: K.reg('album', a), shape: 'sq', icon: 'disc', img: K.pick(a, 'thumb'), title: a.title, sub: [K.join(a.artist), a.year || ''].filter(Boolean).join(' · '), href: '#/music/album/' + a.albumid });
  }
  function artistCard(a) {
    return K.ui.card({ key: K.reg('artist', a), shape: 'sq circle', icon: 'mic', img: K.pick(a, 'thumb'), title: a.artist, href: '#/music/artist/' + a.artistid });
  }
  function mvCard(m) {
    return K.ui.card({ key: K.reg('musicvideo', m), shape: 'land', icon: 'clip', img: K.pick(m, 'thumb', 'poster'), title: m.title, sub: K.join(m.artist), watched: m.playcount > 0 });
  }
  function songRow(s, i, list) {
    return K.ui.row({ lead: s.track || i + 1, title: s.title, sub: K.join(s.artist) + (list ? '' : ''), right: html`<span class="row-s">${K.fmtTime(s.duration)}</span><button class="icon-btn" data-act="cmenu" data-k="${K.reg('song', s)}">${ic('more', 18)}</button>`,
      attrs: 'data-act="cplay" data-k="' + K.reg('song', s) + '" style="cursor:pointer"' });
  }
  function hrow(title, items, card, more) {
    if (!items || !items.length) return '';
    return html`${K.ui.sec(title, '', more)}<div class="hrow">${items.map(card)}</div>`;
  }

  /* ---------- воспроизведение составных объектов ---------- */
  K.playAlbum = function (albumid, pos) {
    return run('Playlist.Clear', { playlistid: 0 }).then(function () { return run('Playlist.Add', { playlistid: 0, item: { albumid: albumid } }); })
      .then(function () { return run('Player.Open', { item: { playlistid: 0, position: pos || 0 } }); })
      .then(function () { K.toast(t('Запускаю воспроизведение'), 'ok'); K.emit('queue'); K.player.refreshSoon(400); }).catch(K.err);
  };
  K.playShow = function (id) {
    return run(V + 'GetEpisodes', { tvshowid: id, properties: ['playcount', 'season', 'episode'], sort: { method: 'episode', order: 'ascending' } }).then(function (r) {
      var eps = (r.episodes || []).sort(function (a, b) { return a.season - b.season || a.episode - b.episode; });
      if (!eps.length) return K.toast(t('Нет серий'), 'err');
      var i = 0; for (; i < eps.length; i++) if (!eps[i].playcount) break; if (i >= eps.length) i = 0;
      return K.playList(1, eps.map(function (e) { return { episodeid: e.episodeid }; }), i);
    }).catch(K.err);
  };

  /* ---------- отметки и удаление ---------- */
  var SETD = { movie: ['SetMovieDetails', 'movieid'], episode: ['SetEpisodeDetails', 'episodeid'], tvshow: ['SetTVShowDetails', 'tvshowid'], musicvideo: ['SetMusicVideoDetails', 'musicvideoid'] };
  var DEL = { movie: ['RemoveMovie', 'movieid'], episode: ['RemoveEpisode', 'episodeid'], tvshow: ['RemoveTVShow', 'tvshowid'], musicvideo: ['RemoveMusicVideo', 'musicvideoid'] };
  function setWatched(kind, it, on) {
    var d = SETD[kind], p = {}; p[d[1]] = it[d[1]]; p.playcount = on ? 1 : 0; if (!on && kind !== 'tvshow') p.resume = { position: 0, total: 0 };
    if (kind === 'tvshow') p = (function () { var q = {}; q.tvshowid = it.tvshowid; q.playcount = on ? 1 : 0; return q; })();
    return run(V + d[0], p).then(function () { K.toast(on ? t('Отмечено просмотренным') : t('Отмечено непросмотренным'), 'ok'); K.emit('library'); });
  }
  function removeItem(kind, it) {
    var d = DEL[kind];
    return K.ui.confirm(t('Удалить «{n}» из медиатеки? Файлы на диске останутся.', { n: it.title }), { danger: true, ok: t('Удалить') }).then(function (y) {
      if (!y) return; var p = {}; p[d[1]] = it[d[1]];
      return run(V + d[0], p).then(function () { K.toast(t('Удалено из медиатеки'), 'ok'); K.emit('library'); if (K.cur.path.split('/').length > 2) history.back(); });
    });
  }
  K.extraMenu = function (kind, it) {
    if (!SETD[kind]) return [];
    var seen = it.playcount > 0;
    return [{ icon: seen ? 'eyeoff' : 'eye', label: seen ? t('Отметить непросмотренным') : t('Отметить просмотренным'), run: function () { return setWatched(kind, it, !seen); } },
      { icon: 'trash', danger: true, label: t('Удалить из медиатеки'), run: function () { return removeItem(kind, it); } }];
  };


  /* ---------- вкладки раздела (с «Папки») и панель обслуживания медиатеки ---------- */
  var SEC = { movies: { base: '/movies', tabs: [['', 'Фильмы'], ['folders', 'Папки']], media: 'video', content: 'movies' },
    tv: { base: '/tv', tabs: [['', 'Сериалы'], ['folders', 'Папки']], media: 'video', content: 'tvshows' },
    mv: { base: '/mv', tabs: [['', 'Клипы'], ['folders', 'Папки']], media: 'video', content: 'musicvideos' },
    music: { base: '/music', tabs: [['', 'Альбомы'], ['artists', 'Исполнители'], ['songs', 'Треки'], ['folders', 'Папки']], media: 'music' } };
  K.secTabs = function (sec, cur) {
    var S = SEC[sec];
    return html`<div class="tabs">${S.tabs.map(function (x) { return html`<a class="${x[0] === (cur || '') ? 'on' : ''}" href="#${S.base}${x[0] ? '/' + x[0] : ''}">${t(x[1])}</a>`; })}</div>`;
  };
  K.libBar = function (sec) {
    var S = SEC[sec], kind = S.media;
    return html`<div class="libbar"><button class="btn sm" data-act="lscan" data-v="${kind}" title="${t('Найти новые и изменённые файлы')}">${ic('refresh', 16)} ${t('Обновить')}</button>
      <button class="btn sm" data-act="lclean" data-v="${kind}" ${S.content ? raw('data-c="' + S.content + '"') : ''} title="${t('Полностью сбросить базу медиатеки, чтобы собрать её заново')}">${ic('eraser', 16)} ${t('Очистить')}</button>
      <button class="icon-btn" data-act="srcs" data-v="${kind}" aria-label="${t('Источники')}" title="${t('Источники')}">${ic('sliders', 18)}</button></div>`;
  };
  K.acts.lscan = function (el) { return K.libScanOnly(el.dataset.v); };

  /* ---------- универсальная страница-список ---------- */
  function setQ(q, patch) {
    var n = {}; Object.keys(q).forEach(function (k) { n[k] = q[k]; }); Object.keys(patch).forEach(function (k) { if (patch[k] === '' || patch[k] == null) delete n[k]; else n[k] = patch[k]; });
    delete n.p;
    var s = Object.keys(n).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(n[k]); }).join('&');
    K.go(K.cur.path + (s ? '?' + s : ''));
  }
  K.acts.qset = function (el) { var q = {}; q[el.dataset.k] = el.value != null && el.tagName === 'SELECT' ? el.value : el.dataset.v; setQ(K.cur.q, q); };
  K.acts.qord = function () { setQ(K.cur.q, { o: K.cur.q.o === 'd' ? '' : 'd' }); };
  K.acts.qtxt = function (el, e) { }; // заглушка; поиск по Enter ниже
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'lf') setQ(K.cur.q, { s: e.target.value.trim() });
  });

  function filterOf(q, cfg) {
    var a = [];
    if (q.f === 'new') a.push({ field: 'playcount', operator: 'is', value: '0' });
    if (q.f === 'seen') a.push({ field: 'playcount', operator: 'greaterthan', value: '0' });
    if (q.f === 'part') a.push({ field: 'inprogress', operator: 'true', value: '' });
    if (q.g) a.push({ field: 'genre', operator: 'is', value: q.g });
    if (q.s) a.push(K.ci(cfg.sfield || 'title', q.s));
    return a.length ? (a.length === 1 ? a[0] : { and: a }) : undefined;
  }
  function listPage(cfg) {
    return function (ctx) {
      var q = ctx.q, grp = cfg.groups && q.gb ? cfg.groups.filter(function (g) { return g.id === q.gb; })[0] : null;
      var sort = grp ? grp.method : (q.m || cfg.sort), order = q.o === 'd' ? 'descending' : (q.o === 'a' ? 'ascending' : cfg.order || 'ascending');
      if (!q.o && cfg.orders && cfg.orders[sort]) order = cfg.orders[sort];
      var pre = cfg.genres ? run(cfg.genres[0], cfg.genres[1]).then(function (r) { return r.genres || []; }).catch(function () { return []; }) : Promise.resolve([]);
      return pre.then(function (genres) {
        if (!ctx.alive()) return;
        var view = ctx.view;
        K.mount(view, html`${K.ui.head(cfg.title(), { right: html`<span class="muted" id="cnt"></span>${cfg.sec ? K.libBar(cfg.sec) : ''}`, sub: cfg.sub ? cfg.sub() : '' })}
          ${cfg.tabs ? cfg.tabs() : ''}
          <div class="toolbar">
            <label class="search sm"><span>${ic('search', 16)}</span><input id="lf" type="search" placeholder="${t('Фильтр по названию')}" value="${q.s || ''}"></label>
            ${cfg.filters ? K.ui.seg([['', t('Все')], ['new', t('Новые')], ['part', t('Начатые')], ['seen', t('Просмотр.')]], q.f || '', 'qset', 'data-k="f"') : ''}
            ${genres.length ? K.ui.select([['', t('Все жанры')]].concat(genres.map(function (g) { return [g.label, g.label]; })), q.g || '', 'data-change="qset" data-k="g"') : ''}
            ${cfg.groups ? K.ui.select([['', t('Без группировки')]].concat(cfg.groups.map(function (g) { return [g.id, t(g.label)]; })), q.gb || '', 'data-change="qset" data-k="gb"') : ''}
            ${grp ? '' : K.ui.select(cfg.sorts.map(function (s) { return [s[0], t(s[1])]; }), sort, 'data-change="qset" data-k="m"')}
            <button class="icon-btn" data-act="qord" aria-label="${t('Порядок')}">${ic(order === 'ascending' ? 'up' : 'down')}</button>
          </div><div class="${cfg.cls || 'grid'}" id="lst"></div>`);
        var filter = cfg.filterFn ? cfg.filterFn(q) : filterOf(q, cfg), last;
        var inf = K.ui.infinite($('#lst', view), function (start, n) {
          var p = { properties: cfg.props, limits: { start: start, end: start + n }, sort: { method: sort, order: order, ignorearticle: true } };
          if (filter) p.filter = filter;
          return run(cfg.method, p).then(function (r) { return { items: r[cfg.key] || [], total: r.limits ? r.limits.total : undefined }; });
        }, function (items, st) {
          if (st === 0) last = undefined;
          return html`${items.map(function (x, i) {
            var h = '';
            if (grp) { var k = grp.key(x); if (k !== last) { last = k; h = html`<div class="grp-h" data-id="g:${k}">${k || t('Не указано')}</div>`; } }
            return html`${h}${cfg.card(x, st + i)}`;
          })}`;
        }, { size: cfg.size || 60, empty: K.ui.empty(cfg.icon, t('Ничего не найдено')), onTotal: function (tot) { var c = $('#cnt', view); if (c && isFinite(tot)) c.textContent = tot; } });
        ctx.cleanup.push(inf); ctx.refresh = inf.refresh;
      });
    };
  }
  var VSORT = [['title', 'По названию'], ['dateadded', 'Недавно добавленные'], ['year', 'По году'], ['rating', 'По рейтингу'], ['lastplayed', 'Недавно смотрел'], ['random', 'Случайно']];
  var DESC = { dateadded: 'descending', rating: 'descending', lastplayed: 'descending', year: 'descending' };
  function isList(r, secs) { return r.seg.length === 1 || (r.seg.length === 2 && secs.indexOf(r.seg[1]) >= 0); }
  function folders(sec, ctx) { return K.browse(ctx, { media: SEC[sec].media, base: SEC[sec].base + '/folders', sec: sec, tabs: K.secTabs(sec, 'folders'), title: t(SEC[sec].tabs[0][1]) }); }
  K.pages.movies = { title: function () { return t('Фильмы'); }, cache: function (r) { return isList(r, ['folders']); }, render: function (ctx) {
    if (ctx.args[0] === 'folders') return folders('movies', ctx);
    if (ctx.args[0]) return movieDetail(ctx, +ctx.args[0]);
    return listPage({ title: function () { return t('Фильмы'); }, sec: 'movies', tabs: function () { return K.secTabs('movies', ''); }, icon: 'film', method: V + 'GetMovies', key: 'movies', props: MOVIE_P, sort: 'title', orders: DESC, sorts: VSORT, filters: true, genres: [V + 'GetGenres', { type: 'movie' }], card: movieCard,
      groups: [{ id: 'year', label: 'По году', method: 'year', key: function (m) { return m.year || ''; } }, { id: 'genre', label: 'По жанру', method: 'genre', key: function (m) { return (m.genre || [])[0] || ''; } }] })(ctx);
  } };
  K.pages.mv = { title: function () { return t('Клипы'); }, cache: function (r) { return isList(r, ['folders']); }, render: function (ctx) {
    if (ctx.args[0] === 'folders') return folders('mv', ctx);
    return listPage({ title: function () { return t('Клипы'); }, sec: 'mv', tabs: function () { return K.secTabs('mv', ''); }, icon: 'clip', method: V + 'GetMusicVideos', key: 'musicvideos', props: MV_P, sort: 'title', orders: DESC, sorts: VSORT.slice(0, 3).concat([['random', 'Случайно']]), filters: true, genres: [V + 'GetGenres', { type: 'musicvideo' }], cls: 'grid land', card: mvCard, sfield: 'title',
      groups: [{ id: 'artist', label: 'По исполнителю', method: 'artist', key: function (m) { return K.join(m.artist); } }, { id: 'year', label: 'По году', method: 'year', key: function (m) { return m.year || ''; } }] })(ctx);
  } };
  K.pages.tv = { title: function () { return t('Сериалы'); }, cache: function (r) { return isList(r, ['folders']); }, render: function (ctx) {
    if (ctx.args[0] === 'folders') return folders('tv', ctx);
    if (ctx.args[0]) return showDetail(ctx, +ctx.args[0], ctx.args[1] != null ? +ctx.args[1] : null);
    return listPage({ title: function () { return t('Сериалы'); }, sec: 'tv', tabs: function () { return K.secTabs('tv', ''); }, icon: 'tv', method: V + 'GetTVShows', key: 'tvshows', props: SHOW_P, sort: 'title', orders: DESC, sorts: VSORT.slice(0, 5), filters: true, genres: [V + 'GetGenres', { type: 'tvshow' }], card: showCard,
      groups: [{ id: 'year', label: 'По году', method: 'year', key: function (m) { return m.year || ''; } }, { id: 'genre', label: 'По жанру', method: 'genre', key: function (m) { return (m.genre || [])[0] || ''; } }] })(ctx);
  } };

  /* ---------- музыка ---------- */
  function musicTabs(cur) { return K.secTabs('music', cur === 'albums' ? '' : cur); }
  var MSORT = [['title', 'По названию'], ['dateadded', 'Недавно добавленные'], ['year', 'По году'], ['rating', 'По рейтингу'], ['random', 'Случайно']];
  var ADESC = { dateadded: 'descending', rating: 'descending', year: 'descending' };
  function songRowK(s) {
    var k = K.reg('song', s);
    return K.ui.row({ id: k, img: K.pick(s, 'thumb', 'album.thumb'), title: s.title, sub: songSub(s), right: html`<span class="row-s">${K.fmtTime(s.duration)}</span><button class="icon-btn" data-act="cmenu" data-k="${k}">${ic('more', 18)}</button>`, attrs: 'data-act="cplay" data-k="' + k + '" style="cursor:pointer"' });
  }
  function songSub(s) { return K.join(s.artist) + (s.album ? ' — ' + s.album : ''); }
  K.pages.music = { title: function () { return t('Музыка'); }, cache: function (r) { return isList(r, ['artists', 'songs', 'folders']); }, render: function (ctx) {
    var a = ctx.args[0];
    if (a === 'folders') return folders('music', ctx);
    if (a === 'album' && ctx.args[1]) return albumDetail(ctx, +ctx.args[1]);
    if (a === 'artist' && ctx.args[1]) return artistDetail(ctx, +ctx.args[1]);
    var G = [A + 'GetGenres', {}];
    if (a === 'artists') return listPage({ title: function () { return t('Музыка'); }, sec: 'music', tabs: function () { return musicTabs('artists'); }, icon: 'mic', method: A + 'GetArtists', key: 'artists', props: ['thumbnail', 'art', 'genre'], sort: 'artist', sorts: [['artist', 'По имени'], ['dateadded', 'Недавно добавленные'], ['random', 'Случайно']], sfield: 'artist', genres: G, card: artistCard, cls: 'grid sq' })(ctx);
    if (a === 'songs') return listPage({ title: function () { return t('Музыка'); }, sec: 'music', tabs: function () { return musicTabs('songs'); }, icon: 'music', method: A + 'GetSongs', key: 'songs', props: ['title', 'artist', 'album', 'albumid', 'duration', 'track', 'thumbnail', 'art', 'file', 'year', 'genre'], sort: 'title', orders: ADESC, sorts: [['title', 'По названию'], ['artist', 'По исполнителю'], ['album', 'По альбому'], ['dateadded', 'Недавно добавленные'], ['random', 'Случайно']], genres: G, cls: 'list glass panel', size: 80, card: songRowK,
      groups: [{ id: 'artist', label: 'По исполнителю', method: 'artist', key: function (m) { return K.join(m.artist); } }, { id: 'album', label: 'По альбому', method: 'album', key: function (m) { return m.album || ''; } }] })(ctx);
    return listPage({ title: function () { return t('Музыка'); }, sec: 'music', tabs: function () { return musicTabs('albums'); }, icon: 'disc', method: A + 'GetAlbums', key: 'albums', props: ALBUM_P, sort: 'title', orders: ADESC, sorts: MSORT, genres: G, card: albumCard, cls: 'grid sq', sfield: 'album',
      groups: [{ id: 'artist', label: 'По исполнителю', method: 'artist', key: function (a) { return K.join(a.artist); } }, { id: 'year', label: 'По году', method: 'year', key: function (a) { return a.year || ''; } }, { id: 'genre', label: 'По жанру', method: 'genre', key: function (a) { return (a.genre || [])[0] || ''; } }] })(ctx);
  } };

  /* ---------- детальные страницы ---------- */
  function heroBg(img) { return img ? html`<div class="hero-bg"><img alt="" src="${K.img(img)}" onerror="this.remove()"></div>` : ''; }
  function castList(c) {
    if (!c || !c.length) return '';
    return html`${K.ui.sec(t('В ролях'))}<div class="cast">${c.slice(0, 24).map(function (p) {
      return html`<div class="cast-i"><div class="cast-p">${p.thumbnail ? html`<img loading="lazy" src="${K.img(p.thumbnail)}" alt="" onerror="this.remove()">` : ic('user', 26)}</div><b>${p.name}</b><small>${p.role || ''}</small></div>`; })}</div>`;
  }
  function kv(label, v) { v = K.join(v); return v ? html`<div><dt>${label}</dt><dd>${v}</dd></div>` : ''; }
  function chips(a) { return a && a.length ? html`<div class="chips">${a.map(function (g) { return html`<span class="chip">${g}</span>`; })}</div>` : ''; }

  function movieDetail(ctx, id) {
    return run(V + 'GetMovieDetails', { movieid: id, properties: MOVIE_D }).then(function (r) {
      if (!ctx.alive()) return; var m = r.moviedetails, key = K.reg('movie', m), res = m.resume && m.resume.position > 0;
      var sd = m.streamdetails || {}, v0 = (sd.video || [])[0], a0 = (sd.audio || [])[0];
      K.mount(ctx.view, html`<div class="hero">${heroBg(K.pick(m, 'fanart'))}<div class="hero-in">
        <a class="icon-btn hero-back" href="#/movies" aria-label="${t('Назад')}">${ic('back')}</a>
        <div class="hero-poster">${K.pick(m, 'poster', 'thumb') ? html`<img src="${K.img(K.pick(m, 'poster', 'thumb'))}" alt="">` : ic('film', 48)}</div>
        <div class="hero-t"><h1>${m.title}</h1>${m.tagline ? html`<p class="tag">${m.tagline}</p>` : ''}
          <div class="meta">${[m.year, mins(m), m.mpaa].filter(Boolean).map(function (x) { return html`<span>${x}</span>`; })}${stars(m.rating)}${m.playcount > 0 ? html`<span class="pill">${t('Просмотрено')}</span>` : ''}</div>${chips(m.genre)}
          <div class="acts"><button class="btn primary" data-act="cplay" data-k="${key}">${ic('play', 18)} ${res ? t('Продолжить') : t('Смотреть')}</button>
            <button class="btn" data-act="cmenu" data-k="${key}">${ic('more', 18)} ${t('Ещё')}</button>
            ${m.trailer ? html`<button class="btn ghost" data-act="trailer" data-v="${m.trailer}">${ic('clip', 18)} ${t('Трейлер')}</button>` : ''}</div>
          ${res ? html`<div class="prog big"><i style="width:${pct(m)}%"></i></div>` : ''}</div></div></div>
        ${m.plot ? html`<p class="plot">${m.plot}</p>` : ''}
        <div class="glass panel"><dl class="kv">${kv(t('Режиссёр'), m.director)}${kv(t('Сценарий'), m.writer)}${kv(t('Студия'), m.studio)}${kv(t('Страна'), m.country)}${kv(t('Оригинал'), m.originaltitle !== m.title ? m.originaltitle : '')}${kv(t('Коллекция'), m.set)}
          ${kv(t('Видео'), v0 ? [v0.width + '×' + v0.height, (v0.codec || '').toUpperCase()].join(' ') : '')}${kv(t('Аудио'), a0 ? [(a0.codec || '').toUpperCase(), a0.channels + 'ch', a0.language].filter(Boolean).join(' ') : '')}${kv(t('Файл'), m.file)}${kv(t('Добавлен'), K.fmtDate(m.dateadded))}</dl></div>
        ${castList(m.cast)}`);
    });
  }
  K.acts.trailer = function (el) { return K.play({ file: el.dataset.v }); };

  function showDetail(ctx, id, season) {
    return K.batch([[V + 'GetTVShowDetails', { tvshowid: id, properties: SHOW_D }], [V + 'GetSeasons', { tvshowid: id, properties: ['season', 'art', 'playcount', 'episode', 'watchedepisodes', 'showtitle'] }]]).then(function (r) {
      if (!ctx.alive()) return; if (r[0] instanceof Error) throw r[0];
      var s = r[0].tvshowdetails, seasons = K.ok(r[1]) ? (r[1].seasons || []) : [], key = K.reg('tvshow', s);
      if (season == null) {
        K.mount(ctx.view, html`<div class="hero">${heroBg(K.pick(s, 'fanart'))}<div class="hero-in">
          <a class="icon-btn hero-back" href="#/tv" aria-label="${t('Назад')}">${ic('back')}</a>
          <div class="hero-poster">${K.pick(s, 'poster', 'thumb') ? html`<img src="${K.img(K.pick(s, 'poster', 'thumb'))}" alt="">` : ic('tv', 48)}</div>
          <div class="hero-t"><h1>${s.title}</h1><div class="meta">${[s.year, s.episode + ' ' + t('эп.'), s.mpaa].filter(Boolean).map(function (x) { return html`<span>${x}</span>`; })}${stars(s.rating)}</div>${chips(s.genre)}
            <div class="acts"><button class="btn primary" data-act="cplay" data-k="${key}">${ic('play', 18)} ${t('Смотреть')}</button><button class="btn" data-act="cmenu" data-k="${key}">${ic('more', 18)} ${t('Ещё')}</button></div></div></div></div>
          ${s.plot ? html`<p class="plot">${s.plot}</p>` : ''}
          ${K.ui.sec(t('Сезоны'))}<div class="grid">${seasons.map(function (x) {
            return K.ui.card({ img: K.pick(x, 'poster', 'thumb'), icon: 'tv', title: x.season === 0 ? t('Спецвыпуски') : t('Сезон {n}', { n: x.season }), sub: x.watchedepisodes + ' / ' + x.episode, href: '#/tv/' + id + '/' + x.season, watched: x.episode > 0 && x.watchedepisodes >= x.episode }); })}</div>
          <div class="glass panel" style="margin-top:20px"><dl class="kv">${kv(t('Студия'), s.studio)}${kv(t('Премьера'), K.fmtDate(s.premiered))}${kv(t('Путь'), s.file)}</dl></div>${castList(s.cast)}`);
        return;
      }
      return run(V + 'GetEpisodes', { tvshowid: id, season: season, properties: EP_P, sort: { method: 'episode', order: 'ascending' } }).then(function (er) {
        if (!ctx.alive()) return; var eps = er.episodes || [];
        K.mount(ctx.view, html`${K.ui.head(s.title, { back: '#/tv/' + id, sub: season === 0 ? t('Спецвыпуски') : t('Сезон {n}', { n: season }),
          right: html`<button class="btn primary" data-act="playseason" data-id="${id}" data-s="${season}">${ic('play', 18)} ${t('Играть сезон')}</button>` })}
          <div class="tabs">${seasons.map(function (x) { return html`<a class="${x.season === season ? 'on' : ''}" href="#/tv/${id}/${x.season}">${x.season === 0 ? 'S0' : x.season}</a>`; })}</div>
          <div class="glass panel list" style="padding:8px">${eps.map(function (e) {
            var k = K.reg('episode', e);
            return K.ui.row({ lead: e.episode, img: K.pick(e, 'thumb'), shape: 'land', icon: 'tv', title: e.title, sub: [K.fmtDate(e.firstaired), mins(e)].filter(Boolean).join(' · '),
              right: html`${e.playcount > 0 ? html`<span class="tick-i">${ic('check', 16)}</span>` : ''}<button class="icon-btn" data-act="cmenu" data-k="${k}">${ic('more', 18)}</button>`, attrs: 'data-act="cplay" data-k="' + k + '" style="cursor:pointer"' }); })}</div>`);
        K.eps = eps;
      });
    });
  }
  K.acts.playseason = function (el) {
    var eps = K.eps || [], i = 0; for (; i < eps.length; i++) if (!eps[i].playcount) break; if (i >= eps.length) i = 0;
    return K.playList(1, eps.map(function (e) { return { episodeid: e.episodeid }; }), i);
  };
  document.addEventListener('click', function (e) { if (e.target.closest('.row [data-act="cmenu"]')) e.stopPropagation(); }, true);

  /* имена исполнителей как ссылки на их страницы */
  function artistLinks(names, ids) {
    names = names || []; if (!Array.isArray(names)) names = [names];
    return html`${names.map(function (n, i) { var id = ids && ids[i]; return html`${i ? ', ' : ''}${id != null ? html`<a class="lnk" href="#/music/artist/${id}">${n}</a>` : n}`; })}`;
  }
  K.artistLinks = artistLinks;
  function albumDetail(ctx, id) {
    return K.batch([[A + 'GetAlbumDetails', { albumid: id, properties: ALBUM_P.concat(['description', 'musicbrainzalbumid', 'albumduration', 'artistid']) }],
      [A + 'GetSongs', { properties: ['title', 'artist', 'track', 'duration', 'disc'], filter: { albumid: id }, sort: { method: 'track', order: 'ascending' } }]]).then(function (r) {
      if (!ctx.alive()) return; if (r[0] instanceof Error) throw r[0];
      var a = r[0].albumdetails, songs = K.ok(r[1]) ? (r[1].songs || []) : [], key = K.reg('album', a), total = songs.reduce(function (x, s) { return x + (s.duration || 0); }, 0);
      K.mount(ctx.view, html`<div class="hero">${heroBg(K.pick(a, 'fanart', 'thumb'))}<div class="hero-in">
        <a class="icon-btn hero-back" href="javascript:history.back()" aria-label="${t('Назад')}">${ic('back')}</a>
        <div class="hero-poster sq">${K.pick(a, 'thumb') ? html`<img src="${K.img(K.pick(a, 'thumb'))}" alt="">` : ic('disc', 48)}</div>
        <div class="hero-t"><h1>${a.title}</h1><p class="tag">${artistLinks(a.artist, a.artistid)}</p><div class="meta">${[a.year, songs.length + ' ' + t('треков'), K.fmtDur(total), a.albumlabel].filter(Boolean).map(function (x) { return html`<span>${x}</span>`; })}${stars(a.rating)}</div>${chips(a.genre)}
          <div class="acts"><button class="btn primary" data-act="cplay" data-k="${key}">${ic('play', 18)} ${t('Играть')}</button><button class="btn" data-act="cmenu" data-k="${key}">${ic('more', 18)} ${t('Ещё')}</button></div></div></div></div>
        <div class="glass panel list" style="padding:8px">${songs.map(function (s, i) {
          var k = K.reg('song', s);
          return K.ui.row({ lead: s.track || i + 1, title: s.title, sub: K.join(s.artist) !== K.join(a.artist) ? K.join(s.artist) : '', right: html`<span class="row-s">${K.fmtTime(s.duration)}</span><button class="icon-btn" data-act="cmenu" data-k="${k}">${ic('more', 18)}</button>`, attrs: 'data-act="playtrack" data-id="' + id + '" data-pos="' + i + '" style="cursor:pointer"' }); })}</div>
        ${a.description ? html`<p class="plot">${a.description}</p>` : ''}`);
    });
  }
  K.acts.playtrack = function (el) { return K.playAlbum(+el.dataset.id, +el.dataset.pos); };

  function artistDetail(ctx, id) {
    return K.batch([[A + 'GetArtistDetails', { artistid: id, properties: ['description', 'genre', 'art', 'thumbnail', 'fanart'] }],
      [A + 'GetAlbums', { properties: ['title', 'year', 'art', 'thumbnail', 'albumlabel'], filter: { artistid: id }, sort: { method: 'year', order: 'ascending' } }],
      [A + 'GetSongs', { properties: ['title', 'artist', 'album', 'albumid', 'track', 'duration', 'disc', 'year'], filter: { artistid: id }, sort: { method: 'album', order: 'ascending' } }]]).then(function (r) {
      if (!ctx.alive()) return; if (r[0] instanceof Error) throw r[0];
      var a = r[0].artistdetails, albums = K.ok(r[1]) ? (r[1].albums || []) : [], songs = K.ok(r[2]) ? (r[2].songs || []) : [], key = K.reg('artist', a);
      var by = {}; songs.forEach(function (s) { (by[s.albumid] = by[s.albumid] || []).push(s); });
      var order = albums.map(function (x) { return x.albumid; }); songs.forEach(function (s) { if (order.indexOf(s.albumid) < 0) order.push(s.albumid); });
      var meta = {}; albums.forEach(function (x) { meta[x.albumid] = x; });
      K.artistSongs = songs;
      var idx = 0;
      K.mount(ctx.view, html`<div class="hero">${heroBg(K.pick(a, 'fanart'))}<div class="hero-in">
        <a class="icon-btn hero-back" href="#/music/artists" aria-label="${t('Назад')}">${ic('back')}</a>
        <div class="hero-poster sq circle">${K.pick(a, 'thumb') ? html`<img src="${K.img(K.pick(a, 'thumb'))}" alt="">` : ic('mic', 48)}</div>
        <div class="hero-t"><h1>${a.artist}</h1><div class="meta"><span>${albums.length} ${t('альбомов')}</span><span>${songs.length} ${t('треков')}</span></div>${chips(a.genre)}
          <div class="acts"><button class="btn primary" data-act="artistplay" data-i="0">${ic('play', 18)} ${t('Играть всё')}</button><button class="btn" data-act="cmenu" data-k="${key}">${ic('more', 18)} ${t('Ещё')}</button></div></div></div></div>
        ${a.description ? html`<p class="plot">${a.description}</p>` : ''}
        ${order.map(function (aid) {
          var al = meta[aid] || { albumid: aid, title: (by[aid][0] || {}).album, art: {} }, list = by[aid] || [], ak = K.reg('album', al);
          return html`<div class="alb-sec"><div class="alb-h"><a class="alb-cov" href="#/music/album/${aid}">${K.pick(al, 'thumb') ? html`<img loading="lazy" src="${K.img(K.pick(al, 'thumb'))}" alt="" onerror="this.remove()">` : ic('disc', 24)}</a>
            <div class="alb-t"><a href="#/music/album/${aid}"><b>${al.title}</b></a><small>${[al.year, list.length + ' ' + t('треков')].filter(Boolean).join(' · ')}</small></div>
            <button class="btn sm" data-act="cplay" data-k="${ak}">${ic('play', 16)} ${t('Играть альбом')}</button><button class="icon-btn" data-act="cmenu" data-k="${ak}">${ic('more', 18)}</button></div>
            <div class="glass panel list" style="padding:6px">${list.map(function (s) {
              var i = idx++, k = K.reg('song', s);
              return K.ui.row({ lead: s.track || '', title: s.title, right: html`<span class="row-s">${K.fmtTime(s.duration)}</span><button class="icon-btn" data-act="cmenu" data-k="${k}">${ic('more', 18)}</button>`, attrs: 'data-act="artistplay" data-i="' + i + '" style="cursor:pointer"' }); })}</div></div>`; })}`);
    });
  }
  /* порядок очереди совпадает с порядком показа (по альбомам) */
  K.acts.artistplay = function (el) {
    var by = {}, order = []; (K.artistSongs || []).forEach(function (s) { if (!by[s.albumid]) { by[s.albumid] = []; order.push(s.albumid); } by[s.albumid].push(s); });
    var flat = []; order.forEach(function (a) { flat = flat.concat(by[a]); });
    return K.playList(0, flat.map(function (s) { return { songid: s.songid }; }), +el.dataset.i);
  };

  /* ---------- главная ---------- */
  K.pages.home = { title: function () { return t('Главная'); }, render: function (ctx) {
    var L = { start: 0, end: 14 };
    function load() { return K.batch([
      [V + 'GetMovies', { properties: MOVIE_P, limits: L, filter: { field: 'inprogress', operator: 'true', value: '' }, sort: { method: 'lastplayed', order: 'descending' } }],
      [V + 'GetEpisodes', { properties: EP_P, limits: L, filter: { field: 'inprogress', operator: 'true', value: '' }, sort: { method: 'lastplayed', order: 'descending' } }],
      [V + 'GetRecentlyAddedMovies', { properties: MOVIE_P, limits: L }],
      [V + 'GetRecentlyAddedEpisodes', { properties: EP_P, limits: L }],
      [A + 'GetRecentlyAddedAlbums', { properties: ALBUM_P, limits: L }],
      [V + 'GetMovies', { properties: ['title'], limits: { start: 0, end: 1 } }],
      [V + 'GetTVShows', { properties: ['title'], limits: { start: 0, end: 1 } }],
      [A + 'GetAlbums', { properties: ['title'], limits: { start: 0, end: 1 } }],
      [A + 'GetSongs', { properties: ['title'], limits: { start: 0, end: 1 } }]
    ]).then(function (r) {
      if (!ctx.alive()) return;
      function g(i, k) { return K.ok(r[i]) ? (r[i][k] || []) : []; }
      function tot(i) { return K.ok(r[i]) && r[i].limits ? r[i].limits.total : 0; }
      var cont = g(0, 'movies').map(movieCard).concat(g(1, 'episodes').map(epCard));
      var stats = [['film', t('Фильмов'), tot(5), '#/movies'], ['tv', t('Сериалов'), tot(6), '#/tv'], ['disc', t('Альбомов'), tot(7), '#/music'], ['music', t('Треков'), tot(8), '#/music/songs']];
      var sig = JSON.stringify([r.map(function (x) { return K.ok(x) ? Object.keys(x).map(function (k) { return Array.isArray(x[k]) ? x[k].map(function (i) { return [i.movieid || i.episodeid || i.albumid, i.playcount, i.resume && i.resume.position]; }) : x[k]; }) : 0; }), K.lang]);
      K.mount(ctx.view, html`${K.ui.head(t('Главная'), { sub: t('Центр управления Kodi'), right: html`<button class="btn sm" data-act="quick" data-v="all" title="${t('Найти новые файлы и убрать удалённые, ничего не пересоздавая')}">${ic('refresh', 16)} ${t('Быстрое обновление')}</button>` })}
        <div class="stats">${stats.map(function (s) { return html`<a class="glass stat" href="${s[3]}">${ic(s[0], 22)}<b>${s[2]}</b><small>${s[1]}</small></a>`; })}</div>
        ${cont.length ? html`${K.ui.sec(t('Продолжить просмотр'))}<div class="hrow">${cont}</div>` : ''}
        ${hrow(t('Новые фильмы'), g(2, 'movies'), movieCard, '#/movies?m=dateadded')}
        ${hrow(t('Новые серии'), g(3, 'episodes'), epCard, '#/tv')}
        ${hrow(t('Новые альбомы'), g(4, 'albums'), albumCard, '#/music?m=dateadded')}
        ${!tot(5) && !tot(6) && !tot(7) ? K.ui.empty('box', t('Медиатека пуста'), t('Добавьте источники в Kodi и запустите сканирование')) : ''}`, sig);
    }); }
    ctx.refresh = load; return load();
  } };
  /* ---------- поиск ---------- */
  K.pages.search = { title: function () { return t('Поиск'); }, render: function (ctx) {
    var q = (ctx.q.q || '').trim(); $('#q').value = q;
    if (!q) return K.mount(ctx.view, html`${K.ui.head(t('Поиск'))}${K.ui.empty('search', t('Введите запрос'))}`);
    var L = { start: 0, end: 18 }, f = function (field) { return K.ci(field, q); };
    return K.batch([
      [V + 'GetMovies', { properties: MOVIE_P, limits: L, filter: f('title') }], [V + 'GetTVShows', { properties: SHOW_P, limits: L, filter: f('title') }],
      [V + 'GetEpisodes', { properties: EP_P, limits: L, filter: f('title') }], [V + 'GetMusicVideos', { properties: MV_P, limits: L, filter: f('title') }],
      [A + 'GetArtists', { properties: ['thumbnail', 'art'], limits: L, filter: f('artist') }], [A + 'GetAlbums', { properties: ALBUM_P, limits: L, filter: f('album') }],
      [A + 'GetSongs', { properties: ['title', 'artist', 'album', 'duration', 'track'], limits: L, filter: f('title') }]
    ]).then(function (r) {
      if (!ctx.alive()) return;
      function g(i, k) { return K.ok(r[i]) ? (r[i][k] || []) : []; }
      var songs = g(6, 'songs'), any = r.some(function (x, i) { return K.ok(x) && Object.keys(x).some(function (k) { return Array.isArray(x[k]) && x[k].length; }); });
      K.mount(ctx.view, html`${K.ui.head(t('Поиск'), { sub: '«' + q + '»' })}${!any ? K.ui.empty('search', t('Ничего не найдено')) : ''}
        ${hrow(t('Фильмы'), g(0, 'movies'), movieCard)}${hrow(t('Сериалы'), g(1, 'tvshows'), showCard)}${hrow(t('Серии'), g(2, 'episodes'), epCard)}${hrow(t('Клипы'), g(3, 'musicvideos'), mvCard)}
        ${hrow(t('Исполнители'), g(4, 'artists'), artistCard)}${hrow(t('Альбомы'), g(5, 'albums'), albumCard)}
        ${songs.length ? html`${K.ui.sec(t('Треки'))}<div class="glass panel list" style="padding:8px">${songs.map(function (s, i) { return songRow(s, i, true); })}</div>` : ''}`);
    });
  } };
})();

/* Glass Control — файлы (проводник), избранное, очередь, ТВ/радио */
(function () {
  'use strict';
  var K = window.K, t = K.t, html = K.html, ic = K.ic, $ = K.$, raw = K.raw;
  var FP = ['file', 'size', 'lastmodified', 'thumbnail', 'title', 'mimetype'];

  K.playFile = function (f) {
    var isDir = f.filetype === 'directory', spec = isDir ? { directory: f.file } : { file: f.file };
    return K.play(spec);
  };
  var MEDIA = [['video', 'Видео'], ['music', 'Музыка'], ['pictures', 'Фото'], ['files', 'Файлы']];
  var SHORT = [['addons://sources/video', 'Видео-дополнения', 'plug', 0], ['addons://sources/audio', 'Музыка-дополнения', 'plug', 0],
    ['/', 'Корень устройства', 'monitor', 1], ['special://home/', 'Данные Kodi', 'folder', 1], ['special://profile/', 'Профиль', 'user', 1], ['special://temp/', 'Временные файлы', 'folder', 1], ['special://logpath/', 'Логи', 'log', 1]];
  function sepOf(p) { return p.indexOf('\\') >= 0 && p.indexOf('/') < 0 ? '\\' : '/'; }
  function parentOf(p) {
    var m = p.match(/^(.*?:\/\/)(.*)$/), pre = m ? m[1] : '', rest = m ? m[2] : p, win = /^[A-Za-z]:[\\/]/.test(p);
    rest = rest.replace(/[\\/]+$/, ''); var i = Math.max(rest.lastIndexOf('/'), rest.lastIndexOf('\\'));
    if (i < 0) return ''; if (i === 0 && !m && !win) return '/';
    if (win && i < 3 && rest.length <= 3) return '';
    return pre + rest.slice(0, i + 1);
  }
  function crumbs(p) {
    var m = p.match(/^(.*?:\/\/)(.*)$/), pre = m ? m[1] : '', rest = m ? m[2] : p, parts = rest.split(/[\\/]/).filter(Boolean), acc = pre, out = [], sep = sepOf(p);
    if (!m && p[0] === '/') acc = '/';
    parts.forEach(function (x) { acc += (acc && !/[\\/]$/.test(acc) ? sep : '') + x; out.push([x, acc + sep]); });
    return out;
  }
  function norm(f) { return { file: f.path, label: f.name, filetype: f.dir ? 'directory' : 'file', size: f.size, lastmodified: f.mtime ? new Date(f.mtime * 1000).toISOString().replace('T', ' ').slice(0, 19) : '', type: 'unknown' }; }
  /* список папки: сначала Kodi (с фильтром по типу медиа), при отказе (RemoteAccess) — через серверную часть */
  function listDir(path, media, all) {
    var viaBe = function () { return K.be.call('/api/fs/list', { path: path }).then(function (r) { return r.items.map(norm); }); };
    if (all && K.be.ok) return viaBe();
    return K.rpc('Files.GetDirectory', { directory: path, media: media, properties: FP, sort: { method: 'label', order: 'ascending', ignorearticle: true } }).then(function (r) {
      var l = r.files || [];
      /* Kodi иногда молча отдаёт пустой список (нет прав/пароля для JSON-RPC): пробуем напрямую через серверную часть */
      if (!l.length && K.be.ok) return viaBe().then(function (b) { return b; }, function () { return l; });
      return l;
    }, function (e) {
      if (K.be.ok) return viaBe().catch(function (e2) { throw new Error(e.message + ' / ' + e2.message); });
      var x = new Error(e.message + (e.code === -32602 ? ' — ' + t('Kodi не разрешает удалённый доступ к этой папке: добавьте её в источники (с включённым «разрешить доступ») или установите Glass Control Backend.') : '')); throw x;
    });
  }
  K.fmClip = null;

  /* Проводник. o: {media, base, sec, tabs, title} */
  K.browse = function (ctx, o) {
    var path = ctx.q.p || '', media = o.media, all = ctx.q.all === '1', base = '#' + o.base, link = function (p) { return base + (o.base === '/files' ? '?t=' + media + '&' : '?') + 'p=' + encodeURIComponent(p) + (all ? '&all=1' : ''); };
    var root = base + (o.base === '/files' ? '?t=' + media : '');
    var libKind = media === 'music' ? 'music' : 'video';
    var bar = html`<div class="libbar"><button class="btn sm" data-act="lscan" data-v="${libKind}" ${path ? raw('data-p="' + K.esc(path) + '"') : ''}>${ic('refresh', 16)} ${path ? t('Сканировать папку') : t('Обновить')}</button>
      <button class="btn sm" data-act="lclean" data-v="${libKind}" title="${t('Полностью сбросить базу медиатеки, чтобы собрать её заново')}">${ic('eraser', 16)} ${t('Очистить')}</button><button class="icon-btn" data-act="srcs" data-v="${media}" aria-label="${t('Источники')}" title="${t('Источники')}">${ic('sliders', 18)}</button></div>`;
    var title = o.title || t('Файлы');
    if (!path) {
      var srcPromise = K.be.ok ? K.be.call('/api/sources/list', { media: media }).then(function (r) { return (r.sources || []).map(function (s) { return { label: s.name, file: (s.paths && s.paths[0]) || '' }; }); }).catch(function () { return null; }) : (K.be && K.be.retry ? K.be.retry().then(function (ok) { if (!ok) return null; return K.be.call('/api/sources/list', { media: media }).then(function (r) { return (r.sources || []).map(function (s) { return { label: s.name, file: (s.paths && s.paths[0]) || '' }; }); }).catch(function () { return null; }); }).catch(function () { return null; }) : Promise.resolve(null));
      return srcPromise.then(function (beSrc) {
        return K.rpc('Files.GetSources', { media: media }).then(function (r) {
          if (!ctx.alive()) return; var src = (beSrc !== null) ? beSrc : (r.sources || []);
        K.mount(ctx.view, html`${K.ui.head(title, { sub: t('Источники и файловый менеджер'), right: bar })}${o.tabs}
          ${K.be.ok ? '' : ''}<div class="glass panel list" style="padding:8px">${src.length ? src.map(function (s) {
            return K.ui.row({ icon: 'folder', img: '', title: s.label, sub: s.file, href: link(s.file),
              right: html`<span class="srcrow-a"><button class="icon-btn" data-act="srcscan" data-v="${libKind}" data-p="${s.file}" aria-label="${t('Обновить')}" title="${t('Обновить')}">${ic('refresh', 18)}</button><button class="icon-btn" data-act="srcdel" data-m="${media}" data-n="${s.label}" data-p="${s.file}" aria-label="${t('Удалить')}" title="${t('Удалить источник')}">${ic('trash', 18)}</button></span>` }); }) : K.ui.empty('folder', t('Источники не настроены'), t('Добавьте источник кнопкой «⚙» справа вверху'))}</div>
          ${K.ui.sec(t('Быстрый доступ'))}<div class="chips">${SHORT.filter(function (s) { return !s[3] || K.be.ok; }).map(function (s) { return html`<a class="chip" href="${link(s[0])}">${ic(s[2], 16)} ${t(s[1])}</a>`; })}</div>
          ${K.be.ok || !K.be.tried ? '' : K.be.hint()}`);
      });
      });
    }
    return listDir(path, media, all).then(function (files) {
      if (!ctx.alive()) return;
      var dirs = files.filter(function (f) { return f.filetype === 'directory'; }), fl = files.filter(function (f) { return f.filetype !== 'directory'; });
      var list = dirs.concat(fl), up = parentOf(path), cr = crumbs(path);
      K.fl = list; K.fpath = path; K.fsel = {}; K.fsm = false; K.fmedia = media;
      draw();
      function draw() {
        var n = Object.keys(K.fsel).length, clip = K.fmClip;
        K.mount(ctx.view, html`${K.ui.head(title, { right: html`${bar}<button class="btn sm" data-act="fplaydir" data-p="${path}">${ic('play', 16)} ${t('Играть папку')}</button><button class="btn sm" data-act="fqdir" data-p="${path}">${ic('qadd', 16)} ${t('В очередь')}</button>` })}${o.tabs}
          <div class="crumbs"><a href="${root}">${ic('home', 16)}</a>${cr.map(function (c) { return html`<span>/</span><a href="${link(c[1])}">${c[0]}</a>`; })}</div>
          <div class="fm-bar">
            ${K.be.ok ? html`<button class="btn sm ${K.fsm ? 'primary' : ''}" data-act="fsm">${ic('check', 16)} ${t('Выбрать')}</button>
              <a class="chip ${all ? 'on' : ''}" href="${link(path).replace(/&all=1$/, '') + (all ? '' : '&all=1')}">${t('Все файлы')}</a>` : ''}
            ${K.fsm ? html`<span class="clip">${n} ${t('выбрано')}</span><button class="btn sm" data-act="fall">${t('Все')}</button>
              <button class="btn sm" data-act="fcopy" ${n ? '' : raw('disabled')}>${ic('file', 16)} ${t('Копировать')}</button><button class="btn sm" data-act="fcut" ${n ? '' : raw('disabled')}>${ic('qnext', 16)} ${t('Вырезать')}</button>
              <button class="btn sm danger" data-act="fdel" ${n ? '' : raw('disabled')}>${ic('trash', 16)} ${t('Удалить')}</button>` : ''}
            ${K.be.ok && clip ? html`<span class="clip">${clip.mode === 'copy' ? t('Скопировано') : t('Вырезано')}: ${clip.paths.length}</span><button class="btn sm primary" data-act="fpaste">${ic('download', 16)} ${t('Вставить сюда')}</button><button class="icon-btn" data-act="fclip0" aria-label="${t('Отмена')}">${ic('x', 16)}</button>` : ''}
            <span class="sp"></span>${K.be.ok ? html`<button class="btn sm" data-act="fmkdir">${ic('plus', 16)} ${t('Папка')}</button>` : ''}</div>
          <div class="glass panel list" style="padding:8px">${up ? K.ui.row({ id: '..', img: '', icon: 'up', title: '..', href: link(up) }) : ''}
            ${list.length ? list.map(function (f, i) {
              var dir = f.filetype === 'directory', nm = f.label || f.title || f.file, sel = !!K.fsel[i];
              return K.ui.row({ id: f.file, cls: sel ? 'sel' : '', lead: K.fsm ? html`<span class="chk">${ic('check', 14)}</span>` : undefined, img: f.thumbnail || '', icon: dir ? 'folder' : (f.type === 'song' || /^audio/.test(f.mimetype || '') ? 'music' : /^image/.test(f.mimetype || '') ? 'image' : /^video/.test(f.mimetype || '') ? 'film' : 'file'), title: nm,
                sub: dir ? '' : [f.size > 0 ? K.fmtSize(f.size) : '', f.lastmodified ? K.fmtDate(f.lastmodified) : ''].filter(Boolean).join(' · '), href: !K.fsm && dir ? link(f.file) : undefined,
                right: html`<button class="icon-btn" data-act="fmenu" data-i="${i}" aria-label="${t('Действия')}">${ic('more', 18)}</button>`, attrs: K.fsm ? 'data-act="fpick" data-i="' + i + '" style="cursor:pointer"' : (dir ? '' : 'data-act="fplay" data-i="' + i + '" style="cursor:pointer"') }); }) : K.ui.empty('folder', t('Папка пуста'))}</div>`);
      }
      K.fdraw = draw; ctx.cleanup.push(function () { if (K.fdraw === draw) K.fdraw = null; });
    });
  };
  K.pages.files = { title: function () { return t('Файлы'); }, cache: function (r) { return true; }, render: function (ctx) {
    var media = ctx.q.t || 'video';
    var tabs = html`<div class="tabs">${MEDIA.map(function (x) { return html`<a class="${x[0] === media ? 'on' : ''}" href="#/files?t=${x[0]}">${t(x[1])}</a>`; })}</div>`;
    return K.be.init().then(function () { return K.browse(ctx, { media: media, base: '/files', tabs: tabs, title: t('Файлы') }); });
  } };
  /* файловые действия */
  K.acts.fplay = function (el) { return K.playFile(K.fl[+el.dataset.i]); };
  K.acts.fplaydir = function (el) { return K.play({ directory: el.dataset.p }); };
  K.acts.fqdir = function (el) { return K.queue({ directory: el.dataset.p }, { pl: K.fmedia === 'music' ? 0 : 1 }); };
  K.acts.srcscan = function (el) { return K.libScanOnly(el.dataset.v, el.dataset.p); };
  K.acts.lscan = (function (o) { return function (el) { return K.libScanOnly(el.dataset.v, el.dataset.p); }; })();
  K.acts.fsm = function () { K.fsm = !K.fsm; K.fsel = {}; K.fdraw && K.fdraw(); };
  K.acts.fpick = function (el) { var i = +el.dataset.i; if (K.fsel[i]) delete K.fsel[i]; else K.fsel[i] = 1; K.fdraw && K.fdraw(); };
  K.acts.fall = function () { var n = Object.keys(K.fsel).length; K.fsel = {}; if (n < K.fl.length) K.fl.forEach(function (f, i) { K.fsel[i] = 1; }); K.fdraw && K.fdraw(); };
  function selPaths() { return Object.keys(K.fsel).map(function (i) { return K.fl[+i].file; }); }
  function done(r, what) {
    var bad = (r.failed || []).length;
    if (bad) K.toast(what + ': ' + bad + ' ' + t('не удалось') + ' — ' + r.failed[0].error, 'err'); else K.toast(what, 'ok');
    K.fsm = false; K.fsel = {}; K.route(true);
  }
  K.acts.fcopy = function () { K.fmClip = { mode: 'copy', paths: selPaths() }; K.fsm = false; K.fsel = {}; K.fdraw && K.fdraw(); K.toast(t('Скопировано в буфер'), 'ok'); };
  K.acts.fcut = function () { K.fmClip = { mode: 'move', paths: selPaths() }; K.fsm = false; K.fsel = {}; K.fdraw && K.fdraw(); K.toast(t('Вырезано в буфер'), 'ok'); };
  K.acts.fclip0 = function () { K.fmClip = null; K.fdraw && K.fdraw(); };
  K.acts.fpaste = function () {
    var c = K.fmClip; if (!c) return;
    return K.be.call('/api/fs/' + (c.mode === 'copy' ? 'copy' : 'move'), { src: c.paths, dst: K.fpath }).then(function (r) { if (c.mode === 'move') K.fmClip = null; done(r, c.mode === 'copy' ? t('Скопировано') : t('Перемещено')); });
  };
  K.acts.fdel = function () {
    var p = selPaths();
    return K.ui.confirm(t('Удалить безвозвратно ({n})? Файлы будут стёрты с диска.', { n: p.length }), { danger: true, ok: t('Удалить') }).then(function (y) { if (y) return K.be.call('/api/fs/delete', { paths: p }).then(function (r) { done(r, t('Удалено')); }); });
  };
  K.acts.fmkdir = function () {
    return K.ui.prompt(t('Новая папка'), { label: t('Имя папки') }).then(function (n) { if (n) return K.be.call('/api/fs/mkdir', { path: K.fpath, name: n }).then(function () { K.toast(t('Папка создана'), 'ok'); K.route(true); }); });
  };
  K.acts.fmenu = function (el) {
    var f = K.fl[+el.dataset.i], dir = f.filetype === 'directory', spec = dir ? { directory: f.file } : { file: f.file }, nm = f.label || f.file;
    var pl = (K.fmedia === 'music') ? 0 : 1, libKind = K.fmedia === 'music' ? 'music' : 'video', it = [
      { icon: 'play', label: dir ? t('Играть папку') : t('Воспроизвести'), run: function () { return K.play(spec); } },
      { icon: 'qnext', label: t('Следующим'), run: function () { return K.queue(spec, { next: true, pl: pl }); } },
      { icon: 'qadd', label: t('В очередь'), run: function () { return K.queue(spec, { pl: pl }); } },
      { icon: 'star', label: t('В избранное'), run: function () { return K.rpc('Favourites.AddFavourite', { title: nm, type: 'media', path: f.file, thumbnail: f.thumbnail || undefined }).then(function () { K.toast(t('Добавлено в избранное'), 'ok'); }); } }];
    if (dir) it.push({ icon: 'refresh', label: t('Сканировать папку в медиатеку'), run: function () { return K.libScanOnly(libKind, f.file); } });
    else it.push({ icon: 'download', label: t('Скачать'), run: function () { return K.rpc('Files.PrepareDownload', { path: f.file }).then(function (r) { window.open('/' + r.details.path, '_blank'); }); } });
    if (K.be.ok) {
      it.push({ icon: 'edit', label: t('Переименовать'), run: function () { return K.ui.prompt(t('Переименовать'), { label: t('Новое имя'), value: nm }).then(function (n) { if (n && n !== nm) return K.be.call('/api/fs/rename', { path: f.file, name: n }).then(function () { K.toast(t('Переименовано'), 'ok'); K.route(true); }); }); } });
      it.push({ icon: 'file', label: t('Копировать'), run: function () { K.fmClip = { mode: 'copy', paths: [f.file] }; K.fdraw && K.fdraw(); K.toast(t('Скопировано в буфер'), 'ok'); } });
      it.push({ icon: 'qnext', label: t('Вырезать'), run: function () { K.fmClip = { mode: 'move', paths: [f.file] }; K.fdraw && K.fdraw(); K.toast(t('Вырезано в буфер'), 'ok'); } });
      it.push({ icon: 'trash', danger: true, label: t('Удалить с диска'), run: function () { return K.ui.confirm(t('Удалить «{n}» с диска безвозвратно?', { n: nm }), { danger: true, ok: t('Удалить') }).then(function (y) { if (y) return K.be.call('/api/fs/delete', { paths: [f.file] }).then(function (r) { done(r, t('Удалено')); }); }); } });
    }
    K.ui.menu(nm, it);
  };

  /* ---------- источники ---------- */
  var MEDIA_NAME = { video: 'Видео', music: 'Музыка', pictures: 'Фото', files: 'Файлы', programs: 'Программы' };
  var CONTENT_NAME = { movies: 'Фильмы', tvshows: 'Сериалы', musicvideos: 'Музыкальные видео', none: 'Не задавать' };
  function ckey(p) { return String(p || '').replace(/[\\/]+$/, '').toLowerCase(); }
  K.acts.srcs = function (el) { return K.sourcesDialog(el.dataset.v); };
  K.sourcesDialog = function (media) {
    media = media === 'video' || media === 'music' || media === 'pictures' ? media : 'files';
    return K.be.init().then(function () {
      var extra = (K.be.ok && media === 'video') ? K.be.call('/api/sources/list', { media: media }).catch(function () { return {}; }) : (K.be.ok ? K.be.call('/api/sources/list', { media: media }).catch(function () { return {}; }) : Promise.resolve({}));
      return Promise.all([K.rpc('Files.GetSources', { media: media }), extra]);
    }).then(function (rr) {
      var r = rr[0], extra = rr[1] || {}, cmap = extra.content || {};
      // если серверная часть доступна — берём список источников из sources.xml (на лету, без перезапуска Kodi)
      var src;
      if (K.be.ok && Array.isArray(extra.sources)) {
        src = extra.sources.map(function (s) { return { label: s.name, file: (s.paths && s.paths[0]) || '' }; });
      } else {
        src = r.sources || [];
      }
      var lib = media === 'music' ? 'music' : media === 'video' ? 'video' : '';
      var m = K.ui.modal({ title: t('Источники') + ': ' + t(MEDIA_NAME[media]), cls: 'wide', body: html`
        ${K.be.ok ? '' : K.be.hint()}
        <div class="glass panel list" style="padding:6px;margin-bottom:14px">${src.length ? src.map(function (s) {
          var ct = cmap[ckey(s.file)] || 'none';
          return K.ui.row({ icon: 'folder', img: '', title: s.label, sub: s.file, right: html`<span class="srcrow-a">${lib ? html`<button class="icon-btn" data-act="srcscan" data-v="${lib}" data-p="${s.file}" title="${t('Обновить')}">${ic('refresh', 18)}</button>` : ''}${media === 'video' && K.be.ok ? html`<button class="icon-btn" data-act="srccontent" data-p="${s.file}" data-c="${ct}" title="${t('Тип содержимого')}: ${t(CONTENT_NAME[ct] || CONTENT_NAME.none)}">${ic('film', 18)}</button>` : ''}<button class="icon-btn" data-act="srcdel" data-m="${media}" data-n="${s.label}" data-p="${s.file}" title="${t('Удалить источник')}">${ic('trash', 18)}</button></span>` }); }) : K.ui.empty('folder', t('Источники не настроены'))}</div>
        ${K.be.ok ? html`<h3 class="ph3">${t('Добавить источник')}</h3>
          <label class="field"><span>${t('Название')}</span><input class="inp" id="sn" type="text"></label>
          <label class="field" style="margin-top:10px"><span>${t('Путь (папка, smb://, nfs://, http://…)')}</span><div class="grp"><input class="inp" id="sp" type="text" placeholder="/storage/emulated/0/Movies/"><button class="btn" data-act="srcpick">${ic('folder', 16)} ${t('Обзор')}</button><button class="btn" data-act="srcnet">${ic('plug', 16)} ${t('Подключить сетевую папку')}</button></div></label>
          ${media === 'video' ? html`<label class="field" style="margin-top:10px"><span>${t('Тип содержимого')}</span>${K.ui.select([['movies', t('Фильмы')], ['tvshows', t('Сериалы')], ['musicvideos', t('Музыкальные видео')], ['none', t('Не задавать')]], 'movies', 'id="sc"')}</label>` : ''}
          <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="srcadd" data-m="${media}">${ic('plus', 16)} ${t('Добавить')}</button></div>
          <p class="note">${media === 'video' ? t('Для фильмов и сериалов Glass Control сам задаст скрапер и включит обход подпапок источника. Тип можно изменить кнопкой с плёнкой у источника.') : ''} ${media === 'music' ? t('Каждая добавленная папка становится отдельным музыкальным источником.') : ''} ${t('Kodi читает список источников при запуске: после изменения перезапустите Kodi.')}</p>` : ''}`, actions: [{ label: t('Закрыть') }] });
      K.srcModal = m;
    }).catch(K.err);
  };
  K.acts.srcdel = function (el) {
    var media = el.dataset.m, name = el.dataset.n;
    return K.be.init().then(function () {
      if (!K.be.ok) { K.toast(t('Для удаления источников нужен Glass Control Backend'), 'err'); return; }
      return K.ui.confirm(t('Удалить источник «{n}»? Файлы не удаляются.', { n: name }), { danger: true, ok: t('Удалить') }).then(function (y) {
        if (y) return K.be.call('/api/sources/remove', { media: media, name: name, path: el.dataset.p || '' }).then(function (r) { if (r.already) K.toast(t('Источника «{n}» уже нет в sources.xml (удалён ранее) — Kodi показывает его до перезапуска', { n: name }), 'ok'); restartNote(); });
      });
    });
  };
  K.acts.srcadd = function (el) {
    var media = el.dataset.m;
    var n = $('#sn').value.trim(), p = $('#sp').value.trim();
    var content = media === 'video' && $('#sc') ? $('#sc').value : '';
    if (!n || !p) return K.toast(t('Укажите название и путь'), 'err');
    return K.be.call('/api/sources/add', { media: media, name: n, path: p, content: content }).then(function (r) {
      K.toast(t('Источник добавлен'), 'ok');
      if (r.auth === false) K.toast(t('Не удалось сохранить логин и пароль в passwords.xml'), 'err');
      var kind = media === 'video' ? 'video' : media === 'music' ? 'music' : '';
      var dir = r.path || p;
      if (!kind || (kind === 'video' && content === 'none')) { restartNote(); return; }
      // сканируем сразу через VideoLibrary.Scan / MusicLibrary.Scan — без перезагрузки профиля
      return K.libUpdate(kind, { directory: dir, clean: false }).then(function () { restartNote(kind, dir); });
    }).catch(K.err);
  };
  K.acts.srccontent = function (el) {
    var p = el.dataset.p, cur = el.dataset.c || 'none';
    return K.ui.modal({ title: t('Тип содержимого'), body: html`<label class="field"><span>${t('Тип содержимого')}</span>${K.ui.select([['movies', t('Фильмы')], ['tvshows', t('Сериалы')], ['musicvideos', t('Музыкальные видео')], ['none', t('Не задавать')]], cur, 'id="scc"')}</label>
      <p class="note">${t('Для фильмов и сериалов Glass Control задаст скрапер и включит обход подпапок источника. «Не задавать» оставляет папку без типа — Kodi не будет добавлять её в медиатеку.')}</p>`,
      actions: [{ label: t('Отмена') }, { label: t('Сохранить'), cls: 'primary', onclick: function () {
        var v = $('#scc').value;
        return K.be.call('/api/sources/content', { path: p, content: v }).then(function () {
          el.dataset.c = v; el.title = t('Тип содержимого') + ': ' + t(CONTENT_NAME[v] || CONTENT_NAME.none);
          K.toast(t('Сохранено'), 'ok');
          if (v !== 'none') K.libUpdate('video', { directory: p, clean: false });
        }).catch(K.err);
      } }] });
  };
  function restartNote(kind, path) {
    if (K.srcModal && document.body.contains(K.srcModal.el)) K.srcModal.close();
    var msg = kind ? t('Источник добавлен и сканирование запущено. Kodi увидит источник и пароль после перезапуска приложения.') : t('Источники изменены. Kodi подхватит изменения после перезапуска приложения.');
    K.ui.confirm(msg, { ok: t('Понятно'), cancel: t('Закрыть') }).then(function () { /* no profile reload — it deadlocks with SMB I/O */ });
  }
  K.acts.srcpick = function () { K.pickDir(function (p) { var i = $('#sp'); if (i) i.value = p; }); };
  K.acts.srcnet = function () {
    var cur = ($('#sp') && $('#sp').value.trim()) || 'smb://192.168.1.70/';
    var m = cur.match(/^([a-z0-9+]+:\/\/)(?:[^@\/]*@)?(.*)$/i);
    var host = m ? (m[2].split('/')[0] || '192.168.1.70') : '192.168.1.70';
    K.ui.modal({ title: t('Подключить сетевую папку'), body: html`
      <label class="field"><span>${t('Адрес (smb://host/ или nfs://host/)')}</span><input class="inp" id="nk" type="text" value="smb://${host}/"></label>
      <label class="field" style="margin-top:10px"><span>${t('Логин')}</span><input class="inp" id="nu" type="text" autocomplete="off"></label>
      <label class="field" style="margin-top:10px"><span>${t('Пароль')}</span><input class="inp" id="np" type="password" autocomplete="off"></label>
      <p class="note">${t('Проверим соединение и подставим путь с логином/паролем в поле «Путь».')}</p>`,
      actions: [{ label: t('Отмена') }, { label: t('Подключить'), cls: 'primary', onclick: function () {
        var k = $('#nk').value.trim(), u = $('#nu').value.trim(), p = $('#np').value;
        if (!k) return K.toast(t('Укажите адрес'), 'err') || false;
        var x = k.match(/^([a-z0-9+]+:\/\/)(?:[^@\/]*@)?(.*)$/i); if (!x) return K.toast(t('Неверный адрес'), 'err') || false;
        var url = x[1] + (u ? encodeURIComponent(u) + (p ? ':' + encodeURIComponent(p) : '') + '@' : '') + x[2];
        if (!url.endsWith('/')) url += '/';
        return K.be.call('/api/fs/list', { path: url }).then(function (r) {
          var i = $('#sp'); if (i) i.value = url;
          K.toast(t('Подключено: ') + (r.items ? r.items.length : 0) + ' ' + t('элементов'), 'ok');
        }).catch(function (e) { K.toast((e && e.message) || t('Нет связи'), 'err'); return false; });
      } }] });
  };
  /* выбор папки: локально и в сети (smb://, nfs://, upnp://…) через серверную часть; логин и пароль подставляются в адрес */
  K.pickDir = function (cb) {
    var cur = $('#sp') && $('#sp').value.trim() || '/', m, err = '';
    function withAuth(p, u, pw) {
      var x = p.match(/^([a-z0-9+]+:\/\/)(?:[^@\/]*@)?(.*)$/i); if (!x) return p;
      return x[1] + (u ? encodeURIComponent(u) + (pw ? ':' + encodeURIComponent(pw) : '') + '@' : '') + x[2];
    }
    function shown(p) { return p.replace(/^([a-z0-9+]+:\/\/)[^@\/]*@/i, '$1***@'); }
    function render() {
      var box = $('#pkbox'); if (!box) return;
      return K.be.call('/api/fs/list', { path: cur }).then(function (r) {
        err = ''; var dirs = r.items.filter(function (x) { return x.dir; }), net = cur.indexOf('://') > 0;
        K.mount(box, html`<div class="chips tight" style="margin-bottom:10px">${[['/', 'Устройство'], ['smb://', 'Windows (SMB)'], ['nfs://', 'NFS'], ['upnp://', 'UPnP'], ['sources://video/', 'Источники']].filter(function (x) { return x[0] !== 'sources://video/'; }).map(function (x) { return html`<button class="chip" data-act="pk" data-p="${x[0]}">${x[1]}</button>`; })}</div>
          <div class="muted" style="margin-bottom:8px;word-break:break-all">${shown(cur)}</div>
          <div class="glass panel list" style="padding:6px;max-height:42vh;overflow:auto">${parentOf(cur) ? K.ui.row({ img: '', icon: 'up', title: '..', attrs: 'data-act="pk" data-p="' + K.esc(parentOf(cur)) + '" style="cursor:pointer"' }) : ''}
            ${dirs.length ? dirs.map(function (d) { return K.ui.row({ img: '', icon: 'folder', title: d.name, attrs: 'data-act="pk" data-p="' + K.esc(d.path) + '" style="cursor:pointer"' }); }) : (parentOf(cur) ? '' : K.ui.empty('folder', t('Папок нет')))}</div>
          ${net ? html`<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="pkauth">${ic('user', 16)} ${t('Логин и пароль')}</button></div>` : ''}`);
      }, function (e) {
        K.mount(box, html`<div class="note" style="color:var(--err,#ff8d8d)">${e.message}</div><div class="chips tight" style="margin:10px 0">${[['/', 'Устройство'], ['smb://', 'Windows (SMB)'], ['nfs://', 'NFS'], ['upnp://', 'UPnP']].map(function (x) { return html`<button class="chip" data-act="pk" data-p="${x[0]}">${x[1]}</button>`; })}</div>
          ${cur.indexOf('://') > 0 ? html`<button class="btn sm primary" data-act="pkauth">${ic('user', 16)} ${t('Логин и пароль')}</button>` : ''}`);
      });
    }
    K.acts.pk = function (el) { cur = el.dataset.p; return render(); };
    K.acts.pkauth = function () {
      var pick = cur; K.ui.modal({ title: t('Доступ к сетевой папке'), body: html`<label class="field"><span>${t('Логин')}</span><input class="inp" id="pku" type="text" autocomplete="off"></label>
        <label class="field" style="margin-top:10px"><span>${t('Пароль')}</span><input class="inp" id="pkp" type="password" autocomplete="off"></label>
        <p class="note">${t('Логин и пароль сохраняются в passwords.xml на устройстве, а в sources.xml остаётся чистый путь без логина и пароля. Пароль передаётся только вашему Kodi.')}</p>`,
        actions: [{ label: t('Отмена') }, { label: t('Войти'), cls: 'primary', onclick: function () { cur = withAuth(pick, $('#pku').value.trim(), $('#pkp').value); render(); } }] });
    };
    m = K.ui.modal({ title: t('Выбор папки'), cls: 'wide', body: html`<div id="pkbox">${K.ui.loading()}</div>`, actions: [{ label: t('Отмена') }, { label: t('Выбрать эту папку'), cls: 'primary', onclick: function () { cb(cur); } }] });
    render();
  };

  /* ---------- Избранное ---------- */
  K.pages.fav = { title: function () { return t('Избранное'); }, render: function (ctx) {
    return K.rpc('Favourites.GetFavourites', { properties: ['thumbnail', 'path', 'window', 'windowparameter'] }).then(function (r) {
      if (!ctx.alive()) return; var fv = r.favourites || []; K.favs = fv;
      K.mount(ctx.view, html`${K.ui.head(t('Избранное'), { sub: fv.length + ' ' + t('элементов') })}
        ${fv.length ? html`<div class="glass panel list" style="padding:8px">${fv.map(function (f, i) {
          return K.ui.row({ img: f.thumbnail || '', icon: f.type === 'media' ? 'film' : f.type === 'script' ? 'plug' : 'star', title: f.title, sub: f.path || f.windowparameter || f.window || '',
            right: html`<button class="icon-btn" data-act="fvdel" data-i="${i}" aria-label="${t('Убрать')}">${ic('trash', 18)}</button>`, attrs: 'data-act="fvgo" data-i="' + i + '" style="cursor:pointer"' }); })}</div>` : K.ui.empty('star', t('Избранное пусто'), t('Добавляйте файлы из раздела «Файлы»'))}`);
    });
  } };
  K.acts.fvgo = function (el) {
    var f = K.favs[+el.dataset.i];
    if (f.type === 'media' && f.path) return K.play({ file: f.path });
    if (f.type === 'window' && f.window) return K.rpc('GUI.ActivateWindow', { window: f.window, parameters: f.windowparameter ? [f.windowparameter] : undefined }).then(function () { K.toast(t('Открыто на экране Kodi'), 'ok'); });
    if (f.type === 'script' && f.path) return K.rpc('Addons.ExecuteAddon', { addonid: f.path.replace(/^.*?:\/\/([^/]+).*$/, '$1') }).catch(K.err);
  };
  K.acts.fvdel = function (el) {
    var f = K.favs[+el.dataset.i], p = { title: f.title, type: f.type };
    ['path', 'window', 'windowparameter', 'thumbnail'].forEach(function (k) { if (f[k]) p[k] = f[k]; });
    return K.rpc('Favourites.AddFavourite', p).then(function () { K.toast(t('Убрано из избранного'), 'ok'); K.route(true); });   // повторное добавление = удаление
  };

  /* ---------- Очередь ---------- */
  K.pages.queue = { title: function () { return t('Очередь'); }, render: function (ctx) {
    if (K.target() === 'browser' && K.local && K.local.q && K.local.q.length) {
      var items = K.local.q, cur = K.local.i;
      K.mount(ctx.view, html`${K.ui.head(t('Очередь'), { sub: items.length + ' ' + t('элементов') + ' (' + t('браузер') + ')', right: html`<button class="btn sm danger" data-act="lqclear">${ic('trash', 16)} ${t('Очистить')}</button>` })}
        <div class="glass panel list" style="padding:8px">${items.map(function (it, i) {
          return K.ui.row({ cls: i === cur ? 'cur' : '', lead: i === cur ? ic('play', 14) : i + 1, img: it.thumb || '', icon: it.kind === 'video' ? 'film' : 'music', title: it.title || it.label,
            sub: it.sub || '', attrs: 'data-act="lqgoto" data-i="' + i + '" style="cursor:pointer"' }); })}</div>`);
      return;
    }
    var pl = ctx.q.pl != null ? +ctx.q.pl : (K.player.props && K.player.props.playlistid === 1 ? 1 : 0);
    return K.rpc('Playlist.GetItems', { playlistid: pl, properties: ['title', 'artist', 'album', 'showtitle', 'season', 'episode', 'art', 'thumbnail', 'duration', 'runtime'] }).then(function (r) {
      if (!ctx.alive()) return; var items = r.items || [], cur = K.player.id != null && K.player.props && K.player.props.playlistid === pl ? K.player.props.position : -1;
      K.qitems = items; K.qpl = pl;
      var totSec = items.reduce(function (a, it) { return a + (it.duration || it.runtime || 0); }, 0);
      var totMin = Math.round(totSec / 60);
      var counter = items.length + ' ' + t('треков') + ' · ' + totMin + ' ' + t('мин');
      K.mount(ctx.view, html`${K.ui.head(t('Очередь'), { sub: counter, right: html`<button class="btn sm danger" data-act="qclear" ${items.length ? '' : K.raw('disabled')}>${ic('trash', 16)} ${t('Очистить')}</button>` })}
        <div class="tabs"><a class="${pl === 0 ? 'on' : ''}" href="#/queue?pl=0">${t('Музыка')}</a><a class="${pl === 1 ? 'on' : ''}" href="#/queue?pl=1">${t('Видео')}</a></div>
        ${items.length ? html`<div class="glass panel list" style="padding:8px">${items.map(function (it, i) {
          var vid = pl === 1;
          var prev = items[i-1];
          var newGroup = !prev || (it.album || it.title) !== (prev.album || prev.title) || (K.join(it.artist) !== K.join(prev.artist));
          var groupHead = (!vid && newGroup && it.album) ? html`<div class="grp-h" style="display:flex;align-items:center;gap:10px;padding:8px 4px"><img src="${K.img(K.pick(it,'thumb','poster')||it.thumbnail||'')}" style="width:40px;height:40px;border-radius:8px;object-fit:cover" onerror="this.remove()"><div><b>${it.album}</b><br><span style="font-size:12px;color:var(--ink2)">${K.join(it.artist)}</span></div></div>` : '';
          return html`${groupHead}${K.ui.row({ cls: i === cur ? 'cur' : '', lead: i === cur ? ic('play', 14) : i + 1, img: (vid || newGroup) ? (K.pick(it, 'thumb', 'poster') || it.thumbnail || '') : '', shape: vid ? 'land' : '', icon: vid ? 'film' : 'music', title: it.title || it.label,
            sub: it.showtitle ? it.showtitle + ' · S' + it.season + 'E' + it.episode : K.join(it.artist) + (it.album ? ' — ' + it.album : ''),
            right: html`<button class="icon-btn hov" data-act="qmove" data-i="${i}" data-d="-1" ${i === 0 ? K.raw('disabled') : ''} aria-label="${t('Выше')}">${ic('up', 18)}</button><button class="icon-btn hov" data-act="qmove" data-i="${i}" data-d="1" ${i === items.length - 1 ? K.raw('disabled') : ''} aria-label="${t('Ниже')}">${ic('down', 18)}</button><button class="icon-btn" data-act="qdel" data-i="${i}" aria-label="${t('Убрать')}">${ic('x', 18)}</button>`,
            attrs: 'data-act="qplay" data-i="' + i + '" style="cursor:pointer"' })}`; })}</div>` : K.ui.empty('list', t('Очередь пуста'), t('Добавляйте треки и фильмы через меню «⋯»'))}`);
    });
  } };
  K.acts.qplay = function (el) { return K.rpc('Player.Open', { item: { playlistid: K.qpl, position: +el.dataset.i } }).then(function () { K.player.refreshSoon(400); K.toast(t('Запускаю воспроизведение'), 'ok'); }); };
  K.acts.qdel = function (el) { return K.rpc('Playlist.Remove', { playlistid: K.qpl, position: +el.dataset.i }).then(function () { K.route(true); }); };
  K.acts.qmove = function (el) { var i = +el.dataset.i, j = i + +el.dataset.d; return K.rpc('Playlist.Swap', { playlistid: K.qpl, position1: i, position2: j }).then(function () { K.route(true); }); };
  K.acts.qclear = function () { return K.ui.confirm(t('Очистить очередь?'), { danger: true, ok: t('Очистить') }).then(function (y) { if (y) return K.rpc('Playlist.Clear', { playlistid: K.qpl }).then(function () { K.route(true); }); }); };
  /* строки очереди: кнопки внутри не запускают воспроизведение */
  document.addEventListener('click', function (e) { var b = e.target.closest('.row button[data-act]'); if (b && b.dataset.act !== 'qplay') e.stopPropagation(); }, true);
  /* но обработчик самой кнопки должен сработать: делегирование идёт на document в фазе всплытия, поэтому вызываем его вручную */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.row button[data-act]'); if (!b) return;
    var f = K.acts[b.dataset.act]; if (f) { e.stopImmediatePropagation(); try { var r = f(b, e); if (r && r.catch) r.catch(K.err); } catch (x) { K.err(x); } }
  }, true);

  /* ---------- ТВ и радио ---------- */
  K.pages.pvr = { title: function () { return t('ТВ и радио'); }, render: function (ctx) {
    var tab = ctx.args[0] || 'tv';
    function tabs() { return html`<div class="tabs">${[['tv', 'ТВ'], ['radio', 'Радио'], ['rec', 'Записи'], ['timers', 'Таймеры']].map(function (x) { return html`<a class="${x[0] === tab ? 'on' : ''}" href="#/pvr/${x[0]}">${t(x[1])}</a>`; })}</div>`; }
    if (tab === 'tv' || tab === 'radio') {
      return K.rpc('PVR.GetChannels', { channelgroupid: tab === 'tv' ? 'alltv' : 'allradio', properties: ['thumbnail', 'channelnumber', 'broadcastnow'] }).then(function (r) {
        if (!ctx.alive()) return; var ch = r.channels || [];
        K.mount(ctx.view, html`${K.ui.head(t('ТВ и радио'))}${tabs()}${ch.length ? html`<div class="glass panel list" style="padding:8px">${ch.map(function (c) {
          return K.ui.row({ lead: c.channelnumber || '', img: c.thumbnail || '', icon: 'radio', title: c.label, sub: c.broadcastnow ? c.broadcastnow.title : '', attrs: 'data-act="chplay" data-id="' + c.channelid + '" style="cursor:pointer"' }); })}</div>` : K.ui.empty('radio', t('Каналов нет'))}`);
      });
    }
    if (tab === 'rec') {
      return K.rpc('PVR.GetRecordings', { properties: ['title', 'channel', 'starttime', 'runtime', 'plot', 'art'] }).then(function (r) {
        if (!ctx.alive()) return; var rc = r.recordings || [];
        K.mount(ctx.view, html`${K.ui.head(t('ТВ и радио'))}${tabs()}${rc.length ? html`<div class="glass panel list" style="padding:8px">${rc.map(function (c) {
          return K.ui.row({ img: K.pick(c, 'thumb') || '', shape: 'land', icon: 'rec', title: c.title || c.label, sub: [c.channel, K.fmtDateTime(c.starttime)].filter(Boolean).join(' · '), attrs: 'data-act="recplay" data-id="' + c.recordingid + '" style="cursor:pointer"' }); })}</div>` : K.ui.empty('rec', t('Записей нет'))}`);
      });
    }
    return K.rpc('PVR.GetTimers', { properties: ['title', 'starttime', 'endtime', 'state', 'channelid', 'istimerrule'] }).then(function (r) {
      if (!ctx.alive()) return; var tm = r.timers || [];
      K.mount(ctx.view, html`${K.ui.head(t('ТВ и радио'))}${tabs()}${tm.length ? html`<div class="glass panel list" style="padding:8px">${tm.map(function (c) {
        return K.ui.row({ img: undefined, lead: ic('clock', 16), title: c.title, sub: [c.state, K.fmtDateTime(c.starttime)].filter(Boolean).join(' · '), right: html`<button class="icon-btn" data-act="tmdel" data-id="${c.timerid}">${ic('trash', 18)}</button>` }); })}</div>` : K.ui.empty('clock', t('Таймеров нет'))}`);
    });
  } };
  K.acts.chplay = function (el) { return K.play({ channelid: +el.dataset.id }); };
  K.acts.recplay = function (el) { return K.play({ recordingid: +el.dataset.id }); };
  K.acts.tmdel = function (el) { return K.rpc('PVR.DeleteTimer', { timerid: +el.dataset.id }).then(function () { K.route(true); }); };
})();

/* i18n: ключ — русская строка. Для en берётся перевод из K.EN, иначе остаётся русский. */
(function () {
  'use strict';
  var K = window.K = window.K || {};
  K.EN = K.EN || {};
  var saved = null;
  try { saved = localStorage.getItem('glass.lang'); } catch (e) { }
  K.lang = saved || ((navigator.language || 'ru').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en');
  K.setLang = function (l) {
    if (l === K.lang) return;
    try { localStorage.setItem('glass.lang', l); } catch (e) { }
    K.lang = l;
    try { if (K.drawNav) K.drawNav(); } catch (e) { }
    try { if (K.refreshTop) K.refreshTop(); } catch (e) { }
    try { K.route(true); } catch (e) { console.error('route err', e); }
  };
  K.t = function (s, p) {
    var r = (K.lang === 'ru') ? s : (K.EN[s] || s);
    if (p) { r = r.replace(/\{(\w+)\}/g, function (m, k) { return p[k] != null ? p[k] : m; }); }
    return r;
  };
  window.t = K.t;
})();

# -*- coding: utf-8 -*-
"""Накладывает/снимает патч «Glass Now Playing» на обложку Mimic-LR (skin.mimic.lr).

Что меняется в скине (оригиналы сохраняются как *.glassnp.bak):
  media/glassnp/                        — текстуры (новая папка)
  xml/MusicVisualisation-GlassView.xml  — новый вид (новый файл)
  xml/MusicVisualisation.xml            — подключение вида GlassView
  xml/MusicOSD.xml                      — кнопка смены вида: StandardView→CoverView→CoverView2→GlassView→…
  xml/custom_1120_OSDSettings.xml       — то же в настройках
"""
import io
import os
import re
import shutil

import glass_xml

SKIN_ID = "skin.mimic.lr"
MARK = "GLASSNP"
BAK = ".glassnp.bak"
VIEW = "GlassView"

WINDOW = "MusicVisualisation.xml"
OSD_FILES = ("MusicOSD.xml", "custom_1120_OSDSettings.xml")


class PatchError(Exception):
    pass


# ----------------------------------------------------------------- файлы
def _read(path):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def _write(path, text):
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def _ci_find(folder, name):
    """Поиск файла без учёта регистра (на Android регистр важен)."""
    if not os.path.isdir(folder):
        return None
    for entry in os.listdir(folder):
        if entry.lower() == name.lower():
            return os.path.join(folder, entry)
    return None


def _backup(path):
    if os.path.exists(path) and not os.path.exists(path + BAK):
        shutil.copy2(path, path + BAK)


def xml_dir(skin_dir):
    txt = _read(os.path.join(skin_dir, "addon.xml"))
    res = re.findall(r"<res\b[^>]*>", txt)
    if not res:
        raise PatchError("В addon.xml скина нет <res>")
    pick = next((r for r in res if 'default="true"' in r), res[0])
    m = re.search(r'folder="([^"]+)"', pick)
    folder = os.path.join(skin_dir, m.group(1) if m else "xml")
    if not os.path.isdir(folder):
        raise PatchError("Нет папки xml у скина: " + folder)
    return folder


def skin_version(skin_dir):
    m = re.search(r'<addon\b[^>]*\bversion="([^"]+)"', _read(os.path.join(skin_dir, "addon.xml")))
    return m.group(1) if m else "?"


def is_patched(skin_dir):
    try:
        f = _ci_find(xml_dir(skin_dir), WINDOW)
        return bool(f) and MARK in _read(f) and os.path.isdir(os.path.join(skin_dir, "media", "glassnp"))
    except (PatchError, IOError, OSError):
        return False


# ----------------------------------------------------------------- патчи
def _patch_window(path):
    txt = _read(path)
    if MARK in txt:
        return "уже подключён"
    if txt.count("</controls>") != 1:
        raise PatchError("%s: ожидался один блок <controls>. Версия Mimic-LR отличается от 8.2.x?" % WINDOW)
    notes = []
    _backup(path)

    # 1) группа с новым видом — перед </controls>
    group = (
        "\t\t<!-- %s: Glass view -->\n"
        "\t\t<control type=\"group\">\n"
        "\t\t\t<visible>String.IsEqual(Skin.String(musicvis.view),%s)</visible>\n"
        "\t\t\t<include file=\"%s\">%s</include>\n"
        "\t\t</control>\n\t" % (MARK, VIEW, glass_xml.FILE_NAME, glass_xml.INCLUDE_NAME))
    txt = txt.replace("</controls>", group + "</controls>", 1)

    # 2) полноэкранную визуализацию Kodi в режиме Glass/ANIMATED не рисуем (экономим процессор телефона)
    viz_visible = ("<visible>Player.HasAudio + [!String.IsEqual(Skin.String(musicvis.view),%s)"
                   " | Skin.HasSetting(GlassNP.RealViz)]</visible>" % VIEW)
    new_txt, n = re.subn(
        r'(<control\s+type="visualisation"[^>]*>.*?)<visible>\s*Player\.HasAudio\s*</visible>',
        lambda m: m.group(1) + viz_visible,
        txt, count=1, flags=re.S)
    if n:
        txt = new_txt
    else:
        notes.append("не найден условный <visible> у visualisation (не критично)")

    # 3) фокус по умолчанию на Play/Pause, когда включён Glass
    focus = ('<defaultcontrol always="true" condition="String.IsEqual(Skin.String(musicvis.view),%s)">9003</defaultcontrol>'
             % VIEW)

    def add_focus(m):
        return m.group(1) + focus + "\n" + m.group(1) + m.group(2)

    new_txt, n = re.subn(r"([ \t]*)(<defaultcontrol\b[^>]*>[^<]*</defaultcontrol>)", add_focus, txt, count=1)
    if n:
        txt = new_txt
    else:
        txt = re.sub(r"(<window\b[^>]*>)", lambda m: m.group(1) + "\n\t" + focus, txt, count=1)
    _write(path, txt)
    return "; ".join(["подключён"] + notes)


_CYCLE_RE = re.compile(
    r"([ \t]*)(<onclick condition=\"!String\.IsEmpty\(Skin\.String\(musicvis\.view\)\) \+ "
    r"String\.IsEqual\(Skin\.String\(musicvis\.view\),CoverView2\)\">)"
    r"Skin\.SetString\(musicvis\.view,StandardView\)(</onclick>)")


def _patch_cycle(path):
    txt = _read(path)
    if VIEW in txt:
        return "уже добавлен в цикл видов"

    def repl(m):
        ind = m.group(1)
        return ("%s%sSkin.SetString(musicvis.view,%s)%s\n"
                "%s<onclick condition=\"String.IsEqual(Skin.String(musicvis.view),%s)\">"
                "Skin.SetString(musicvis.view,StandardView)</onclick>"
                % (ind, m.group(2), VIEW, m.group(3), ind, VIEW))

    new_txt, n = _CYCLE_RE.subn(repl, txt)
    if not n:
        return "цикл видов не найден (вид включается через меню дополнения)"
    _backup(path)
    _write(path, new_txt)
    return "Glass добавлен в цикл видов (%d)" % n


# ----------------------------------------------------------------- действия
def apply(skin_dir, payload_dir):
    """Применить патч. Возвращает список строк-отчёта."""
    if not os.path.isfile(os.path.join(skin_dir, "addon.xml")):
        raise PatchError("Скин не найден: " + skin_dir)
    report = []
    xdir = xml_dir(skin_dir)

    win = _ci_find(xdir, WINDOW)
    if not win:
        raise PatchError("В скине нет %s" % WINDOW)

    # текстуры
    dst = os.path.join(skin_dir, "media", "glassnp")
    src = os.path.join(payload_dir, "glassnp")
    if not os.path.isdir(src):
        raise PatchError("В дополнении нет текстур: " + src)
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    report.append("текстуры: %d файлов" % len(os.listdir(dst)))

    # файл вида
    _write(os.path.join(xdir, glass_xml.FILE_NAME), glass_xml.build())
    report.append("создан " + glass_xml.FILE_NAME)

    report.append("%s: %s" % (WINDOW, _patch_window(win)))
    for name in OSD_FILES:
        p = _ci_find(xdir, name)
        if p:
            report.append("%s: %s" % (name, _patch_cycle(p)))
    return report


def remove(skin_dir):
    xdir = xml_dir(skin_dir)
    report = []
    for name in (WINDOW,) + OSD_FILES:
        p = _ci_find(xdir, name)
        if p and os.path.exists(p + BAK):
            shutil.move(p + BAK, p)
            report.append("восстановлен " + name)
    p = os.path.join(xdir, glass_xml.FILE_NAME)
    if os.path.exists(p):
        os.remove(p)
        report.append("удалён " + glass_xml.FILE_NAME)
    d = os.path.join(skin_dir, "media", "glassnp")
    if os.path.isdir(d):
        shutil.rmtree(d)
        report.append("удалены текстуры")
    return report

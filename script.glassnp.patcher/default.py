# -*- coding: utf-8 -*-
"""Меню дополнения: Программы → Mimic-LR Glass Now Playing."""
import os
import sys

import xbmc
import xbmcaddon
import xbmcgui
import xbmcvfs

ADDON = xbmcaddon.Addon()
HERE = xbmcvfs.translatePath(ADDON.getAddonInfo("path"))
sys.path.insert(0, os.path.join(HERE, "resources", "lib"))

import patcher  # noqa: E402
from common import find_skin_dir, mark_installed, mark_removed  # noqa: E402

PAYLOAD = os.path.join(HERE, "resources", "payload")
TITLE = "Mimic-LR Glass Now Playing"


def active_is_mimic():
    return xbmc.getSkinDir() == patcher.SKIN_ID


def info(text):
    xbmcgui.Dialog().ok(TITLE, text)


def do_install(skin_dir):
    report = patcher.apply(skin_dir, PAYLOAD)
    mark_installed(patcher.skin_version(skin_dir))
    return report


def enable_view():
    if active_is_mimic():
        xbmc.executebuiltin("Skin.SetString(musicvis.view,%s)" % patcher.VIEW)
        return True
    return False


def main():
    skin_dir = find_skin_dir()
    if not skin_dir:
        info("Скин Mimic-LR (skin.mimic.lr) не найден.\n"
             "Установите его: Настройки → Интерфейс → Обложка → Получить ещё.")
        return

    patched = patcher.is_patched(skin_dir)
    status = "установлен" if patched else "не установлен"
    items = [
        "Установить патч и включить Glass",
        "Включить вид Glass",
        "Визуализатор: переключить ANIMATED ⇄ AUDIO",
        "Вернуть штатный вид Mimic-LR",
        "Удалить патч",
    ]
    idx = xbmcgui.Dialog().select("%s — патч %s (скин %s)" % (TITLE, status, patcher.skin_version(skin_dir)), items)
    if idx < 0:
        return

    try:
        if idx == 0:
            report = do_install(skin_dir)
            xbmc.executebuiltin("ReloadSkin()")
            ok = enable_view()
            msg = "Готово.\n" + "\n".join(report)
            if not ok:
                msg += ("\n\nСейчас активна другая обложка. Включите Mimic-LR "
                        "(Настройки → Интерфейс → Обложка), затем запустите это дополнение "
                        "и выберите «Включить вид Glass».")
            else:
                msg += "\n\nОткройте воспроизведение музыки на весь экран."
            info(msg)

        elif idx == 1:
            if not patched:
                info("Сначала установите патч (первый пункт).")
            elif enable_view():
                info("Вид Glass включён. Откройте воспроизведение музыки на весь экран.")
            else:
                info("Активна не Mimic-LR. Переключите обложку на Mimic-LR и повторите.")

        elif idx == 2:
            if active_is_mimic():
                xbmc.executebuiltin("Skin.ToggleSetting(GlassNP.RealViz)")
                info("Режим визуализатора переключён.\n"
                     "ANIMATED — столбики-оформление.\nAUDIO — настоящая визуализация Kodi под стеклом "
                     "(выбор: Настройки → Плеер → Музыка → Визуализация).")
            else:
                info("Активна не Mimic-LR.")

        elif idx == 3:
            if active_is_mimic():
                xbmc.executebuiltin("Skin.SetString(musicvis.view,StandardView)")
                info("Штатный вид возвращён.")
            else:
                info("Активна не Mimic-LR.")

        elif idx == 4:
            if active_is_mimic():
                xbmc.executebuiltin("Skin.SetString(musicvis.view,StandardView)")
            report = patcher.remove(skin_dir)
            mark_removed()
            xbmc.executebuiltin("ReloadSkin()")
            info("Патч удалён.\n" + "\n".join(report))
    except patcher.PatchError as e:
        info("Ошибка патча:\n%s" % e)
    except (IOError, OSError) as e:
        info("Не удалось записать файлы скина:\n%s" % e)


if __name__ == "__main__":
    main()

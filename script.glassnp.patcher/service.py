# -*- coding: utf-8 -*-
"""Сервис: если скин Mimic-LR обновился и затёр патч — накладывает его заново."""
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
from common import find_skin_dir, mark_installed, was_installed  # noqa: E402

PAYLOAD = os.path.join(HERE, "resources", "payload")
CHECK_EVERY = 600  # секунд


def check(player):
    if not was_installed():
        return
    skin_dir = find_skin_dir()
    if not skin_dir or patcher.is_patched(skin_dir):
        return
    try:
        patcher.apply(skin_dir, PAYLOAD)
        mark_installed(patcher.skin_version(skin_dir))
    except Exception as e:  # noqa: BLE001
        xbmc.log("[glassnp] повторное наложение не удалось: %s" % e, xbmc.LOGWARNING)
        return
    xbmcgui.Dialog().notification("Glass Now Playing", "Патч наложен заново после обновления скина",
                                  xbmcgui.NOTIFICATION_INFO, 5000, False)
    if xbmc.getSkinDir() == patcher.SKIN_ID and not player.isPlaying():
        xbmc.executebuiltin("ReloadSkin()")


if __name__ == "__main__":
    monitor = xbmc.Monitor()
    player = xbmc.Player()
    if not monitor.waitForAbort(20):          # дать Kodi загрузиться
        while True:
            check(player)
            if monitor.waitForAbort(CHECK_EVERY):
                break

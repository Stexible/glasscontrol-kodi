# -*- coding: utf-8 -*-
"""Общие функции для default.py и service.py (требуют Kodi)."""
import os

import xbmcvfs

SKIN_ID = "skin.mimic.lr"
ADDON_ID = "script.glassnp.patcher"


def find_skin_dir():
    for base in ("special://home/addons/", "special://xbmc/addons/"):
        p = xbmcvfs.translatePath(base + SKIN_ID)
        if os.path.isfile(os.path.join(p, "addon.xml")):
            return p
    return None


def _flag_path():
    d = xbmcvfs.translatePath("special://profile/addon_data/%s/" % ADDON_ID)
    if not os.path.isdir(d):
        os.makedirs(d)
    return os.path.join(d, "installed.flag")


def mark_installed(skin_version):
    with open(_flag_path(), "w") as f:
        f.write(skin_version)


def mark_removed():
    p = _flag_path()
    if os.path.exists(p):
        os.remove(p)


def was_installed():
    return os.path.exists(_flag_path())

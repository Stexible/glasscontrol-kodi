# -*- coding: utf-8 -*-
"""Генератор MusicVisualisation-GlassView.xml для Mimic-LR (раскладка 1920x1080).

Вид подключается тем же способом, что и родные виды скина:
<include file="MusicVisualisation-GlassView.xml">MusicVisGlassView</include>
Шрифты — уже существующие в скине (font10..font48), Font.xml не трогаем.
"""
import random

TEX = "glassnp/"
ACCENT = "FF54D6E2"
BAR_COUNT = 72

# роль -> существующий шрифт Mimic-LR (размер в скобках, px при 1080p)
F_CLOCK = "font32"    # 50
F_TITLE = "font48"    # 60
F_ARTIST = "font30"   # 45
F_ALBUM = "font14"    # 33
F_INFO = "font13"     # 30
F_SMALL = "font12"    # 26
F_LABEL = "font12"    # 26
F_BADGE = "font10"    # 21

INCLUDE_NAME = "MusicVisGlassView"
FILE_NAME = "MusicVisualisation-GlassView.xml"


def build():
    out = []
    w = out.append

    def tex(name):
        return TEX + name

    def image(l, t, wd, ht, texture, vis=None, cd=None, aspect=None):
        w("<control type=\"image\">")
        w("<left>%d</left><top>%d</top><width>%d</width><height>%d</height>" % (l, t, wd, ht))
        if aspect:
            w("<aspectratio>%s</aspectratio>" % aspect)
        if vis:
            w("<visible>%s</visible>" % vis)
        cd_attr = ' colordiffuse="' + cd + '"' if cd else ""
        w("<texture" + cd_attr + ">" + texture + "</texture>")
        w("</control>")

    def label(l, t, wd, ht, text, font, color, align="left", vis=None, scroll=False):
        w("<control type=\"label\">")
        w("<left>%d</left><top>%d</top><width>%d</width><height>%d</height>" % (l, t, wd, ht))
        w("<font>%s</font><textcolor>%s</textcolor><align>%s</align><aligny>center</aligny>" % (font, color, align))
        if scroll:
            w("<scroll>true</scroll>")
        if vis:
            w("<visible>%s</visible>" % vis)
        w("<label>%s</label>" % text)
        w("</control>")

    def button(cid, l, t, wd, ht, nf, fo, click, nav):
        w("<control type=\"button\" id=\"%d\">" % cid)
        w("<left>%d</left><top>%d</top><width>%d</width><height>%d</height>" % (l, t, wd, ht))
        w("<texturenofocus>%s</texturenofocus><texturefocus>%s</texturefocus>" % (nf, fo))
        w("<onclick>%s</onclick>" % click)
        for k, v in nav.items():
            w("<%s>%s</%s>" % (k, v, k))
        w("</control>")

    anim_viz = "!Skin.HasSetting(GlassNP.RealViz)"

    w("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
    w("<!-- GLASSNP: Glass Now Playing view for Mimic-LR. Generated file, do not edit by hand. -->")
    w("<includes>")
    w("<include name=\"%s\">" % INCLUDE_NAME)
    w("<control type=\"group\">")
    w("<animation effect=\"fade\" start=\"0\" end=\"100\" time=\"300\">WindowOpen</animation>")
    w("<animation effect=\"fade\" start=\"100\" end=\"0\" time=\"200\">WindowClose</animation>")

    # фон (в режиме AUDIO скрыт — под стеклом видна настоящая визуализация Kodi)
    image(0, 0, 1920, 1080, tex("bg.jpg"), vis=anim_viz, aspect="scale")

    # часы
    label(1310, 48, 500, 76, "$INFO[System.Time(hh:mm)]", F_CLOCK, "FFFFFFFF", "right")

    # стеклянные панели + блик на стекле
    image(110, 190, 620, 620, tex("panel_art.png"))
    image(770, 190, 1040, 620, tex("panel_info.png"))
    image(110, 840, 1700, 190, tex("panel_bottom.png"))
    image(770, 190, 1040, 620, tex("glare_panel_info.png"))
    image(110, 840, 1700, 190, tex("glare_panel_bottom.png"))

    # обложка альбома со скруглением и бликом
    w("<control type=\"image\">")
    w("<left>130</left><top>210</top><width>580</width><height>580</height>")
    w("<aspectratio>scale</aspectratio>")
    w("<texture diffuse=\"%s\" fallback=\"DefaultAlbumCover.png\">$INFO[Player.Art(thumb)]</texture>" % tex("mask_art.png"))
    w("</control>")
    image(130, 210, 580, 580, tex("glare_art.png"))
    image(110, 190, 620, 620, tex("glare_panel_art.png"))

    # тексты трека
    label(820, 228, 940, 82, "$INFO[MusicPlayer.Title]", F_TITLE, "FFFFFFFF", scroll=True)
    label(820, 314, 940, 56, "$INFO[MusicPlayer.Artist]", F_ARTIST, "EBFFFFFF", scroll=True)
    label(820, 366, 940, 46, "$INFO[MusicPlayer.Album]$INFO[MusicPlayer.Year, (,)]", F_ALBUM, "8CFFFFFF", scroll=True)
    image(820, 428, 940, 2, tex("white.png"), cd="24FFFFFF", aspect="stretch")

    # формат/битрейт и плашка кодека
    has_bits = "!String.IsEmpty(MusicPlayer.BitsPerSample) + !String.IsEqual(MusicPlayer.BitsPerSample,0)"
    no_bits = "String.IsEmpty(MusicPlayer.BitsPerSample) | String.IsEqual(MusicPlayer.BitsPerSample,0)"
    label(1090, 440, 550, 48, "PCM $INFO[MusicPlayer.SampleRate]kHz / $INFO[MusicPlayer.BitsPerSample]bit",
          F_INFO, "D9FFFFFF", "right", vis=has_bits)
    label(1090, 440, 550, 48, "$INFO[MusicPlayer.BitRate]kbps  /  $INFO[MusicPlayer.SampleRate]kHz",
          F_INFO, "D9FFFFFF", "right", vis=no_bits)
    image(1660, 444, 100, 40, tex("badge.png"), vis="!String.IsEmpty(MusicPlayer.Codec)")
    label(1660, 444, 100, 40, "[UPPERCASE]$INFO[MusicPlayer.Codec][/UPPERCASE]", F_BADGE, "F2FFFFFF", "center",
          vis="!String.IsEmpty(MusicPlayer.Codec)")

    # прогресс + время
    w("<control type=\"progress\">")
    w("<left>820</left><top>520</top><width>940</width><height>10</height>")
    w("<texturebg>%s</texturebg>" % tex("track.png"))
    w("<lefttexture>%s</lefttexture>" % tex("fill_l.png"))
    w("<midtexture>%s</midtexture>" % tex("fill_m.png"))
    w("<righttexture>%s</righttexture>" % tex("fill_r.png"))
    w("<info>Player.Progress</info>")
    w("</control>")
    label(820, 546, 300, 40, "$INFO[Player.Time]", F_SMALL, "A6FFFFFF")
    label(1460, 546, 300, 40, "$INFO[Player.Duration]", F_SMALL, "A6FFFFFF", "right")

    # невидимый слайдер перемотки поверх прогресса (тап/свайп на телефоне, стрелки на пульте)
    w("<control type=\"slider\" id=\"9010\">")
    w("<description>Seek</description>")
    w("<left>820</left><top>505</top><width>940</width><height>40</height>")
    w("<texturesliderbar /><textureslidernib /><textureslidernibfocus />")
    w("<action>seek</action>")
    w("<onup>9010</onup><ondown>9003</ondown><onleft>9010</onleft><onright>9010</onright>")
    w("</control>")

    # кнопки: LOOP, PREV, PLAY/PAUSE, NEXT, SHUFFLE
    button(9001, 820, 600, 100, 104, tex("empty.png"), tex("btn_sm_fo.png"), "PlayerControl(Repeat)",
           {"onleft": "9005", "onright": "9002", "onup": "9010", "ondown": "9007"})
    button(9002, 981, 610, 190, 84, tex("btn_nf.png"), tex("btn_fo.png"), "PlayerControl(Previous)",
           {"onleft": "9001", "onright": "9003", "onup": "9010", "ondown": "9007"})
    button(9003, 1195, 610, 190, 84, tex("btn_nf.png"), tex("btn_fo.png"), "PlayerControl(Play)",
           {"onleft": "9002", "onright": "9004", "onup": "9010", "ondown": "9007"})
    button(9004, 1409, 610, 190, 84, tex("btn_nf.png"), tex("btn_fo.png"), "PlayerControl(Next)",
           {"onleft": "9003", "onright": "9005", "onup": "9010", "ondown": "9006"})
    button(9005, 1660, 600, 100, 104, tex("empty.png"), tex("btn_sm_fo.png"), "PlayerControl(Random)",
           {"onleft": "9004", "onright": "9001", "onup": "9010", "ondown": "9006"})

    ic = 44
    image(1076 - ic // 2, 630, ic, ic, tex("ic_prev.png"))
    image(1290 - ic // 2, 630, ic, ic, tex("ic_pause.png"), vis="Player.Playing + !Player.Paused")
    image(1290 - ic // 2, 630, ic, ic, tex("ic_play.png"), vis="!Player.Playing | Player.Paused")
    image(1504 - ic // 2, 630, ic, ic, tex("ic_next.png"))
    image(850, 632, 40, 40, tex("ic_loop.png"), cd=ACCENT, vis="Playlist.IsRepeat | Playlist.IsRepeatOne")
    image(850, 632, 40, 40, tex("ic_loop.png"), cd="8CFFFFFF", vis="!Playlist.IsRepeat + !Playlist.IsRepeatOne")
    image(1690, 632, 40, 40, tex("ic_shuffle.png"), cd=ACCENT, vis="Playlist.IsRandom")
    image(1690, 632, 40, 40, tex("ic_shuffle.png"), cd="8CFFFFFF", vis="!Playlist.IsRandom")

    for cx, text in ((870, "LOOP"), (1076, "PREV"), (1290, "PLAY/PAUSE"), (1504, "NEXT"), (1710, "SHUFFLE")):
        label(cx - 110, 700, 220, 40, text, F_LABEL, "99FFFFFF", "center")

    # служебные кнопки: штатный вид / режим визуализатора
    button(9007, 820, 744, 250, 46, tex("pill_nf.png"), tex("pill_fo.png"),
           "Skin.SetString(musicvis.view,StandardView)",
           {"onleft": "9006", "onright": "9006", "onup": "9003", "ondown": "9007"})
    label(820, 744, 250, 46, "CLASSIC VIEW", F_LABEL, "CCFFFFFF", "center")
    button(9006, 1510, 744, 250, 46, tex("pill_nf.png"), tex("pill_fo.png"),
           "Skin.ToggleSetting(GlassNP.RealViz)",
           {"onleft": "9007", "onright": "9007", "onup": "9004", "ondown": "9006"})
    label(1510, 744, 250, 46, "VIZ: AUDIO", F_LABEL, "CCFFFFFF", "center", vis="Skin.HasSetting(GlassNP.RealViz)")
    label(1510, 744, 250, 46, "VIZ: ANIMATED", F_LABEL, "CCFFFFFF", "center", vis=anim_viz)

    # столбики эквалайзера (оформительские, пульсируют пока играет трек)
    rnd = random.Random(11)
    pitch = 1620.0 / BAR_COUNT
    rest = 8.0
    bottom = 1008
    w("<control type=\"group\">")
    w("<visible>%s</visible>" % anim_viz)
    for i in range(BAR_COUNT):
        x = 150 + i * pitch
        env = 0.35 + 0.65 * (2.718281828 ** (-i / 28.0))
        hmax = 130 * env * (0.55 + 0.45 * rnd.random())
        hmin = 10 + rnd.random() * 14
        t = int(380 + rnd.random() * 700)
        delay = int(rnd.random() * 600)
        cx = x + 7
        w("<control type=\"image\">")
        w("<left>%d</left><top>%d</top><width>14</width><height>%d</height>" % (round(x), bottom - int(rest), int(rest)))
        w("<aspectratio>stretch</aspectratio>")
        w("<texture>%s</texture>" % tex("bar.png"))
        w("<animation effect=\"zoom\" start=\"100,%d\" end=\"100,%d\" center=\"%d,%d\" time=\"%d\" delay=\"%d\" "
          "tween=\"sine\" easing=\"inout\" pulse=\"true\" loop=\"true\" "
          "condition=\"Player.Playing + !Player.Paused\">Conditional</animation>"
          % (round(hmin / rest * 100), round(hmax / rest * 100), round(cx), bottom, t, delay))
        w("</control>")
    w("</control>")

    w("</control>")      # внешняя группа
    w("</include>")
    w("</includes>")
    return "\n".join(out) + "\n"

# Glass Control для Kodi

Набор дополнений Kodi 21 в «стеклянном» стиле:

| Папка | Что это |
|---|---|
| `webinterface.glasscontrol` | Веб-интерфейс управления Kodi (медиатека, плеер, настройки, пульт, файлы) |
| `service.glasscontrol` | Серверная часть: файловый менеджер, источники, яркость, сброс медиатеки |
| `script.glassnp.patcher` | Патч скина Mimic-LR: вид «Сейчас играет» со стеклом и визуализатором |
| `repository.glasscontrol` | Шаблон репозитория Kodi (для автообновлений) |

## Установка
**Вариант А — из zip.** Скачайте zip-файлы со страницы Releases → в Kodi: Дополнения → Установить из zip-файла.
**Вариант Б — репозиторий с автообновлением.** Установите `repository.glasscontrol-*.zip`, затем Дополнения → Установить из репозитория → Glass Control.

Веб-интерфейс открывается в браузере: `http://<адрес-Kodi>:8080`. Для работы нужно включить Настройки → Службы → Управление → «Разрешить удалённое управление по HTTP». Для файлового менеджера и источников установите ещё и `service.glasscontrol`.

## Как выпустить новую версию
1. Внесите изменения в папки дополнений.
2. Поднимите `version` в `addon.xml` изменённого дополнения (иначе Kodi не увидит обновление).
3. `git commit`, затем `git tag v1.2.1 && git push --tags`.
4. GitHub Actions соберёт zip, приложит их к релизу и обновит репозиторий Kodi на GitHub Pages.

Локальная сборка: `python3 tools/build.py` → `dist/releases/*.zip`.
Сборка репозитория: `python3 tools/build.py --base-url https://ЛОГИН.github.io/ИМЯ_РЕПО` → `dist/site`.

## Однократная настройка GitHub
Settings → Pages → Build and deployment → Source: **GitHub Actions**.

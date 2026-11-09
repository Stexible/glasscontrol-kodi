"""Тонкая обёртка над xbmcvfs; вне Kodi (тесты) работает на обычной файловой системе."""
import os
import shutil

try:
    import xbmcvfs as _x  # type: ignore
except ImportError:  # pragma: no cover - вне Kodi
    _x = None


def sep_of(p):
    return '\\' if ('\\' in p and '/' not in p) else '/'


def join(base, name):
    if base.endswith(('/', '\\')):
        return base + name
    return base + sep_of(base) + name


def parent(p):
    q = p.rstrip('/\\')
    i = max(q.rfind('/'), q.rfind('\\'))
    if i < 0:
        return ''
    return q[:i + 1]


def basename(p):
    return p.rstrip('/\\').replace('\\', '/').rsplit('/', 1)[-1]


def depth_ok(p):
    """Не даём трогать корни: '/', 'C:\\', 'smb://host/', 'special://home/'."""
    q = p.rstrip('/\\')
    if '://' in q:
        rest = q.split('://', 1)[1]
        return len([x for x in rest.replace('\\', '/').split('/') if x]) >= 2
    return len([x for x in q.replace('\\', '/').split('/') if x]) >= 2


def exists(p):
    return _x.exists(p) if _x else os.path.exists(p)


def isdir(p):
    if _x:
        return _x.exists(p.rstrip('/\\') + '/') and not _isfile(p)
    return os.path.isdir(p)


def _isfile(p):
    try:
        return _x.Stat(p).st_size() >= 0 and not _x.exists(p.rstrip('/\\') + '/')
    except Exception:
        return False


def listdir(p):
    """-> (dirs, files) — имена."""
    if _x:
        d, f = _x.listdir(p)
        return list(d), list(f)
    ds, fs = [], []
    for n in os.listdir(p):
        (ds if os.path.isdir(os.path.join(p, n)) else fs).append(n)
    return ds, fs


def stat(p):
    try:
        if _x:
            s = _x.Stat(p)
            return int(s.st_size()), int(s.st_mtime())
        s = os.stat(p)
        return int(s.st_size), int(s.st_mtime)
    except Exception:
        return 0, 0


def mkdir(p):
    return _x.mkdirs(p) if _x else (os.makedirs(p, exist_ok=True) or True)


def copy_file(a, b):
    if _x:
        return bool(_x.copy(a, b))
    shutil.copyfile(a, b)
    return True


def rename(a, b):
    if _x:
        return bool(_x.rename(a, b))
    os.rename(a, b)
    return True


def delete_file(p):
    if _x:
        return bool(_x.delete(p))
    os.remove(p)
    return True


def rmdir(p):
    if _x:
        return bool(_x.rmdir(p.rstrip('/\\') + '/', True))
    shutil.rmtree(p)
    return True

#!/usr/bin/env python3
"""把本地 dist 差异上传到服务器（不在服务器上构建，避免 CPU 打满）。

用法：
    SSH_PASS='xxx' python scripts/deploy_push_dist.py             # 只算差异，不上传（dry run）
    SSH_PASS='xxx' python scripts/deploy_push_dist.py --apply     # 真正上传并切换
    SSH_PASS='xxx' python scripts/deploy_push_dist.py --apply --no-server   # 只传前端，不动后端代码

设计要点（服务器 2 核 / 1.9G，构建必炸）：
    1. 前端产物在本机构建，服务器只接收文件，完全不跑 npm/vite
    2. 按 文件名+大小 做差异比对，只传变化的文件
    3. 传输限速（默认 6 MB/s），把 ssh 加密的 CPU 占用压在低位
    4. 先传静态资源，最后才覆盖 index.html —— 切换是原子的，中途访问不受影响
    5. 后端 server/*.js 一并按大小比对同步（有新逻辑改动时才会传）
    6. 传完 chown www:www，nginx reload，全程无 CPU 密集操作
"""
import json
import os
import sys
import time
import warnings

warnings.filterwarnings('ignore')
import paramiko

APPLY = '--apply' in sys.argv
SYNC_SERVER = '--no-server' not in sys.argv

HOST = os.environ.get('SSH_HOST', '64.90.3.51')
USER = os.environ.get('SSH_USER', 'root')
PASS = os.environ.get('SSH_PASS', '')
RATE = int(os.environ.get('SSH_RATE_MBPS', '6')) * 1024 * 1024  # 限速，字节/秒

if APPLY and not PASS:
    sys.exit('请先设置环境变量 SSH_PASS（SSH_HOST / SSH_USER 有默认值）')

APP_DIR = '/www/wwwroot/shuzhi'
LOCAL_DIST = r'C:\Users\yuyiling\Desktop\shuzhi\dist'
LOCAL_SRC = r'C:\Users\yuyiling\Desktop\shuzhi'
REMOTE_LIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_tmp_remote_dist.json')
SMALL_FILE = 200 * 1024  # 小于此值一律覆盖，避免"大小相同但内容变了"


class RateLimiter:
    """给文件读取加节流，控制 sftp 传输速率，压低 ssh 加密的 CPU 占用。"""

    def __init__(self, fh, rate):
        self.fh = fh
        self.rate = rate
        self.sent = 0
        self.t0 = time.time()

    def read(self, n):
        chunk = self.fh.read(n)
        if chunk:
            self.sent += len(chunk)
            expect = self.sent / self.rate
            elapsed = time.time() - self.t0
            if elapsed < expect:
                time.sleep(expect - elapsed)
        return chunk

    def __getattr__(self, item):
        return getattr(self.fh, item)


def walk_local(root):
    """返回 {相对路径: (绝对路径, 大小)}"""
    out = {}
    for dirpath, _, files in os.walk(root):
        for name in files:
            abs_p = os.path.join(dirpath, name)
            rel = os.path.relpath(abs_p, root).replace('\\', '/')
            out[rel] = (abs_p, os.path.getsize(abs_p))
    return out


def fetch_remote_list(client):
    """从服务器抓取 dist 与 server 的文件清单 {相对路径: 大小}。"""
    def run(cmd):
        _, out, _ = client.exec_command(cmd, get_pty=True, timeout=180)
        return out.read().decode('utf-8', 'replace')

    result = {}
    # find -printf 一次拿到 大小\t路径，避免上千次 stat 往返
    raw = run(f'cd {APP_DIR} && find dist server -maxdepth 2 -type f -printf "%s\\t%p\\n" 2>/dev/null')
    for line in raw.splitlines():
        parts = line.strip().split('\t')
        if len(parts) != 2:
            continue
        try:
            result[parts[1].replace('\\', '/')] = int(parts[0])
        except ValueError:
            continue
    return result


def diff(local, remote, prefix):
    """比对本地目录与服务器清单（服务器清单里的键形如 'dist/xxx'）。"""
    out = []
    for rel, (abs_p, size) in sorted(local.items()):
        rkey = f'{prefix}/{rel}'
        if rkey not in remote or remote[rkey] != size or size < SMALL_FILE:
            out.append((rel, abs_p, size))
    return out


def upload(sftp, items, remote_root, label):
    if not items:
        print(f'\n[{label}] 无变化，跳过')
        return 0
    total = sum(s for _, _, s in items)
    print(f'\n[{label}] 上传 {len(items)} 个文件，共 {total / 1024 / 1024:.2f} MB')
    done = 0
    for rel, abs_p, size in items:
        target = f'{remote_root}/{rel}'
        parent = target.rsplit('/', 1)[0]
        try:
            sftp.stat(parent)
        except IOError:
            sftp.mkdir(parent)
        with open(abs_p, 'rb') as fh:
            sftp.putfo(RateLimiter(fh, RATE), target)
        done += 1
        print(f'  [{done}/{len(items)}] {rel} ({size:,} B)')
    return done


def main():
    local_dist = walk_local(LOCAL_DIST)

    # 只同步运行必需的后端文件，不传测试/临时文件
    server_dir = os.path.join(LOCAL_SRC, 'server')
    local_server = {}
    if SYNC_SERVER and os.path.isdir(server_dir):
        for name in os.listdir(server_dir):
            abs_p = os.path.join(server_dir, name)
            if os.path.isfile(abs_p) and name.endswith('.js'):
                local_server[name] = (abs_p, os.path.getsize(abs_p))

    remote = {}
    if APPLY or os.path.exists(REMOTE_LIST):
        pass
    if not APPLY and os.path.exists(REMOTE_LIST):
        remote = json.load(open(REMOTE_LIST, encoding='utf-8'))
        print('[dry-run] 使用上次缓存的服务器清单（可能过期）')

    dist_items = diff(local_dist, remote, 'dist') if remote else [
        (rel, abs_p, size) for rel, (abs_p, size) in sorted(local_dist.items())
    ]
    server_items = diff(local_server, remote, 'server') if remote else [
        (rel, abs_p, size) for rel, (abs_p, size) in sorted(local_server.items())
    ]

    total = sum(s for _, _, s in dist_items) + sum(s for _, _, s in server_items)
    print(f'本地 dist: {len(local_dist)} 个文件')
    print(f'服务器 dist 清单: {len(remote)} 条')
    print(f'待上传: dist {len(dist_items)} 个 + server {len(server_items)} 个，共 {total / 1024 / 1024:.2f} MB')

    if not APPLY:
        print('\n[dry-run] 未上传。加 --apply 执行。')
        return

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30,
                   banner_timeout=60, auth_timeout=30)

    print('\n=== 抓取服务器现状 ===')

    def run(cmd, timeout=180):
        _, out, _ = client.exec_command(cmd, get_pty=True, timeout=timeout)
        return out.read().decode('utf-8', 'replace')

    print(run('cat /proc/loadavg'))
    remote = fetch_remote_list(client)
    json.dump(remote, open(REMOTE_LIST, 'w', encoding='utf-8'))
    print(f'已记录服务器清单 {len(remote)} 条')

    # 重新按真实清单算差异
    dist_items = diff(local_dist, remote, 'dist')
    server_items = diff(local_server, remote, 'server')
    total = sum(s for _, _, s in dist_items) + sum(s for _, _, s in server_items)
    print(f'实际待上传: dist {len(dist_items)} 个 + server {len(server_items)} 个，'
          f'共 {total / 1024 / 1024:.2f} MB')

    if not dist_items and not server_items:
        print('\n[完成] 服务器已是最新，无需上传')
        client.close()
        return

    sftp = client.open_sftp()
    sftp.get_channel().settimeout = lambda *a: None  # 保持长连接不被超时打断

    # index.html 放最后传，保证切换原子
    ordered = [x for x in dist_items if x[0] != 'index.html'] + \
              [x for x in dist_items if x[0] == 'index.html']
    upload(sftp, ordered, f'{APP_DIR}/dist', '前端 dist')
    if SYNC_SERVER:
        upload(sftp, server_items, f'{APP_DIR}/server', '后端 server')
    sftp.close()

    print('\n=== 修正属主 + 校验 nginx ===')
    print(run(f'cd {APP_DIR} && chown -R www:www dist server && nginx -t 2>&1'))

    print('\n=== 清理上一版残留的 index 资源 ===')
    keep = {os.path.basename(p) for p, _, _ in dist_items if p.startswith('assets/index-')}
    keep |= {os.path.basename(p) for p in os.listdir(os.path.join(LOCAL_DIST, 'assets'))
             if p.startswith('index-')} if os.path.isdir(os.path.join(LOCAL_DIST, 'assets')) else set()
    if keep:
        keep_args = ' '.join(f'! -name "{k}"' for k in sorted(keep))
        print(run(f'cd {APP_DIR}/dist/assets && find . -maxdepth 1 -name "index-*" '
                  f'{keep_args} -delete; ls -l | grep -E "index-.*\\.(js|css)" || echo "(仅保留最新)"'))
    else:
        print('(未识别到 index 资源，跳过清理)')

    print('\n=== 重载 nginx + 重启 API ===')
    print(run('nginx -s reload && echo "nginx reloaded"'))
    print(run('pm2 restart shuzhi 2>&1 | tail -2'))
    time.sleep(3)
    print(run('pm2 list | grep shuzhi'))

    print('\n=== 冒烟 ===')
    print(run(
        "echo -n '首页: '; curl -s -o /dev/null -w '%{http_code}\\n' "
        "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/; "
        "echo -n 'API:  '; curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:4001/api/auth/me; "
        "echo -n 'favicon: '; curl -s -o /dev/null -w '%{http_code}\\n' "
        "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/favicon.ico"))
    print(run('curl -s --resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/ '
              '| grep -oE "/assets/index-[A-Za-z0-9_-]+\\.(js|css)" | sort -u'))

    print('\n=== 负载（确认未打高） ===')
    print(run('cat /proc/loadavg; ps -eo pcpu,pmem,comm --sort=-pcpu | head -5'))
    client.close()
    print('\n[完成] 部署结束')


if __name__ == '__main__':
    main()

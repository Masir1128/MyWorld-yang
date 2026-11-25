#!/usr/bin/env python3
"""草原之夜本地服务：仅使用 Python 标准库，供两个 .command 脚本调用。"""

import argparse
import fcntl
import functools
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import urllib.request
from urllib.parse import urlsplit


SCRIPT = Path(__file__).resolve()
PROJECT_DIR = SCRIPT.parent.parent
RUNTIME_DIR = PROJECT_DIR / ".local-server"
STATE_FILE = RUNTIME_DIR / "server.json"
LOG_FILE = RUNTIME_DIR / "server.log"
PROJECT_ID = hashlib.sha256(os.fsencode(PROJECT_DIR)).hexdigest()[:20]
HEALTH_PATH = "/__science_sheep_local_status__"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def read_state():
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if (isinstance(state, dict)
                and type(state.get("pid")) is int and state["pid"] > 1
                and type(state.get("port")) is int and 1024 <= state["port"] <= 65535):
            return state
    except (OSError, ValueError):
        pass
    return None


def is_project_process(state):
    """停止前核对完整脚本路径、运行模式和端口，防止误杀复用 PID 的进程。"""
    if not state:
        return False
    try:
        result = subprocess.run(
            ["/bin/ps", "-p", str(state["pid"]), "-o", "command="],
            capture_output=True, text=True, timeout=2, check=False,
        )
        # macOS ps 不会为路径里的空格添加引号，不能用 shlex 拆分命令。
        command = result.stdout.strip()
        suffix = " -u {} serve --port {}".format(SCRIPT, state["port"])
        executable = command[:-len(suffix)] if command.endswith(suffix) else ""
        return (result.returncode == 0 and bool(executable)
                and Path(executable).name.lower().startswith("python"))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return False


def is_ready(state):
    try:
        url = "http://127.0.0.1:{}{}".format(state["port"], HEALTH_PATH)
        with OPENER.open(url, timeout=0.4) as response:
            info = json.loads(response.read(4096))
        return info == {"project": PROJECT_ID, "pid": state["pid"]}
    except (OSError, ValueError):
        return False


def show_started(state, no_browser, reused=False):
    url = "http://127.0.0.1:{}/".format(state["port"])
    print("草原之夜已在运行。" if reused else "草原之夜已启动。")
    print("首页：" + url)
    print("关闭服务请双击「关闭草原之夜.command」。")
    if not no_browser:
        try:
            result = subprocess.run(["/usr/bin/open", url], timeout=10, check=False)
            if result.returncode != 0:
                print("请在浏览器中打开上面的首页地址。")
        except (OSError, subprocess.TimeoutExpired):
            print("请在浏览器中打开上面的首页地址。")


def start(no_browser):
    state = read_state()
    if is_project_process(state):
        if not is_ready(state):
            raise RuntimeError("服务进程正在运行，但页面未响应。请先双击关闭脚本，再重新启动。")
        show_started(state, no_browser, reused=True)
        return

    STATE_FILE.unlink(missing_ok=True)
    for port in range(8000, 8011):
        # 先检查端口；真正启动时仍由服务器绑定，处理其他程序同时占用的情况。
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue

        with LOG_FILE.open("ab") as log:
            process = subprocess.Popen(
                [sys.executable, "-u", str(SCRIPT), "serve", "--port", str(port)],
                cwd=str(PROJECT_DIR), stdin=subprocess.DEVNULL,
                stdout=log, stderr=subprocess.STDOUT,
                start_new_session=True, close_fds=True,
            )
        state = {"pid": process.pid, "port": port}
        STATE_FILE.write_text(json.dumps(state) + "\n", encoding="utf-8")
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if process.poll() is not None:
                STATE_FILE.unlink(missing_ok=True)
                break
            if is_ready(state):
                show_started(state, no_browser)
                return
            time.sleep(0.1)
        else:
            stop()
            raise RuntimeError("服务启动超时。日志：" + str(LOG_FILE))
    raise RuntimeError("没有可用端口或服务启动失败。日志：" + str(LOG_FILE))


def stop():
    state = read_state()
    if not is_project_process(state):
        STATE_FILE.unlink(missing_ok=True)
        print("草原之夜未启动，无需关闭。")
        return

    try:
        os.kill(state["pid"], signal.SIGTERM)
    except ProcessLookupError:
        pass
    deadline = time.monotonic() + 5
    while is_project_process(state) and time.monotonic() < deadline:
        time.sleep(0.1)
    if is_project_process(state):
        os.kill(state["pid"], signal.SIGKILL)
        deadline = time.monotonic() + 2
        while is_project_process(state) and time.monotonic() < deadline:
            time.sleep(0.1)
        if is_project_process(state):
            raise RuntimeError("服务未能关闭，请稍后重试。")
    STATE_FILE.unlink(missing_ok=True)
    print("草原之夜已关闭。")


class ProjectHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 编辑后重新打开即可看到最新页面，不保留旧首页和旧脚本的浏览器缓存。
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == HEALTH_PATH:
            data = json.dumps({"project": PROJECT_ID, "pid": os.getpid()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()


def serve(port):
    handler = functools.partial(ProjectHandler, directory=str(PROJECT_DIR))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        def terminate(_signum, _frame):
            raise SystemExit(0)

        signal.signal(signal.SIGTERM, terminate)
        server.serve_forever(poll_interval=0.2)


def main():
    parser = argparse.ArgumentParser(description="草原之夜本地服务")
    parser.add_argument("action", choices=("start", "stop", "status", "serve"))
    parser.add_argument("--port", type=int)
    parser.add_argument("--no-browser", action="store_true", help="启动时不打开浏览器")
    args = parser.parse_args()
    if args.action == "serve":
        if args.port is None:
            parser.error("serve 需要 --port")
        serve(args.port)
        return

    RUNTIME_DIR.mkdir(exist_ok=True)
    with (RUNTIME_DIR / "control.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == "start":
            start(args.no_browser)
        elif args.action == "stop":
            stop()
        else:
            state = read_state()
            if is_project_process(state) and is_ready(state):
                print("运行中：http://127.0.0.1:{}/".format(state["port"]))
            else:
                print("草原之夜未启动。")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as error:
        print("操作失败：" + str(error), file=sys.stderr)
        sys.exit(1)

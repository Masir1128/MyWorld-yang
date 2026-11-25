#!/bin/zsh
# 只关闭由启动脚本运行的本项目服务。
PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)" || exit 1

if command -v python3 >/dev/null 2>&1; then
  python3 "$PROJECT_DIR/tools/local_server.py" stop "$@"
  result=$?
else
  print '没有找到 Python 3，请安装 Python 3 后重新双击关闭。'
  result=1
fi

if (( result != 0 )) && [[ -t 0 ]]; then
  read -k 1 '?按任意键关闭此窗口……'
  print
fi
exit "$result"

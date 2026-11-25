#!/bin/zsh
# 双击启动项目；服务会在后台运行，关闭此终端窗口也能继续使用。
PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)" || exit 1

if command -v python3 >/dev/null 2>&1; then
  python3 "$PROJECT_DIR/tools/local_server.py" start "$@"
  result=$?
else
  print '没有找到 Python 3，请安装 Python 3 后重新双击启动。'
  result=1
fi

if (( result != 0 )) && [[ -t 0 ]]; then
  read -k 1 '?按任意键关闭此窗口……'
  print
fi
exit "$result"

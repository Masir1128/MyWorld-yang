#!/bin/zsh
# 打包「科学羊的世界」网站：只拷贝要公开的文件到 dist/，可以直接上传到 Cloudflare Pages / itch.io
# 用法：zsh tools/build_site.sh
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp index.html dist/
cp -R assets dist/
cp -R shared dist/
mkdir -p dist/meadow && cp meadow/index.html dist/meadow/
cp meadow/underwater.js meadow/diving.js meadow/abyssal-offline.js dist/meadow/
cp -R meadow/abyssal dist/meadow/
mkdir -p dist/meadow/models
cp meadow/models/Knight.glb dist/meadow/models/
# 第一章旁白（用户自己制作）：只带分句录音；背景音乐不打包，网页自动改用程序生成的摇篮曲
mkdir -p dist/meadow/voice/night && cp meadow/voice/night/N[0-9]*.mp3 dist/meadow/voice/night/
find dist -name ".DS_Store" -delete
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

# 每次创建全新的压缩包，防止旧版本中已删除的文件被 zip 更新模式保留下来。
temporary = Path('science-sheep-world.zip.tmp')
with ZipFile(temporary, 'w', compression=ZIP_DEFLATED) as archive:
    for path in sorted(Path('dist').rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to('dist'))
temporary.replace('science-sheep-world.zip')
PY
echo "完成：dist/ 文件夹 $(du -sh dist | cut -f1)，压缩包 science-sheep-world.zip $(du -h science-sheep-world.zip | cut -f1)"

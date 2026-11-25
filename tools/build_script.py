# -*- coding: utf-8 -*-
"""
把 tools/route_script.py 里的路线文案同步到：
  1. meadow/index.html（网页里的 ROUTE_SCRIPT）
  2. 夜晚文案.txt、白天文案.txt（纯净文案，只有要念的文字，给配音用）
  3. tools/文案时间轴（内部对照用）.html（编号、时间、地点，匹配音频时自己用）
并建好 meadow/voice/night、meadow/voice/day 两个放录音的文件夹。
用法：python3 tools/build_script.py
"""
import os, re, json, html, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('rs', os.path.join(ROOT, 'tools', 'route_script.py'))
rs = importlib.util.module_from_spec(spec); spec.loader.exec_module(rs)

def mmss(sec): return f'{int(sec) // 60:02d}:{int(sec) % 60:02d}'
CPS = 3.0   # 估算语速：轻声、慢速时每秒约 3 个字（省略号另算停顿）
def est(text): return len(re.sub(r'[，。、！？……]', '', text)) / CPS + text.count('……') * 0.9 + 1
import subprocess
def real(sub, k):   # 已经有录音时，用录音的真实时长
    f = os.path.join(ROOT, 'meadow', 'voice', sub, k + '.mp3')
    if not os.path.exists(f): return None
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip()
    return float(out) if out else None

# 1. 网页
idx = os.path.join(ROOT, 'meadow', 'index.html')
s = open(idx, encoding='utf-8').read()
data = {'version': rs.VERSION, 'night': rs.NIGHT, 'day': rs.DAY}
new = '/*ROUTE_SCRIPT_BEGIN*/const ROUTE_SCRIPT = ' + json.dumps(data, ensure_ascii=False) + ';/*ROUTE_SCRIPT_END*/'
s2, n = re.subn(r'/\*ROUTE_SCRIPT_BEGIN\*/.*?/\*ROUTE_SCRIPT_END\*/', lambda m: new, s, flags=re.S)
assert n == 1, '没找到 ROUTE_SCRIPT 标记'
open(idx, 'w', encoding='utf-8').write(s2)

# 2. 给配音用的纯净文案：只有要念的文字，段与段之间空一行（编号、时间、地点只留在 tools 里）
vdir = os.path.join(ROOT, 'meadow', 'voice')
for sub in ('night', 'day'): os.makedirs(os.path.join(vdir, sub), exist_ok=True)
for name, rows in (('夜晚文案.txt', rs.NIGHT), ('白天文案.txt', rs.DAY)):
    with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(r[4] for r in rows) + '\n')

# 3. 时间轴阅读版
def table(rows, sub):
    out = []
    for i, (k, sec, place, kind, text) in enumerate(rows):
        nxt = rows[i + 1][1] if i + 1 < len(rows) else rs.LOOP_SEC
        room, rd = nxt - sec, real(sub, k)
        need = rd if rd else est(text)
        warn = ' class="tight"' if need > room - 3 else ''
        out.append(f'<tr{warn}><td><b>{k}</b></td><td>{mmss(sec)}</td><td>{place}</td><td>{kind}</td><td>{html.escape(text)}</td>'
                   f'<td>{"录音 " if rd else "约 "}{need:.0f} 秒<br><span class="sub">可用 {room} 秒</span></td></tr>')
    return '\n'.join(out)
doc = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>星野 · 直播文案与时间轴</title>
<style>
:root{{--bg:#f7f6f2;--card:#fff;--ink:#1f2328;--sub:#6a7380;--line:#e3e1da;--accent:#2f7a5b;--warn:#b25d12}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#14171c;--card:#1b1f26;--ink:#e6e8eb;--sub:#9aa3ae;--line:#2c323b;--accent:#5cc49a;--warn:#e3a45f}}}}
:root[data-theme="dark"]{{--bg:#14171c;--card:#1b1f26;--ink:#e6e8eb;--sub:#9aa3ae;--line:#2c323b;--accent:#5cc49a;--warn:#e3a45f}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}}
main{{max-width:1000px;margin:0 auto;padding:36px 16px 80px}} h1{{font-size:28px;margin:0 0 4px}} h2{{margin:36px 0 10px;font-size:21px}}
.meta,.sub{{color:var(--sub);font-size:13px}} .wrap{{overflow-x:auto}}
table{{width:100%;border-collapse:collapse;background:var(--card);font-size:14px;min-width:720px}}
th,td{{border-bottom:1px solid var(--line);padding:8px 9px;text-align:left;vertical-align:top}} th{{position:sticky;top:0;background:var(--card)}}
td:nth-child(5){{min-width:380px}} tr.tight td:last-child{{color:var(--warn)}}
.box{{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:10px 16px;margin:12px 0}}
</style></head><body><main>
<h1>星野 · 直播文案与时间轴</h1>
<div class="meta">版本：{rs.VERSION} · 固定节奏下走一圈约 {mmss(rs.LOOP_SEC)} · 共 夜晚 {len(rs.NIGHT)} 段 / 白天 {len(rs.DAY)} 段</div>
<div class="box"><b>路线</b>：草原（出生点）→ 湖边 → 溪边 → 瀑布 → 沿溪返回 → 西边的大草原 → 山口 → 海边（礁石岬角）→ 翻回山口 → 草原（回到起点）。
<br><b>用法</b>：网页面板“漫游 / 直播”里点“从起点开始一圈”，同时开始录屏；每段文案会在表里的时间、在对应的地点开始播放。
<br><b>音频命名</b>：夜晚放 <code>meadow/voice/night/N01.mp3</code>，白天放 <code>meadow/voice/day/D01.mp3</code>。
<br><b>“约 X 秒”</b>是按轻声慢读估算的时长；橙色表示可能超过到下一段的间隔。音频生成后我会按真实时长重新核对。</div>
<h2>夜晚版</h2><div class="wrap"><table><tr><th>编号</th><th>开始</th><th>地点</th><th>类型</th><th>文案</th><th>时长</th></tr>
{table(rs.NIGHT, 'night')}</table></div>
<h2>白天版</h2><div class="wrap"><table><tr><th>编号</th><th>开始</th><th>地点</th><th>类型</th><th>文案</th><th>时长</th></tr>
{table(rs.DAY, 'day')}</table></div>
</main></body></html>'''
open(os.path.join(ROOT, 'tools', '文案时间轴（内部对照用）.html'), 'w', encoding='utf-8').write(doc)
tight = [r[0] for rows in (rs.NIGHT, rs.DAY) for i, r in enumerate(rows) if est(r[4]) > ((rows[i + 1][1] if i + 1 < len(rows) else rs.LOOP_SEC) - r[1]) - 3]
print('已同步', rs.VERSION, '| 夜晚', len(rs.NIGHT), '段，白天', len(rs.DAY), '段 | 可能偏长：', tight or '无')

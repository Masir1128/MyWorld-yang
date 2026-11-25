# -*- coding: utf-8 -*-
"""
把一整段旁白录音按文案的段落切开，保存成 N01.mp3、N02.mp3……
做法：用本机的 Whisper 识别出每个字的时间（JSON），和文案逐字对齐，找到每段开头的时间，
再在那附近最安静的地方下刀。
用法：python3 tools/split_audio.py <录音.mp3> <whisper输出.json> <night|day> <输出文件夹> [只切这些编号，如 N41,N42,N43]
"""
import sys, os, re, json, subprocess, struct, difflib, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('rs', os.path.join(ROOT, 'tools', 'route_script.py'))
rs = importlib.util.module_from_spec(spec); spec.loader.exec_module(rs)
src, asr, which, outdir = sys.argv[1:5]
rows = rs.NIGHT if which == 'night' else rs.DAY
if len(sys.argv) > 5: rows = [r for r in rows if r[0] in sys.argv[5].split(',')]   # 只切其中几段（补录时用），例如 N41,N42,N43

T2S = str.maketrans('叢藍們這裡聽說話來時們邊還遠沒會變輕', '丛蓝们这里听说话来时们边还远没会变轻')
norm = lambda s: re.sub(r'[^一-鿿]', '', s.translate(T2S))

# 识别结果：逐字时间（开始、结束）
chars = []
for seg in json.load(open(asr, encoding='utf-8'))['segments']:
    for w in seg.get('words', []):
        t = norm(w['word'])
        if not t: continue
        d = (w['end'] - w['start']) / len(t)
        for i, c in enumerate(t): chars.append((c, w['start'] + i * d, w['start'] + (i + 1) * d))
hyp = ''.join(c[0] for c in chars)

# 文案：每段开头在全文中的位置
ref, starts = '', []
for r in rows: starts.append(len(ref)); ref += norm(r[4])
bounds = starts[1:] + [len(ref)]

sm = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
ref2hyp = {}
for a_, b_, n in sm.get_matching_blocks():
    if n >= 3:   # 只信连续对上 3 个字以上的部分
        for k in range(n): ref2hyp[a_ + k] = b_ + k
CH = 0.16   # 每个字大约 0.16 秒，用来往前、往后推算
def first_time(st, en):
    for j in range(st, min(en, st + 20)):
        if j in ref2hyp: return chars[ref2hyp[j]][1] - (j - st) * CH
    return None
def last_time(st, en):
    for j in range(en - 1, max(st, en - 20) - 1, -1):
        if j in ref2hyp: return chars[ref2hyp[j]][2] + (en - 1 - j) * CH
    return None

# 音量包络（找安静处下刀）
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], capture_output=True).stdout
a = struct.unpack('<%df' % (len(pcm) // 4), pcm); SR = 8000; dur = len(a) / SR
def energy(t, w=0.05):
    i0, i1 = max(0, int((t - w) * SR)), min(len(a), int((t + w) * SR))
    return sum(x * x for x in a[i0:i1]) / max(1, i1 - i0)
def quietest(t0, t1):
    best, bt, x = 9e9, t0, t0
    while x <= t1:
        e = energy(x)
        if e < best: best, bt = e, x
        x += 0.02
    return bt

cuts, found = [], []
for i, st in enumerate(starts):
    ft = first_time(st, bounds[i])
    if ft is None: cuts.append(None); found.append(False); continue
    found.append(True)
    if i == 0: cuts.append(0.0); continue
    lt = last_time(starts[i - 1], bounds[i - 1]) if found[i - 1] else ft - 0.6
    lo, hi = min(lt, ft) - 0.05, max(lt, ft) + 0.05      # 上一段最后一个字 和 这一段第一个字 之间的空隙
    cuts.append(quietest(lo, hi))

os.makedirs(outdir, exist_ok=True)
result = []
for i, r in enumerate(rows):
    if not found[i]: result.append((r[0], None)); continue
    t0 = cuts[i]
    nxt = next((cuts[j] for j in range(i + 1, len(rows)) if found[j]), dur)
    covered = sum(1 for j in range(starts[i], starts[i + 1] if i + 1 < len(starts) else len(ref)) if j in ref2hyp) / max(1, len(norm(r[4])))
    out = os.path.join(outdir, r[0] + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-to', f'{nxt:.3f}', '-i', src,
                    '-af', 'afade=t=in:d=0.04,areverse,afade=t=in:d=0.12,areverse', '-c:a', 'libmp3lame', '-q:a', '3', out], check=True)
    result.append((r[0], round(nxt - t0, 1), round(t0, 2), round(covered, 2)))
json.dump(result, open(os.path.join(outdir, '_split.json'), 'w'), ensure_ascii=False)
for x in result: print(x)

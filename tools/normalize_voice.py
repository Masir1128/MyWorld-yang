# -*- coding: utf-8 -*-
"""
把旁白录音统一到同样的响度（默认 -18 LUFS，峰值不超过 -1.5 dB），每段一样响，也不会破音。
用法：python3 tools/normalize_voice.py meadow/voice/night [目标响度，默认 -18]
只处理 N01.mp3、D01.mp3 这类分段文件，不动原始整段录音。
"""
import sys, os, re, json, subprocess, shutil, tempfile
folder = sys.argv[1]
target = float(sys.argv[2]) if len(sys.argv) > 2 else -18.0
for name in sorted(os.listdir(folder)):
    if not re.fullmatch(r'[ND]\d\d\.mp3', name): continue
    f = os.path.join(folder, name)
    # 第一遍：测量
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', f'loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = json.loads(out[out.rindex('{'):out.rindex('}') + 1])
    # 第二遍：按测量结果线性调整
    af = (f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    tmp = tempfile.mktemp(suffix='.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-af', af, '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '3', tmp], check=True)
    shutil.move(tmp, f)
    print(f'{name}: {float(m["input_i"]):.1f} → {target:.0f} LUFS')

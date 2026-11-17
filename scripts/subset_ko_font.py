# 產生韓文字型的子集：只留 src 裡（介面文字＋韓文國名）用到的韓文字，檔案從約 230KB 變成約 44KB。
# 改了韓文字之後重跑：python3 scripts/subset_ko_font.py（需要 fonttools：pip install fonttools brotli）
import glob, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'assets', 'fonts')
SRC = 'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRound{}.woff2'

text = ''
for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.*'), recursive=True):
    if f.endswith(('.vue', '.js', 'names_jako.json')):
        text += open(f, encoding='utf-8').read()
chars = sorted({c for c in text if '가' <= c <= '힣' or 'ㄱ' <= c <= 'ㆎ'})
print(f'{len(chars)} 個韓文字')

with tempfile.TemporaryDirectory() as tmp:
    chars_file = os.path.join(tmp, 'chars.txt')
    open(chars_file, 'w', encoding='utf-8').write(''.join(chars) + '0123456789·.,:()%/-+–— ')
    for w in ('B', 'EB'):
        full = os.path.join(tmp, f'full{w}.woff2')
        subprocess.run(['curl', '-sSfL', '-o', full, SRC.format(w)], check=True) # 用 curl 下載（有些電腦的 Python 沒有憑證）
        out = os.path.join(OUT, f'NanumSquareRound{w}-sub.woff2')
        subprocess.run([sys.executable, '-m', 'fontTools.subset', full, f'--text-file={chars_file}', '--flavor=woff2', "--layout-features=*", f'--output-file={out}'], check=True)
        print(out, os.path.getsize(out), 'bytes')

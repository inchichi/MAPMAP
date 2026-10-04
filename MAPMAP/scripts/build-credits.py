"""게임 안 크레딧 화면용 저작자 표시 텍스트를 만든다.

모으는 곳:
  - src/games/my-sample-rpg/assets/tilesets/lpc/CREDITS-*.txt  (LPC 지형·동굴·식물·나무 타일)
  - src/games/my-sample-rpg/assets/characters/lpc/CREDITS.csv  (LPC 캐릭터·장비·무기)
  - licenses/*.txt, licenses/assets/*                            (폰트·Lua·기타)
출력: src/games/my-sample-rpg/assets/credits.txt (게임이 ?raw 로 읽는다)

CC-BY-SA / OGA-BY / GPL 에셋은 저작자 표시가 의무라, 에셋을 바꾸면 이 스크립트를 다시 돌린다.
"""
import csv
import glob
import os

GAME = 'src/games/my-sample-rpg'
OUT = os.path.join(GAME, 'assets/credits.txt')

parts = ['이 게임은 아래 자유 라이선스 에셋을 사용합니다. 원작자분들께 감사드립니다.', '']

# ---- LPC 캐릭터: 파일 행을 저작자·라이선스 묶음으로 합친다
rows = list(csv.reader(open(os.path.join(GAME, 'assets/characters/lpc/CREDITS.csv'), encoding='utf-8')))[1:]
groups = {}
for filename, _notes, authors, licenses, urls in rows:
    key = (authors.strip(), licenses.strip())
    entry = groups.setdefault(key, {'files': set(), 'urls': set()})
    entry['files'].add(filename.split('/')[0] + '/' + (filename.split('/')[1] if '/' in filename else ''))
    entry['urls'].update(u for u in urls.replace(',', ' ').split() if u.startswith('http'))
parts += ['■ 캐릭터·장비 (Universal LPC Spritesheet Character Generator)',
          'https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator', '']
for (authors, licenses), entry in sorted(groups.items(), key=lambda kv: sorted(kv[1]['files'])[0]):
    parts.append(f"- {', '.join(sorted(entry['files']))}")
    parts.append(f'  저작자: {authors}')
    parts.append(f'  라이선스: {licenses}')
    for url in sorted(entry['urls'])[:3]:
        parts.append(f'  {url}')
parts.append('')

# ---- LPC 타일
for path in sorted(glob.glob(os.path.join(GAME, 'assets/tilesets/lpc/CREDITS-*.txt'))):
    name = os.path.basename(path)[len('CREDITS-'):-len('.txt')]
    parts.append(f'■ 맵 타일 ({name})')
    parts.append(open(path, encoding='utf-8').read().strip())
    parts.append('')

# ---- LPC 몬스터
monster_credits = os.path.join(GAME, 'assets/monsters/lpc/CREDITS.txt')
if os.path.exists(monster_credits):
    parts.append('■ 몬스터')
    parts.append(open(monster_credits, encoding='utf-8').read().strip())
    parts.append('')

# ---- 기타 에셋·라이선스
for path in sorted(glob.glob('licenses/assets/**/SOURCE.txt', recursive=True) +
                   glob.glob('licenses/assets/**/README.md', recursive=True)):
    parts.append(f'■ {os.path.relpath(os.path.dirname(path), "licenses/assets") or "assets"}')
    parts.append(open(path, encoding='utf-8').read().strip()[:800])
    parts.append('')
for path in sorted(glob.glob('licenses/*.txt')):
    parts.append(f'■ {os.path.basename(path)[:-4]}')
    parts.append(open(path, encoding='utf-8').read().strip()[:1200])
    parts.append('')

open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(parts) + '\n')
print('wrote', OUT, len(parts), 'lines')

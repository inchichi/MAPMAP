"""마법 스킬 아이콘 생성기 — 기존 Slash/Protect 아이콘과 같은 짜임(어두운 사각 프레임 +
가운데 빛나는 효과)의 32x32 픽셀 아트를 4배(128px)로 키워 저장한다.

  Energy_bolt_skill.png    보랏빛 마력 화살
  Ice_bolt_skill.png       푸른 얼음 결정
  Fireball_skill.png       불꽃 꼬리를 단 불덩이
  Chain_lightning_skill.png 갈라지며 튀는 번개
  Multi_shot_skill.png     부채꼴로 퍼지는 화살 세 대
  Piercing_arrow_skill.png 빛줄기를 끌며 꿰뚫는 화살
  Poison_arrow_skill.png   독이 맺힌 초록 화살촉

python3 scripts/generate-magic-skill-icons.py (repo 루트에서)
"""
import math

from PIL import Image, ImageDraw, ImageFilter

OUT = 'src/games/my-sample-rpg/assets/skills/'
N, SCALE = 32, 4


def frame():
    """둥근 모서리 사각 프레임 + 안쪽 어두운 바탕."""
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=4, fill=(58, 40, 26, 255))
    d.rounded_rectangle([1, 1, N - 2, N - 2], radius=3, fill=(120, 86, 52, 255))
    d.rounded_rectangle([2, 2, N - 3, N - 3], radius=3, fill=(26, 20, 22, 255))
    return im


def glow(layer, radius, color):
    """효과 레이어를 흐리게 퍼뜨린 빛 번짐을 만든다."""
    g = Image.new('RGBA', layer.size, color + (0,))
    alpha = layer.split()[3].filter(ImageFilter.GaussianBlur(radius))
    g.putalpha(alpha.point(lambda a: min(255, int(a * 1.6))))
    return g


def compose(effect, glow_color, glow_radius=2.2):
    base = frame()
    inner = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    inner.alpha_composite(glow(effect, glow_radius, glow_color))
    inner.alpha_composite(effect)
    mask = Image.new('L', (N, N), 0)
    ImageDraw.Draw(mask).rounded_rectangle([2, 2, N - 3, N - 3], radius=3, fill=255)
    clipped = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    clipped.paste(inner, (0, 0), mask)
    base.alpha_composite(clipped)
    # 픽셀 아트처럼 알파를 끊어 준다(반투명 번짐은 4단계로)
    px = base.load()
    for y in range(N):
        for x in range(N):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0 if a < 24 else min(255, (a // 64 + 1) * 64 - 1) if a < 255 else 255)
    return base.resize((N * SCALE, N * SCALE), Image.NEAREST)


def energy_bolt():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    # 왼쪽 아래 → 오른쪽 위로 날아가는 마력 화살 + 꼬리
    for i, (w, c) in enumerate(((5, (120, 80, 230)), (3, (170, 140, 255)), (1, (235, 225, 255)))):
        d.line([(6, 25), (21, 10)], fill=c + (255,), width=w)
    d.polygon([(19, 8), (26, 6), (24, 13)], fill=(245, 240, 255, 255))
    for x, y in ((9, 19), (13, 24), (7, 14), (15, 17)):
        d.point((x, y), fill=(200, 180, 255, 255))
    return compose(e, (150, 110, 255))


def ice_bolt():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    cx, cy = 16, 16
    for k in range(6):   # 육각 눈 결정
        a = math.pi / 3 * k + math.pi / 6
        x, y = cx + math.cos(a) * 11, cy + math.sin(a) * 11
        d.line([(cx, cy), (x, y)], fill=(150, 215, 255, 255), width=3)
        d.line([(cx, cy), (x, y)], fill=(235, 250, 255, 255), width=1)
        for t in (0.55,):
            bx, by = cx + math.cos(a) * 11 * t, cy + math.sin(a) * 11 * t
            for s in (-1, 1):
                b2 = a + s * math.pi / 4
                d.line([(bx, by), (bx + math.cos(b2) * 4, by + math.sin(b2) * 4)],
                       fill=(200, 240, 255, 255), width=1)
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(240, 252, 255, 255))
    return compose(e, (90, 180, 255))


def fireball():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    # 오른쪽 위 불덩이 + 왼쪽 아래로 흩날리는 불꽃 꼬리
    for i, (r, c) in enumerate(((10, (200, 50, 20)), (8, (245, 110, 30)), (5, (255, 190, 60)), (2, (255, 245, 200)))):
        d.polygon([(20 - r * 0.2, 12 - r * 0.9), (20 + r, 12), (20 - r * 0.2, 12 + r * 0.9),
                   (20 - r * 2.0 - 2, 12 + r * 1.2 + 3)], fill=c + (255,))
        d.ellipse([20 - r * 0.8, 12 - r * 0.8, 20 + r * 0.8, 12 + r * 0.8], fill=c + (255,))
    for x, y in ((6, 26), (9, 22), (5, 21), (12, 27)):
        d.point((x, y), fill=(255, 170, 60, 255))
    return compose(e, (255, 120, 40))


def chain_lightning():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    main = [(17, 3), (12, 13), (18, 14), (11, 28)]
    branch = [(18, 14), (25, 19), (22, 21), (28, 27)]
    for pts in (main, branch):
        d.line(pts, fill=(120, 170, 255, 255), width=4, joint='curve')
        d.line(pts, fill=(255, 250, 200, 255), width=2, joint='curve')
    for x, y in ((11, 28), (28, 27)):
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 230, 255))
    return compose(e, (130, 170, 255))


def arrow(d, x0, y0, x1, y1, shaft=(150, 110, 70), head=(225, 230, 235), fletch=(235, 235, 225)):
    d.line([(x0, y0), (x1, y1)], fill=shaft + (255,), width=2)
    ang = math.atan2(y1 - y0, x1 - x0)
    tip = (x1 + math.cos(ang) * 4, y1 + math.sin(ang) * 4)
    left = (x1 + math.cos(ang + 2.4) * 4, y1 + math.sin(ang + 2.4) * 4)
    right = (x1 + math.cos(ang - 2.4) * 4, y1 + math.sin(ang - 2.4) * 4)
    d.polygon([tip, left, right], fill=head + (255,))
    for s_ in (-1, 1):
        d.line([(x0, y0), (x0 - math.cos(ang + s_ * 0.6) * 4, y0 - math.sin(ang + s_ * 0.6) * 4)],
               fill=fletch + (255,), width=1)


def multi_shot():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    for dy in (-8, 0, 8):
        arrow(d, 6, 22 + dy * 0.2, 24, 16 + dy)
    return compose(e, (255, 220, 140), 1.6)


def piercing_arrow():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    d.line([(4, 26), (26, 6)], fill=(170, 220, 255, 255), width=3)
    arrow(d, 8, 22, 24, 8, shaft=(230, 240, 255), head=(255, 255, 255))
    for x, y in ((12, 22), (18, 16)):
        d.ellipse([x - 3, y - 3, x + 3, y + 3], outline=(150, 210, 255, 255))
    return compose(e, (140, 200, 255))


def poison_arrow():
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    arrow(d, 6, 25, 23, 9, head=(120, 230, 90))
    for x, y in ((24, 15), (21, 18), (25, 20)):
        d.ellipse([x - 1, y - 1, x + 1, y + 2], fill=(140, 240, 100, 255))
    return compose(e, (110, 220, 80))


def dash():
    """돌진: 앞으로 쏠린 발자국 잔상 + 속도선."""
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    for i, (y, length) in enumerate(((9, 12), (15, 17), (21, 12))):
        d.line([(5, y), (5 + length, y)], fill=(255, 220, 150, 140 + i * 30), width=2)
    d.polygon([(18, 8), (27, 15), (18, 22), (20, 15)], fill=(255, 235, 190, 255))
    d.polygon([(12, 10), (19, 15), (12, 20), (14, 15)], fill=(255, 190, 110, 200))
    return compose(e, (255, 190, 90))


def focus():
    """집중: 푸른 마나 소용돌이와 가운데 빛."""
    e = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(e)
    import math as _m
    pts = []
    for k in range(60):
        t = k / 60 * 4 * _m.pi
        r = 2 + k * 0.19
        pts.append((16 + _m.cos(t) * r, 16 + _m.sin(t) * r))
    d.line(pts, fill=(120, 180, 255, 255), width=2)
    d.ellipse([13, 13, 19, 19], fill=(225, 240, 255, 255))
    for x, y in ((7, 8), (25, 9), (24, 25), (8, 24)):
        d.point((x, y), fill=(200, 230, 255, 255))
    return compose(e, (110, 160, 255))


for name, fn in (('Energy_bolt_skill', energy_bolt), ('Ice_bolt_skill', ice_bolt),
                 ('Fireball_skill', fireball), ('Chain_lightning_skill', chain_lightning),
                 ('Multi_shot_skill', multi_shot), ('Piercing_arrow_skill', piercing_arrow),
                 ('Poison_arrow_skill', poison_arrow), ('Dash_skill', dash), ('Focus_skill', focus)):
    fn().save(OUT + name + '.png')
    print('wrote', OUT + name + '.png')

# 옷장(캐릭터 꾸미기)의 부위 탭 아이콘 일곱을 단순한 도형으로 그린다(투명 배경, 진한 갈색 한 색).
# 쓰는 법: python scripts/lobby3d/draw-wardrobe-slot-icons.py <출력 폴더>
#   (출력은 apps/mobile/assets/icons/wardrobe-slots/에 <부위>.png로 넣는다. Pillow 필요)
# 4배로 크게 그린 뒤 줄여 가장자리를 부드럽게 한다. 앱은 고른 탭에서 tintColor로 색만 바꾼다.
import os
import sys

from PIL import Image, ImageDraw

out = sys.argv[1]
SIZE = 96
K = 4
S = SIZE * K
INK = (61, 41, 28, 255)
W = 7 * K  # 선 굵기


def canvas():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def p(*xy):
    """0~96 좌표를 4배 캔버스 좌표로."""
    return [v * K for v in xy]


def hat(d):
    # 야구모자: 둥근 머리 부분과 오른쪽으로 내민 챙
    d.chord(p(10, 24, 66, 80), 180, 360, fill=INK)
    d.rounded_rectangle(p(10, 48, 66, 58), radius=4 * K, fill=INK)
    d.rounded_rectangle(p(50, 50, 92, 60), radius=5 * K, fill=INK)
    d.ellipse(p(33, 19, 43, 29), fill=INK)


def top(d):
    d.polygon(p(30, 18, 40, 18, 48, 26, 56, 18, 66, 18, 88, 32, 80, 46, 70, 40, 70, 80, 26, 80, 26, 40, 16, 46, 8, 32), fill=INK)


def bottom(d):
    d.polygon(p(22, 20, 74, 20, 82, 74, 56, 74, 48, 44, 40, 74, 14, 74), fill=INK)


def shoes(d):
    # 옆에서 본 운동화: 왼쪽이 뒤꿈치, 오른쪽이 앞코
    d.polygon(p(14, 30, 36, 30, 44, 44, 66, 48, 82, 54, 88, 62, 88, 70, 12, 70, 12, 34), fill=INK)
    d.rounded_rectangle(p(8, 66, 90, 78), radius=5 * K, fill=INK)
    d.line(p(46, 46, 54, 38), fill=(0, 0, 0, 0), width=3 * K)


def face(d):
    d.ellipse(p(8, 34, 42, 66), outline=INK, width=W)
    d.ellipse(p(54, 34, 88, 66), outline=INK, width=W)
    d.arc(p(38, 40, 58, 56), 200, 340, fill=INK, width=W)


def back(d):
    d.arc(p(34, 10, 62, 34), 180, 360, fill=INK, width=W)
    d.rounded_rectangle(p(20, 22, 76, 86), radius=14 * K, fill=INK)
    d.rounded_rectangle(p(32, 52, 64, 74), radius=6 * K, fill=(0, 0, 0, 0), outline=(255, 255, 255, 0))
    hole = Image.new("L", (S, S), 0)
    ImageDraw.Draw(hole).rounded_rectangle(p(32, 54, 64, 72), radius=5 * K, outline=255, width=4 * K)
    return hole


def accessory(d):
    # 목걸이: 목에 거는 줄과 아래 펜던트
    d.arc(p(10, -14, 86, 66), 15, 165, fill=INK, width=W)
    d.ellipse(p(35, 56, 61, 82), fill=INK)
    d.line(p(48, 62, 48, 62), fill=INK)


os.makedirs(out, exist_ok=True)
for name, draw in [("hat", hat), ("top", top), ("bottom", bottom), ("shoes", shoes), ("face", face), ("back", back), ("accessory", accessory)]:
    im, d = canvas()
    hole = draw(d)
    if hole is not None:
        # 가방 주머니 선은 지워서 비운다
        im.putalpha(Image.composite(Image.new("L", (S, S), 0), im.getchannel("A"), hole))
    im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(out, name + ".png"))
    print("icon", name)

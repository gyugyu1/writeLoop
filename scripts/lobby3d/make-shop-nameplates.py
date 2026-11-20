"""가구점 진열 상품의 명패 글자 그림(PNG)을 만든다.

서버 아이템 목록(apps/backend/src/main/resources/catalog/items.json)에서 files.nameplate가 있는 아이템마다
지금 한국어 이름(name)을 가운데 맞춤으로 쓴 그림을 같은 폴더의 files/<nameplate>에 쓴다.
앱은 이 그림을 가구점 진열대 명패(받침 윗면, 가로 1.0 × 세로 0.2m 판)에 붙인다(apps/mobile/src/components/lobby3d/lobby3d-shop.tsx).
상품 이름을 바꾸거나 상품을 더하면 이 스크립트를 다시 돌린다.

그림: 1000 × 200 픽셀(가로 5 : 세로 1), 투명 배경, 어두운 갈색 글자. 글자는 판 가운데 가로 960·세로 150 픽셀 안에 들게 맞춘다
(매장 모델에 새겨진 글자 메시의 크기: 가로 최대 0.96, 세로 0.15m).
글꼴: Noto Sans KR(SIL Open Font License). 기본은 Windows의 C:/Windows/Fonts/NotoSansKR-VF.ttf이고, --font로 다른 경로를 줄 수 있다.

쓰는 법(저장소 루트에서): python scripts/lobby3d/make-shop-nameplates.py [--font <ttf 경로>]
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "apps" / "backend" / "src" / "main" / "resources" / "catalog"
WIDTH, HEIGHT = 1000, 200
MAX_TEXT_WIDTH, MAX_TEXT_HEIGHT = 960, 150
TEXT_COLOR = (74, 46, 31, 255)
DEFAULT_FONT = "C:/Windows/Fonts/NotoSansKR-VF.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(path, size)
    try:
        font.set_variation_by_name("Bold")
    except (OSError, ValueError):
        pass  # 가변 글꼴이 아니면 그대로 쓴다
    return font


def fitted_font(path: str, text: str) -> ImageFont.FreeTypeFont:
    """글자가 MAX_TEXT_WIDTH × MAX_TEXT_HEIGHT 안에 드는 가장 큰 크기."""
    probe = ImageDraw.Draw(Image.new("RGBA", (WIDTH, HEIGHT)))
    size = MAX_TEXT_HEIGHT
    while size > 10:
        font = load_font(path, size)
        left, top, right, bottom = probe.textbbox((0, 0), text, font=font)
        if right - left <= MAX_TEXT_WIDTH and bottom - top <= MAX_TEXT_HEIGHT:
            return font
        size -= 2
    return load_font(path, size)


def render(text: str, font_path: str) -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    font = fitted_font(font_path, text)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    x = (WIDTH - (right - left)) / 2 - left
    y = (HEIGHT - (bottom - top)) / 2 - top
    draw.text((x, y), text, font=font, fill=TEXT_COLOR)
    return image


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--font", default=DEFAULT_FONT)
    args = parser.parse_args()
    items = json.loads((CATALOG / "items.json").read_text(encoding="utf-8"))["items"]
    made = 0
    for item in items:
        name_file = (item.get("files") or {}).get("nameplate")
        if not name_file:
            continue
        out = CATALOG / "files" / name_file
        # 그림 내용이 같으면 파일 해시가 같도록 메타데이터 없이 쓴다
        render(item["name"], args.font).save(out, format="PNG", optimize=True)
        print(f"{item['id']}: {item['name']} -> {out.relative_to(ROOT).as_posix()}")
        made += 1
    print(f"명패 그림 {made}장")


if __name__ == "__main__":
    main()

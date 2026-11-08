"""Convert the selected concept to Windows icon sizes (Python 3 + Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / 'design/icon-concepts/redia-v1/C-ribbon-r.png'
target = root / 'assets'
target.mkdir(exist_ok=True)
image = Image.open(str(source)).convert('RGBA')
image = image.resize((512, 512), Image.LANCZOS)
image.save(str(target / 'app-icon.png'))
image.save(str(target / 'app-icon.ico'), sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
icon = Image.open(str(target / 'app-icon.ico'))
assert icon.ico.sizes() == {(s, s) for s in (16, 24, 32, 48, 64, 128, 256)}
print('ICON_OK: PNG 512; ICO 16/24/32/48/64/128/256')

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
assets.mkdir(exist_ok=True)
size = 1024
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((22, 22, 1002, 1002), radius=255, fill='#f4c451')
draw.rounded_rectangle((330, 255, 755, 770), radius=115, fill='#17161d')
draw.rectangle((257, 385, 400, 640), fill='#17161d')
draw.rounded_rectangle((470, 420, 610, 605), radius=65, fill='#f4c451')
image.save(assets / 'icon.png')
image.save(assets / 'icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
image.save(assets / 'icon.icns')
image.resize((32, 32), Image.Resampling.LANCZOS).save(assets / 'tray.png')

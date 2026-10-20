from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
assets.mkdir(exist_ok=True)
size = 1024
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))

# Put the bright yellow in the camera mark itself. macOS can render Dock icons
# with a dark/tinted appearance, where a yellow field and near-black mark become
# hard to distinguish. A dark field with a yellow camera preserves that contrast.
background = Image.new('RGBA', (size, size), (0, 0, 0, 0))
background_draw = ImageDraw.Draw(background)
background_draw.rounded_rectangle((20, 20, 1004, 1004), radius=255, fill='#211e28', outline='#564c5b', width=12)
image.alpha_composite(background)
draw = ImageDraw.Draw(image)

# Camera body and side grip use a warm golden gradient, clipped to the silhouette.
camera_mask = Image.new('L', (size, size), 0)
mask_draw = ImageDraw.Draw(camera_mask)
mask_draw.rounded_rectangle((320, 270, 770, 760), radius=125, fill=255)
mask_draw.rounded_rectangle((238, 410, 385, 630), radius=32, fill=255)
camera = Image.new('RGBA', (size, size), (0, 0, 0, 0))
camera_pixels = camera.load()
top = (255, 225, 85)
bottom = (255, 177, 20)
for y in range(250, 780):
    t = (y - 250) / 530
    color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,)
    for x in range(220, 790):
        if camera_mask.getpixel((x, y)):
            camera_pixels[x, y] = color
image.alpha_composite(camera)
draw = ImageDraw.Draw(image)

# A pale lens rim and dark glass keep the camera readable at Dock sizes.
draw.ellipse((400, 382, 690, 672), fill='#fff3c4')
draw.ellipse((430, 412, 660, 642), fill='#f4ad1f')
draw.ellipse((455, 437, 635, 617), fill='#211e28')
draw.ellipse((481, 461, 547, 527), fill='#fff1b5')
draw.ellipse((497, 477, 531, 511), fill='#fffaf0')
image.save(assets / 'icon.png')
image.save(assets / 'icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
image.save(assets / 'icon.icns')

iconset = assets / 'icon.iconset'
iconset.mkdir(exist_ok=True)
for name, pixels in [
    ('icon_16x16.png', 16),
    ('icon_16x16@2x.png', 32),
    ('icon_32x32.png', 32),
    ('icon_32x32@2x.png', 64),
    ('icon_128x128.png', 128),
    ('icon_128x128@2x.png', 256),
    ('icon_256x256.png', 256),
    ('icon_256x256@2x.png', 512),
    ('icon_512x512.png', 512),
    ('icon_512x512@2x.png', 1024),
]:
    image.resize((pixels, pixels), Image.Resampling.LANCZOS).save(iconset / name)

# Keep the compact menu-bar glyph's established yellow background/black camera.
tray = Image.new('RGBA', (size, size), (0, 0, 0, 0))
tray_draw = ImageDraw.Draw(tray)
tray_draw.rounded_rectangle((22, 22, 1002, 1002), radius=255, fill='#f4c451')
tray_draw.rounded_rectangle((330, 255, 755, 770), radius=115, fill='#17161d')
tray_draw.rectangle((257, 385, 400, 640), fill='#17161d')
tray_draw.rounded_rectangle((470, 420, 610, 605), radius=65, fill='#f4c451')
tray.resize((32, 32), Image.Resampling.LANCZOS).save(assets / 'tray.png')

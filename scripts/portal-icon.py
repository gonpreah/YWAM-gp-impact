"""The GP Portal's icon: an open door on the portal's black, the YWAM GP spark — drawn in the GP Tasks icon's flat style."""
from PIL import Image, ImageDraw
import math, sys

INK = (0, 0, 0)          # the portal's page
PAPER = (250, 246, 240)  # Paper #FAF6F0
COBALT = (31, 68, 255)   # Cobalt #1F44FF
MARIGOLD = (255, 179, 35)
DEEP = (16, 38, 160)     # a darker cobalt for the door's inner side

def spark(d, cx, cy, r, fill):
    pts = []
    for i in range(8):
        a = -math.pi / 2 + i * math.pi / 4
        rr = r if i % 2 == 0 else r * 0.34
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def draw(size, scale_art=1.0):
    S = 4 * size
    im = Image.new('RGB', (S, S), INK)
    d = ImageDraw.Draw(im)
    k = S / 512.0
    def T(x, y):   # art is drawn on a 512 grid, then shrunk around the centre for the maskable one
        return (256 + (x - 256) * scale_art) * k, (256 + (y - 256) * scale_art) * k
    def R(v): return v * scale_art * k
    # the doorway: an arch, its frame in cobalt, the light inside in paper
    left, right, top, bottom = 150, 362, 116, 410
    rad = (right - left) / 2
    cx = (left + right) / 2
    # frame (cobalt), a little bigger
    fpad = 18
    x0, y0 = T(left - fpad, top + rad); x1, y1 = T(right + fpad, bottom)
    d.rectangle([x0, y0, x1, y1], fill=COBALT)
    ax0, ay0 = T(cx - rad - fpad, top - fpad); ax1, ay1 = T(cx + rad + fpad, top - fpad + 2 * (rad + fpad))
    d.ellipse([ax0, ay0, ax1, ay1], fill=COBALT)
    # the opening: paper light
    x0, y0 = T(left, top + rad); x1, y1 = T(right, bottom)
    d.rectangle([x0, y0, x1, y1], fill=PAPER)
    ax0, ay0 = T(cx - rad, top); ax1, ay1 = T(cx + rad, top + 2 * rad)
    d.ellipse([ax0, ay0, ax1, ay1], fill=PAPER)
    # the door, swung open inwards: a dark cobalt leaf against the left jamb
    leaf = [T(left, top + rad - 40), T(left + 70, top + rad - 6), T(left + 70, bottom - 26), T(left, bottom)]
    d.polygon(leaf, fill=DEEP)
    kx, ky = T(left + 52, (top + rad + bottom) / 2 + 10)
    d.ellipse([kx - R(9), ky - R(9), kx + R(9), ky + R(9)], fill=MARIGOLD)   # its handle
    # the step out: a paper path widening towards us
    path = [T(cx - 40, bottom), T(cx + 92, bottom), T(cx + 150, 470), T(cx - 70, 470)]
    d.polygon(path, fill=(200, 196, 190))
    # the spark, top right, as on GP Tasks
    sx, sy = T(398, 120)
    spark(d, sx, sy, R(56), MARIGOLD)
    return im.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
draw(512).save(out + '/portal-512.png', optimize=True)
draw(180).save(out + '/portal-180.png', optimize=True)
draw(512, 0.78).save(out + '/portal-maskable-512.png', optimize=True)
print('ok')

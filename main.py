import pygame, random, sys

pygame.init()
BLOCK = 40
COLS, ROWS = 10, 20
WIDTH, HEIGHT = COLS * BLOCK, ROWS * BLOCK
INFO_WIDTH = 220
screen = pygame.display.set_mode((WIDTH + INFO_WIDTH, HEIGHT))
pygame.display.set_caption("Cat Tetris (Mouse Buttons, Replay R)")
clock = pygame.time.Clock()
font = pygame.font.SysFont("consolas", 22, bold=True)
info_center_x = WIDTH + INFO_WIDTH // 2

bg_start = pygame.image.load("start_bg.png").convert()
bg_start = pygame.transform.scale(bg_start, (WIDTH + INFO_WIDTH, HEIGHT))
bg_gameover = pygame.image.load("gameover_bg.png").convert()
bg_gameover = pygame.transform.scale(bg_gameover, (WIDTH + INFO_WIDTH, HEIGHT))
bg_game = pygame.image.load("background.png").convert()
bg_game = pygame.transform.scale(bg_game, (WIDTH + INFO_WIDTH, HEIGHT))

cat_img = pygame.image.load("cat.png").convert_alpha()
cat_img = pygame.transform.scale(cat_img, (BLOCK, BLOCK))

COLORS = [(0,255,255),(0,0,255),(255,165,0),(255,255,0),(0,255,0),(128,0,128),(255,0,0)]
SHAPES = [
    [[1,1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
    [[1,1],[1,1]], [[0,1,1],[1,1,0]], [[0,1,0],[1,1,1]], [[1,1,0],[0,1,1]]
]

BLACK = (0,0,0)
GRAY = (60,60,60)
WHITE = (255,255,255)
LIGHT_GRAY = (120,120,120)

bg_brightness = 0
dragging = False
slider_width = 200
slider_height = 20
slider_rect = pygame.Rect(WIDTH + 10, HEIGHT - 50, slider_width, slider_height)
slider_knob = pygame.Rect(slider_rect.x, slider_rect.y-5, 10, slider_height+10)
slider_knob.x = slider_rect.x

def new_piece():
    i = random.randint(0,len(SHAPES)-1)
    return {'shape': SHAPES[i], 'color': COLORS[i], 'x': COLS//2-2, 'y':0}

def valid_position(grid, shape, x, y):
    for j,row in enumerate(shape):
        for i,cell in enumerate(row):
            if cell:
                if i+x<0 or i+x>=COLS or j+y>=ROWS: return False
                if j+y>=0 and grid[j+y][i+x]: return False
    return True

def clear_lines(grid):
    new_grid = [row for row in grid if any(cell==0 for cell in row)]
    cleared = ROWS - len(new_grid)
    return [[0]*COLS for _ in range(cleared)] + new_grid, cleared

def hard_drop(grid, piece):
    y = piece['y']
    while valid_position(grid, piece['shape'], piece['x'], y+1): y += 1
    piece['y'] = y

def ghost_position(grid, piece):
    y = piece['y']
    while valid_position(grid, piece['shape'], piece['x'], y+1): y += 1
    return y

def tint_image(image, color):
    img = image.copy()
    color_surf = pygame.Surface(img.get_size()).convert_alpha()
    color_surf.fill(color + (255,))
    img.blit(color_surf, (0,0), special_flags=pygame.BLEND_RGBA_MULT)
    return img

def draw_piece(piece, offset_x=0, offset_y=0, alpha=255, scale=BLOCK):
    board_mode = (offset_x == 0 and offset_y == 0)
    for j,row in enumerate(piece['shape']):
        for i,cell in enumerate(row):
            if not cell: continue
            img = pygame.transform.scale(cat_img, (scale, scale))
            img = tint_image(img, piece['color'])
            img.set_alpha(alpha)
            x = (piece['x'] + i) * BLOCK if board_mode else offset_x + i*scale
            y = (piece['y'] + j) * BLOCK if board_mode else offset_y + j*scale
            screen.blit(img, (x, y))

def get_bg_color():
    return (bg_brightness, bg_brightness, bg_brightness)

def draw_button_modern(text, center_y, mouse_pos=None, width=180, height=50):
    rect = pygame.Rect(0,0,width,height)
    rect.center = (info_center_x - 200, center_y)
    hover = mouse_pos and rect.collidepoint(mouse_pos)
    color_bg = (255,140,0) if hover else (255,165,0)
    color_shadow = (100,100,100)
    shadow_rect = rect.copy()
    shadow_rect.x += 3
    shadow_rect.y += 3
    pygame.draw.rect(screen, color_shadow, shadow_rect, border_radius=12)
    pygame.draw.rect(screen, color_bg, rect, border_radius=12)
    surf = font.render(text, True, WHITE)
    surf_rect = surf.get_rect(center=rect.center)
    screen.blit(surf, surf_rect)
    return rect

def start_screen():
    while True:
        screen.blit(bg_start, (0,0))
        mx,my = pygame.mouse.get_pos()
        btn_start = draw_button_modern("START", HEIGHT//2, (mx,my))
        btn_exit  = draw_button_modern("EXIT", HEIGHT//2 + 70, (mx,my))
        pygame.display.flip()
        for e in pygame.event.get():
            if e.type==pygame.QUIT: pygame.quit(); sys.exit()
            elif e.type==pygame.KEYDOWN:
                if e.key==pygame.K_RETURN: return
                elif e.key==pygame.K_ESCAPE: pygame.quit(); sys.exit()
            elif e.type==pygame.MOUSEBUTTONDOWN:
                if btn_start.collidepoint(e.pos): return
                if btn_exit.collidepoint(e.pos): pygame.quit(); sys.exit()

def game_over_screen(score):
    while True:
        screen.blit(bg_gameover, (0,0))
        mx,my = pygame.mouse.get_pos()
        btn_replay = draw_button_modern("REPLAY", HEIGHT//2, (mx,my))
        btn_exit   = draw_button_modern("EXIT", HEIGHT//2 + 70, (mx,my))
        pygame.display.flip()
        for e in pygame.event.get():
            if e.type==pygame.QUIT: pygame.quit(); sys.exit()
            elif e.type==pygame.KEYDOWN:
                if e.key == pygame.K_r: return True
                elif e.key == pygame.K_ESCAPE: pygame.quit(); sys.exit()
            elif e.type==pygame.MOUSEBUTTONDOWN:
                if btn_replay.collidepoint(e.pos): return True
                if btn_exit.collidepoint(e.pos): pygame.quit(); sys.exit()

def play_game():
    global dragging, bg_brightness
    grid = [[0]*COLS for _ in range(ROWS)]
    current = new_piece()
    next_piece = new_piece()
    drop_time, delay = 0, 500
    score = 0
    next_block_size = 50

    while True:
        now = pygame.time.get_ticks()
        for event in pygame.event.get():
            if event.type==pygame.QUIT: pygame.quit(); sys.exit()
            elif event.type==pygame.KEYDOWN:
                shape = current['shape']
                if event.key in (pygame.K_LEFT, pygame.K_a):
                    if valid_position(grid, shape, current['x']-1, current['y']):
                        current['x'] -= 1
                elif event.key in (pygame.K_RIGHT, pygame.K_d):
                    if valid_position(grid, shape, current['x']+1, current['y']):
                        current['x'] += 1
                elif event.key in (pygame.K_UP, pygame.K_e):
                    rotated = [list(row)[::-1] for row in zip(*shape)]
                    if valid_position(grid, rotated, current['x'], current['y']):
                        current['shape'] = rotated
                elif event.key==pygame.K_q:
                    rotated = [list(row) for row in zip(*shape[::-1])]
                    if valid_position(grid, rotated, current['x'], current['y']):
                        current['shape'] = rotated
                elif event.key==pygame.K_SPACE:
                    hard_drop(grid, current)
                elif event.key==pygame.K_r:
                    return 'replay'
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if slider_knob.collidepoint(event.pos): dragging = True
            elif event.type == pygame.MOUSEBUTTONUP:
                dragging = False
            elif event.type == pygame.MOUSEMOTION and dragging:
                slider_knob.x = max(slider_rect.x, min(event.pos[0], slider_rect.right - slider_knob.width))
                bg_brightness = int(255 * ((slider_knob.x - slider_rect.x) / (slider_rect.width - slider_knob.width)))

        if now - drop_time > delay:
            drop_time = now
            if valid_position(grid, current['shape'], current['x'], current['y']+1):
                current['y'] += 1
            else:
                for j,row in enumerate(current['shape']):
                    for i,cell in enumerate(row):
                        if cell:
                            grid[current['y']+j][current['x']+i] = current['color']
                grid, cleared = clear_lines(grid)
                score += cleared*100
                current = next_piece
                next_piece = new_piece()
                if not valid_position(grid, current['shape'], current['x'], current['y']):
                    return score

        ghost_y = ghost_position(grid, current)
        ghost_piece = current.copy()
        ghost_piece['y'] = ghost_y

        bg_tinted = bg_game.copy()
        overlay = pygame.Surface(bg_tinted.get_size()).convert_alpha()
        overlay.fill((bg_brightness, bg_brightness, bg_brightness, 0))
        bg_tinted.blit(overlay, (0,0), special_flags=pygame.BLEND_RGBA_MULT)
        screen.blit(bg_tinted, (0,0))

        for y,row in enumerate(grid):
            for x,cell in enumerate(row):
                if cell: draw_piece({'shape':[[1]],'x':x,'y':y,'color':cell})

        draw_piece(ghost_piece, alpha=70)
        draw_piece(current)

        pygame.draw.rect(screen, GRAY, (WIDTH,0,INFO_WIDTH,HEIGHT))
        screen.blit(font.render(f"Score: {score}", True, WHITE), (WIDTH+20,30))
        screen.blit(font.render("Next:", True, WHITE), (WIDTH+20,80))
        piece_width = len(next_piece['shape'][0]) * next_block_size
        offset_x = WIDTH + (INFO_WIDTH - piece_width)//2
        offset_y = 120
        draw_piece(next_piece, offset_x, offset_y, alpha=255, scale=next_block_size)

        controls = ["Controls:","A / ← : Move Left","D / → : Move Right","Q : Rotate Left",
                    "E / ↑ : Rotate Right","SPACE : Hard Drop","R : Replay"]
        for i,line in enumerate(controls):
            screen.blit(font.render(line, True, WHITE), (WIDTH+20,250+i*25))

        for x in range(COLS):
            pygame.draw.line(screen,(40,40,40),(x*BLOCK,0),(x*BLOCK,HEIGHT))
        for y in range(ROWS):
            pygame.draw.line(screen,(40,40,40),(0,y*BLOCK),(WIDTH,y*BLOCK))

        screen.blit(font.render("BRIGHTNESS", True, WHITE), (slider_rect.x, slider_rect.y-25))
        pygame.draw.rect(screen, LIGHT_GRAY, slider_rect)
        pygame.draw.rect(screen, WHITE, slider_knob)

        pygame.display.flip()
        clock.tick(30)

while True:
    start_screen()
    result = play_game()
    if result == 'replay': continue
    replay = game_over_screen(result)
    if not replay: break

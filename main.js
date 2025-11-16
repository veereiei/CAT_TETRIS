// --- Game Constants (เทียบเท่ากับส่วนบนของ Python) ---
const BLOCK = 40;
const COLS = 10;
const ROWS = 20;
const WIDTH = COLS * BLOCK;
const HEIGHT = ROWS * BLOCK;
const INFO_WIDTH = 220;
const CANVAS_WIDTH = WIDTH + INFO_WIDTH;
const CANVAS_HEIGHT = HEIGHT;
const DROP_DELAY = 500; // milliseconds

// --- Colors and Shapes ---
const COLORS = [
    'rgb(0,255,255)',  // I
    'rgb(0,0,255)',    // J
    'rgb(255,165,0)',  // L
    'rgb(255,255,0)',  // O
    'rgb(0,255,0)',    // S
    'rgb(128,0,128)',  // T
    'rgb(255,0,0)'     // Z
];
const SHAPES = [
    [[1, 1, 1, 1]], 
    [[1, 0, 0], [1, 1, 1]], 
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1], [1, 1]], 
    [[0, 1, 1], [1, 1, 0]], 
    [[0, 1, 0], [1, 1, 1]], 
    [[1, 1, 0], [0, 1, 1]]
];

const BLACK = 'rgb(0,0,0)';
const GRAY = 'rgb(60,60,60)';
const WHITE = 'rgb(255,255,255)';

// --- Canvas Setup ---
const canvas = document.createElement('canvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
ctx.font = 'bold 22px consolas';

// --- Global Game State ---
let gameState = 'start'; // 'start', 'playing', 'gameover'
let grid = [];
let currentPiece;
let nextPiece;
let score = 0;
let lastDropTime = 0;

// --- Asset Loading ---
const bgStart = new Image(); bgStart.src = 'pic/start_bg.png';
const bgGameover = new Image(); bgGameover.src = 'pic/gameover_bg.png';
const bgGame = new Image(); bgGame.src = 'pic/background.png';
const catImg = new Image(); catImg.src = 'pic/cat.png';

let assetsLoaded = 0;
const totalAssets = 4;
[bgStart, bgGameover, bgGame, catImg].forEach(img => {
    img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            mainLoop(0);
        }
    };
});

// --- Info Panel Setup ---
const infoCenterX = WIDTH + INFO_WIDTH / 2;
const nextBlockSize = 50;

// --- Helper Functions ---

/** Creates a new random Tetris piece. */
function newPiece() {
    const i = Math.floor(Math.random() * SHAPES.length);
    return { shape: SHAPES[i], color: COLORS[i], x: COLS / 2 - 2, y: 0 };
}

/** Checks if a piece is in a valid position on the grid. */
function validPosition(grid, shape, x, y) {
    for (let j = 0; j < shape.length; j++) {
        for (let i = 0; i < shape[j].length; i++) {
            if (shape[j][i]) {
                const newX = i + x;
                const newY = j + y;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
                if (newY >= 0 && grid[newY] && grid[newY][newX]) return false;
            }
        }
    }
    return true;
}

/** Clears completed lines and updates the grid. */
function clearLines(grid) {
    let newGrid = grid.filter(row => row.some(cell => cell === 0));
    const cleared = ROWS - newGrid.length;
    const emptyRow = Array(COLS).fill(0);
    for (let i = 0; i < cleared; i++) {
        newGrid.unshift(emptyRow.slice());
    }
    return [newGrid, cleared];
}

/** Calculates the y-position for the ghost piece. */
function ghostPosition(grid, piece) {
    let y = piece.y;
    while (validPosition(grid, piece.shape, piece.x, y + 1)) {
        y++;
    }
    return y;
}

/** Executes a hard drop for the current piece. */
function hardDrop(grid, piece) {
    piece.y = ghostPosition(grid, piece);
}

/** Rotates a shape 90 degrees clockwise. */
function rotateClockwise(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            newShape[i][rows - 1 - j] = shape[j][i];
        }
    }
    return newShape;
}

/** Rotates a shape 90 degrees counter-clockwise. */
function rotateCounterClockwise(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            newShape[cols - 1 - i][j] = shape[j][i];
        }
    }
    return newShape;
}

/**
 * Draws a piece (or a single block) on the canvas, using a tinted cat image.
 * Uses Alpha 0.4 for tinting color to make the blocks appear very faded.
 */
function drawPiece(piece, offset_x = 0, offset_y = 0, alpha = 255, scale = BLOCK) {
    const boardMode = (offset_x === 0 && offset_y === 0);
    const color = piece.color;
    
    // แยกค่า R, G, B
    const r = parseInt(color.match(/\d+/g)[0]);
    const g = parseInt(color.match(/\d+/g)[1]);
    const b = parseInt(color.match(/\d+/g)[2]);
    const alphaFloat = alpha / 255;
    
    // สร้าง Canvas ชั่วคราวสำหรับการย้อมสี
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scale;
    tempCanvas.height = scale;
    const tctx = tempCanvas.getContext('2d');
    
    for (let j = 0; j < piece.shape.length; j++) {
        for (let i = 0; i < piece.shape[j].length; i++) {
            if (!piece.shape[j][i]) continue;
            
            let x = (piece.x + i) * BLOCK;
            let y = (piece.y + j) * BLOCK;
            
            if (!boardMode) { 
                x = offset_x + i * scale;
                y = offset_y + j * scale;
            }

            // 1. วาดรูปแมวต้นฉบับ
            tctx.clearRect(0, 0, scale, scale);
            tctx.globalCompositeOperation = 'source-over';
            tctx.drawImage(catImg, 0, 0, scale, scale); 

            // 2. ย้อมสีรูปแมว: ใช้ Alpha 0.4 
            tctx.globalCompositeOperation = 'source-atop'; 
            tctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`; // **ปรับความจางเป็น 0.4**
            tctx.fillRect(0, 0, scale, scale); 

            // 3. วาดรูปแมวที่ถูกย้อมสีแล้วลงบน Canvas หลัก
            ctx.globalAlpha = alphaFloat;
            ctx.drawImage(tempCanvas, x, y);
            ctx.globalAlpha = 1; 
        }
    }
}


// --- Drawing Functions ---

/** Draws a "modern" button. */
function drawButtonModern(text, center_y, mouse_pos = null, width = 180, height = 50) {
    const x = infoCenterX - 200 - width / 2;
    const y = center_y - height / 2;
    const rect = { x, y, w: width, h: height };

    let hover = false;
    if (mouse_pos) {
        hover = mouse_pos.x >= rect.x && mouse_pos.x <= rect.x + rect.w &&
                mouse_pos.y >= rect.y && mouse_pos.y <= rect.y + rect.h;
    }

    const colorBg = hover ? 'rgb(255,140,0)' : 'rgb(255,165,0)';

    // Shadow
    const shadowOffset = 3;
    ctx.fillStyle = 'rgb(100,100,100)';
    roundRect(ctx, rect.x + shadowOffset, rect.y + shadowOffset, rect.w, rect.h, 12);
    
    // Main button
    ctx.fillStyle = colorBg;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);

    // Text
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.x + rect.w / 2, center_y);
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'alphabetic'; 

    return rect;
}

/** Draws a rounded rectangle. */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

/** Draws the start screen. (ไม่มีปุ่ม EXIT) */
function drawStartScreen(mouse_pos) {
    ctx.drawImage(bgStart, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const btnStart = drawButtonModern("START", HEIGHT / 2, mouse_pos);
    return { btnStart }; 
}

/** Draws the game over screen. (ปุ่ม EXIT กลับไปหน้า Start) */
function drawGameOverScreen(score, mouse_pos) {
    ctx.drawImage(bgGameover, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const btnReplay = drawButtonModern("REPLAY", HEIGHT / 2, mouse_pos);
    const btnExit = drawButtonModern("EXIT", HEIGHT / 2 + 70, mouse_pos);
    
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.fillText(`Your Score : ${score}`, CANVAS_WIDTH / 2, HEIGHT / 2 - 70);
    ctx.textAlign = 'left';

    return { btnReplay, btnExit };
}

/** Draws the main game scene. */
function drawGame() {
    // 1. Draw Background
    ctx.drawImage(bgGame, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw landed pieces
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (grid[y][x]) {
                drawPiece({ shape: [[1]], x: x, y: y, color: grid[y][x] });
            }
        }
    }

    // 3. Draw Ghost and Current Piece
    if (currentPiece) {
        const ghostY = ghostPosition(grid, currentPiece);
        const ghostPiece = { ...currentPiece, y: ghostY };
        drawPiece(ghostPiece, 0, 0, 70); 
        drawPiece(currentPiece);         
    }

    // 4. Draw Info Panel Background
    ctx.fillStyle = GRAY;
    ctx.fillRect(WIDTH, 0, INFO_WIDTH, HEIGHT);

    // 5. Draw Score & Next Piece Text
    ctx.fillStyle = WHITE;
    ctx.fillText(`Score: ${score}`, WIDTH + 20, 30);
    ctx.fillText("Next:", WIDTH + 20, 80);

    // 6. Draw Next Piece Preview
    if (nextPiece) {
        const pieceWidth = nextPiece.shape[0].length * nextBlockSize;
        const offset_x = WIDTH + (INFO_WIDTH - pieceWidth) / 2;
        const offset_y = 120;
        drawPiece(nextPiece, offset_x, offset_y, 255, nextBlockSize);
    }

    // 7. Draw Controls
    const controls = ["Controls:", "A / ← : Move Left", "D / → : Move Right", "Q : Rotate Left",
                      "E / ↑ : Rotate Right", "SPACE : Hard Drop", "R : Replay"];
    ctx.fillStyle = WHITE;
    controls.forEach((line, i) => {
        ctx.fillText(line, WIDTH + 20, 250 + i * 25);
    });

    // 8. Draw Grid Lines
    ctx.strokeStyle = 'rgb(40,40,40)';
    ctx.lineWidth = 1;
    for (let x = 0; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK, 0);
        ctx.lineTo(x * BLOCK, HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK);
        ctx.lineTo(WIDTH, y * BLOCK);
        ctx.stroke();
    }
    
    // 9. ไม่มี Brightness Slider
}

// --- Game Logic ---

/** Initializes/Resets the game state. */
function initGame() {
    grid = Array(ROWS).fill(0).map(() => Array(COLS).fill(0));
    currentPiece = newPiece();
    nextPiece = newPiece();
    score = 0;
    lastDropTime = 0;
    gameState = 'playing';
}

/** Processes game state updates. */
function updateGame(timestamp) {
    if (timestamp - lastDropTime > DROP_DELAY) {
        lastDropTime = timestamp;
        
        if (validPosition(grid, currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
        } else {
            for (let j = 0; j < currentPiece.shape.length; j++) {
                for (let i = 0; i < currentPiece.shape[j].length; i++) {
                    if (currentPiece.shape[j][i]) {
                        grid[currentPiece.y + j][currentPiece.x + i] = currentPiece.color;
                    }
                }
            }

            let cleared;
            [grid, cleared] = clearLines(grid);
            score += cleared * 100;
            
            currentPiece = nextPiece;
            nextPiece = newPiece();

            if (!validPosition(grid, currentPiece.shape, currentPiece.x, currentPiece.y)) {
                gameState = 'gameover';
            }
        }
    }
}

// --- Main Game Loop ---

let mousePosition = { x: 0, y: 0 };

function mainLoop(timestamp) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (gameState === 'start') {
        drawStartScreen(mousePosition);
    } else if (gameState === 'playing') {
        updateGame(timestamp);
        drawGame();
    } else if (gameState === 'gameover') {
        drawGameOverScreen(score, mousePosition);
    }

    requestAnimationFrame(mainLoop);
}

// --- Event Listeners ---

// Keydown handler for game controls
document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') {
        if (gameState === 'gameover' && (e.key === 'r' || e.key === 'R')) {
            initGame();
        } else if (gameState === 'start' && e.key === 'Enter') {
            initGame();
        } else if (e.key === 'Escape') {
            gameState = 'start';
        } else {
             console.log("Escape pressed on Start Screen. Game Closed.");
        }
        return;
    }

    const shape = currentPiece.shape;
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            if (validPosition(grid, shape, currentPiece.x - 1, currentPiece.y)) {
                currentPiece.x--;
            }
            break;
        case 'ArrowRight':
        case 'd':
            if (validPosition(grid, shape, currentPiece.x + 1, currentPiece.y)) {
                currentPiece.x++;
            }
            break;
        case 'ArrowUp':
        case 'e': 
            const rotatedCW = rotateClockwise(shape);
            if (validPosition(grid, rotatedCW, currentPiece.x, currentPiece.y)) {
                currentPiece.shape = rotatedCW;
            }
            break;
        case 'q': 
            const rotatedCCW = rotateCounterClockwise(shape);
            if (validPosition(grid, rotatedCCW, currentPiece.x, currentPiece.y)) {
                currentPiece.shape = rotatedCCW;
            }
            break;
        case ' ': 
            hardDrop(grid, currentPiece);
            lastDropTime = 0; 
            updateGame(DROP_DELAY + 1);
            break;
        case 'r':
        case 'R':
            initGame(); 
            break;
    }
});

// Mouse handlers (ไม่มี Logic ของ Slider แล้ว)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePosition.x = e.clientX - rect.left;
    mousePosition.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    // ไม่มี Logic ของ Slider
});

canvas.addEventListener('mouseup', (e) => {
    let buttons;
    if (gameState === 'start') {
        buttons = drawStartScreen(mousePosition);
        if (mousePosition.x >= buttons.btnStart.x && mousePosition.x <= buttons.btnStart.x + buttons.btnStart.w &&
            mousePosition.y >= buttons.btnStart.y && mousePosition.y <= buttons.btnStart.y + buttons.btnStart.h) {
            initGame(); 
        } 
    } else if (gameState === 'gameover') {
        buttons = drawGameOverScreen(score, mousePosition);
        if (mousePosition.x >= buttons.btnReplay.x && mousePosition.x <= buttons.btnReplay.x + buttons.btnReplay.w &&
            mousePosition.y >= buttons.btnReplay.y && mousePosition.y <= buttons.btnReplay.y + buttons.btnReplay.h) {
            initGame(); 
        } else if (mousePosition.x >= buttons.btnExit.x && mousePosition.x <= buttons.btnExit.x + buttons.btnExit.w &&
            mousePosition.y >= buttons.btnExit.y && mousePosition.y <= buttons.btnExit.y + buttons.btnExit.h) {
            gameState = 'start';
        }
    }
});
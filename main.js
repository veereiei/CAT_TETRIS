// --- Game Constants (ปรับให้เป็น Dynamic) ---
const COLS = 10;
const ROWS = 20;
const DROP_DELAY = 500; // milliseconds

// ขนาดเริ่มต้น
const INITIAL_BLOCK = 40; 

// ตัวแปร Dynamic
let BLOCK; 
let WIDTH;
let HEIGHT;
let INFO_WIDTH;
let CANVAS_WIDTH;
let CANVAS_HEIGHT;
let infoCenterX;
let nextBlockSize;

// --- Canvas Setup ---
const canvas = document.createElement('canvas');
canvas.id = 'game'; // เพิ่ม ID
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
// ฟอนต์เริ่มต้นจะถูกกำหนดใน calculateSizes()

// --- Colors and Shapes ---
const COLORS = [
    'rgb(0,255,255)',   // I
    'rgb(0,0,255)',     // J
    'rgb(255,165,0)',   // L
    'rgb(255,255,0)',   // O
    'rgb(0,255,0)',     // S
    'rgb(128,0,128)',   // T
    'rgb(255,0,0)'      // Z
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
            calculateSizes(); // คำนวณขนาดครั้งแรกเมื่อโหลดเสร็จ
            mainLoop(0);
        }
    };
});

// --- Mobile Control Setup ---
const controlButtons = [
    { text: "←", key: "ArrowLeft", x: 0, y: 0, w: 0, h: 0 },
    { text: "→", key: "ArrowRight", x: 0, y: 0, w: 0, h: 0 },
    { text: "⟲", key: "q", x: 0, y: 0, w: 0, h: 0 }, // Rotate CCW
    { text: "⟳", key: "ArrowUp", x: 0, y: 0, w: 0, h: 0 }, // Rotate CW
    { text: "DROP", key: " ", x: 0, y: 0, w: 0, h: 0 }
];

// --- Responsive Sizing Function ---

/** คำนวณขนาด Block และ Canvas ใหม่ให้เข้ากับหน้าจอ */
function calculateSizes() {
    const maxCanvasWidth = window.innerWidth * 0.95; 
    const maxCanvasHeight = window.innerHeight * 0.95; 

    // กำหนดขนาด BLOCK โดยอิงจากความสูง (ROWS) และจำกัดขนาดสูงสุดที่ INITIAL_BLOCK
    let tempBlock = Math.min(INITIAL_BLOCK, Math.floor(maxCanvasHeight / ROWS));
    
    // คำนวณความกว้างที่ต้องการ (Grid + Info Panel ขั้นต่ำ 120px)
    let tempInfoWidth = Math.max(120, Math.floor(tempBlock * COLS * 0.4));
    const requiredCanvasWidth = COLS * tempBlock + tempInfoWidth;
    
    // หากความกว้างเกินหน้าจอ ให้ลดขนาด Block ลง
    if (requiredCanvasWidth > maxCanvasWidth) {
         tempBlock = Math.floor(maxCanvasWidth / (COLS + COLS * 0.4));
    }

    // กำหนดค่าสุดท้าย
    BLOCK = Math.max(15, tempBlock); // Block ขั้นต่ำ 15px
    WIDTH = COLS * BLOCK;
    HEIGHT = ROWS * BLOCK;
    INFO_WIDTH = Math.max(120, Math.floor(WIDTH * 0.4)); 
    CANVAS_WIDTH = WIDTH + INFO_WIDTH;
    CANVAS_HEIGHT = HEIGHT;
    infoCenterX = WIDTH + INFO_WIDTH / 2;
    nextBlockSize = BLOCK * 0.8;

    // อัปเดตขนาด Canvas และฟอนต์
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.font = `bold ${Math.max(14, Math.floor(BLOCK * 0.5))}px consolas`;
}

// อัปเดตขนาดเมื่อหน้าจอถูกปรับ
window.addEventListener('resize', calculateSizes);


// --- Helper Functions (โค้ดเดิม) ---

function newPiece() {
    const i = Math.floor(Math.random() * SHAPES.length);
    return { shape: SHAPES[i], color: COLORS[i], x: COLS / 2 - 2, y: 0 };
}

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

function clearLines(grid) {
    let newGrid = grid.filter(row => row.some(cell => cell === 0));
    const cleared = ROWS - newGrid.length;
    const emptyRow = Array(COLS).fill(0);
    for (let i = 0; i < cleared; i++) {
        newGrid.unshift(emptyRow.slice());
    }
    return [newGrid, cleared];
}

function ghostPosition(grid, piece) {
    let y = piece.y;
    while (validPosition(grid, piece.shape, piece.x, y + 1)) {
        y++;
    }
    return y;
}

function hardDrop(grid, piece) {
    piece.y = ghostPosition(grid, piece);
}

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

/** Draws a piece (or a single block) on the canvas, using a tinted cat image. */
function drawPiece(piece, offset_x = 0, offset_y = 0, alpha = 255, scale = BLOCK) {
    const boardMode = (offset_x === 0 && offset_y === 0);
    const color = piece.color;
    
    const r = parseInt(color.match(/\d+/g)[0]);
    const g = parseInt(color.match(/\d+/g)[1]);
    const b = parseInt(color.match(/\d+/g)[2]);
    const alphaFloat = alpha / 255;
    
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

            tctx.clearRect(0, 0, scale, scale);
            tctx.globalCompositeOperation = 'source-over';
            tctx.drawImage(catImg, 0, 0, scale, scale); 

            // ย้อมสีรูปแมว: ใช้ Alpha 0.3
            tctx.globalCompositeOperation = 'source-atop'; 
            tctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`; 
            tctx.fillRect(0, 0, scale, scale); 

            ctx.globalAlpha = alphaFloat;
            ctx.drawImage(tempCanvas, x, y);
            ctx.globalAlpha = 1; 
        }
    }
}


// --- Drawing Functions ---

function drawButtonModern(text, center_y, mouse_pos = null, width = 180, height = 50) {
    // ปรับให้ปุ่มอยู่ตรงกลาง Canvas สำหรับหน้า Start/Game Over
    const x = (CANVAS_WIDTH - width) / 2;
    const y = center_y - height / 2;
    const rect = { x, y, w: width, h: height };

    let hover = false;
    if (mouse_pos && mouse_pos.x !== -1) {
        hover = mouse_pos.x >= rect.x && mouse_pos.x <= rect.x + rect.w &&
                mouse_pos.y >= rect.y && mouse_pos.y <= rect.y + rect.h;
    }

    const colorBg = hover ? 'rgb(255,140,0)' : 'rgb(255,165,0)';
    const btnFont = `bold ${Math.max(18, Math.floor(height * 0.4))}px consolas`;

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
    ctx.font = btnFont;
    ctx.fillText(text, rect.x + rect.w / 2, center_y);
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'alphabetic'; 
    ctx.font = `bold ${Math.max(14, Math.floor(BLOCK * 0.5))}px consolas`; // คืนค่าฟอนต์หลัก

    return rect;
}

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

function drawStartScreen(mouse_pos) {
    ctx.drawImage(bgStart, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const btnStart = drawButtonModern("START", HEIGHT / 2, mouse_pos);
    return { btnStart }; 
}

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
    const infoTextSize = Math.max(14, Math.floor(BLOCK * 0.5));
    ctx.font = `bold ${infoTextSize}px consolas`;
    ctx.fillText(`Score: ${score}`, WIDTH + 10, infoTextSize + 10);
    ctx.fillText("Next:", WIDTH + 10, infoTextSize + 10 + 50);

    // 6. Draw Next Piece Preview
    if (nextPiece) {
        const pieceWidth = nextPiece.shape[0].length * nextBlockSize;
        const offset_x = WIDTH + (INFO_WIDTH - pieceWidth) / 2;
        const offset_y = infoTextSize + 10 + 50 + 20;
        drawPiece(nextPiece, offset_x, offset_y, 255, nextBlockSize);
    }

    // 7. Draw Controls (เฉพาะ PC)
    if (window.innerWidth > 800) { // แสดง Controls เมื่อหน้าจอกว้างพอ (ถือว่าเป็น PC)
        const controls = ["Controls:", "A / ← : Move Left", "D / → : Move Right", "Q : Rotate Left",
                            "E / ↑ : Rotate Right", "SPACE : Hard Drop", "R : Replay"];
        ctx.fillStyle = WHITE;
        ctx.font = `bold ${Math.max(10, Math.floor(BLOCK * 0.3))}px consolas`;
        controls.forEach((line, i) => {
            ctx.fillText(line, WIDTH + 10, HEIGHT * 0.5 + i * 15);
        });
    }

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
    
    // 9. Draw Mobile Controls (เฉพาะ Mobile)
    if (window.innerWidth <= 800 || 'ontouchstart' in window) {
        drawMobileControls();
    }
}

/** วาดปุ่มควบคุมบนมือถือ */
function drawMobileControls() {
    const buttonSize = Math.max(50, Math.floor(WIDTH / 5)); 
    const rotSize = Math.max(40, Math.floor(INFO_WIDTH / 2) - 10);
    const padding = 10;
    
    // 1. ปุ่มซ้าย-ขวา (แถวล่างซ้าย)
    const startX = padding;
    const startY = HEIGHT - buttonSize - padding;

    controlButtons[0] = { ...controlButtons[0], x: startX, y: startY, w: buttonSize, h: buttonSize };
    drawControlBtn(controlButtons[0], mousePosition);
    
    controlButtons[1] = { ...controlButtons[1], x: startX + buttonSize + padding, y: startY, w: buttonSize, h: buttonSize };
    drawControlBtn(controlButtons[1], mousePosition);

    // 2. ปุ่มหมุน (บน Info Panel)
    const rotStartX = WIDTH + padding;
    let rotY = HEIGHT - rotSize - padding;
    
    controlButtons[2] = { ...controlButtons[2], x: rotStartX, y: rotY, w: rotSize, h: rotSize };
    drawControlBtn(controlButtons[2], mousePosition);

    controlButtons[3] = { ...controlButtons[3], x: rotStartX + rotSize + padding, y: rotY, w: rotSize, h: rotSize };
    drawControlBtn(controlButtons[3], mousePosition);

    // 3. ปุ่ม Drop (อยู่บนปุ่มหมุน)
    rotY = rotY - rotSize - padding;
    controlButtons[4] = { ...controlButtons[4], x: rotStartX, y: rotY, w: INFO_WIDTH - 2 * padding, h: rotSize };
    drawControlBtn(controlButtons[4], mousePosition);
}

/** วาดปุ่มควบคุมแต่ละปุ่ม */
function drawControlBtn(btn, mouse_pos) {
    const rect = { x: btn.x, y: btn.y, w: btn.w, h: btn.h };
    let hover = false;
    if (mouse_pos.x !== -1) { // ตรวจสอบว่ามีการแตะ/คลิกอยู่
        hover = mouse_pos.x >= rect.x && mouse_pos.x <= rect.x + rect.w &&
                mouse_pos.y >= rect.y && mouse_pos.y <= rect.y + rect.h;
    }

    const colorBg = hover ? 'rgb(0, 100, 200)' : 'rgb(0, 150, 255)';

    // Shadow
    const shadowOffset = 3;
    ctx.fillStyle = 'rgb(50,50,50)';
    roundRect(ctx, rect.x + shadowOffset, rect.y + shadowOffset, rect.w, rect.h, 8);
    
    // Main button
    ctx.fillStyle = colorBg;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);

    // Text
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(16, Math.floor(btn.h * 0.4))}px sans-serif`;
    ctx.fillText(btn.text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'alphabetic'; 
    ctx.font = `bold ${Math.max(14, Math.floor(BLOCK * 0.5))}px consolas`; // คืนค่าฟอนต์หลัก
}

// --- Game Logic (โค้ดเดิม) ---

function initGame() {
    grid = Array(ROWS).fill(0).map(() => Array(COLS).fill(0));
    currentPiece = newPiece();
    nextPiece = newPiece();
    score = 0;
    lastDropTime = 0;
    gameState = 'playing';
}

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

let mousePosition = { x: -1, y: -1 }; // ใช้ -1 เพื่อระบุว่าไม่ได้มีการแตะ/คลิก

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

// --- Event Handlers ---

// Keydown handler for game controls (PC)
document.addEventListener('keydown', (e) => {
     if (gameState !== 'playing') {
        if (gameState === 'gameover' && (e.key === 'r' || e.key === 'R')) {
            initGame();
        } else if (gameState === 'start' && e.key === 'Enter') {
            initGame();
        } else if (e.key === 'Escape') {
            gameState = 'start';
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

// Mousemove (PC) - สำหรับ Hover Effect
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePosition.x = e.clientX - rect.left;
    mousePosition.y = e.clientY - rect.top;
});

// Mouseup (PC) - สำหรับคลิกปุ่ม Start/Replay/Exit
canvas.addEventListener('mouseup', (e) => {
    handleInteraction(mousePosition);
    mousePosition = { x: -1, y: -1 }; 
});

// Touchstart (Mobile) - สำหรับแตะปุ่มควบคุม และเริ่ม/จบเกม
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mousePosition.x = touch.clientX - rect.left;
    mousePosition.y = touch.clientY - rect.top;
    
    // จัดการการแตะปุ่มควบคุมเกมทันที (Move, Rotate, Drop)
    handleTouchDown(mousePosition);
}, { passive: false });

// Touchend (Mobile) - สำหรับปล่อยการแตะปุ่ม Start/Replay/Exit
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // จัดการการคลิกปุ่ม Start/Replay/Exit
    handleInteraction(mousePosition); 
    // เคลียร์สถานะการแตะเพื่อล้าง Hover Effect
    mousePosition = { x: -1, y: -1 }; 
});

/** ฟังก์ชันรวมสำหรับตรวจสอบการคลิก/แตะปุ่ม Start/Game Over */
function handleInteraction(pos) {
    let buttons;
    if (gameState === 'start') {
        buttons = drawStartScreen(pos);
        if (pos.x >= buttons.btnStart.x && pos.x <= buttons.btnStart.x + buttons.btnStart.w &&
            pos.y >= buttons.btnStart.y && pos.y <= buttons.btnStart.y + buttons.btnStart.h) {
            initGame(); 
        } 
    } else if (gameState === 'gameover') {
        buttons = drawGameOverScreen(score, pos);
        if (pos.x >= buttons.btnReplay.x && pos.x <= buttons.btnReplay.x + buttons.btnReplay.w &&
            pos.y >= buttons.btnReplay.y && pos.y <= buttons.btnReplay.y + buttons.btnReplay.h) {
            initGame(); 
        } else if (pos.x >= buttons.btnExit.x && pos.x <= buttons.btnExit.x + buttons.btnExit.w &&
            pos.y >= buttons.btnExit.y && pos.y <= buttons.btnExit.y + buttons.btnExit.h) {
            gameState = 'start';
        }
    }
}

/** ฟังก์ชันสำหรับจัดการการแตะ (Touch Down) บนปุ่มควบคุมเกม */
function handleTouchDown(pos) {
    if (gameState !== 'playing') return;

    // ตรวจสอบปุ่มควบคุมบนหน้าจอ
    for (const btn of controlButtons) {
        if (pos.x >= btn.x && pos.x <= btn.x + btn.w &&
            pos.y >= btn.y && pos.y <= btn.y + btn.h) {
            
            // จำลองการกดปุ่ม (ใช้ key event เดิม)
            const event = new KeyboardEvent('keydown', { 'key': btn.key });
            document.dispatchEvent(event);
            return;
        }
    }
}

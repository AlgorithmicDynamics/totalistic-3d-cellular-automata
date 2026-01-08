const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

/* ================= CONFIG ================= */

const sizex = 128;
const sizey = 128;
const sizez = 128;
const pixel = 4;

const warmupIterations = 100;
const frameStep = 1;     // z-slice step
const frameDelay = 80;

const r_string = "11000001010001";

/* ========================================= */

/* ---- Parse rule genome ---- */

const r = r_string.split('').map(v => v === '1' ? 1 : 0);
if (r.length !== 14) {
    throw new Error("Rule string must be 14 bits");
}

const rule = new Uint8Array(128);

// identical to nexta() logic
for (let i = 0; i < 128; i++) {
    let q = ((i >> 3) & 1) * 6;
    for (let j = 0; j < 7; j++) q += (i >> j) & 1;
    rule[i] = r[q];
}

/* ---- Allocate field ---- */

let b = new Array(sizex);
for (let x = 0; x < sizex; x++) {
    b[x] = new Array(sizey);
    for (let y = 0; y < sizey; y++) {
        b[x][y] = new Uint8Array(sizez);
        for (let z = 0; z < sizez; z++) {
            b[x][y][z] = Math.random() < 0.5 ? 1 : 0;
        }
    }
}

/* ---- Neighborhood ---- */

function neighborhood(x, y, z) {
    const xm = (x - 1 + sizex) % sizex;
    const xp = (x + 1) % sizex;
    const ym = (y - 1 + sizey) % sizey;
    const yp = (y + 1) % sizey;
    const zm = (z - 1 + sizez) % sizez;
    const zp = (z + 1) % sizez;

    return (
        (b[xp][y ][z ] << 6) |
        (b[xm][y ][z ] << 5) |
        (b[x ][yp][z ] << 4) |
        (b[x ][y ][z ] << 3) |
        (b[x ][ym][z ] << 2) |
        (b[x ][y ][zp] << 1) |
        (b[x ][y ][zm] << 0)
    );
}

/* ---- CA step ---- */

function stepCA() {
    const temp = new Array(sizex);
    for (let x = 0; x < sizex; x++) {
        temp[x] = new Array(sizey);
        for (let y = 0; y < sizey; y++) {
            temp[x][y] = new Uint8Array(sizez);
            for (let z = 0; z < sizez; z++) {
                temp[x][y][z] = rule[neighborhood(x, y, z)];
            }
        }
    }
    b = temp;
}

/* ---- Warm up ---- */

console.log("Running warm-up iterations...");
for (let i = 0; i < warmupIterations; i++) stepCA();
console.log("Warm-up done");

/* ---- GIF setup ---- */

const canvas = createCanvas(sizex * pixel, sizey * pixel);
const ctx = canvas.getContext('2d');

const filename = `ca3d_${r_string}_${Date.now()}.gif`;
const encoder = new GIFEncoder(canvas.width, canvas.height);
encoder.createReadStream().pipe(fs.createWriteStream(filename));

encoder.start();
encoder.setRepeat(0);
encoder.setDelay(frameDelay);
encoder.setQuality(10);

/* ---- Render slices ---- */

for (let z = 0; z < sizez; z += frameStep) {

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    for (let x = 0; x < sizex; x++) {
        for (let y = 0; y < sizey; y++) {
            if (b[x][y][z]) {
                ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
            }
        }
    }

    encoder.addFrame(ctx);
}

/* ---- Finish ---- */

encoder.finish();
console.log(`GIF saved: ${filename}`);


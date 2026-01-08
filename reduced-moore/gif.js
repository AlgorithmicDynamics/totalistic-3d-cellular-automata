const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

/* ================= CONFIG ================= */

const sizex = 128;
const sizey = 128;
const sizez = 128;
const pixel = 4;

const warmupIterations = 100;
const frameStep = 1;
const frameDelay = 80;

// 38-bit totalistic rule (19 empty + 19 alive)
const r_string = "11111101110110001100010111101000111000";

/* ========================================= */

/* ---- Parse rule genome ---- */

const r = r_string.split('').map(v => v === '1' ? 1 : 0);
if (r.length !== 38) {
	throw new Error("Rule string must be exactly 38 bits");
}

// 2^19 neighborhood states
const RULE_SIZE = 1 << 19;
const rule = new Uint8Array(RULE_SIZE);

/* ---- Build rule table ---- */

for (let i = 0; i < RULE_SIZE; i++) {

	// center cell = bit 18
	let center = (i >> 18) & 1;

	// offset: empty → 0, alive → 18
	let q = center * 18;

	// popcount of 19 bits
	for (let j = 0; j < 19; j++)
		q += (i >> j) & 1;

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

/* ---- 19-cell neighborhood ---- */

function neighborhood(x, y, z) {

	const xm = (x - 1 + sizex) % sizex;
	const xp = (x + 1) % sizex;
	const ym = (y - 1 + sizey) % sizey;
	const yp = (y + 1) % sizey;
	const zm = (z - 1 + sizez) % sizez;
	const zp = (z + 1) % sizez;

	return (
		// faces (0–5)
		(b[xm][y ][z ] << 0) |
		(b[xp][y ][z ] << 1) |
		(b[x ][ym][z ] << 2) |
		(b[x ][yp][z ] << 3) |
		(b[x ][y ][zm] << 4) |
		(b[x ][y ][zp] << 5) |

		// edges XY (6–9)
		(b[xm][ym][z ] << 6) |
		(b[xm][yp][z ] << 7) |
		(b[xp][ym][z ] << 8) |
		(b[xp][yp][z ] << 9) |

		// edges XZ (10–13)
		(b[xm][y ][zm] << 10) |
		(b[xm][y ][zp] << 11) |
		(b[xp][y ][zm] << 12) |
		(b[xp][y ][zp] << 13) |

		// edges YZ (14–17)
		(b[x ][ym][zm] << 14) |
		(b[x ][ym][zp] << 15) |
		(b[x ][yp][zm] << 16) |
		(b[x ][yp][zp] << 17) |

		// center (18)
		(b[x ][y ][z ] << 18)
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

const filename = `ca3d_19cell_${r_string}_${Date.now()}.gif`;
const encoder = new GIFEncoder(canvas.width, canvas.height);

encoder.createReadStream().pipe(fs.createWriteStream(filename));
encoder.start();
encoder.setRepeat(0);
encoder.setDelay(frameDelay);
encoder.setQuality(10);

/* ---- Render Z slices ---- */

for (let z = 0; z < sizez; z += frameStep) {

	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "white";
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			if (b[x][y][z])
				ctx.fillRect(x * pixel, y * pixel, pixel, pixel);

	encoder.addFrame(ctx);
}

/* ---- Finish ---- */

encoder.finish();
console.log(`GIF saved: ${filename}`);


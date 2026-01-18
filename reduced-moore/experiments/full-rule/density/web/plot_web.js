const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');

let W = 0;
let H = 0;

let data = null;
let samples = null;

let RULE_SIZE = 0;
let VOLUME = 0;

/* ================= VIEWPORT ================= */

// normalized view window
let x0 = 0, x1 = 1;   // K / ruleSize
let y0 = 0, y1 = 1;   // Y / volume

/* ================= INTERACTION ================= */

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragX0 = 0, dragX1 = 0;
let dragY0 = 0, dragY1 = 0;

/* ================= SETUP ================= */

function resize() {
	W = canvas.width = window.innerWidth;
	H = canvas.height = window.innerHeight;
	draw();
}

window.addEventListener('resize', resize);

/* ================= DATA ================= */

async function loadData() {
	try {
		const res = await fetch('density.json');
		if (!res.ok) throw new Error('data not found');

		data = await res.json();
		samples = data.samples;
		
		/*
		try {
			const resSample = await fetch('density_sample.json');
			if (resSample.ok) {
				sampleData = await resSample.json();
				sampleSamples = sampleData.samples;
			}
		} catch (e) {
			// sample file is optional — ignore
		}
		*/

		RULE_SIZE = data.meta.ruleSize;
		VOLUME =
			data.meta.sizex *
			data.meta.sizey *
			data.meta.sizez;

		x0 = 0; x1 = 1;
		y0 = 0; y1 = 1;

		resize();
	} catch (e) {
		info.textContent = 'failed to load data';
		console.error(e);
	}
}

/* ================= MAPPING ================= */

function mapX(K) {
	const nx = K / (RULE_SIZE - 1);
	return (nx - x0) / (x1 - x0) * W;
}

function mapY(Y) {
	const ny = Y / VOLUME;
	return H - (ny - y0) / (y1 - y0) * H;
}

/* ================= DRAW ================= */

function drawAxes() {
	ctx.strokeStyle = '#333';
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(0, H);
	ctx.lineTo(W, H);
	ctx.stroke();
}

function draw() {
	if (!samples) return;

	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, W, H);

	drawAxes();

	ctx.fillStyle = 'rgba(255,255,255,0.85)';

	for (const [K, Y] of samples) {
		const nx = K / (RULE_SIZE - 1);
		const ny = Y / VOLUME;

		if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;

		const x = mapX(K);
		const y = mapY(Y);

		ctx.fillRect(x, y, 1, 1);
	}

/*	
	if (sampleSamples) {
		ctx.fillStyle = 'rgba(255, 0, 0, 1)'; // red

		for (const [K, Y] of sampleSamples) {
			const nx = K / (RULE_SIZE - 1);
			const ny = Y / VOLUME;

			if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;

			const x = mapX(K);
			const y = mapY(Y);

			ctx.fillRect(x - 2, y - 2, 5, 5);
		}
	}
*/

}

/* ================= ZOOM ================= */

canvas.addEventListener('wheel', e => {
	e.preventDefault();

	const mx = e.offsetX / W;
	const my = 1 - e.offsetY / H;

	const zoom = e.deltaY > 0 ? 1.25 : 0.8;

	const xr = x1 - x0;
	const yr = y1 - y0;

	const cx = x0 + mx * xr;
	const cy = y0 + my * yr;

	const nxr = xr * zoom;
	const nyr = yr * zoom;

	x0 = cx - mx * nxr;
	x1 = cx + (1 - mx) * nxr;

	y0 = cy - my * nyr;
	y1 = cy + (1 - my) * nyr;

	// clamp
	x0 = Math.max(0, x0);
	y0 = Math.max(0, y0);
	x1 = Math.min(1, x1);
	y1 = Math.min(1, y1);

	draw();
}, { passive: false });

/* ================= PAN ================= */

canvas.addEventListener('mousedown', e => {
	dragging = true;
	dragStartX = e.clientX;
	dragStartY = e.clientY;
	dragX0 = x0;
	dragX1 = x1;
	dragY0 = y0;
	dragY1 = y1;
});

window.addEventListener('mouseup', () => dragging = false);

window.addEventListener('mousemove', e => {
	if (!samples) return;

	if (dragging) {
		const dx = (e.clientX - dragStartX) / W;
		const dy = (e.clientY - dragStartY) / H;

		const xr = dragX1 - dragX0;
		const yr = dragY1 - dragY0;

		x0 = dragX0 - dx * xr;
		x1 = dragX1 - dx * xr;

		y0 = dragY0 + dy * yr;
		y1 = dragY1 + dy * yr;

		x0 = Math.max(0, x0);
		y0 = Math.max(0, y0);
		x1 = Math.min(1, x1);
		y1 = Math.min(1, y1);

		draw();
	}

	hoverInfo(e);
});

/* ================= HOVER ================= */

function hoverInfo(e) {
	let best = null;
	let bestD = 12;
	let bestIsSample = false;

/*
	// 1) check sample points FIRST (higher priority)
	if (sampleSamples) {
		for (const [K, Y] of sampleSamples) {
			const nx = K / (RULE_SIZE - 1);
			const ny = Y / VOLUME;
			if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;

			const x = mapX(K);
			const y = mapY(Y);

			const d = Math.abs(x - e.offsetX) + Math.abs(y - e.offsetY);
			if (d < bestD) {
				bestD = d;
				best = [K, Y];
				bestIsSample = true;
			}
		}
	}
*/

	// 2) check main dataset
	for (const [K, Y] of samples) {
		const nx = K / (RULE_SIZE - 1);
		const ny = Y / VOLUME;
		if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;

		const x = mapX(K);
		const y = mapY(Y);

		const d = Math.abs(x - e.offsetX) + Math.abs(y - e.offsetY);
		if (d < bestD) {
			bestD = d;
			best = [K, Y];
			bestIsSample = false;
		}
	}

	if (best) {
		info.textContent = bestIsSample
			? `[ ${best[0]}, ${best[1]} ]  (sample)`
			: `[ ${best[0]}, ${best[1]} ]`;
	} else {
		info.textContent = '';
	}
}

/* ================= INIT ================= */

loadData();

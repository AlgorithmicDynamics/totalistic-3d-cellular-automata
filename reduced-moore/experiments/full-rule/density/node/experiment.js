const fs = require('fs');
const readline = require('readline');

/* ================= CONFIG ================= */

const DATA_FILE = 'density.json';

const sizex = 32;
const sizey = 32;
const sizez = 32;

const warmupIterations = 50;
const RULE_SIZE = 1 << 19; // 524288

const K_MAX_FRACTION = 1.00;

/* ========================================= */

/* ---------- Data ---------- */

let data;

/* ---------- Helpers ---------- */

function nowISO() {
	return new Date().toISOString();
}

function warn(msg) {
	console.warn('[WARN]', msg);
}

/* ---------- Load / Init ---------- */

function initEmptyData() {
	return {
		meta: {
			created: nowISO(),
			sizex,
			sizey,
			sizez,
			warmupIterations,
			ruleSize: RULE_SIZE,
			metric: 'density'
		},
		samples: []
	};
}

function loadData() {
	if (!fs.existsSync(DATA_FILE)) {
		console.log('No data file found, creating new one.');
		data = initEmptyData();
		saveData();
		return;
	}

	data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

	const m = data.meta;
	if (m.sizex !== sizex) warn('sizex mismatch');
	if (m.ruleSize !== RULE_SIZE) warn('ruleSize mismatch');

	console.log('Data loaded.');
}

function saveData() {
	fs.writeFileSync(DATA_FILE, JSON.stringify(data));
	console.log('Data saved.');
}

/* ---------- CA Core ---------- */

function allocField() {
	const f = new Array(sizex);
	for (let x = 0; x < sizex; x++) {
		f[x] = new Array(sizey);
		for (let y = 0; y < sizey; y++)
			f[x][y] = new Uint8Array(sizez);
	}
	return f;
}

let field = allocField();

function cloneField(src) {
	const f = allocField();
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			for (let z = 0; z < sizez; z++)
				f[x][y][z] = src[x][y][z];
	return f;
}

function seedField() {
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			for (let z = 0; z < sizez; z++)
				field[x][y][z] = Math.random() < 0.5 ? 1 : 0;
}

function neighborhood(x, y, z) {
	const xm = (x - 1 + sizex) % sizex;
	const xp = (x + 1) % sizex;
	const ym = (y - 1 + sizey) % sizey;
	const yp = (y + 1) % sizey;
	const zm = (z - 1 + sizez) % sizez;
	const zp = (z + 1) % sizez;

	return (
		// bottom layer (z-1): B0, D0, E0, F0, H0
		(field[x ][ym][zm] << 0) |
		(field[xm][y ][zm] << 1) |
		(field[x ][y ][zm] << 2) |
		(field[xp][y ][zm] << 3) |
		(field[x ][yp][zm] << 4) |

		// middle layer (z): A1..I1
		(field[xm][ym][z ] << 5) |
		(field[x ][ym][z ] << 6) |
		(field[xp][ym][z ] << 7) |
		(field[xm][y ][z ] << 8) |
		(field[x ][y ][z ] << 9) |   // CENTER
		(field[xp][y ][z ] << 10) |
		(field[xm][yp][z ] << 11) |
		(field[x ][yp][z ] << 12) |
		(field[xp][yp][z ] << 13) |

		// top layer (z+1): B2, D2, E2, F2, H2
		(field[x ][ym][zp] << 14) |
		(field[xm][y ][zp] << 15) |
		(field[x ][y ][zp] << 16) |
		(field[xp][y ][zp] << 17) |
		(field[x ][yp][zp] << 18)
	);
}

function randomGenomeWithK(k) {
	const g = new Uint8Array(RULE_SIZE);
	for (let i = 0; i < k; i++) g[i] = 1;

	for (let i = RULE_SIZE - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = g[i];
		g[i] = g[j];
		g[j] = t;
	}
	return g;
}

function stepDirect(genome) {
	const next = allocField();
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			for (let z = 0; z < sizez; z++)
				next[x][y][z] = genome[neighborhood(x, y, z)];
	field = next;
}

function flickerCount(prev, curr) {
	let s = 0;
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			for (let z = 0; z < sizez; z++)
				if (prev[x][y][z] !== curr[x][y][z]) s++;
	return s;
}

function aliveCount() {
	let s = 0;
	for (let x = 0; x < sizex; x++)
		for (let y = 0; y < sizey; y++)
			for (let z = 0; z < sizez; z++)
				s += field[x][y][z];
	return s;
}

/* ---------- Experiment ---------- */

function runBatch(batchSize = 100) {
	let k = 0;
	const startCount = data.samples.length;

	const step = Math.max(
		100 / batchSize,
		Math.pow(10, -Math.floor(Math.log10(batchSize)))
	);

	let lastMark = -1;

	console.log(
		`runBatch(${batchSize}) started (progress step ${step}%)`
	);

	for (let i = 0; i < batchSize; i++) {

		const K = Math.floor(Math.random() * RULE_SIZE * K_MAX_FRACTION);
		const genome = randomGenomeWithK(K);

		seedField();

		for (let t = 0; t < warmupIterations - 1; t++)
			stepDirect(genome);
		
		//uncomment this one for flickering experiment
		/*
		const prev = cloneField(field);
		stepDirect(genome);

		const Y = flickerCount(prev, field);
		*/
		
		const Y = aliveCount();
		
		data.samples.push([ K, Y ]);

		const pct = ((i + 1) / batchSize) * 100;
		const mark = Math.floor(pct / step);

		if (mark !== lastMark) {
			const decimals = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
			console.log(
				`  progress: ${(mark * step).toFixed(decimals)}%`
			);
			lastMark = mark;
		}
		
		k++;
		if (k ==100) {
			saveData();
			console.log(`saved`);
			k = 0;
		}
	}

	saveData();

	console.log(
		`runBatch finished: ${data.samples.length - startCount} samples added`
	);
}

/* ---------- Sampling ---------- */

const SAMPLE_DATA_FILE = 'density_sample.json';
const SAMPLE_GENOMES_FILE = 'density_sample_genomes.json';

function initEmptySampleData() {
	return {
		meta: {
			created: nowISO(),
			sizex,
			sizey,
			sizez,
			warmupIterations,
			ruleSize: RULE_SIZE,
			metric: 'density',
			type: 'sample'
		},
		samples: []
	};
}

function loadOrInitSample(file) {
	if (!fs.existsSync(file)) return initEmptySampleData();
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function genomeToBitString(genome) {
	let s = '';
	for (let i = 0; i < genome.length; i++)
		s += genome[i] ? '1' : '0';
	return s;
}

function bitStringToGenome(str) {
	const g = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++)
		g[i] = str[i] === '1' ? 1 : 0;
	return g;
}

function genomeToBase64(genome) {
	const bytes = new Uint8Array(Math.ceil(genome.length / 8));

	for (let i = 0; i < genome.length; i++) {
		if (genome[i]) {
			bytes[i >> 3] |= 1 << (i & 7);
		}
	}

	return Buffer.from(bytes).toString('base64');
}

function base64ToGenome(str, length = RULE_SIZE) {
	const bytes = Buffer.from(str, 'base64');
	const genome = new Uint8Array(length);

	for (let i = 0; i < length; i++) {
		genome[i] = (bytes[i >> 3] >> (i & 7)) & 1;
	}

	return genome;
}

function sample(rangeFrom, rangeTo, amount) {
	if (rangeFrom < 0 || rangeTo >= RULE_SIZE || rangeFrom > rangeTo) {
		throw new Error('Invalid K range');
	}

	console.log(
		`sampling K in [${rangeFrom}, ${rangeTo}], amount=${amount}`
	);

	const sampleData = loadOrInitSample(SAMPLE_DATA_FILE);
	const sampleGenomes = fs.existsSync(SAMPLE_GENOMES_FILE)
		? JSON.parse(fs.readFileSync(SAMPLE_GENOMES_FILE, 'utf8'))
		: [];

	for (let i = 0; i < amount; i++) {

		const K = rangeFrom + Math.floor(
			Math.random() * (rangeTo - rangeFrom + 1)
		);

		const genome = randomGenomeWithK(K);

		seedField();

		for (let t = 0; t < warmupIterations - 1; t++)
			stepDirect(genome);

		const prev = cloneField(field);
		stepDirect(genome);

		const Y = flickerCount(prev, field);

		sampleData.samples.push([ K, Y ]);
		sampleGenomes.push({
			K,
			Y,
			//genomeBits: genomeToBitString(genome)
			genomeB64: genomeToBase64(genome)
		});

		console.log(
			`sample ${i + 1}/${amount} done  (K=${K}, Y=${Y})`
		);
	}

	fs.writeFileSync(
		SAMPLE_DATA_FILE,
		JSON.stringify(sampleData)
	);

	fs.writeFileSync(
		SAMPLE_GENOMES_FILE,
		JSON.stringify(sampleGenomes)
	);

	console.log('sampling finished');
	console.log(
		`  saved ${amount} samples to ${SAMPLE_DATA_FILE}`
	);
	console.log(
		`  saved ${amount} genomes to ${SAMPLE_GENOMES_FILE}`
	);
}

/* ---------- REPL ---------- */

function status() {
	console.log(`samples: ${data.samples.length}`);
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	prompt: 'ca> '
});

global.status = status;
global.run = runBatch;
global.sample = sample;
global.save = saveData;
global.exit = () => process.exit(0);

loadData();

console.log('REPL ready.');
console.log('Commands: run(n), status(), sample(), save(), exit()');

rl.prompt();
rl.on('line', line => {
	try {
		eval(line);
	} catch (e) {
		console.error(e.message);
	}
	rl.prompt();
});

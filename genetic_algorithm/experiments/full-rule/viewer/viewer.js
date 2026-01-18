/* ================= GLOBAL ================= */

var k = 0;
var timerId = false;

var sizex = 128, sizey = 128, sizez = 128;
var size = 4;
var zslice = 0;

var b = [];

// full reduced-Moore rule
var rule = new Uint8Array(524288);

/* ================= INDEXEDDB ================= */

const DB_NAME = 'cell_ga_db';
const STORE_GENOMES = 'genomes';

var gaGenomes = [];

async function loadGAGenomes(){
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onerror = () => reject(req.error);

		req.onsuccess = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_GENOMES)){
				resolve([]);
				return;
			}

			const tx = db.transaction([STORE_GENOMES], 'readonly');
			const st = tx.objectStore(STORE_GENOMES);
			const out = [];

			st.openCursor().onsuccess = e => {
				const cur = e.target.result;
				if (cur){
					out.push({
						id: cur.key,
						genome: new Uint8Array(cur.value.buf)
					});
					cur.continue();
				} else {
					resolve(out);
				}
			};
		};
	});
}

async function initGARules(){
	const sel = document.getElementById("gaRuleSelect");
	sel.innerHTML = '<option value="">-- select GA genome --</option>';

	gaGenomes = await loadGAGenomes();
	for (const g of gaGenomes){
		const opt = document.createElement("option");
		opt.value = g.id;
		opt.textContent = `GA genome #${g.id}`;
		sel.appendChild(opt);
	}
}

function loadFromGA(val){
	const id = Number(val);
	if (!isFinite(id)) return;

	const entry = gaGenomes.find(g => g.id === id);
	if (!entry) return;

	rule = entry.genome;

	// do NOT stop timer explicitly
	// just reset state and continue
	clearpage();
}

/* ================= CORE ================= */

function alloc3(){
	b = new Array(sizex);
	for(let x=0;x<sizex;x++){
		b[x] = new Array(sizey);
		for(let y=0;y<sizey;y++)
			b[x][y] = new Uint8Array(sizez);
	}
}

function neighborhood(x,y,z){
	let xm=(x-1+sizex)%sizex, xp=(x+1)%sizex;
	let ym=(y-1+sizey)%sizey, yp=(y+1)%sizey;
	let zm=(z-1+sizez)%sizez, zp=(z+1)%sizez;

	return (
		(b[x ][ym][zm] << 0) |
		(b[xm][y ][zm] << 1) |
		(b[x ][y ][zm] << 2) |
		(b[xp][y ][zm] << 3) |
		(b[x ][yp][zm] << 4) |

		(b[xm][ym][z ] << 5) |
		(b[x ][ym][z ] << 6) |
		(b[xp][ym][z ] << 7) |
		(b[xm][y ][z ] << 8) |
		(b[x ][y ][z ] << 9) |
		(b[xp][y ][z ] << 10) |
		(b[xm][yp][z ] << 11) |
		(b[x ][yp][z ] << 12) |
		(b[xp][yp][z ] << 13) |

		(b[x ][ym][zp] << 14) |
		(b[xm][y ][zp] << 15) |
		(b[x ][y ][zp] << 16) |
		(b[xp][y ][zp] << 17) |
		(b[x ][yp][zp] << 18)
	);
}

function stepCA(){
	k++;
	const t = allocTemp();
	for(let x=0;x<sizex;x++)
	for(let y=0;y<sizey;y++)
	for(let z=0;z<sizez;z++)
		t[x][y][z] = rule[ neighborhood(x,y,z) ];
	b = t;
	document.getElementById("console-log0").innerHTML = k;
}

function allocTemp(){
	let t = new Array(sizex);
	for(let x=0;x<sizex;x++){
		t[x] = new Array(sizey);
		for(let y=0;y<sizey;y++)
			t[x][y] = new Uint8Array(sizez);
	}
	return t;
}

/* ================= DRAW ================= */

function draw(){
	const c = document.getElementById("myCanvas");
	const ctx = c.getContext("2d");
	c.width = sizex * size;
	c.height = sizey * size;

	ctx.fillStyle = "#000";
	ctx.fillRect(0,0,c.width,c.height);

	ctx.fillStyle = "#fff";
	for(let x=0;x<sizex;x++)
	for(let y=0;y<sizey;y++)
		if(b[x][y][zslice])
			ctx.fillRect(x*size,y*size,size,size);
}

function setz(v){
	zslice = v|0;
	document.getElementById("zval").innerHTML = zslice;
	draw();
}

/* ================= CONTROL ================= */

function start(){
	if(!timerId){
		timerId = setInterval(()=>{ stepCA(); draw(); }, 1);
		document.getElementById("btnStart").classList.add("active");
	}
}

function stop(){
	clearInterval(timerId);
	timerId = false;
	document.getElementById("btnStart").classList.remove("active");
}

function oneStep(){ stepCA(); draw(); }

/* ================= INIT STATE ================= */

function seedField(mode){
	if(mode==="random")
		for(let x=0;x<sizex;x++)
		for(let y=0;y<sizey;y++)
		for(let z=0;z<sizez;z++)
			b[x][y][z] = Math.random() < 0.5;

	if(mode==="center")
		b[sizex>>1][sizey>>1][sizez>>1] = 1;

	if(mode==="chunks"){
		const chunks = Math.floor(sizex*sizey*sizez*0.01/27);
		for(let i=0;i<chunks;i++){
			const cx = Math.random()*(sizex-3)|0;
			const cy = Math.random()*(sizey-3)|0;
			const cz = Math.random()*(sizez-3)|0;
			for(let dx=0;dx<3;dx++)
			for(let dy=0;dy<3;dy++)
			for(let dz=0;dz<3;dz++)
				b[cx+dx][cy+dy][cz+dz] = Math.random()<0.5;
		}
	}
}

function clearpage(){
	k = 0;
	alloc3();
	const m = document.querySelector("input[name=initState]:checked").value;
	seedField(m);
	zslice = m==="center" ? sizez>>1 : 0;
	document.getElementById("zslice").value = zslice;
	draw();
}

/* ================= UI ================= */

function applyFieldSize(){
	sizex = sizey = sizez = parseInt(fieldSize.value);
	init();
}

function applyPixelSize(){
	size = parseInt(pixelSize.value);
	draw();
}

/* ================= INIT ================= */

function init(){
	const s = document.getElementById("zslice");
	s.max = sizez - 1;
	s.value = 0;
	zslice = 0;

	initGARules();
	clearpage();
}

var PopulationSize = 200;
var fitness = [];
var population = [];

// genotype size: FULL RULE TABLE (2^19)
var rulesize = 524288;

// initial genome density (probability of 1)
let genomeDensity = 0.0477;

// how many individuals are shown at once
var cellscount = 10;

// 3D preview size
var sizex = 64;
var sizey = 64;
var sizez = 64;

var size = 2;      // pixel size
var zslice = 0;    // global z slice
var steps = 0;

var rulesnumbers = []; // indices into population shown in grid
var selected = []; // selected[n] = true/false for visible previews

// per-preview CA state
var states = [];
// per-preview direct rule tables
var ruleTables = [];

/// local storage functions ///
var PopulationInStorage;

function supportsLocalStorage(){
	return ('localStorage' in window) && window['localStorage'] !== null;
}

// ===== IndexedDB (population storage) =====
const DB_NAME = 'cell_ga_db';
const DB_VERSION = 1;
const STORE_GENOMES = 'genomes';
const STORE_META = 'meta';

function idbOpen(){
	return new Promise(function(resolve, reject){
		if (!('indexedDB' in window)) return reject(new Error('IndexedDB not supported'));
		var req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = function(e){
			var db = req.result;
			if (!db.objectStoreNames.contains(STORE_GENOMES)){
				db.createObjectStore(STORE_GENOMES, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(STORE_META)){
				db.createObjectStore(STORE_META, { keyPath: 'key' });
			}
		};

		req.onsuccess = function(){ resolve(req.result); };
		req.onerror = function(){ reject(req.error || new Error('IndexedDB open error')); };
	});
}

function idbPutMeta(db, key, value){
	return new Promise(function(resolve, reject){
		var tx = db.transaction([STORE_META], 'readwrite');
		var st = tx.objectStore(STORE_META);
		var req = st.put({ key: key, value: value });
		req.onsuccess = function(){ resolve(true); };
		req.onerror = function(){ reject(req.error || new Error('idbPutMeta error')); };
	});
}

function idbGetMeta(db, key){
	return new Promise(function(resolve, reject){
		var tx = db.transaction([STORE_META], 'readonly');
		var st = tx.objectStore(STORE_META);
		var req = st.get(key);
		req.onsuccess = function(){
			resolve(req.result ? req.result.value : undefined);
		};
		req.onerror = function(){ reject(req.error || new Error('idbGetMeta error')); };
	});
}

function idbPutGenome(db, id, uint8){
	return new Promise(function(resolve, reject){
		var tx = db.transaction([STORE_GENOMES], 'readwrite');
		var st = tx.objectStore(STORE_GENOMES);
		// store as ArrayBuffer (structured clone)
		var req = st.put({ id: id, buf: uint8.buffer });
		req.onsuccess = function(){ resolve(true); };
		req.onerror = function(){ reject(req.error || new Error('idbPutGenome error')); };
	});
}

function idbGetGenome(db, id){
	return new Promise(function(resolve, reject){
		var tx = db.transaction([STORE_GENOMES], 'readonly');
		var st = tx.objectStore(STORE_GENOMES);
		var req = st.get(id);
		req.onsuccess = function(){
			if (!req.result || !req.result.buf) return resolve(null);
			resolve(new Uint8Array(req.result.buf));
		};
		req.onerror = function(){ reject(req.error || new Error('idbGetGenome error')); };
	});
}

function idbClearAll(db){
	return new Promise(function(resolve, reject){
		var tx1 = db.transaction([STORE_GENOMES], 'readwrite');
		tx1.objectStore(STORE_GENOMES).clear();

		var tx2 = db.transaction([STORE_META], 'readwrite');
		tx2.objectStore(STORE_META).clear();

		var done1 = false, done2 = false;

		tx1.oncomplete = function(){ done1 = true; if (done2) resolve(true); };
		tx2.oncomplete = function(){ done2 = true; if (done1) resolve(true); };

		tx1.onerror = function(){ reject(tx1.error || new Error('idbClearAll genomes error')); };
		tx2.onerror = function(){ reject(tx2.error || new Error('idbClearAll meta error')); };
	});
}

// ===== save / resume =====
function savePopulation(){
	// population is huge: IndexedDB only
	return (async function(){
		try{
			var db = await idbOpen();
			await idbPutMeta(db, 'cell.in.Storage', true);
			await idbPutMeta(db, 'rulesize', rulesize);
			await idbPutMeta(db, 'PopulationSize', PopulationSize);

			// write all genomes
			for (var n=0; n<PopulationSize; n++){
				// ensure Uint8Array
				var g = population[n];
				if (!(g instanceof Uint8Array) || g.length !== rulesize){
					return false;
				}
				await idbPutGenome(db, n, g);
			}
			PopulationInStorage = true;
			return true;
		}catch(e){
			// if IndexedDB fails, we still keep running (just no persistence)
			console.warn('savePopulation: IndexedDB failed:', e);
			return false;
		}
	})();
}

function saveFitness(){
	if (!supportsLocalStorage()) { return false; }
	localStorage["cell.fitness"] = JSON.stringify(fitness);
	return true;
}

function resumePopulation(){
	// async because IndexedDB
	return (async function(){
		try{
			var db = await idbOpen();
			var inStorage = await idbGetMeta(db, 'cell.in.Storage');
			if (!inStorage) return false;

			var rs = await idbGetMeta(db, 'rulesize');
			var ps = await idbGetMeta(db, 'PopulationSize');

			// storage might contain older genotype size or other pop size
			if (rs !== rulesize) return false;
			if (ps !== PopulationSize) return false;

			// load genomes
			population = new Array(PopulationSize);
			for (var n=0; n<PopulationSize; n++){
				var g = await idbGetGenome(db, n);
				if (!g || g.length !== rulesize) return false;
				population[n] = g;
			}

			// fitness from localStorage (separate on purpose)
			if (supportsLocalStorage() && localStorage["cell.fitness"]){
				fitness = JSON.parse(localStorage["cell.fitness"]);
			}else{
				fitness = [];
			}
			if (!fitness || fitness.length !== PopulationSize){
				fitness = new Array(PopulationSize);
				for (var i=0; i<PopulationSize; i++) fitness[i] = 0;
				saveFitness();
			}

			PopulationInStorage = true;
			return true;
		}catch(e){
			console.warn('resumePopulation: IndexedDB failed:', e);
			return false;
		}
	})();
}

function newPopulation(){
	genomeDensity = parseFloat(document.getElementById("genomedensity").value);
	if (!(genomeDensity > 0 && genomeDensity < 1)) genomeDensity = 0.05;
	
	// sync generation, async persistence
	population = new Array(PopulationSize);
	fitness = new Array(PopulationSize);

	if (supportsLocalStorage()){
		localStorage.removeItem("cell.fitness");
	}

	for (var n=0; n<PopulationSize; n++){
		var g = new Uint8Array(rulesize);
		for (var i=0; i<rulesize; i++){
			g[i] = (Math.random() < genomeDensity) ? 1 : 0;
		}
		population[n] = g;
		fitness[n] = 0;
	}

	PopulationInStorage = true;
	saveFitness();
	// persist population (async, fire-and-forget)
	savePopulation();
}
/// local storage functions ///


// ===== random chooser for displayed indices =====
var randa = [];
function realrand(){
	if (randa.length == 0) for (var i=0; i<PopulationSize; i++) randa[i] = i;
	var rem = Math.floor(Math.random()*(randa.length));
	var sp = randa.splice(rem,1)[0];
	return sp;
}


// ===== 3D NEIGHBORHOOD (faces+edges+center = 19) =====
// RE-INDEXED (more symmetrical)
function neighborhood(state, x, y, z){
	var xm=(x-1+sizex)%sizex, xp=(x+1)%sizex;
	var ym=(y-1+sizey)%sizey, yp=(y+1)%sizey;
	var zm=(z-1+sizez)%sizez, zp=(z+1)%sizez;

	return (
		(state[x ][ym][zm] << 0) |
		(state[xm][y ][zm] << 1) |
		(state[x ][y ][zm] << 2) |
		(state[xp][y ][zm] << 3) |
		(state[x ][yp][zm] << 4) |

		(state[xm][ym][z ] << 5) |
		(state[x ][ym][z ] << 6) |
		(state[xp][ym][z ] << 7) |
		(state[xm][y ][z ] << 8) |
		(state[x ][y ][z ] << 9) |
		(state[xp][y ][z ] << 10) |
		(state[xm][yp][z ] << 11) |
		(state[x ][yp][z ] << 12) |
		(state[xp][yp][z ] << 13) |

		(state[x ][ym][zp] << 14) |
		(state[xm][y ][zp] << 15) |
		(state[x ][y ][zp] << 16) |
		(state[xp][y ][zp] << 17) |
		(state[x ][yp][zp] << 18)
	);
}

function alloc3D(){
	var b = new Array(sizex);
	for (var x=0; x<sizex; x++){
		b[x] = new Array(sizey);
		for (var y=0; y<sizey; y++){
			b[x][y] = new Uint8Array(sizez);
		}
	}
	return b;
}

function seedRandom3D(state){
	for (var x=0; x<sizex; x++)
	for (var y=0; y<sizey; y++)
	for (var z=0; z<sizez; z++)
		state[x][y][z] = (Math.random() < 0.5) ? 1 : 0;
}

function seedCenter3D(state){
	var cx = (sizex>>1), cy = (sizey>>1), cz = (sizez>>1);
	state[cx][cy][cz] = 1;
}

function stepOne3D(state, ruleTable){
	var t = alloc3D();
	for (var x=0; x<sizex; x++)
	for (var y=0; y<sizey; y++)
	for (var z=0; z<sizez; z++)
		t[x][y][z] = ruleTable[ neighborhood(state, x, y, z) ];
	return t;
}


// ===== DRAW =====
function drawOne(n){
	var canvas = document.getElementById('c'+n+'0');
	var context = canvas.getContext('2d');
	canvas.width = sizex*size;
	canvas.height = sizey*size;

	context.fillStyle = 'rgb(0,0,0)';
	context.fillRect(0,0,canvas.width,canvas.height);

	context.fillStyle = 'rgb(255,255,255)';
	var st = states[n];

	for (var x=0; x<sizex; x++)
	for (var y=0; y<sizey; y++){
		if (st[x][y][zslice]){
			context.fillRect(x*size, y*size, size, size);
		}
	}
}

function drawAll(){
	for (var n=0; n<cellscount; n++) drawOne(n);
}

function setz(v){
	zslice = v|0;
	var zv = document.getElementById("zval");
	if (zv) zv.innerHTML = zslice;
	drawAll();
}

function clearSelection(){
	for (var i=0; i<cellscount; i++){
		selected[i] = false;
		var el = document.getElementsByClassName('canv0')[i];
		if (el) el.classList.remove('selected');
	}
}


// ===== UI RESET / INIT STATE =====
function clearpage(changenumbers=true){
	stop();

	steps = 0;

	// choose which population members are shown
	if (changenumbers){
		for (var i2=0; i2<cellscount; i2++){
			rulesnumbers[i2] = realrand();
		}
	}

	// rebuild preview states + ruleTables
	states = [];
	ruleTables = [];
	for (var n=0; n<cellscount; n++){
		states[n] = alloc3D();
		seedRandom3D(states[n]);

		ruleTables[n] = population[ rulesnumbers[n] ];
	}

	drawAll();
	
	var hello0 = document.getElementById('console-log0');
	if (hello0) hello0.innerHTML = rulesnumbers.join(', ');

	var hello1 = document.getElementById('console-log1');
	if (hello1) hello1.innerHTML = fitness.join(', ');

	clearSelection();
}

function clearone(){
	stop();

	steps = 0;

	states = [];
	ruleTables = [];
	for (var n=0; n<cellscount; n++){
		states[n] = alloc3D();
		seedCenter3D(states[n]);

		ruleTables[n] = population[ rulesnumbers[n] ];
	}

	// center seed -> center zslice
	zslice = sizez >> 1;
	var zs = document.getElementById("zslice");
	if (zs){
		zs.max = sizez - 1;
		zs.value = zslice;
	}
	var zv = document.getElementById("zval");
	if (zv) zv.innerHTML = zslice;

	drawAll();
	
	var hello0 = document.getElementById('console-log0');
	if (hello0) hello0.innerHTML = rulesnumbers.join(', ');

	var hello1 = document.getElementById('console-log1');
	if (hello1) hello1.innerHTML = fitness.join(', ');
}

function clearc(){
	clearpage(false);
}


// ===== SIMULATION STEPS =====
function countpoints(){
	steps++;

	for (var n=0; n<cellscount; n++){
		states[n] = stepOne3D(states[n], ruleTables[n]);
	}

	drawAll();

	var hello3 = document.getElementById('console-log3');
	if (hello3) hello3.innerHTML = "steps: " + steps;
}

function count100(c){
	var cm = c-1;
	stop();

	for (var i=0; i<cm; i++){
		for (var n=0; n<cellscount; n++){
			states[n] = stepOne3D(states[n], ruleTables[n]);
		}
		steps++;
	}
	countpoints();
}

function onestep(){
	countpoints();
}


// ===== SELECTION (fixed +1) =====
var selectcounter = 0;
function selectc(){
	stop();

	for (var i=0; i<cellscount; i++){
		if (selected[i]){
			fitness[ rulesnumbers[i] ] += 1;
		}
	}

	//Fitness only.
	saveFitness();

	clearpage();
	selectcounter++;

	var hello2 = document.getElementById('console-log2');
	if (hello2) hello2.innerHTML = "selections: " + selectcounter;
}


// ===== GA CORE (rulesize=524288) =====
function sortf(c, d) {
	if (c[1] < d[1]) return 1;
	else if (c[1] > d[1]) return -1;
	else return 0;
}

function evolute(){
	stop();

	var sizehalf = PopulationSize/2;
	var sizequarter = sizehalf/2;

	var mutation = document.getElementById("mutatepercent").value*1;
	var mutategen = document.getElementById("mutategen").value*1;

	var arrayt = [];
	for (var n=0; n<PopulationSize; n++){
		arrayt[n] = [];
		arrayt[n][0] = population[n];
		arrayt[n][1] = fitness[n];
		arrayt[n][2] = n;
	}

	arrayt.sort(sortf);
	arrayt.length = sizehalf;
	population = [];
	fitness = [];

	// crossover
	for (var i=0; i<sizequarter; i++){
		var i0=i*4;
		var i1=i*4+1;
		var i2=i*4+2;
		var i3=i*4+3;

		var removed1=Math.floor(Math.random()*(arrayt.length));
		var parent1f = arrayt.splice(removed1,1);
		var parent1 = parent1f[0][0];

		var removed2=Math.floor(Math.random()*(arrayt.length));
		var parent2f = arrayt.splice(removed2,1);
		var parent2 = parent2f[0][0];

		// keep as Uint8Array for memory sanity
		var child1 = new Uint8Array(rulesize);
		var child2 = new Uint8Array(rulesize);

		for (var j=0; j<rulesize; j++){
			var gen=Math.round(Math.random());
			if (gen==1){
				child1[j]=parent1[j];
				child2[j]=parent2[j];
			}else{
				child1[j]=parent2[j];
				child2[j]=parent1[j];
			}
		}

		population[i0]=parent1;
		population[i1]=parent2;
		population[i2]=child1;
		population[i3]=child2;

		fitness[i0]=0;
		fitness[i1]=0;
		fitness[i2]=0;
		fitness[i3]=0;
	}

	// mutation
	var m = 100/mutation;
	var m2 = mutategen;

	for (var i=0; i<PopulationSize; i++){
		var rnd = Math.floor(Math.random()*(m)) + 1;
		if (rnd==1){
			var rnd2 = Math.floor(Math.random()*(m2)) + 1;
			for (var j=0; j<rnd2; j++){
				var gen = Math.floor(Math.random()*(rulesize));
				if (population[i][gen])
					population[i][gen]=0;
				else
					population[i][gen]=1;
			}
		}
	}

	// persist
	savePopulation(); // async, but we don't need to wait
	saveFitness();

	clearpage();
	selectcounter=0;
}


// ===== RECREATE =====
function recreate(){
	stop();
	newPopulation();
	clearpage();
	selectcounter = 0;
	var hello2 = document.getElementById('console-log2');
	if (hello2) hello2.innerHTML = "selections: " + selectcounter;
}


// ===== START/STOP LOOP =====
var timerId;
function start(){
	if (!timerId){
		timerId = setInterval(function(){
			countpoints();
		}, 1);
	}
}
function stop(){
	if (timerId){
		clearInterval(timerId);
		timerId = false;
	}
}


// ===== INIT =====
function init(){
	var canv = document.getElementById('canv');
	for (var n=0; n<cellscount; n++){
		var canvas1 = document.createElement('canvas');
		var canvasId = "c"+n+"0";
		canvas1.setAttribute("id", canvasId);

		var div1 = document.createElement('div');
		div1.setAttribute("class", "canv0");

		selected[n] = false;

		(function(n, div1){
			div1.onclick = function(){
				selected[n] = !selected[n];
				if (selected[n]){
					div1.classList.add('selected');
					piu(); // 🔊 tiny sound
				}else{
					div1.classList.remove('selected');
					pau(); // 🔊 even tinier sound
				}
			};
		})(n, div1);

		var div2 = document.createElement('div');
		div2.appendChild(canvas1);

		div1.appendChild(div2);
		canv.appendChild(div1);
	}

	// zslice slider
	var zs = document.getElementById("zslice");
	if (zs){
		zs.min = 0;
		zs.max = sizez - 1;
		zs.value = 0;
	}
	var zv = document.getElementById("zval");
	if (zv) zv.innerHTML = "0";

	// async load/create population, then clearpage
	(async function(){
		var ok = await resumePopulation();
		if (!ok){
			// also clear IndexedDB content if it exists (avoid mixing old crap)
			try{
				var db = await idbOpen();
				await idbClearAll(db);
			}catch(e){
				// ignore
			}
			newPopulation();
		}
		clearpage();
	})();
}

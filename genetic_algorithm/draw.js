var PopulationSize = 200;
var fitness = [];
var population = [];

// genotype size: 19 empty + 19 alive
var rulesize = 38;

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
// per-preview expanded lookup table
var ruleTables = [];

// 38-bit totalistic selector workspace
var r = new Array(38).fill(0);

/// local storage functions ///
var PopulationInStorage;
function supportsLocalStorage(){
	return ('localStorage' in window) && window['localStorage'] !== null;
}

function savePopulation(){
	if (!supportsLocalStorage()) { return false; }
	localStorage["cell.in.Storage"] = PopulationInStorage;
	localStorage["cell.population"] = JSON.stringify(population);
	return true;
}
function saveFitness(){
	if (!supportsLocalStorage()) { return false; }
	localStorage["cell.fitness"] = JSON.stringify(fitness);
	return true;
}
function resumePopulation(){
	if (!supportsLocalStorage()) { return false; }
	PopulationInStorage = (localStorage["cell.in.Storage"] == "true");
	if (!PopulationInStorage) { return false; }
	population = JSON.parse(localStorage["cell.population"]);
	fitness = JSON.parse(localStorage["cell.fitness"]);

	// storage might contain older genotype size
	if (!population || !population.length || !population[0] || population[0].length !== rulesize) {
		return false;
	}
	return true;
}
function newPopulation(){
	population = [];
	fitness = [];
	localStorage.clear();
	for (var n=0; n<PopulationSize; n++){
		population[n] = [];
		fitness[n] = 0;
		for (var i=0; i<rulesize; i++){
			population[n][i] = Math.round(Math.random());
		}
	}
	PopulationInStorage = true;
	savePopulation();
	saveFitness();
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


// ===== 3D TOTALISTIC RULE EXPANSION =====
function buildRuleFromGenotype(geno38){
	for (var i=0; i<38; i++) r[i] = geno38[i] ? 1 : 0;

	// 2^19 = 524288 neighborhood states
	var rule = new Uint8Array(524288);

	for (var i=0; i<524288; i++){
		var center = (i >> 18) & 1;
		var q = center * 18;
		for (var j=0; j<19; j++) q += (i >> j) & 1;
		rule[i] = r[q];
	}
	return rule;
}


// ===== 3D NEIGHBORHOOD (faces+edges+center = 19) =====
function neighborhood(state, x, y, z){
	var xm=(x-1+sizex)%sizex, xp=(x+1)%sizex;
	var ym=(y-1+sizey)%sizey, yp=(y+1)%sizey;
	var zm=(z-1+sizez)%sizez, zp=(z+1)%sizez;

	return (
		// faces
		(state[xm][y ][z ]<<0) | (state[xp][y ][z ]<<1) |
		(state[x ][ym][z ]<<2) | (state[x ][yp][z ]<<3) |
		(state[x ][y ][zm]<<4) | (state[x ][y ][zp]<<5) |

		// edges XY
		(state[xm][ym][z ]<<6) | (state[xm][yp][z ]<<7) |
		(state[xp][ym][z ]<<8) | (state[xp][yp][z ]<<9) |

		// edges XZ
		(state[xm][y ][zm]<<10) | (state[xm][y ][zp]<<11) |
		(state[xp][y ][zm]<<12) | (state[xp][y ][zp]<<13) |

		// edges YZ
		(state[x ][ym][zm]<<14) | (state[x ][ym][zp]<<15) |
		(state[x ][yp][zm]<<16) | (state[x ][yp][zp]<<17) |

		// center
		(state[x ][y ][z ]<<18)
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

function renderRuleStrings(){
	var out = [];
	for (var i = 0; i < rulesnumbers.length; i++){
		var idx = rulesnumbers[i];
		if (idx == null) continue;
		out.push(
			"#" + idx + ": " + population[idx].join("")
		);
	}
	return out.join("\n");
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
		ruleTables[n] = buildRuleFromGenotype(population[ rulesnumbers[n] ]);
	}

	drawAll();

	var hello0 = document.getElementById('console-log0');
	if (hello0){
		hello0.innerHTML = rulesnumbers.join(', ');
		hello0.onclick = function(){
			var r = document.getElementById('console-rules');
			if (!r) return;
			if (r.classList.contains('hidden')){
				r.innerHTML = renderRuleStrings();
				r.classList.remove('hidden');
			}else{
				r.classList.add('hidden');
			}
		};
	}
	
	var rblock = document.getElementById('console-rules');
	if (rblock && !rblock.classList.contains('hidden')){
		rblock.innerHTML = renderRuleStrings();
	}

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
		ruleTables[n] = buildRuleFromGenotype(population[ rulesnumbers[n] ]);
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


// ===== GENOFOND (genotype heatmap) =====
function genofond(){
	var canvas = document.getElementById('blanc');
	var context = canvas.getContext('2d');
	canvas.width = rulesize;
	canvas.height = PopulationSize;

	context.fillStyle = 'rgb(0,0,0)';
	context.fillRect(0,0,canvas.width,canvas.height);

	context.fillStyle = 'rgb(255,255,255)';
	for (var y=0; y<PopulationSize; y++){
		for (var x=0; x<rulesize; x++){
			if (population[y][x] == 1) context.fillRect(x, y, 1, 1);
		}
	}
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

	saveFitness();
	clearpage();
	selectcounter++;

	var hello2 = document.getElementById('console-log2');
	if (hello2) hello2.innerHTML = "selections: " + selectcounter;
}


// ===== GA CORE (preserved; rulesize=38) =====
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

		var child1 = [];
		var child2 = [];

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

	savePopulation();
	saveFitness();

	genofond();
	clearpage();
	selectcounter=0;
}


// ===== RECREATE (requested) =====
function recreate(){
	stop();
	newPopulation();
	genofond();
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


// ===== A LIL BULLSHIT =====
var audioCtx = null;

function piu(){
	if (!audioCtx){
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}

	var o = audioCtx.createOscillator();
	var g = audioCtx.createGain();

	o.type = 'square';      // 8-bit-ish
	o.frequency.value = 1800; // “piu” pitch

	g.gain.value = 0.04;    // VERY quiet

	o.connect(g);
	g.connect(audioCtx.destination);

	o.start();
	o.stop(audioCtx.currentTime + 0.03); // ~30 ms
}

function pau(){
	if (!audioCtx){
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}

	var o = audioCtx.createOscillator();
	var g = audioCtx.createGain();

	o.type = 'square';
	o.frequency.value = 900;   // lower pitch

	g.gain.value = 0.025;      // quieter than piu

	o.connect(g);
	g.connect(audioCtx.destination);

	o.start();
	o.stop(audioCtx.currentTime + 0.045); // slightly longer
}

// ===== INIT =====
function init(){
	// preview canvases + checkboxes
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

	// load or create population
	if (!resumePopulation()){
		newPopulation();
	}

	// genotype canvas
	var canv2 = document.getElementById('canv2');
	var canvasG = document.createElement('canvas');
	canvasG.setAttribute("id", "blanc");
	var divG = document.createElement('div');
	divG.setAttribute("class", "canv0");
	var divG2 = document.createElement('div');
	divG2.appendChild(canvasG);
	divG.appendChild(divG2);
	canv2.appendChild(divG);

	genofond();

	// zslice slider
	var zs = document.getElementById("zslice");
	if (zs){
		zs.min = 0;
		zs.max = sizez - 1;
		zs.value = 0;
	}
	var zv = document.getElementById("zval");
	if (zv) zv.innerHTML = "0";

	clearpage();
}

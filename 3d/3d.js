var k = 0;
var timerId = false;

var sizex = 128;
var sizey = 128;
var sizez = 128;
var size  = 4;

var zslice = 0;

var b = [];
var rule = new Uint8Array(128);

// genome: 14 bits
var r = new Array(14).fill(0);

/* ================= CORE ================= */

function alloc3(){
	b = new Array(sizex);
	for(let x=0;x<sizex;x++){
		b[x] = new Array(sizey);
		for(let y=0;y<sizey;y++){
			b[x][y] = new Uint8Array(sizez);
		}
	}
}

function buildRule(){
	for (let i = 0; i < 128; i++) {
		let q = ((i >> 3) & 1) * 6;
		for (let j = 0; j < 7; j++)
			q += (i >> j) & 1;
		rule[i] = r[q];
	}
}

function neighborhood(x,y,z){
	let xm = (x-1+sizex)%sizex;
	let xp = (x+1)%sizex;
	let ym = (y-1+sizey)%sizey;
	let yp = (y+1)%sizey;
	let zm = (z-1+sizez)%sizez;
	let zp = (z+1)%sizez;

	return (
		(b[xp][y ][z ]<<6) |
		(b[xm][y ][z ]<<5) |
		(b[x ][yp][z ]<<4) |
		(b[x ][y ][z ]<<3) |
		(b[x ][ym][z ]<<2) |
		(b[x ][y ][zp]<<1) |
		(b[x ][y ][zm]<<0)
	);
}

function stepCA(){
	k++;

	let temp = new Array(sizex);
	for(let x=0;x<sizex;x++){
		temp[x] = new Array(sizey);
		for(let y=0;y<sizey;y++){
			temp[x][y] = new Uint8Array(sizez);
		}
	}

	for(let x=0;x<sizex;x++)
		for(let y=0;y<sizey;y++)
			for(let z=0;z<sizez;z++)
				temp[x][y][z] = rule[neighborhood(x,y,z)];

	b = temp;

	document.getElementById("console-log0").innerHTML = k;
}

/* ================= DRAW ================= */

function draw(){
	let canvas = document.getElementById("myCanvas");
	let ctx = canvas.getContext("2d");

	canvas.width  = sizex * size;
	canvas.height = sizey * size;

	ctx.fillStyle = "black";
	ctx.fillRect(0,0,canvas.width,canvas.height);

	ctx.fillStyle = "white";
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

/* ================= SIMULATION CONTROL ================= */

function start(){
	if(!timerId){
		timerId = setInterval(function(){
			stepCA();
			draw();
		}, 1);

		let btn = document.getElementById("btnStart");
		if(btn) btn.classList.add("active");
	}
}

function stop(){
	if(timerId){
		clearInterval(timerId);
		timerId = false;
	}

	let btn = document.getElementById("btnStart");
	if(btn) btn.classList.remove("active");
}

function oneStep(){
	stepCA();
	draw();
}

/* ================= INITIAL STATE ================= */

function getInitStateMode(){
	let radios = document.getElementsByName("initState");
	for(let i=0;i<radios.length;i++)
		if(radios[i].checked)
			return radios[i].value;
	return "random";
}

function seedField(mode){
	// RANDOM
	if(mode === "random"){
		for(let x=0;x<sizex;x++)
			for(let y=0;y<sizey;y++)
				for(let z=0;z<sizez;z++)
					b[x][y][z] = Math.random() < 0.5 ? 1 : 0;
	}

	// SINGLE CENTER CELL
	else if(mode === "center"){
		let cx = (sizex/2)|0;
		let cy = (sizey/2)|0;
		let cz = (sizez/2)|0;
		b[cx][cy][cz] = 1;
	}

	// SPARSE RANDOM CHUNKS
	else if(mode === "chunks"){
		let totalCells = sizex * sizey * sizez;
		let chunks = Math.floor(totalCells * 0.01 / 27);

		for(let i=0;i<chunks;i++){
			let cx = Math.floor(Math.random() * (sizex-3));
			let cy = Math.floor(Math.random() * (sizey-3));
			let cz = Math.floor(Math.random() * (sizez-3));

			for(let dx=0;dx<3;dx++)
				for(let dy=0;dy<3;dy++)
					for(let dz=0;dz<3;dz++)
						b[cx+dx][cy+dy][cz+dz] =
							Math.random() < 0.5 ? 1 : 0;
		}
	}
}

function defaultZForMode(mode){
	if(mode === "center"){
		return (sizez/2)|0;
	}
	return 0;
}

function setZSliceImmediate(z){
	zslice = z|0;

	let slider = document.getElementById("zslice");
	if(slider) slider.value = zslice;

	let label = document.getElementById("zval");
	if(label) label.innerHTML = zslice;
}

function clearpage(){
	k = 0;
	document.getElementById("console-log0").innerHTML = k;

	alloc3();

	let mode = getInitStateMode();

	seedField(mode);
	setZSliceImmediate(defaultZForMode(mode));

	draw();
}

/* ================= RULE EDITOR ================= */

function normalizeRuleString(str){
	let out = [];
	for(let i=0;i<str.length && out.length<14;i++)
		out.push(str[i]==='1'?1:0);
	while(out.length<14) out.push(0);
	return out;
}

function ruleFromText(){
	let str = document.getElementById("ruleInput").value;
	r = normalizeRuleString(str);
	updateRuleCheckboxes();
	buildRule();
	draw();
}

function ruleFromCheckboxes(){
	for(let i=0;i<14;i++)
		r[i] = document.getElementById("rbit"+i).checked ? 1 : 0;

	document.getElementById("ruleInput").value = r.join("");
	buildRule();
	draw();
}

function createRuleCheckboxes(){
	let row0 = document.getElementById("ruleBitsRow0");
	let row1 = document.getElementById("ruleBitsRow1");

	row0.innerHTML = "";
	row1.innerHTML = "";

	for(let i=0;i<7;i++){
		let cb0 = document.createElement("input");
		cb0.type = "checkbox";
		cb0.id = "rbit"+i;
		cb0.onchange = ruleFromCheckboxes;
		row0.appendChild(cb0);
	}

	for(let i=7;i<14;i++){
		let cb1 = document.createElement("input");
		cb1.type = "checkbox";
		cb1.id = "rbit"+i;
		cb1.onchange = ruleFromCheckboxes;
		row1.appendChild(cb1);
	}
}

function updateRuleCheckboxes(){
	for(let i=0;i<14;i++)
		document.getElementById("rbit"+i).checked = !!r[i];
}

/* ================= UI ================= */

function applyFieldSize(){
	let v = parseInt(document.getElementById("fieldSize").value);
	sizex = sizey = sizez = v;
	init();
}

function applyPixelSize(){
	size = parseInt(document.getElementById("pixelSize").value);
	draw();
}

function nexta(newa=true){
	if(newa)
		for(let i=0;i<14;i++)
			r[i] = Math.round(Math.random());

	buildRule();
	document.getElementById("ruleInput").value = r.join("");
	updateRuleCheckboxes();
	clearpage();
}

/* ================= INIT ================= */

function init(){
	let s = document.getElementById("zslice");
	s.max = sizez - 1;
	s.value = 0;
	zslice = 0;

	createRuleCheckboxes();

	r = normalizeRuleString(document.getElementById("ruleInput").value);
	updateRuleCheckboxes();
	buildRule();

	clearpage();
}

var k = 0;
var timerId = false;

var sizex = 128, sizey = 128, sizez = 128;
var size = 4;
var zslice = 0;

var b = [];

// 2^19 = 524288 neighborhood states
var rule = new Uint8Array(524288);

// 19 empty + 19 alive
var r = new Array(38).fill(0);

/* ================= CORE ================= */

function alloc3(){
	b = new Array(sizex);
	for(let x=0;x<sizex;x++){
		b[x] = new Array(sizey);
		for(let y=0;y<sizey;y++)
			b[x][y] = new Uint8Array(sizez);
	}
}

/* ===== 19-CELL TOTALISTIC RULE ===== */

function buildRule(){
	for(let i=0;i<524288;i++){
		let center = (i >> 18) & 1;
		let q = center * 18;
		for(let j=0;j<19;j++)
			q += (i >> j) & 1;
		rule[i] = r[q];
	}
}

function randomKofN(k, n){
	const a = new Array(n).fill(0);
	for (let i = 0; i < k; i++) a[i] = 1;
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function applyCaseRule() {
	const a = parseInt(document.getElementById('caseA').value, 10);
	const b = parseInt(document.getElementById('caseB').value, 10);

	r = [
		...randomKofN(b, 19), // center = 0
		...randomKofN(a, 19)  // center = 1
	];

	ruleInput.value = r.join('');
	updateRuleCheckboxes();
	buildRule();
	clearpage();
}

/* ===== 19-CELL NEIGHBORHOOD ===== */

function neighborhood(x,y,z){
	let xm=(x-1+sizex)%sizex, xp=(x+1)%sizex;
	let ym=(y-1+sizey)%sizey, yp=(y+1)%sizey;
	let zm=(z-1+sizez)%sizez, zp=(z+1)%sizez;

	return (
		// faces
		(b[xm][y ][z ]<<0) | (b[xp][y ][z ]<<1) |
		(b[x ][ym][z ]<<2) | (b[x ][yp][z ]<<3) |
		(b[x ][y ][zm]<<4) | (b[x ][y ][zp]<<5) |

		// edges XY
		(b[xm][ym][z ]<<6) | (b[xm][yp][z ]<<7) |
		(b[xp][ym][z ]<<8) | (b[xp][yp][z ]<<9) |

		// edges XZ
		(b[xm][y ][zm]<<10) | (b[xm][y ][zp]<<11) |
		(b[xp][y ][zm]<<12) | (b[xp][y ][zp]<<13) |

		// edges YZ
		(b[x ][ym][zm]<<14) | (b[x ][ym][zp]<<15) |
		(b[x ][yp][zm]<<16) | (b[x ][yp][zp]<<17) |

		// center
		(b[x ][y ][z ]<<18)
	);
}

function stepCA(){
	k++;
	let t = allocTemp();
	for(let x=0;x<sizex;x++)
	for(let y=0;y<sizey;y++)
	for(let z=0;z<sizez;z++)
		t[x][y][z] = rule[neighborhood(x,y,z)];
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
	let c = document.getElementById("myCanvas");
	let ctx = c.getContext("2d");
	c.width = sizex*size;
	c.height = sizey*size;
	ctx.fillStyle="black";
	ctx.fillRect(0,0,c.width,c.height);
	ctx.fillStyle="white";
	for(let x=0;x<sizex;x++)
	for(let y=0;y<sizey;y++)
		if(b[x][y][zslice])
			ctx.fillRect(x*size,y*size,size,size);
}

function setz(v){
	zslice=v|0;
	document.getElementById("zval").innerHTML=zslice;
	draw();
}

/* ================= CONTROL ================= */

function start(){
	if(!timerId){
		timerId=setInterval(()=>{stepCA();draw();},1);
		let btn = document.getElementById("btnStart");
		if(btn) btn.classList.add("active");
	}
}

function stop(){
	clearInterval(timerId);
	timerId=false;
	let btn = document.getElementById("btnStart");
	if(btn) btn.classList.remove("active");
}

function oneStep(){ stepCA(); draw(); }

/* ================= INIT STATE ================= */

function seedField(mode){
	if(mode==="random")
		for(let x=0;x<sizex;x++)
		for(let y=0;y<sizey;y++)
		for(let z=0;z<sizez;z++)
			b[x][y][z]=Math.random()<0.5;

	if(mode==="center")
		b[sizex>>1][sizey>>1][sizez>>1]=1;

	if(mode==="chunks"){
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

function clearpage(){
	k=0;
	alloc3();
	let m=document.querySelector("input[name=initState]:checked").value;
	seedField(m);
	zslice = m==="center" ? sizez>>1 : 0;
	document.getElementById("zslice").value=zslice;
	draw();
}

/* ================= RULE UI ================= */

function normalizeRuleString(str){
	let a=[];
	for(let i=0;i<str.length&&a.length<38;i++)
		a.push(str[i]==='1'?1:0);
	while(a.length<38)a.push(0);
	return a;
}

function ruleFromText(){
	r=normalizeRuleString(ruleInput.value);
	updateRuleCheckboxes();
	buildRule(); draw();
}

function ruleFromCheckboxes(){
	for(let i=0;i<38;i++)
		r[i]=document.getElementById("rbit"+i).checked?1:0;
	ruleInput.value=r.join("");
	buildRule(); draw();
}

function createRuleCheckboxes(){
	let r0=ruleBitsRow0, r1=ruleBitsRow1;
	r0.innerHTML=r1.innerHTML="";
	for(let i=0;i<38;i++){
		let cb=document.createElement("input");
		cb.type="checkbox";
		cb.id="rbit"+i;
		cb.onchange=ruleFromCheckboxes;
		(i<19?r0:r1).appendChild(cb);
	}
}

function updateRuleCheckboxes(){
	for(let i=0;i<38;i++)
		document.getElementById("rbit"+i).checked=!!r[i];
}



function onCaseModeChange() {
	if (useCaseRule.checked) {
		applyCaseRule();
	}
}

function initCaseSelectors() {
	const selA = document.getElementById('caseA');
	const selB = document.getElementById('caseB');

	for (let i = 0; i <= 19; i++) {
		const o1 = document.createElement('option');
		o1.value = i;
		o1.textContent = i;
		selA.appendChild(o1);

		const o2 = document.createElement('option');
		o2.value = i;
		o2.textContent = i;
		selB.appendChild(o2);
	}
	
	selA.value = 3; // center = 1
	selB.value = 3; // center = 0
}

/* ================= UI ================= */

function applyFieldSize(){
	sizex=sizey=sizez=parseInt(fieldSize.value);
	init();
}

function applyPixelSize(){
	size=parseInt(pixelSize.value);
	draw();
}

function nexta(){
	for(let i=0;i<38;i++) r[i] = Math.random() < 0.5 ? 1 : 0;
	ruleInput.value=r.join("");
	updateRuleCheckboxes();
	buildRule();
	clearpage();
}

function randomRule(){
	if (useCaseRule.checked) {
		applyCaseRule();
	} else {
		nexta();
	}
}

function onCaseParamsChange(){
	if (useCaseRule.checked) {
		applyCaseRule();
	}
}

/* ================= INIT ================= */

function init(){
	let s = document.getElementById("zslice");
	s.max = sizez - 1;
	s.value = 0;
	zslice = 0;
	
	createRuleCheckboxes();
	r=normalizeRuleString(ruleInput.value);
	updateRuleCheckboxes();
	buildRule();
	clearpage();
	initCaseSelectors();
}

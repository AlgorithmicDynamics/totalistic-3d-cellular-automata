// sound.js
var audioCtx = null;

function soundInit(){
	if (!audioCtx){
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
}

function piu(){
	soundInit();

	var o = audioCtx.createOscillator();
	var g = audioCtx.createGain();

	o.type = 'square';
	o.frequency.value = 1800;

	g.gain.value = 0.04;

	o.connect(g);
	g.connect(audioCtx.destination);

	o.start();
	o.stop(audioCtx.currentTime + 0.03);
}

function pau(){
	soundInit();

	var o = audioCtx.createOscillator();
	var g = audioCtx.createGain();

	o.type = 'square';
	o.frequency.value = 900;

	g.gain.value = 0.025;

	o.connect(g);
	g.connect(audioCtx.destination);

	o.start();
	o.stop(audioCtx.currentTime + 0.045);
}

var humOsc = null;
var humGain = null;

/*
function startHum(){
	soundInit();
	if (humOsc) return;

	humOsc = audioCtx.createOscillator();
	humGain = audioCtx.createGain();

	humOsc.type = 'square';
	humOsc.frequency.value = 90;   // deep, ominous
	humGain.gain.value = 0.008;    // VERY quiet

	humOsc.connect(humGain);
	humGain.connect(audioCtx.destination);

	humOsc.start();
}

function stopHum(){
	if (humOsc){
		humOsc.stop();
		humOsc = null;
		humGain = null;
	}
}
*/

var humDriftTimer = null;
var humBaseGain = 0.008;

function startHum(){
	soundInit();
	if (humOsc) return;

	humOsc = audioCtx.createOscillator();
	humGain = audioCtx.createGain();

	humOsc.type = 'square';
	humOsc.frequency.value = 90;

	humGain.gain.value = humBaseGain;

	humOsc.connect(humGain);
	humGain.connect(audioCtx.destination);

	humOsc.start();

	// very slow, irregular drift
	humDriftTimer = setInterval(function(){
		if (!humGain) return;

		var delta = (Math.random() * 0.10 - 0.05); // ±5%
		humGain.gain.value = humBaseGain * (1 + delta);
	}, 8000 + Math.random() * 12000); // every 8–20 sec
}

function stopHum(){
	if (humOsc){
		humOsc.stop();
		humOsc = null;
		humGain = null;
	}
	if (humDriftTimer){
		clearInterval(humDriftTimer);
		humDriftTimer = null;
	}
}
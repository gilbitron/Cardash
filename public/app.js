document.addEventListener('DOMContentLoaded', function(){
	var socket = io.connect('http://localhost:3000'),
		canvas = document.getElementById('canvas'),
		context = canvas.getContext('2d'),
		gauges = [],
		gaugesData = [],
		activeGauge = null;

	window.requestAnimFrame = (function(callback) {
		return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60);
		};
	})();

	socket.on('connection', function(monitors){
		gauges = monitors;
		activeGauge = gauges[0];

		gauges.forEach(function(gauge){
			socket.on(gauge, function(data) {
				if(!gaugesData[gauge]){
					gaugesData.length++;
				}
				gaugesData[gauge] = data;
			});
		});

		canvas.addEventListener('click', function(e) {
			e.preventDefault();
			var idx = gauges.indexOf(activeGauge);
			idx++;
			if(idx >= gauges.length) idx = 0;
			activeGauge = gauges[idx];
		});
	});

	socket.on('disconnect', function(monitors){
		gauges = [];
		gaugesData = [];
		activeGauge = null;
	});

	socket.on('disconnected', function(monitors){
		gauges = [];
		gaugesData = [];
		activeGauge = null;
	});

	var fontFace = '"Helvetica Neue", Helvetica, Arial, sans-serif',
		fontSize = 20,
		output = '';

	function animate(canvas, context) {
		context.clearRect(0, 0, canvas.width, canvas.height);

		if(typeof gaugesData[activeGauge] !== 'undefined'){
			context.textAlign = 'right';
			context.textBaseline = 'bottom';

			// Description
			fontSize = 21;
			output = gaugesData[activeGauge].description;
			do{
				fontSize--;
				context.font = fontSize +'px '+ fontFace;
			} while(context.measureText(output).width > canvas.width - 40);
			context.fillStyle = '#ccc';
			context.fillText(output, canvas.width - 20,  canvas.height - 20);

			// Units
			fontSize = 41;
			output = gaugesData[activeGauge].unit;
			do{
				fontSize--;
				context.font = fontSize +'px '+ fontFace;
			} while(context.measureText(output).width > canvas.width - 40);
			context.fillStyle = '#fff';
			context.fillText(output, canvas.width - 20,  canvas.height - 45);

			// Value
			fontSize = 101;
			output = Math.round(gaugesData[activeGauge].value);
			do{
				fontSize--;
				context.font = fontSize +'px '+ fontFace;
			} while(context.measureText(output).width > canvas.width - 40);
			context.fillStyle = '#fff';
			context.fillText(output, canvas.width - 20,  canvas.height - 80);

			// Percentage
			context.beginPath();
			context.moveTo(30, 30);
			context.lineTo(canvas.width - 30, 30);
			context.lineWidth = 15;
			context.strokeStyle = '#444';
			context.lineCap = 'round';
			context.stroke();

			var perc = Math.round(((gaugesData[activeGauge].value - gaugesData[activeGauge].min) / (gaugesData[activeGauge].max - gaugesData[activeGauge].min)) * 100);
			if(perc < 0) perc = 0;
			if(perc > 100) perc = 100;
			var width = Math.round((canvas.width - 60) * (perc / 100));
			context.beginPath();
			context.moveTo(30, 30);
			context.lineTo(width + 30, 30);
			context.lineWidth = 15;
			if(perc > 90){
				context.strokeStyle = '#E04644';
			} else {
				context.strokeStyle = '#B7D968';
			}
			context.lineCap = 'round';
			context.stroke();
		} else {
			context.font = '40px '+ fontFace;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillStyle = '#fff';
			context.fillText('No Data', canvas.width / 2,  canvas.height / 2);
		}

		requestAnimFrame(function() {
			animate(canvas, context);
		});
	}
	animate(canvas, context);
});

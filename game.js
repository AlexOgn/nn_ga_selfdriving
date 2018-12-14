const canvas = document.getElementById('maincanvas');
const context = canvas.getContext('2d');

const updateInterval = 20;
const maxTicksPerGeneration = 1500;

let ticksPerUpdate = 5;

let currentTick = 0;
let generationBeginTick = 0;

function dist(x1, y1, x2, y2) {
	return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2));
}

let generationHistory = [];

class generationHistoryDataPoint {
	constructor(generation, bestIndividual, averageScore) {
		this.generationId = generation;
		this.bestNN       = bestIndividual.nn;
		this.bestScore    = bestIndividual.score;
		this.averageScore = averageScore;
		this.date         = new Date();
	}
}

class UIBox {
	constructor(x, y, width, height, func) {
		this.x      = x;
		this.y      = y;
		this.width  = width;
		this.height = height;

		this.renderFunction = func;
	}
	render() {
		context.save();
		context.translate(this.x, this.y);
		context.scale(this.width, this.height);

		context.globalAlpha = 0.3;
		context.fillRect(0, 0, 1, 1);

		this.renderFunction();

		context.restore();
	}
}

let UIBoxes = [];
UIBoxes.push(new UIBox(400, 400, 200, 100, (startX, startY, width, height) => {
	let bestScore = 1;
	for(const hp of generationHistory) {
		if(hp.bestScore > bestScore) bestScore = hp.bestScore;
	}

	context.beginPath();
	context.moveTo(0, 1);
	for(let i = 0;i < generationHistory.length;i ++) {
		const hp = generationHistory[i];
		context.lineTo(i / generationHistory.length, 1 - hp.bestScore / bestScore);
	}
	context.lineTo(1, 1);
	context.closePath();

	context.globalAlpha = 0.2;
	context.fillStyle = "blue";
	context.fill();
}));

let attached = null;
let attachedType = null;

canvas.addEventListener('mousedown', (event) => {
	attached = null;
	for(const box of UIBoxes) {
		if(   box.x <= event.x && event.x <= box.x + box.width
		   && box.y <= event.y && event.y <= box.y + box.height) {
			   const d = dist(event.x, event.y, box.x + box.width, box.y + box.height);
			   attachedType = (d < canvas.width / 20);
			   attached = box;
		   }
	}
});
canvas.addEventListener('mouseup', (event) => {
	attached = null;
});

canvas.addEventListener('mousemove', (event) => {
	if(attached != null) {
		if(attachedType == 0) {
			attached.x += event.movementX;
			attached.y += event.movementY;
		} else {
			attached.width  += event.movementX;
			attached.height += event.movementY;
		}
	}

});

class Body {
	constructor(x, y, r) {
		this.x = x;
		this.y = y;
		this.r = r;
	}
	draw() {
		context.beginPath();
		context.arc(this.x, this.y, this.r, 0, 2*Math.PI);
		context.fill();
	}
}

class Car {
	constructor(x, y) {
		this.sensors = 8;
		this.nn = new Network([this.sensors+1, 5, 2], F_TanH);
		this.body = new Body(x, y, 10);
		this.sensorRadius = this.body.r * (3 / 5);
		this.angle = 0;
		this.speed = 0;
		this.score = 0;
		this.coll = false;
		this.marked = false;
	}

	collectInputFromSensors() {
		let input = [];

		const off = 2*Math.PI / this.sensors;
		for(let cs = 0;cs < this.sensors;cs ++) {
			const currSensAngle = this.angle + cs * off;
			const x = this.body.x + Math.cos(currSensAngle) * (this.body.r + this.sensorRadius);
			const y = this.body.y + Math.sin(currSensAngle) * (this.body.r + this.sensorRadius);
			let any = 0;
			for(let b of road) {
				if(dist(x, y, b.x, b.y) < this.sensorRadius + b.r) {
					any = 1;
					break;
				}
			}
			input[cs] = any;
		}

		return input;
	}

	run() {
		if(this.coll) return;

		let input = this.collectInputFromSensors();
		input.push(this.speed);
		const result = this.nn.run(input);

		let da = result[0];
		if(da < -0.2) da = -0.2;
		if(da >  0.2) da =  0.2;
		this.angle -= da;

		let ds = result[1];
		if(ds < -0.1) ds = -0.1;
		if(ds >  0.1) ds =  0.1;
		this.speed += ds;
		if(this.speed < -4) this.speed = -4;
		if(this.speed >  4) this.speed =  4;

		this.score += this.speed;

		this.body.x += Math.cos(this.angle) * this.speed;
		this.body.y += Math.sin(this.angle) * this.speed;

		for(let b of road) {
			if(dist(this.body.x, this.body.y, b.x, b.y) < this.body.r + b.r) {
				this.coll = true;
			}
		}
	}

	drawSensors() {
		context.save();

		const off = 2*Math.PI / this.sensors;
		for(let cs = 0;cs < this.sensors;cs ++) {
			const currSensAngle = this.angle + cs * off;
			const x = this.body.x + Math.cos(currSensAngle) * (this.body.r + this.sensorRadius);
			const y = this.body.y + Math.sin(currSensAngle) * (this.body.r + this.sensorRadius);

			context.fillStyle = "black";
			for(let b of road) {
				if(dist(x, y, b.x, b.y) < this.sensorRadius + b.r) {
					context.fillStyle = "red";
					break;
				}
			}

			context.beginPath();
			context.arc(x, y, this.sensorRadius, 0, 2*Math.PI);
			context.fill();
		}

		context.restore();
	}

	draw() {
		context.save();

		if(this.marked) {
			context.fillStyle = "yellow";
		} else {
			context.globalAlpha *= 0.2;
			context.fillStyle = "blue";
		}
		this.body.draw();

		if(!this.coll) this.drawSensors();

		context.restore();
	}
}

let road = [];
let cars = [];

let spawnX, spawnY;

let updateBarrier = (tick) => {};

const generateMap = (curves, curveScale) => {
	spawnX = 450;
	spawnY =  80;

	road = [];

	function generateRing(r, n, cx, cy) {
		for(let i = 0;i < n;i ++) {
			const a = i / n * 2*Math.PI;
			const mul = Math.sin(a * curves) * (curveScale / 20) + 1;

			let rad = 10;
			if(Math.random() < 0.2) rad += Math.random() * 15;

			road.push(new Body(r*mul * Math.cos(a) + cx, r*mul * Math.sin(a) + cy, rad));
		}
	}
	generateRing(200, 100, 400, 400);
	generateRing(350, 160, 400, 400);

	road.push(new Body(0, 0, 100));
	updateBarrier = (tick) => {
		road[road.length-1].x = Math.cos(tick / 230 - 0.60 * Math.PI) * 300 + 400;
		road[road.length-1].y = Math.sin(tick / 230 - 0.60 * Math.PI) * 300 + 400;
	}
	updateBarrier(0);
}

generateMap(8, 4);

for(let i = 0;i < 70;i ++) {
	cars.push(new Car(spawnX, spawnY));
}

let generations = 0;

function simulateTick() {
	currentTick ++;

	let alive = 0;
	for(let c of cars) {
		c.marked = false;
		alive += !c.coll;
		c.run();
	}

	let bestI = 0;
	for(let i = 1;i < cars.length;i ++) {
		if(cars[i].score > cars[bestI].score) bestI = i;
	}
	cars[bestI].marked = true;

	if(alive == 0 || currentTick - generationBeginTick > maxTicksPerGeneration) {
		console.log(generations, cars[bestI].score.toFixed(2), bestI)

		const bestNN = copyNN(cars[bestI].nn);
		let totalScore = 0;
		const mutationRate = 0.08;

		for(let i = 0;i < cars.length;i ++) {
			totalScore += cars[i].score; // acumulate before erasing the car
		}

		generationHistory.push(new generationHistoryDataPoint(generations,
		                       cars[bestI], totalScore / cars.length));

		for(let i = 0;i < cars.length;i ++) {
			cars[i] = new Car(spawnX, spawnY);
			cars[i].nn = copyNN(bestNN);
			/*const mutCnt = */mutate(cars[i].nn, (i == 0 ? 0 : mutationRate));
			//if(mutCnt < 1) console.log('mutation rate too low');
		}


		generations ++;
		generationBeginTick = currentTick + 1;

		//generateMap(6, Math.sin(generations / 10) / 2 + 2);
	}

	updateBarrier(currentTick - generationBeginTick);
}

function update() {
	const updateBegin = new Date();

	for(let i = 0;i < ticksPerUpdate;i ++) simulateTick();

	const updateEnd = new Date();
	const diff = updateEnd - updateBegin;
	/*
	if(diff > updateInterval) {
		console.log("Can't keep up", diff);
	}
	*/
}

function draw() {
	const drawBegin = new Date();

	for(let b of road) b.draw();

	context.globalAlpha = 0.5;
	for(let c of cars) c.draw();
	context.globalAlpha = 1;

	for(const box of UIBoxes) box.render();

	const drawEnd = new Date();
	const diff = drawEnd - drawBegin;
}

const render = () => {
	context.clearRect(0, 0, canvas.width, canvas.height);
	draw();
	requestAnimationFrame(render);
}
requestAnimationFrame(render);

setInterval(update, updateInterval);

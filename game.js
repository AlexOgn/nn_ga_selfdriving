const canvas = document.getElementById('maincanvas');
const context = canvas.getContext('2d');

const updateInterval = 20;
const maxTicksPerGeneration = 1000;

let currentTick = 0;
let generationBeginTick = 0;

function dist(x1, y1, x2, y2) {
	return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2));
}

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
		this.nn = new Network([this.sensors, 5, 5, 2]);
		this.body = new Body(x, y, 10);
		this.sensorRadius = this.body.r * (3 / 5);
		this.angle = 0;
		this.speed = 8;
		this.score = 0;
		this.coll = false;
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
		const result = this.nn.run(input);

		let da = result[0];
		if(da < -0.1) da = -0.1;
		if(da >  0.1) da =  0.1;
		this.angle += da;

		let ds = result[1];
		if(ds < -0.1) ds = -0.1;
		if(ds >  0.1) ds =  0.1;
		this.speed += ds;
		if(this.speed < 8) this.speed = 8;

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

		context.fillStyle = "blue";
		this.body.draw();

		this.drawSensors();

		context.restore();
	}
}

let road = [];
let cars = [];

function generateRing(r, n, cx, cy) {
	for(let i = 0;i < n;i ++) {
		const a = i / n * 2*Math.PI;
		road.push(new Body(r*Math.cos(a) + cx, r*Math.sin(a) + cy, 10));
	}
}
generateRing(270, 50, 400, 400);
generateRing(350, 80, 400, 400);

for(let i = 0;i < 10;i ++) {
	road.push(new Body(Math.random() * 300 + 200, Math.random() * 600, 20));
}

for(let i = 0;i < 70;i ++) {
	cars.push(new Car(450, 100));
}

let generations = 0;

function simulateTick() {
	currentTick ++;

	let alive = 0;
	for(let c of cars) {
		alive += !c.coll;
		c.run();
	}

	if(alive == 0 || currentTick - generationBeginTick > maxTicksPerGeneration) {
		let bestI = 0;
		for(let i = 1;i < cars.length;i ++) {
			if(cars[i].score > cars[bestI].score) {
				bestI = i;
			}
		}
		console.log(generations, cars[bestI].score, bestI)

		const bestNN = copyNN(cars[bestI].nn);
		for(let i = 0;i < cars.length;i ++) {
			cars[i] = new Car(450, 100);
			cars[i].nn = copyNN(bestNN);
			mutate(cars[i].nn, 0.05);
		}

		generations ++;
		generationBeginTick = currentTick + 1;
	}
}

function update() {
	const updateBegin = new Date();

	for(let i = 0;i < 5;i ++) simulateTick();

	const updateEnd = new Date();
	const diff = updateEnd - updateBegin;
	if(updateEnd - updateBegin > updateInterval) {
		console.log("Can't keep up", diff);
	}
}

function draw() {
	const drawBegin = new Date();

	for(let b of road) b.draw();

	context.globalAlpha = 0.5;
	for(let c of cars) c.draw();
	context.globalAlpha = 1;

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

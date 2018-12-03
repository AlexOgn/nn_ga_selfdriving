const canvas = document.getElementById('maincanvas');
const context = canvas.getContext('2d');

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
		this.sensorRadius = this.body.r * (3/5);
		this.angle = 0;
		this.speed = 2;
		this.score = 0;
		this.coll = false;
	}
	collectInputFromSensors() {
		const off = 2*Math.PI / this.sensors;
		let input = [];
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

		this.score += ds;

		this.body.x += Math.cos(this.angle) * this.speed;
		this.body.y += Math.sin(this.angle) * this.speed;

		for(let b of road) {
			if(dist(this.body.x, this.body.y, b.x, b.y) < this.body.r + b.r) {
				this.coll = true;
			}
		}
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

for(let i = 0;i < 100;i ++) {
	cars.push(new Car(450, 100));
}

function update() {
	let alive = 0;
	for(let c of cars) {
		alive += !c.coll;
		c.run();
	}
	if(alive == 0) {
		let bestI = 0;
		for(let i = 1;i < cars.length;i ++) {
			if(cars[i].score > cars[bestI].score) {
				bestI = i;
			}
		}
		console.log(cars[bestI].score, bestI)
	}
}

function draw() {
	for(let b of road) {
		b.draw();
	}
	context.globalAlpha = 0.5;
	for(let c of cars) {
		c.body.draw();
		const off = 2*Math.PI / c.sensors;
		for(let cs = 0;cs < c.sensors;cs ++) {
			const currSensAngle = c.angle + cs * off;
			const x = c.body.x + Math.cos(currSensAngle) * (c.body.r + c.sensorRadius);
			const y = c.body.y + Math.sin(currSensAngle) * (c.body.r + c.sensorRadius);
			context.fillStyle = "black";
			for(let b of road) {
				if(dist(x, y, b.x, b.y) < c.sensorRadius + b.r) {
					context.fillStyle = "red";
				}
			}
			context.beginPath();
			context.arc(x, y, c.sensorRadius, 0, 2*Math.PI);
			context.fill();
		}
		context.fillStyle = "black";
	}
	context.globalAlpha = 1;
}

const render = () => {
	context.clearRect(0, 0, canvas.width, canvas.height);
	draw();
	requestAnimationFrame(render);
}
requestAnimationFrame(render);

setInterval(update, 10);

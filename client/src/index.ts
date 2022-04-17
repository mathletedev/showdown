import { io } from "socket.io-client";

const socket = io(process.env.SERVER_URL!);
const menu = document.querySelector("div")!;
const join = document.querySelector("button") as HTMLButtonElement;
const name = document.querySelector("#name") as HTMLInputElement;
const room = document.querySelector("#room") as HTMLInputElement;
let canvas = document.querySelector("canvas") as HTMLCanvasElement;
let ctx = canvas.getContext("2d")!;
let playing = false;
let state: any;
let keys = {
	left: false,
	right: false,
	up: false,
	down: false
};
let ping = 0;
let last = performance.now();
let times: number[] = [];
let shooting = false;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
});

join.onclick = () => {
	if (name.value === "" || room.value === "") return;

	socket.emit("join", { name: name.value, room: room.value });
	playing = true;

	menu.style.opacity = "0";

	document.addEventListener("keydown", (ev) => handleKey(ev, true));
	document.addEventListener("keyup", (ev) => handleKey(ev, false));
};

const tick = () => {
	requestAnimationFrame(tick);

	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	if (!playing) return;

	ctx.fillStyle = "#ffffff";
	ctx.font = "12px Cascadia Code";

	for (const player in state?.players) {
		const pos = state.players[player].pos;
		const name = state.players[player].name;
		const hp = state.players[player].hp;

		ctx.fillRect(pos.x, pos.y, 20, 20);
		ctx.fillText(
			name,
			pos.x - ctx.measureText(name).width / 2 + 10,
			pos.y - 10
		);
		ctx.fillText(hp, pos.x - ctx.measureText(hp).width / 2 + 10, pos.y + 40);
	}

	for (const projectile of Object.values(state?.projectiles) as any)
		ctx.fillRect(projectile.x, projectile.y, 5, 5);

	ctx.font = "18px Cascadia Code";
	ctx.fillText(`ping: ${ping}ms`, 10, 24);

	const now = performance.now();
	while (times.length > 0 && times[0] <= now - 1000) times.shift();
	times.push(now);
	ctx.fillText(`fps: ${times.length}`, 10, 48);

	socket.emit("move", keys);
};

socket.on("tick", (_state) => {
	state = _state;
});

socket.on("end", () => {
	playing = false;
	menu.style.opacity = "100%";

	document.removeEventListener("keydown", (ev) => handleKey(ev, true));
	document.removeEventListener("keyup", (ev) => handleKey(ev, false));
});

socket.on("pong", () => {
	ping = performance.now() - last;
	last = performance.now();
});

const handleKey = (ev: KeyboardEvent, down: boolean) => {
	if (ev.repeat) return;

	switch (ev.key) {
		default:
			return;
		case "ArrowLeft":
		case "a":
			keys.left = down;
			break;
		case "ArrowRight":
		case "d":
			keys.right = down;
			break;
		case "ArrowUp":
		case "w":
			keys.up = down;
			break;
		case "ArrowDown":
		case "s":
			keys.down = down;
			break;
		case " ":
			if (down && !shooting) {
				socket.emit("shoot");
				shooting = true;
			} else if (!down) shooting = false;
			break;
	}

	ev.preventDefault();
};

setInterval(() => {
	last = performance.now();
	socket.emit("ping");
}, 1000 / 2);

requestAnimationFrame(tick);

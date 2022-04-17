import "dotenv-safe/config";
import { RemoteSocket, Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

const io = new Server(8080, { cors: { origin: process.env.CLIENT_URL } });

let rooms: any = {};

io.on("connection", (socket) => {
	socket.on("disconnecting", () => kill(socket));

	socket.on("join", ({ name, room }) => {
		socket.join(room);

		if (!rooms[room]) {
			rooms[room] = { players: {}, projectiles: [] };
		}
		rooms[room].players[socket.id] = {
			name,
			hp: 100,
			pos: { x: 0, y: 0 },
			vel: { x: 0, y: 0 }
		};
	});
	socket.on("move", (keys) => {
		const room = findRoom(socket.rooms);
		if (!room) return;

		let player = rooms[room].players[socket.id];

		if (keys.left) player.vel.x -= 0.5;
		if (keys.right) player.vel.x += 0.5;
		if (keys.up) player.vel.y -= 0.5;
		if (keys.down) player.vel.y += 0.5;

		player.pos.x += player.vel.x;
		player.pos.y += player.vel.y;

		player.vel.x *= 0.9;
		player.vel.y *= 0.9;
	});
	socket.on("shoot", () => {
		const room = findRoom(socket.rooms);
		if (!room) return;

		const pos = rooms[room].players[socket.id].pos;
		rooms[room].projectiles.push({ x: pos.x - 10, y: pos.y + 10 });
	});
	socket.on("ping", () => socket.emit("pong"));
});

const findRoom = (_rooms: Set<string>) => {
	for (const room of _rooms) {
		if (!!rooms[room]) return room;
	}
};

const kill = (socket: Socket | RemoteSocket<DefaultEventsMap, any>) => {
	const room = findRoom(socket.rooms);
	if (!room) return;

	delete rooms[room].players[socket.id];
	if (rooms[room].players.length === 0) delete rooms[room];
};

setInterval(async () => {
	for (const room in rooms) {
		let i = 0;

		while (i < rooms[room].projectiles.length) {
			const projectile = rooms[room].projectiles[i];
			projectile.x -= 4;

			for (const socket in rooms[room].players) {
				const player = rooms[room].players[socket];

				if (
					projectile.x < player.pos.x + 20 &&
					projectile.x > player.pos.x &&
					projectile.y < player.pos.y + 20 &&
					projectile.y > player.pos.y
				) {
					player.hp -= 5;
					if (player.hp <= 0) {
						kill((await io.to(socket).fetchSockets())[0]);

						io.to(socket).socketsLeave(room);
						io.to(socket).emit("end");
					}

					rooms[room].projectiles.splice(i, 1);
					continue;
				}
			}

			if (projectile.x < 0) {
				rooms[room].projectiles.splice(i, 1);
				continue;
			}

			i++;
		}

		io.to(room).emit("tick", rooms[room]);
	}
}, 1000 / 30);

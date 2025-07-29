importScripts('data/lyric-data.js', 'data/asciiarts-data.js', 'core.js');

let port;
let stage;
let workerPort;
self.onmessage = async (e) => {
	console.info("lyric worker running")
	stage = e.data;
	port = e.ports[0];

	//接收 abort信号
	port.onmessage = (e) => {
		if (e.data === 'abort') {
			if (workerPort) {
				workerPort.postMessage('abort');
			}
			self.postMessage("finished");
			console.log('lyric worker stoped')
			self.close();
		}
	};

	await draw();
	self.postMessage("finished");
};

async function draw() {
	const startTime = performance.now();
	let index = 0;
	let cursorX = 2;
	let cursorY = 2;
	const lyrics = LyricData.lyrics;

	while (lyrics[index].mode != 9) {
		let currentLyric = lyrics[index];
		let pastTime = (performance.now() - startTime) / 10;

		if (pastTime > currentLyric.time) {
			let wordCount = 0;
			let interval;

			if (currentLyric.mode <= 1 || currentLyric.mode >= 5) {
				wordCount = currentLyric.words.length;
			}

			if (wordCount == 0) {
				wordCount = 1;
			}

			if (currentLyric.interval < 0) {
				let nextLyric = lyrics[index + 1];
				interval = (nextLyric.time - currentLyric.time) / 100 / wordCount;
			} else {
				interval = currentLyric.interval / wordCount;
			}

			if (currentLyric.mode == 0) {
				let result = await drawLyrics(currentLyric.words, cursorX, cursorY, interval, true);
				cursorX = result.cursorX;
				cursorY = result.cursorY;
			} else if (currentLyric.mode == 1) {
				let result = await drawLyrics(currentLyric.words, cursorX, cursorY, interval, false);
				cursorX = result.cursorX;
				cursorY = result.cursorY;
			} else if (currentLyric.mode == 2) {
				drawArts(currentLyric.words, stage);
			} else if (currentLyric.mode == 3) {
				clearLyrics(stage);
				cursorX = 2;
				cursorY = 2;
			} else if (currentLyric.mode == 4) {
				// 播放音乐
				port.postMessage('play_music');
			} else if (currentLyric.mode == 5) {
				//启动credit线程
				const channel = new MessageChannel();
				workerPort = channel.port1;
				runCredit(channel.port2, stage);
				workerPort.onmessage = (e) => {
					const {
						x,
						y,
					} = e.data.position;
					print([x, y], e.data.content);
				};
			}

			index += 1;
		}

		await ccore.sleep(10)
	}
}

function print(position, content) {
	port.postMessage({
		position: {
			x: position[0],
			y: position[1]
		},
		content: content
	});
}

function runCredit(port, stage) {
	return new Promise(resovle => {
		const worker = new Worker('./credit.js');
		worker.postMessage(stage, [port]);
		worker.onmessage = (e) => {
			if (e.data === 'finished') {
				resovle();
			}
		};
	})
}

async function drawLyrics(str, cursorX, cursorY, interval, newLine) {
	for (let c of str) {
		print([cursorX, cursorY], c);
		await ccore.sleep(interval * 1000);
		if (c != '\0') {
			cursorX += 1;
		}
	}

	if (newLine) {
		cursorX = 2;
		cursorY += 1;
	}

	return {
		cursorX,
		cursorY
	};
}

async function drawArts(ch, stage) {
	for (var dy = 0; dy < stage.asciiArtHeight; dy++) {
		print([stage.asciiArtX, stage.asciiArtY + dy], AsciiArtsData.arts[ch][dy]);
		await ccore.sleep(10)
	}
}

function clearLyrics(stage) {
	let y = 2;
	for (let i = 0; i < stage.lyricHeight; i++) {
		print([2, y], `${' '.repeat(stage.lyricWidth)}\n`);
		y++;
	}
}
class Stage {
	#audio;
	#workerPort;
	#isEnd = false;
	constructor() {
		let termColumns = 80;
		let termLines = 24;

		termColumns = term.cols;
		termLines = term.rows;

		if (termColumns < 80 || termLines < 24) {
			throw new Error("the terminal size should be at least 80x24");
		}

		let asciiArtWidth = 40;
		let asciiArtHeight = 20;

		let creditsWidth = Math.min(Math.trunc((termColumns - 4) / 2), 56);
		let creditsHeight = termLines - asciiArtHeight - 2;

		let lyricWidth = termColumns - 4 - creditsWidth;
		let lyricHeight = termLines - 2;

		let asciiArtX = lyricWidth + 4 + Math.trunc((creditsWidth - asciiArtWidth) / 2);
		let asciiArtY = creditsHeight + 3;

		let creditsPosX = lyricWidth + 4;

		this.asciiArtHeight = asciiArtHeight;
		this.asciiArtX = asciiArtX;
		this.asciiArtY = asciiArtY;
		this.creditsWidth = creditsWidth;
		this.creditsHeight = creditsHeight;
		this.creditsPosX = creditsPosX;
		this.lyricHeight = lyricHeight;
		this.lyricWidth = lyricWidth;
	}

	async run() {
		return new Promise(async (resolve, reject) => {
			console.log("stage ->", JSON.stringify(this, null, 2));
			this.#beginDraw();
			this.#drawFrame();
			this.#moveTo(2, 2);
			await ccore.sleep(2000);

			if (this.#isEnd) {
				//确保在前两秒 ctrl+c退出后，不会执行后续代码
				reject(new Error('abort'));
				return;
			}

			const channel = new MessageChannel();
			this.#workerPort = channel.port1;

			//启动lyric线程
			let worker = runLyric(channel.port2, this);

			// 获取消息并打印或播放音乐
			this.#workerPort.onmessage = (e) => {
				if (e.data === 'play_music') {
					this.playMusic();
					return;
				}
				const {
					x,
					y
				} = e.data.position;
				if (x > 0 && y > 0) {
					this.#moveTo(x, y);
				}

				term.write(e.data.content);
			};

			//等待lyric线程执行完毕
			await worker;
			if (this.#isEnd) {
				reject(new Error('abort'));
				return;
			} else {
				resolve();
				return;
			}
		});
	}

	stop() {
		this.#isEnd = true;

		// 给其他worker发送abort信号
		if (this.#workerPort) {
			this.#workerPort.postMessage('abort');
		}

		//关闭音乐播放
		this.stopMusic();

		term.write('\x1b[0m');
		term.write('\x1b[?1049l');
		term.write('\x1b[0m');
	}

	#beginDraw() {
		term.write('\x1B[?1049h');
		term.write('\x1B[33;40;1m');
		term.write('\x1B[2J');
	}

	#drawFrame() {
		this.#moveTo(1, 1);

		this.#print(` ${'-'.repeat(this.lyricWidth)}  ${'-'.repeat(this.creditsWidth)} `, false);
		for (let i = 0; i < this.creditsHeight; i++) {
			this.#print(`|${' '.repeat(this.lyricWidth)}||${' '.repeat(this.creditsWidth)}|`, false);
		}

		this.#print(`|${' '.repeat(this.lyricWidth)}| ${'-'.repeat(this.creditsWidth)} `, false);

		for (let i = 0; i < this.lyricHeight - 1 - this.creditsHeight; i++) {
			this.#print(`|${' '.repeat(this.lyricWidth)}|`, true);
		}

		this.#print(` ${'-'.repeat(this.lyricWidth)} `, false);
	}

	#moveTo(x, y) {
		term.write(`\x1B[${y};${x}H`);
	}

	#print(str, newLine) {
		if (newLine) {
			term.writeln(str);
		} else {
			term.write(str);
		}
	}

	playMusic() {
		if (typeof plus === 'undefined') {
			this.#audio = document.getElementById("player");
			this.#audio.play();
		} else {
			this.#audio = plus.audio.createPlayer("/audio/sa1.mp3");
			this.#audio.play();
		}
	}

	stopMusic() {
		if (!this.#audio) return;

		if (typeof plus === 'undefined') {
			this.#audio.pause();
			this.#audio.currentTime = 0;
		} else {
			this.#audio.stop();
			this.#audio.close();
		}
		this.#audio = null;
	}
}

function runLyric(port, stage) {
	return new Promise(resovle => {
		const worker = new Worker('js/lyric.js');
		worker.postMessage(stage, [port]);
		worker.onmessage = (e) => {
			if (e.data === 'finished') {
				resovle();
			}
		};
	})
}
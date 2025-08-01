importScripts('data/credit-data.js', 'collection.js', 'core.js');

let port;
let stage;
self.onmessage = async (e) => {
	console.log("credit worker running")
	stage = e.data;
	port = e.ports[0];

	//接收 abort信号
	port.onmessage = (e) => {
		if (e.data === 'abort') {
			self.postMessage("finished");
			console.log('credit worker stoped')
			self.close();
		}
	};

	await draw();
	self.postMessage("finished");
};

async function draw() {
	let i = 0;
	let creditX = 0;
	let credits = CreditsData.credits
	let length = credits.length;
	const creditList = new DoublyLinkedList();
	creditList.prepend("");
	const startTime = performance.now();

	for (let ch of credits) {
		let duration = 174.0 / length * i;
		i += 1;

		if (ch == "\n") {
			creditX = 0;
			creditList.append("");

			if (creditList.count > stage.creditsHeight) {
				// 删掉前面多余不用显示的行
				for (let j = 0; j < creditList.count - stage.creditsHeight; j++) {
					creditList.removeFirst();
				}
			}

			for (let y = 2; y < 2 + stage.creditsHeight - creditList.count; y++) {
				print([stage.creditsPosX, y], ' '.repeat(stage.creditsWidth));
			}

			let k = 0;
			for (let credit of creditList) {
				let y = 2 + stage.creditsHeight - creditList.count + k;
				let count = stage.creditsWidth - credit.length;
				print([stage.creditsPosX, y], `${credit}${' '.repeat(count)}`);
				k += 1;
			}

		} else {
			creditList.tail.value = creditList.tail.value + ch;
			print([stage.creditsPosX + creditX, stage.creditsHeight + 1], ch);
			creditX += 1;
		}

		while ((performance.now() - startTime) / 1000 < duration) {
			await ccore.sleep(10);
		}
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
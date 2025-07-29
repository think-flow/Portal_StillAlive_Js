var ccore = {
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	
	isPlusAppByUA() {
	  const ua = navigator.userAgent.toLowerCase();
	  return ua.indexOf('html5plus') > -1;
	}
}
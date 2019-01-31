// @ts-ignore
import { Store } from './Store';

const store = new Store();

console.log('Store', store);

onmessage = (message: any) => {
	console.log('message', message);
	switch (message.action) {
		case 'get':
			postMessage(store.get.apply(null, message.args), [] as any);
			break;
		// case "apply":
		// 	self.postMessage(store.apply.apply(null, message.args), '');
		// 	break;
		// case "at":
		// 	self.postMessage(store.at.apply(null, message.args), '');
		// 	break;
		// case "path":
		// 	self.postMessage(store.at.apply(null, message.args), '');
		// 	break;
	}
};

export default self;

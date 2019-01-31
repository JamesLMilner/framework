import { WidgetBase } from '@dojo/framework/widget-core/WidgetBase';
import { v } from '@dojo/framework/widget-core/d';
import { ProjectorMixin } from '@dojo/framework/widget-core/mixins/Projector';
// import { Registry } from '@dojo/framework/widget-core/Registry';
// import { RouteConfig } from '@dojo/framework/routing/interfaces';
// import { registerRouterInjector } from '@dojo/framework/routing/RouterInjector';

import { Pointer } from '@dojo/framework/stores/state/Pointer';
import { WorkerStore } from '@dojo/framework/stores/Store';
import { OperationType } from '@dojo/framework/stores/state/Patch';

(() => {
	const workerStore = new WorkerStore();
	(async () => {
		const apply = workerStore.apply([
			{
				op: OperationType.REPLACE,
				path: new Pointer('/test'),
				value: 'test'
			}
		]);
		const applyValue = await apply;
		console.assert(Array.isArray(applyValue), 'replace should return array of ops');

		const path = workerStore.path('/test');
		const getValue = await workerStore.get(path);
		console.log('getValue', getValue);
		console.assert(getValue === 'test');

		workerStore.onChange([workerStore.path('test')], () => {
			console.log('path fired');
			console.assert(true, 'should fire onChange for test');
		});

		workerStore.on('invalidate', () => {
			console.assert(true, 'should invalidate');
		});
		const applyInvalidateValue = workerStore.apply(
			[
				{
					op: OperationType.REPLACE,
					path: new Pointer('/test'),
					value: 'test-invalidate'
				}
			],
			true
		);

		await applyInvalidateValue;
	})();
})();

// const BasicAppRouteConfig = { path: 'basic', outlet: 'basic'}
// const applicationRoutes: RouteConfig[] = [BasicAppRouteConfig, UrlParametersRouteConfig, AmbiguousMatchesRouteConfig];

// const registry = new Registry();
// registerRouterInjector(applicationRoutes, registry);

class App extends WidgetBase {
	protected render() {
		return v('div', [v('h1', ['Worker'])]);
	}
}

const Projector = ProjectorMixin(App);
const projector = new Projector();
// projector.setProperties({ registry });
projector.append();

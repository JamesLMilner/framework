import { Evented } from '../core/Evented';
import { Patch, PatchOperation } from './state/Patch';
import { Pointer } from './state/Pointer';
import Map from '../shim/Map';

/**
 * The "path" to a value of type T on and object of type M. The path string is a JSON Pointer to the location of
 * `value` within `state`.
 *
 */
export interface Path<M, T> {
	path: string;
	state: M;
	value: T;
}

/**
 * An interface that enables typed traversal of an arbitrary type M. `path` and `at` can be used to generate
 * `Path`s that allow access to properties within M via the `get` method. The returned `Path`s can also be passed to the
 * utility methods `add`, `replace`, and `delete` in order to generate typed operations for modifying the state of a store.
 */
export interface State<M> {
	get<S>(path: Path<M, S>): S;
	at<S extends Path<M, Array<any>>>(path: S, index: number): Path<M, S['value'][0]>;
	path: StatePaths<M>;
}

export interface StatePaths<M> {
	<T, P0 extends keyof T>(path: Path<M, T>, a: P0): Path<M, T[P0]>;
	<T, P0 extends keyof T, P1 extends keyof T[P0]>(path: Path<M, T>, a: P0, b: P1): Path<M, T[P0][P1]>;
	<T, P0 extends keyof T, P1 extends keyof T[P0], P2 extends keyof T[P0][P1]>(
		path: Path<M, T>,
		a: P0,
		b: P1,
		c: P2
	): Path<M, T[P0][P1][P2]>;
	<T, P0 extends keyof T, P1 extends keyof T[P0], P2 extends keyof T[P0][P1], P3 extends keyof T[P0][P1][P2]>(
		path: Path<M, T>,
		a: P0,
		b: P1,
		c: P2,
		d: P3
	): Path<M, T[P0][P1][P2][P3]>;
	<
		T,
		P0 extends keyof T,
		P1 extends keyof T[P0],
		P2 extends keyof T[P0][P1],
		P3 extends keyof T[P0][P1][P2],
		P4 extends keyof T[P0][P1][P2][P3]
	>(
		path: Path<M, T>,
		a: P0,
		b: P1,
		c: P2,
		d: P3,
		e: P4
	): Path<M, T[P0][P1][P2][P3][P4]>;
	<P0 extends keyof M>(a: P0): Path<M, M[P0]>;
	<P0 extends keyof M, P1 extends keyof M[P0]>(a: P0, b: P1): Path<M, M[P0][P1]>;
	<P0 extends keyof M, P1 extends keyof M[P0], P2 extends keyof M[P0][P1]>(a: P0, b: P1, c: P2): Path<
		M,
		M[P0][P1][P2]
	>;
	<P0 extends keyof M, P1 extends keyof M[P0], P2 extends keyof M[P0][P1], P3 extends keyof M[P0][P1][P2]>(
		a: P0,
		b: P1,
		c: P2,
		d: P3
	): Path<M, M[P0][P1][P2][P3]>;
	<
		P0 extends keyof M,
		P1 extends keyof M[P0],
		P2 extends keyof M[P0][P1],
		P3 extends keyof M[P0][P1][P2],
		P4 extends keyof M[P0][P1][P2][P3]
	>(
		a: P0,
		b: P1,
		c: P2,
		d: P3,
		e: P4
	): Path<M, M[P0][P1][P2][P3][P4]>;
}

interface OnChangeCallback {
	callbackId: number;
	callback: () => void;
}

interface OnChangeValue {
	callbacks: OnChangeCallback[];
	previousValue: any;
}

function isString(segment?: string): segment is string {
	return typeof segment === 'string';
}

/**
 * Application state store
 */
export class Store<T = any> extends Evented implements State<T> {
	/**
	 * The private state object
	 */
	private _state = {} as T;

	private _changePaths = new Map<string, OnChangeValue>();

	private _callbackId = 0;

	/**
	 * Returns the state at a specific pointer path location.
	 */
	public get = <U = any>(path: Path<T, U>): U => {
		return path.value;
	};

	/**
	 * Applies store operations to state and returns the undo operations
	 */
	public apply = (operations: PatchOperation<T>[], invalidate: boolean = false): PatchOperation<T>[] => {
		const patch = new Patch(operations);
		const patchResult = patch.apply(this._state);
		this._state = patchResult.object;
		if (invalidate) {
			this.invalidate();
		}
		return patchResult.undoOperations;
	};

	public at = <U = any>(path: Path<T, Array<U>>, index: number): Path<T, U> => {
		const array = this.get(path);
		const value = array && array[index];

		return {
			path: `${path.path}/${index}`,
			state: path.state,
			value
		};
	};

	public onChange = <U = any>(paths: Path<T, U> | Path<T, U>[], callback: () => void) => {
		const callbackId = this._callbackId;
		if (!Array.isArray(paths)) {
			paths = [paths];
		}
		paths.forEach((path) => this._addOnChange(path, callback, callbackId));
		this._callbackId += 1;
		return {
			remove: () => {
				(paths as Path<T, U>[]).forEach((path) => {
					const onChange = this._changePaths.get(path.path);
					if (onChange) {
						onChange.callbacks = onChange.callbacks.filter((callback) => {
							return callback.callbackId !== callbackId;
						});
					}
				});
			}
		};
	};

	private _addOnChange = <U = any>(path: Path<T, U>, callback: () => void, callbackId: number): void => {
		let changePaths = this._changePaths.get(path.path);
		if (!changePaths) {
			changePaths = { callbacks: [], previousValue: this.get(path) };
		}
		changePaths.callbacks.push({ callbackId, callback });
		this._changePaths.set(path.path, changePaths);
	};

	private _runOnChanges() {
		const callbackIdsCalled: number[] = [];
		this._changePaths.forEach((value: OnChangeValue, path: string) => {
			const { previousValue, callbacks } = value;
			const newValue = new Pointer(path).get(this._state);
			if (previousValue !== newValue) {
				this._changePaths.set(path, { callbacks, previousValue: newValue });
				callbacks.forEach((callbackItem) => {
					const { callback, callbackId } = callbackItem;
					if (callbackIdsCalled.indexOf(callbackId) === -1) {
						callbackIdsCalled.push(callbackId);
						callback();
					}
				});
			}
		});
	}

	/**
	 * Emits an invalidation event
	 */
	public invalidate(): any {
		this._runOnChanges();
		this.emit({ type: 'invalidate' });
	}

	public path: State<T>['path'] = (path: string | Path<T, any>, ...segments: (string | undefined)[]) => {
		if (typeof path === 'string') {
			segments = [path, ...segments];
		} else {
			segments = [...new Pointer(path.path).segments, ...segments];
		}

		const stringSegments = segments.filter<string>(isString);
		const hasMultipleSegments = stringSegments.length > 1;
		const pointer = new Pointer(hasMultipleSegments ? stringSegments : stringSegments[0] || '');

		return {
			path: pointer.path,
			state: this._state,
			value: pointer.get(this._state)
		};
	};
}

export interface AsyncState<M> {
	get<S>(path: Path<M, S>): Promise<S>;
	at<S extends Path<M, Array<any>>>(path: S, index: number): Promise<Path<M, S['value'][0]>>;
	path: StatePaths<M>;
}

export class WorkerStore<T = any> implements AsyncState<T> {
	private _worker: Worker;
	private _messageId: number;
	private _messageQueue: any;

	constructor() {
		this._messageId = 0;
		this._messageQueue = {};
		this._worker = this.createWorker();
		this._worker.onmessage = (message: any) => {
			if (this._messageQueue[message.id]) {
				this._messageQueue[message.id].resolve(message);
				delete this._messageQueue[message.id];
			}
		};
	}

	public get = async <U = any>(path: Path<T, U>): Promise<U> => {
		this._messageId++;
		const promise = new Promise((resolve) => {
			this._messageQueue[this._messageId] = resolve;
		});
		this._worker.postMessage([{ action: 'get', args: path }]);
		return (await promise) as U;
	};

	public apply = async (
		operations: PatchOperation<T>[],
		invalidate: boolean = false
	): Promise<PatchOperation<T>[]> => {
		return Promise.resolve({} as PatchOperation<T, any>[]);
	};

	public at = async <U = any>(path: Path<T, Array<U>>, index: number): Promise<Path<T, U>> => {
		return Promise.resolve({} as Path<T, U>);
	};

	public path: State<T>['path'] = (path: string | Path<T, any>, ...segments: (string | undefined)[]) => {
		if (typeof path === 'string') {
			segments = [path, ...segments];
		} else {
			segments = [...new Pointer(path.path).segments, ...segments];
		}

		const stringSegments = segments.filter<string>(isString);
		const hasMultipleSegments = stringSegments.length > 1;
		const pointer = new Pointer(hasMultipleSegments ? stringSegments : stringSegments[0] || '');

		return {
			path: pointer.path,
			state: {} as T,
			value: pointer.get({} as T)
		};
	};

	private createWorker() {
		return new Worker('/dist/worker/src/stores/WorkerStore.js');
	}
}

export default Store;

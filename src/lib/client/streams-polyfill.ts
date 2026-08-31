export function installPdfJsPolyfills() {
  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, resolve, reject };
    };
  }

  const stream = globalThis.ReadableStream;

  if (!stream?.prototype) {
    return;
  }

  const proto = stream.prototype as unknown as {
    values?: () => AsyncIterableIterator<unknown>;
    getReader: () => ReadableStreamDefaultReader;
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
  };

  if (typeof proto.values !== "function") {
    proto.values = function values(this: { getReader: () => ReadableStreamDefaultReader }) {
      const reader = this.getReader();

      return {
        async next() {
          return reader.read();
        },
        async return() {
          await reader.cancel();

          return { done: true as const, value: undefined };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
  }

  if (typeof proto[Symbol.asyncIterator] !== "function") {
    proto[Symbol.asyncIterator] = function asyncIterator(
      this: { values: () => AsyncIterableIterator<unknown> },
    ) {
      return this.values();
    };
  }
}

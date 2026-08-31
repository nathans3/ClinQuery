type LockedFn<T> = () => Promise<T>;
type Mutex = <T>(work: LockedFn<T>) => Promise<T>;

const mutexes = new Map<string, Mutex>();

function createMutex(): Mutex {
  let tail: Promise<void> = Promise.resolve();

  return function run<T>(work: LockedFn<T>): Promise<T> {
    const result = tail.then(work, work);
    tail = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
}

export async function withDocumentLock<T>(
  id: string,
  work: LockedFn<T>,
): Promise<T> {
  const existing = mutexes.get(id);
  const mutex = existing ?? createMutex();

  if (!existing) {
    mutexes.set(id, mutex);
  }

  return mutex(work);
}

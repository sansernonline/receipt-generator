const tails = new Map<string, Promise<void>>();

// runs tasks with the same key one after another, in the order they were asked for
// simple: in memory, so it only protects one server process (ADR: one Windows Server process)
export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (tails.get(key) ?? Promise.resolve()).then(task);
  const tail = run.then(() => undefined, () => undefined); // a failed task must not block the next one
  tails.set(key, tail);
  void tail.then(() => tails.get(key) === tail && tails.delete(key));
  return run;
}

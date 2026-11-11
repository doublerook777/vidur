/** A tiny observable, so screens can subscribe without a state library. */
export class Store<T> {
  private subs = new Set<() => void>();
  constructor(private value: T) {}
  get(): T {
    return this.value;
  }
  set(next: T): void {
    this.value = next;
    this.subs.forEach((f) => f());
  }
  update(patch: Partial<T>): void {
    this.set({ ...this.value, ...patch });
  }
  subscribe(f: () => void): () => void {
    this.subs.add(f);
    return () => this.subs.delete(f);
  }
}

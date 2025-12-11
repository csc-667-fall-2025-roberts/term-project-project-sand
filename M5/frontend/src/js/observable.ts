class Observable<T> {
  private value: T;
  private subscribers: ((newValue: T) => void)[] = [];

  constructor(value: T) {
    this.value = value;
  }

  private notify(): void {
    this.subscribers.forEach((subscriber) => subscriber(this.value));
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): void {
    this.value = newValue;
    this.notify();
  }

  subscribe(callback: (newValue: T) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(
        (subscriber) => subscriber !== callback,
      );
    };
  }
}

export default Observable;

class Observable<T> {
  private value: T;
  private subscribers: ((newValue: T) => void)[] = [];

  constructor(initialValue: T, subscribers: ((newValue: T) => void)[] = []) {
    this.value = initialValue;
    this.subscribers = subscribers;
    this.notify();
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

  private notify(): void {
    this.subscribers.forEach((subscriber) => subscriber(this.value));
  }
}

export default Observable;

import type { User } from "../api";
import Observable from "../observable";

class UserStorage extends Observable<User | null> {
  private static readonly KEY = "user";

  constructor(
    initialValue: User | null = null,
    subscribers: ((newValue: User | null) => void)[] = [],
  ) {
    super(initialValue, subscribers);
    const value = this.get();
    if (value !== initialValue) {
      super.set(value);
    }
  }

  clear(): void {
    window.localStorage.removeItem(UserStorage.KEY);
    super.set(null);
  }

  get(): User | null {
    const user = window.localStorage.getItem(UserStorage.KEY);
    try {
      return JSON.parse(user ?? "null");
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  set(user: User | null): void {
    window.localStorage.setItem(UserStorage.KEY, JSON.stringify(user));
    super.set(user);
  }
}

export default UserStorage;

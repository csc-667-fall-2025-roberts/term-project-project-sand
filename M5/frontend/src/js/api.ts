export interface User {
  id: string;
  email: string;
  name: string;
}

class ApiClient {
  private baseUrl: URL;

  constructor(origin: string) {
    this.baseUrl = new URL("/api", origin);
  }

  private async fetch<T>(url: string, options: RequestInit): Promise<T | null> {
    try {
      const requestUrl = new URL(url, this.baseUrl.origin);
      const fullUrl = new URL(
        this.baseUrl.pathname + requestUrl.pathname,
        this.baseUrl.origin,
      );
      const response = await fetch(fullUrl, {
        credentials: "include",
        ...options,
      });

      return response.json();
    } catch (_error) {
      return null;
    }
  }

  async whoAmI(): Promise<User | null> {
    return this.fetch("/whoami", { method: "GET" });
  }
}

export const client = new ApiClient(import.meta.env.VITE_API_ORIGIN);

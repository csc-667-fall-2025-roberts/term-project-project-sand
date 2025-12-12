export interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AccessTokenResponse {
  token: string;
}

const REFRESH_LEAD_TIME_MS = 2 * 60 * 1000;

class ApiClient {
  private baseUrl: URL;
  private accessToken: string | null = null;
  private accessTokenExpiry: number | null = null;
  private refreshTimer: number | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(origin: string) {
    this.baseUrl = new URL("/api", origin);
  }

  private buildUrl(path: string): URL {
    const requestUrl = new URL(path, this.baseUrl.origin);
    return new URL(
      this.baseUrl.pathname + requestUrl.pathname,
      this.baseUrl.origin,
    );
  }

  private decodeAccessTokenExpiry(token: string): number | null {
    try {
      const [, payload] = token.split(".");
      if (!payload) {
        return null;
      }

      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(normalized);
      const parsed = JSON.parse(decoded) as { exp?: number };
      if (typeof parsed.exp !== "number") {
        return null;
      }

      return parsed.exp * 1000;
    } catch (error) {
      console.warn("Unable to decode access token exp", error);
      return null;
    }
  }

  private shouldRefreshSoon(): boolean {
    if (!this.accessTokenExpiry) {
      return false;
    }

    return Date.now() >= this.accessTokenExpiry - REFRESH_LEAD_TIME_MS;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.accessTokenExpiry) {
      return;
    }

    const delay = this.accessTokenExpiry - REFRESH_LEAD_TIME_MS - Date.now();
    if (delay <= 0) {
      void this.refreshAccessToken();
      return;
    }

    this.refreshTimer = window.setTimeout(
      () => void this.refreshAccessToken(),
      delay,
    );
  }

  private setAccessToken(token: string): void {
    this.accessToken = token;
    this.accessTokenExpiry = this.decodeAccessTokenExpiry(token);
    this.scheduleRefresh();
  }

  private clearAccessToken(): void {
    this.accessToken = null;
    this.accessTokenExpiry = null;

    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.requestAccessToken("/refresh")
      .catch(() => null)
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async requestAccessToken(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<string | null> {
    const response = await this.fetchInternal(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      },
      { skipAuth: true, retryOn401: false },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AccessTokenResponse;
    if (!data.token) {
      return null;
    }

    this.setAccessToken(data.token);
    return data.token;
  }

  private async fetchInternal(
    path: string,
    options: RequestInit,
    config: { skipAuth?: boolean; retryOn401?: boolean } = {},
  ): Promise<Response> {
    const { skipAuth = false, retryOn401 = true } = config;
    const url = this.buildUrl(path);
    const headers = new Headers(options.headers ?? {});

    if (!skipAuth) {
      if (!this.accessToken) {
        await this.refreshAccessToken();
      }

      if (this.shouldRefreshSoon()) {
        await this.refreshAccessToken();
      }

      if (this.accessToken) {
        headers.set("Authorization", `Bearer ${this.accessToken}`);
      }
    }

    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });

    if (response.status !== 401 || skipAuth || !retryOn401) {
      return response;
    }

    const refreshed = await this.refreshAccessToken();
    if (!refreshed) {
      await this.logout(true);
      return response;
    }

    headers.set("Authorization", `Bearer ${refreshed}`);
    const retryResponse = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });

    if (retryResponse.status === 401) {
      await this.logout(true);
    }

    return retryResponse;
  }

  async login(credentials: { email: string; password: string }): Promise<User> {
    const response = await this.fetchInternal(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      },
      { skipAuth: true, retryOn401: false },
    );

    if (!response.ok) {
      throw new Error("Unable to login");
    }

    const data = (await response.json()) as AccessTokenResponse & {
      user?: User;
    };
    if (!data.token) {
      throw new Error("Missing access token");
    }

    this.setAccessToken(data.token);
    if (data.user) {
      return data.user;
    }

    const user = await this.whoAmI();
    if (!user) {
      throw new Error("Unable to load user");
    }

    return user;
  }

  async register(payload: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<User> {
    const response = await this.fetchInternal(
      "/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { skipAuth: true, retryOn401: false },
    );

    if (!response.ok) {
      throw new Error("Unable to register");
    }

    const data = (await response.json()) as AccessTokenResponse & {
      user?: User;
    };

    if (!data.token) {
      throw new Error("Missing access token");
    }

    this.setAccessToken(data.token);

    if (data.user) {
      return data.user;
    }

    const user = await this.whoAmI();
    if (!user) {
      throw new Error("Unable to load user");
    }

    return user;
  }

  async logout(redirect = false): Promise<void> {
    this.clearAccessToken();
    try {
      await this.fetchInternal(
        "/logout",
        { method: "POST" },
        { skipAuth: true, retryOn401: false },
      );
    } catch (error) {
      console.warn("Logout request failed", error);
    }

    if (redirect) {
      window.location.href = "/login";
    }
  }

  async whoAmI(): Promise<User | null> {
    try {
      const response = await this.fetchInternal("/whoami", { method: "GET" });
      if (!response.ok) {
        if (response.status === 401) {
          await this.logout(true);
        }
        return null;
      }
      return response.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async fetch(
    path: string,
    options: RequestInit,
    config?: { skipAuth?: boolean; retryOn401?: boolean },
  ): Promise<Response> {
    return this.fetchInternal(path, options, config);
  }
}

export const client = new ApiClient(import.meta.env.VITE_API_ORIGIN);

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface GameListItem {
  id: string;
  name: string;
  game_code: string;
  status: string;
  max_players: number;
  current_players: number;
  created_at: string | Date;
  is_participant: boolean;
  participant_id: string | null;
}

export interface DashboardChatMessage {
  id: string;
  message: string;
  created_at: string | Date;
  user_id: string;
  display_name: string;
}

export interface GameChatMessage {
  id: string;
  message: string;
  created_at: string | Date;
  user_id: string;
  display_name: string;
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

  async getSocketToken(): Promise<string | null> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }
    if (this.shouldRefreshSoon()) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
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
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to register");
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

  async listGames(): Promise<GameListItem[]> {
    const response = await this.fetchInternal("/games", { method: "GET" });
    if (!response.ok) {
      throw new Error("Unable to load games");
    }
    const data = (await response.json()) as { games?: GameListItem[] };
    return data.games ?? [];
  }

  async createGame(payload: {
    max_players: number;
    starting_balance: number;
    token_color: string;
    name?: string;
  }): Promise<{ game_id: string; game_code: string; participant_id: string }> {
    const response = await this.fetchInternal("/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to create game");
    }

    return response.json();
  }

  async joinByCode(payload: {
    game_code: string;
    token_color: string;
  }): Promise<{ game_id: string; participant_id: string }> {
    const response = await this.fetchInternal("/games/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to join game");
    }

    return response.json();
  }

  async joinGame(
    gameId: string,
    payload: { token_color: string },
  ): Promise<{ participant_id: string }> {
    const response = await this.fetchInternal(`/games/${gameId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to join game");
    }

    return response.json();
  }

  async joinAuto(
    gameId: string,
  ): Promise<{ participant_id: string; token_color?: string | null }> {
    const response = await this.fetchInternal(`/games/${gameId}/join-auto`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Unable to join game");
    }

    return response.json();
  }

  async startGame(gameId: string): Promise<void> {
    const response = await this.fetchInternal(`/games/${gameId}/start`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Unable to start game");
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    const response = await this.fetchInternal(`/games/${gameId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Unable to delete game");
    }
  }

  async getGameState(gameId: string): Promise<unknown> {
    const response = await this.fetchInternal(`/games/${gameId}/state`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error("Unable to load game state");
    }
    return response.json();
  }

  async roll(
    gameId: string,
    payload?: { pay_to_leave_jail?: boolean; use_goojf?: boolean },
  ): Promise<unknown> {
    const response = await this.fetchInternal(`/games/${gameId}/turn/roll`, {
      method: "POST",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to roll dice");
    }
    return response.json();
  }

  async buy(
    gameId: string,
    tileId: string,
    pendingActionId: string,
  ): Promise<void> {
    const response = await this.fetchInternal(
      `/games/${gameId}/properties/${tileId}/buy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_action_id: pendingActionId }),
      },
    );
    if (!response.ok) {
      throw new Error("Unable to buy property");
    }
  }

  async payRent(
    gameId: string,
    tileId: string,
    pendingActionId: string,
  ): Promise<unknown> {
    const response = await this.fetchInternal(
      `/games/${gameId}/properties/${tileId}/pay-rent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_action_id: pendingActionId }),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to pay rent");
    }
    return response.json();
  }

  async sellProperty(gameId: string, tileId: string): Promise<void> {
    const response = await this.fetchInternal(
      `/games/${gameId}/properties/${tileId}/sell`,
      { method: "POST" },
    );
    if (!response.ok) {
      throw new Error("Unable to sell property");
    }
  }

  async payBankDebt(gameId: string, pendingActionId: string): Promise<void> {
    const response = await this.fetchInternal(`/games/${gameId}/debts/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending_action_id: pendingActionId }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to pay debt");
    }
  }

  async declareBankruptcy(
    gameId: string,
    pendingActionId: string,
  ): Promise<void> {
    const response = await this.fetchInternal(
      `/games/${gameId}/debts/bankrupt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_action_id: pendingActionId }),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to declare bankruptcy");
    }
  }

  async endTurn(gameId: string): Promise<unknown> {
    const response = await this.fetchInternal(`/games/${gameId}/turn/end`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Unable to end turn");
    }
    return response.json();
  }

  async listDashboardChat(): Promise<DashboardChatMessage[]> {
    const response = await this.fetchInternal("/chat/dashboard", {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error("Unable to load chat");
    }
    const data = (await response.json()) as {
      messages?: DashboardChatMessage[];
    };
    return data.messages ?? [];
  }

  async sendDashboardChat(message: string): Promise<void> {
    const response = await this.fetchInternal("/chat/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error("Unable to send message");
    }
  }

  async listGameChat(gameId: string): Promise<ChatMessageForUi[]> {
    const response = await this.fetchInternal(`/games/${gameId}/chat`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error("Unable to load game chat");
    }
    const data = (await response.json()) as { messages?: GameChatMessage[] };
    const messages = data.messages ?? [];
    return messages.map((m) => ({
      id: m.id,
      message: m.message,
      created_at: m.created_at,
      user: { id: m.user_id, displayName: m.display_name },
    }));
  }

  async sendGameChat(gameId: string, message: string): Promise<void> {
    const response = await this.fetchInternal(`/games/${gameId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error("Unable to send game message");
    }
  }

  async upgradeProperty(gameId: string, tileId: string): Promise<void> {
    //const res = await fetch(`/api/games/${gameId}/properties/${tileId}/upgrade`, { method: "POST" });
    const response =  await this.fetchInternal(`/games/${gameId}/properties/${tileId}/upgrade`, {
      method: "POST"
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error ?? "Upgrade failed");
    }
  }

}

function resolveApiOrigin(): string {
  const envValue = (import.meta.env.VITE_API_ORIGIN as string | undefined)
    ?.trim()
    .replace(/\/+$/, ""); // Remove trailing slash
  if (envValue) return envValue;
  return window.location.origin;
}

export const client = new ApiClient(resolveApiOrigin());

export interface ChatMessageForUi {
  id: string;
  message: string;
  created_at: string | Date;
  user: { id: string; displayName: string };
}

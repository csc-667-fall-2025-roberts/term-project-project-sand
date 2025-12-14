import { client, type GameListItem } from "./api";
import type { SelectComponent } from "./components/select";
import UserStorage from "./storage/user";
import { clearFormError, setFormError, toggleBusy } from "./utils/form";
import { connectRealtime } from "./realtime";

const userStorage = new UserStorage(null);

function queryRequired<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function setSelectOptions(select: SelectComponent, options: string[]): void {
  select.options = options.map((v) => ({
    value: v,
    label: v ? v[0].toUpperCase() + v.slice(1) : v,
  }));
}

function renderGameCard(
  game: GameListItem,
  opts: { kind: "mine" | "other" },
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className =
    "rounded-lg border-2 border-amber-200 bg-linear-to-br from-white to-amber-50 p-5 transition-all duration-200 hover:scale-[1.01] hover:border-amber-400 hover:shadow-xl";

  const statusLabel =
    game.status === "waiting"
      ? "Waiting"
      : game.status === "playing"
        ? "Playing"
        : "Ended";

  wrap.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1">
        <h3 class="mb-1 text-lg font-bold text-gray-800">${escapeHtml(
          game.name,
        )}</h3>
        <p class="mt-1 text-sm text-gray-700">
          Code:
          <span class="rounded bg-amber-100 px-2 py-1 font-mono font-bold text-amber-700">${escapeHtml(
            game.game_code,
          )}</span>
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span class="text-gray-600"
            >Players:
            <span class="font-semibold text-gray-800">${game.current_players}/${game.max_players}</span></span
          >
          <span class="rounded-full border-2 border-amber-300 bg-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
            ${statusLabel}
          </span>
        </div>
      </div>
      <div class="ml-2 flex gap-2">
        <component-button data-join-game size="sm" type="button">${
          opts.kind === "mine" ? "Resume" : "Open"
        }</component-button>
      </div>
    </div>
  `;

  const btn = wrap.querySelector<HTMLElement>("[data-join-game]");
  btn?.addEventListener("click", async () => {
    try {
      if (opts.kind === "other") {
        if (game.status !== "waiting") {
          alert("You can only join games that are waiting.");
          return;
        }
        await client.joinAuto(game.id);
      }

      window.location.href = `/game?gameId=${encodeURIComponent(game.id)}`;
    } catch (error) {
      console.error(error);
      alert("Unable to open game.");
    }
  });

  return wrap;
}

async function ensureAuthed(): Promise<void> {
  const local = userStorage.get();
  if (local) return;

  const user = await client.whoAmI();
  if (!user) {
    window.location.href = "/login";
    return;
  }

  userStorage.set(user);
}

async function loadGames(): Promise<void> {
  const games = await client.listGames();

  const myList = queryRequired<HTMLDivElement>("myGamesList");
  const otherList = queryRequired<HTMLDivElement>("otherGamesList");
  myList.innerHTML = "";
  otherList.innerHTML = "";

  const myGames = games.filter((g) => g.is_participant);
  const otherGames = games.filter((g) => !g.is_participant);

  for (const game of myGames) {
    myList.appendChild(renderGameCard(game, { kind: "mine" }));
  }

  for (const game of otherGames) {
    otherList.appendChild(renderGameCard(game, { kind: "other" }));
  }
}

function renderDashboardChatMessage(
  container: HTMLElement,
  msg: unknown,
): void {
  const payload =
    msg && typeof msg === "object" ? (msg as Record<string, unknown>) : {};
  const row = document.createElement("div");
  row.className = "flex items-center gap-2";

  const createdAt = payload["created_at"] as string | Date | undefined;
  const message =
    typeof payload["message"] === "string" ? payload["message"] : "";
  const user = payload["user"];
  const displayName =
    isRecord(user) && typeof user["displayName"] === "string"
      ? user["displayName"]
      : typeof payload["display_name"] === "string"
        ? payload["display_name"]
        : "Player";

  row.innerHTML = `
    <span class="text-xs text-gray-500">${formatTime(createdAt ?? new Date())}</span>
    <div>
      <span class="font-semibold text-blue-600">${escapeHtml(displayName)}</span>:
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

async function loadDashboardChat(): Promise<void> {
  const box = queryRequired<HTMLDivElement>("dashboardChatMessages");
  box.innerHTML = "";
  const history = await client.listDashboardChat();
  for (const msg of history) {
    renderDashboardChatMessage(box, msg);
  }
}

async function wireDashboardChat(): Promise<void> {
  const form = queryRequired<HTMLFormElement>("dashboardChatForm");
  const box = queryRequired<HTMLDivElement>("dashboardChatMessages");

  const realtime = await connectRealtime();
  realtime.on("chat:dashboard:message", (payload) => {
    renderDashboardChatMessage(box, payload);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormError(form);
    toggleBusy(form, true);

    try {
      const field = form.querySelector<HTMLInputElement>(
        "input[name='dashboardMessage']",
      );
      const message = field?.value.trim() ?? "";
      if (!message) return;

      await client.sendDashboardChat(message);
      if (field) field.value = "";
    } catch (error) {
      console.error(error);
      setFormError(form, "Unable to send message.");
    } finally {
      toggleBusy(form, false);
    }
  });
}

function wireMaxPlayersSelect(): void {
  const select = document.getElementById("maxPlayersSelect") as SelectComponent;
  if (!select) return;

  select.options = [
    { value: "2", label: "2 Players" },
    { value: "3", label: "3 Players" },
    { value: "4", label: "4 Players" },
    { value: "5", label: "5 Players" },
    { value: "6", label: "6 Players" },
  ];
}

function wireTokenColorSelects(): void {
  const colors = ["red", "blue", "green", "yellow", "purple", "black"];

  const createSelect = document.getElementById(
    "createTokenColorSelect",
  ) as SelectComponent | null;
  if (createSelect) {
    setSelectOptions(createSelect, colors);
  }

  const joinSelect = document.getElementById(
    "joinTokenColorSelect",
  ) as SelectComponent | null;
  if (joinSelect) {
    setSelectOptions(joinSelect, colors);
  }
}

async function wireCreateGame(): Promise<void> {
  const button = queryRequired<HTMLElement>("createGame");
  button.addEventListener("click", async () => {
    try {
      const nameInput = document.querySelector<HTMLInputElement>(
        "input[name='gameName']",
      );
      const balanceInput = document.querySelector<HTMLInputElement>(
        "input[name='startingBalance']",
      );
      const maxPlayersSelect = document.getElementById(
        "maxPlayersSelect",
      ) as SelectComponent;
      const colorSelect = document.getElementById(
        "createTokenColorSelect",
      ) as SelectComponent;

      const maxPlayers = parseInt(maxPlayersSelect.value || "4", 10);
      const tokenColor = colorSelect.value;
      const startingBalance = parseInt(balanceInput?.value || "1500", 10);

      const result = await client.createGame({
        max_players: maxPlayers,
        starting_balance: startingBalance,
        token_color: tokenColor,
        name: nameInput?.value.trim() || undefined,
      });

      window.location.href = `/game?gameId=${encodeURIComponent(result.game_id)}`;
    } catch (error) {
      console.error(error);
      alert("Unable to create game.");
    }
  });
}

async function wireJoinByCode(): Promise<void> {
  const button = queryRequired<HTMLElement>("joinByCode");
  button.addEventListener("click", async () => {
    try {
      const codeInput = document.querySelector<HTMLInputElement>(
        "input[name='joinGameCode']",
      );
      const joinSelect = document.getElementById(
        "joinTokenColorSelect",
      ) as SelectComponent;

      const game_code = (codeInput?.value ?? "").trim().toUpperCase();
      const token_color = joinSelect.value;

      if (!game_code) {
        alert("Game code is required.");
        return;
      }
      if (!token_color) {
        alert("Token color is required.");
        return;
      }

      const result = await client.joinByCode({ game_code, token_color });
      window.location.href = `/game?gameId=${encodeURIComponent(result.game_id)}`;
    } catch (error) {
      console.error(error);
      alert("Unable to join game.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void (async () => {
    await ensureAuthed();
    wireMaxPlayersSelect();
    wireTokenColorSelects();
    await wireCreateGame();
    await wireJoinByCode();

    const refresh = queryRequired<HTMLElement>("refreshGames");
    refresh.addEventListener("click", async () => {
      await loadGames();
    });

    await loadGames();
    await loadDashboardChat();
    await wireDashboardChat();
  })();
});

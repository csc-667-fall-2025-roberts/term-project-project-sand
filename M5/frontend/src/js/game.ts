import { client } from "./api";
import type { User } from "./api";
import UserStorage from "./storage/user";
import { connectRealtime } from "./realtime";
import clsx from "clsx";

interface GameState {
  game_id: string;
  created_by: string;
  last_roll_participant_id: string | null;
  last_roll_turn_number: number | null;
  last_roll_dice_1: number | null;
  last_roll_dice_2: number | null;
  last_roll_is_double: boolean | null;
  last_roll_previous_position: number | null;
  last_roll_new_position: number | null;
  last_roll_action_taken: string | null;
  recent_moves: {
    turn_id: string;
    participant_id: string;
    turn_number: number;
    created_at: string | Date;
    dice_roll_1: number | null;
    dice_roll_2: number | null;
    is_double: boolean | null;
    previous_position: number | null;
    new_position: number | null;
    action_taken: string | null;
  }[];
  recent_transactions: {
    id: string;
    created_at: string | Date;
    turn_id: string | null;
    turn_number: number | null;
    from_participant_id: string | null;
    to_participant_id: string | null;
    amount: number;
    transaction_type: string;
    description: string | null;
  }[];
  board: {
    id: string;
    position: number;
    name: string;
    tile_type: string;
    property_group: string | null;
    purchase_price: number | null;
    rent_base: number | null;
    owner_participant_id: string | null;
    houses: number | null;
    hotels: number | null;
    is_mortgaged: boolean | null;
  }[];
  players: {
    id: string;
    user_id: string;
    display_name: string;
    position: number;
    cash: number;
    jail_turns: number;
    goojf_cards: number;
    is_bankrupt: boolean;
    in_jail: boolean;
    token_color: string | null;
  }[];
  current_player_id: string | null;
  phase: string;
  turn_number: number;
  self: {
    participant_id: string;
    balance: number;
  };
}

interface PlayerOptionsPayload {
  game_id: string;
  player_id: string;
  context: string;
  options: Record<string, unknown>[];
}

interface ChatMessage {
  id: string;
  message: string;
  created_at: string | Date;
  user: { id: string; displayName: string };
}

const userStorage = new UserStorage(null);
let lastHighlightedMoveKey: string | null = null;
let clearMoveHighlightTimer: number | null = null;
let lastHighlightedTransactionKey: string | null = null;
let clearTransactionHighlightTimer: number | null = null;

function queryRequired<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el as T;
}

function parseGameId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("gameId");
}

function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderChatMessage(
  container: HTMLElement,
  msg: ChatMessage,
  tokenColor: string | null,
): void {
  const style = colorForToken(tokenColor);
  const row = document.createElement("div");
  row.className = "flex items-center gap-2";
  row.innerHTML = `
    <span class="text-xs text-gray-500">${formatTime(msg.created_at)}</span>
    <div>
      <span class="inline-flex items-center gap-1 font-semibold ${style.textClass}">
        <span class="inline-block h-2.5 w-2.5 rounded-full ${style.bgClass}"></span>
        <span>${escapeHtml(msg.user.displayName)}</span>
      </span>:
      <span>${escapeHtml(msg.message)}</span>
    </div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorForToken(token: string | null): {
  textClass: string;
  bgClass: string;
  ringClass: string;
} {
  const c = (token ?? "").toLowerCase();
  switch (c) {
    case "red":
      return {
        textClass: "text-red-700",
        bgClass: "bg-red-500",
        ringClass: "ring-red-300",
      };
    case "blue":
      return {
        textClass: "text-blue-700",
        bgClass: "bg-blue-500",
        ringClass: "ring-blue-300",
      };
    case "green":
      return {
        textClass: "text-green-700",
        bgClass: "bg-green-500",
        ringClass: "ring-green-300",
      };
    case "yellow":
      return {
        textClass: "text-amber-700",
        bgClass: "bg-amber-400",
        ringClass: "ring-amber-300",
      };
    case "purple":
      return {
        textClass: "text-purple-700",
        bgClass: "bg-purple-500",
        ringClass: "ring-purple-300",
      };
    case "black":
      return {
        textClass: "text-gray-900",
        bgClass: "bg-gray-900",
        ringClass: "ring-gray-400",
      };
    default:
      return {
        textClass: "text-gray-800",
        bgClass: "bg-gray-500",
        ringClass: "ring-gray-300",
      };
  }
}

function cssColorForToken(token: string | null): string {
  const c = (token ?? "").toLowerCase();
  switch (c) {
    case "red":
      return "#ef4444";
    case "blue":
      return "#3b82f6";
    case "green":
      return "#22c55e";
    case "yellow":
      return "#f59e0b";
    case "purple":
      return "#a855f7";
    case "black":
      return "#111827";
    default:
      return "#6b7280";
  }
}

function withAlphaHex(hex: string, alphaHex: string): string {
  // `#RRGGBB` -> `#RRGGBBAA`
  const normalized = hex.trim();
  if (!normalized.startsWith("#") || normalized.length !== 7) return hex;
  return normalized + alphaHex;
}

function tilePlayersBackgroundImage(colors: string[]): string | null {
  const unique = [...new Set(colors.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return null;

  const n = unique.length;
  const stops: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const start = Math.floor((i / n) * 100);
    const end = Math.floor(((i + 1) / n) * 100);
    const c = withAlphaHex(unique[i], "1A");
    stops.push(`${c} ${start}%`, `${c} ${end}%`);
  }
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

function renderBoard(state: GameState): void {
  const container = queryRequired<HTMLDivElement>("boardTiles");
  container.innerHTML = "";

  const tokenByParticipant = new Map(
    state.players.map((p) => [p.id, p.token_color] as const),
  );

  for (const tile of state.board) {
    const isOwned = Boolean(tile.owner_participant_id);
    const ownerIsSelf = tile.owner_participant_id === state.self.participant_id;
    const ownerToken = tile.owner_participant_id
      ? (tokenByParticipant.get(tile.owner_participant_id) ?? null)
      : null;
    const ownerStyle = isOwned ? colorForToken(ownerToken) : null;

    const playersHere = state.players.filter(
      (p) => p.position === tile.position,
    );
    const playerColors = playersHere.map((p) =>
      cssColorForToken(p.token_color),
    );

    const el = document.createElement("div");
    el.className = clsx(
      "flex min-h-24 flex-col gap-1 rounded-lg border p-1 text-xs shadow-sm",
      {
        "border-gray-200 bg-white": true,
        "ring-2 ring-offset-1": ownerStyle,
        [ownerStyle?.ringClass ?? "ring-gray-300"]: ownerStyle,
      },
    );

    const bgImage = tilePlayersBackgroundImage(playerColors);
    if (playersHere.length === 1 && playerColors.length === 1) {
      el.style.backgroundImage = "";
      el.style.backgroundColor = withAlphaHex(playerColors[0], "1A");
    } else if (bgImage) {
      el.style.backgroundColor = "";
      el.style.backgroundImage = bgImage;
    } else {
      el.style.backgroundImage = "";
      el.style.backgroundColor = "";
    }

    const tokensHtml =
      playersHere.length > 0
        ? `<div class="flex flex-wrap gap-1">${playersHere
            .map((p) => {
              const style = colorForToken(p.token_color);
              return `<span class="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold ring-1 ${style.ringClass}">
                <span class="inline-block h-2.5 w-2.5 rounded-full ${style.bgClass}"></span>
                <span class="${style.textClass}">${escapeHtml(
                  p.display_name,
                )}</span>
              </span>`;
            })
            .join("")}</div>`
        : "";

    const ownerTag = isOwned
      ? (() => {
          const label = ownerIsSelf ? "Yours" : "Owned";
          return `<span class="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold ring-1 ${
            ownerStyle?.ringClass ?? "ring-gray-300"
          }" title="${ownerIsSelf ? "Owned by you" : "Owned by another player"}">
            <span class="inline-block h-2.5 w-2.5 rounded-full ${
              ownerStyle?.bgClass ?? "bg-gray-500"
            }"></span>
            <span class="${ownerStyle?.textClass ?? "text-gray-800"}">${escapeHtml(
              label,
            )}</span>
          </span>`;
        })()
      : "";

    const buildingHtml =
      tile.owner_participant_id && (tile.houses || tile.hotels)
        ? `<div class="text-[10px] font-semibold text-gray-800">
            ${tile.hotels ? "🏨 Hotel" : `🏠 Houses: ${tile.houses ?? 0}`}
          </div>`
        : "";

    const price =
      tile.purchase_price != null
        ? `<div class="text-[10px] text-gray-600">$${tile.purchase_price}</div>`
        : "";

    el.innerHTML = `
      <div class="flex text-wrap items-start justify-between gap-1">
        <div class="font-semibold text-gray-900">
          ${tile.position}. ${escapeHtml(tile.name)}
        </div>
        ${ownerTag}
      </div>
      <div class="flex flex-wrap items-end justify-between gap-1 flex-1">
        <div>
          <div class="text-[10px] text-gray-500">
            ${escapeHtml(tile.tile_type)}
          </div>
          ${buildingHtml}
          ${price}
        </div>
        ${tokensHtml}
      </div>
    `;

    container.appendChild(el);
  }
}

function renderPlayers(state: GameState): void {
  const container = queryRequired<HTMLDivElement>("playersList");
  container.innerHTML = "";

  for (const p of state.players) {
    const isCurrent = p.id === state.current_player_id;
    const isSelf = p.id === state.self.participant_id;
    const derivedInJail = p.in_jail && p.position === 9;
    const playerColor = colorForToken(p.token_color);

    const row = document.createElement("div");
    row.className = clsx("rounded-lg border p-2", {
      "border-amber-300 bg-amber-50": isCurrent,
      "border-gray-200 bg-white": !isCurrent,
    });

    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <div class="font-semibold ${playerColor.textClass}">
            ${escapeHtml(p.display_name)}${isSelf ? " (You)" : ""}
          </div>
          <div class="text-xs text-gray-600">Pos: ${p.position} • Cash: $${p.cash}</div>
          ${
            derivedInJail || p.goojf_cards > 0
              ? `<div class="text-[11px] text-gray-600">
            ${derivedInJail ? `In jail (${p.jail_turns}/3)` : ""}
            ${p.goojf_cards > 0 ? `${derivedInJail ? " • " : ""}GOJF: ${p.goojf_cards}` : ""}
          </div>`
              : ""
          }
        </div>
        ${
          p.is_bankrupt || derivedInJail
            ? `<div class="text-xs text-gray-700">
          ${p.is_bankrupt ? "Bankrupt" : derivedInJail ? "In Jail" : ""}
        </div>`
            : ""
        }
      </div>
    `;

    container.appendChild(row);
  }
}

function renderMoves(state: GameState): void {
  const container = queryRequired<HTMLDivElement>("movesList");
  container.innerHTML = "";

  const nameByParticipant = new Map(
    state.players.map((p) => [p.id, p.display_name] as const),
  );
  const tokenByParticipant = new Map(
    state.players.map((p) => [p.id, p.token_color] as const),
  );

  function summarizeAction(actionTaken: string | null): string {
    if (!actionTaken) return "";
    const parts = actionTaken
      .split(" | ")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter(
        (p) =>
          !p.toLowerCase().startsWith("you rolled") &&
          !p.toLowerCase().startsWith("moved from") &&
          !p.toLowerCase().startsWith("stayed on"),
      );
    return parts.join(" • ");
  }

  const moves = [...(state.recent_moves ?? [])].sort(
    (a, b) => (b.turn_number ?? 0) - (a.turn_number ?? 0),
  );

  const latest = moves.length > 0 ? moves[0] : null;
  const latestKey = latest ? latest.turn_id : null;
  if (latestKey && latestKey !== lastHighlightedMoveKey) {
    lastHighlightedMoveKey = latestKey;
    if (clearMoveHighlightTimer != null) {
      window.clearTimeout(clearMoveHighlightTimer);
    }
    clearMoveHighlightTimer = window.setTimeout(() => {
      const el = document.getElementById(`move-${latestKey}`);
      if (el) {
        el.classList.remove("bg-amber-50", "ring-1", "ring-amber-200");
      }
      clearMoveHighlightTimer = null;
    }, 3000);
  }

  if (moves.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-gray-500";
    empty.textContent = "No moves yet.";
    container.appendChild(empty);
    return;
  }

  for (const m of moves.slice(0, 30)) {
    const who = nameByParticipant.get(m.participant_id) ?? "Player";
    const whoColor = colorForToken(
      tokenByParticipant.get(m.participant_id) ?? null,
    );
    const dice =
      m.dice_roll_1 != null && m.dice_roll_2 != null
        ? `${m.dice_roll_1}+${m.dice_roll_2}`
        : "-";
    const from =
      m.previous_position != null ? String(m.previous_position) : "?";
    const to = m.new_position != null ? String(m.new_position) : "?";
    const note = summarizeAction(m.action_taken);
    const activeCount = state.players.filter((p) => !p.is_bankrupt).length;
    const round =
      activeCount > 0 ? Math.floor((m.turn_number - 1) / activeCount) + 1 : 0;

    const row = document.createElement("div");
    row.id = `move-${m.turn_id}`;
    const shouldHighlight = Boolean(
      m.turn_id && m.turn_id === lastHighlightedMoveKey,
    );
    row.className = clsx("rounded-md text-xs text-gray-700", {
      "bg-amber-50 ring-1 ring-amber-200": shouldHighlight,
    });
    row.innerHTML = `
      <span class="text-gray-500">R${round} • #${m.turn_number}:</span>
      <span class="${whoColor.textClass} font-semibold">${escapeHtml(who)}</span>
      <span>rolled ${escapeHtml(dice)} (${escapeHtml(from)}→${escapeHtml(to)})</span>
      ${note ? `<span class="text-gray-600"> • ${escapeHtml(note)}</span>` : ""}
    `;
    container.appendChild(row);
  }
}

function renderTransactions(state: GameState): void {
  const container = queryRequired<HTMLDivElement>("transactionsList");
  container.innerHTML = "";

  const nameByParticipant = new Map(
    state.players.map((p) => [p.id, p.display_name] as const),
  );
  const tokenByParticipant = new Map(
    state.players.map((p) => [p.id, p.token_color] as const),
  );

  const txs = [...(state.recent_transactions ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (txs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-gray-500";
    empty.textContent = "No transactions yet.";
    container.appendChild(empty);
    return;
  }

  const latest = txs.length > 0 ? txs[0] : null;
  const latestKey = latest ? latest.id : null;
  if (latestKey && latestKey !== lastHighlightedTransactionKey) {
    lastHighlightedTransactionKey = latestKey;
    if (clearTransactionHighlightTimer != null) {
      window.clearTimeout(clearTransactionHighlightTimer);
    }
    clearTransactionHighlightTimer = window.setTimeout(() => {
      const el = document.getElementById(`tx-${latestKey}`);
      if (el) {
        el.classList.remove("bg-amber-50", "ring-1", "ring-amber-200");
      }
      clearTransactionHighlightTimer = null;
    }, 3000);
  }

  const activeCount = state.players.filter((p) => !p.is_bankrupt).length;

  for (const tx of txs.slice(0, 50)) {
    const fromName = tx.from_participant_id
      ? (nameByParticipant.get(tx.from_participant_id) ?? "Bank")
      : "Bank";
    const toName = tx.to_participant_id
      ? (nameByParticipant.get(tx.to_participant_id) ?? "Bank")
      : "Bank";

    const move =
      typeof tx.turn_number === "number" && tx.turn_number > 0
        ? tx.turn_number
        : null;
    const round =
      move && activeCount > 0 ? Math.floor((move - 1) / activeCount) + 1 : null;
    const prefix = move ? `R${round ?? 0} • #${move} • ` : "";

    const row = document.createElement("div");
    row.id = `tx-${tx.id}`;
    const shouldHighlight = Boolean(
      tx.id && tx.id === lastHighlightedTransactionKey,
    );
    row.className = clsx("rounded-md text-xs text-gray-700", {
      "bg-amber-50 ring-1 ring-amber-200": shouldHighlight,
    });
    const fromColor = colorForToken(
      tx.from_participant_id
        ? (tokenByParticipant.get(tx.from_participant_id) ?? null)
        : null,
    );
    const toColor = colorForToken(
      tx.to_participant_id
        ? (tokenByParticipant.get(tx.to_participant_id) ?? null)
        : null,
    );
    row.innerHTML = `
      ${prefix ? `<span class="text-gray-500">${escapeHtml(prefix)}</span>` : ""}
      <span class="font-semibold text-gray-800">${escapeHtml(
        tx.transaction_type,
      )}</span>: <span class="font-semibold">$${tx.amount}</span>
      <span class="text-gray-500"> • </span>
      <span class="${fromColor.textClass} font-semibold">${escapeHtml(
        fromName,
      )}</span>
      <span class="text-gray-500"> → </span>
      <span class="${toColor.textClass} font-semibold">${escapeHtml(
        toName,
      )}</span>
      ${
        tx.description
          ? `<span class="text-gray-600"> • ${escapeHtml(tx.description)}</span>`
          : ""
      }
    `;
    container.appendChild(row);
  }
}

function renderMeta(state: GameState): void {
  const title = queryRequired<HTMLDivElement>("gameTitle");
  const meta = queryRequired<HTMLDivElement>("gameMeta");
  const banner = queryRequired<HTMLDivElement>("gameBanner");

  title.textContent = `Game ${state.game_id}`;
  const activeCount = state.players.filter((p) => !p.is_bankrupt).length;
  const roundNumber =
    state.turn_number > 0 && activeCount > 0
      ? Math.floor((state.turn_number - 1) / activeCount) + 1
      : 0;

  const parts: string[] = [`Phase: ${state.phase}`];
  parts.push(`Round: ${roundNumber}`);
  parts.push(`Move: ${state.turn_number}`);

  if (
    state.last_roll_participant_id &&
    state.last_roll_dice_1 != null &&
    state.last_roll_dice_2 != null
  ) {
    const who =
      state.players.find((p) => p.id === state.last_roll_participant_id)
        ?.display_name ?? "Player";
    const total = state.last_roll_dice_1 + state.last_roll_dice_2;
    const from =
      state.last_roll_previous_position != null
        ? String(state.last_roll_previous_position)
        : "?";
    const to =
      state.last_roll_new_position != null
        ? String(state.last_roll_new_position)
        : "?";
    parts.push(
      `Last roll: ${who} rolled ${state.last_roll_dice_1}+${state.last_roll_dice_2}=${total} (${from}→${to})`,
    );
  }

  meta.textContent = parts.join(" • ");

  if (state.phase === "ended") {
    banner.classList.remove("hidden");
    banner.textContent = "Game ended.";
  }

  queryRequired<HTMLSpanElement>("selfBalance").textContent =
    "$" + String(state.self.balance);
}

function isMyTurn(state: GameState): boolean {
  return state.current_player_id === state.self.participant_id;
}

function hasRolledThisTurnFromState(state: GameState): boolean {
  if (state.phase !== "playing") return false;
  if (!isMyTurn(state)) return false;
  return state.last_roll_participant_id === state.current_player_id;
}

function setActionBanner(text: string | null): void {
  const banner = queryRequired<HTMLDivElement>("gameBanner");
  if (!text) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }

  banner.classList.remove("hidden");
  banner.textContent = text;
}

function renderOptions(
  state: GameState,
  payload: PlayerOptionsPayload | null,
  ui: { hasRolledThisTurn: boolean },
  handlers: {
    onRoll: (payload?: {
      pay_to_leave_jail?: boolean;
      use_goojf?: boolean;
    }) => Promise<void>;
    onEndTurn: () => Promise<void>;
    onStartGame: () => Promise<void>;
    onDeleteGame: () => Promise<void>;
    onBuy: (tileId: string, pendingActionId: string) => Promise<void>;
    onPayRent: (tileId: string, pendingActionId: string) => Promise<void>;
    onSkip: (pendingActionId: string) => Promise<void>;
    onSellProperty: (tileId: string) => Promise<void>;
    onPayBankDebt: (pendingActionId: string) => Promise<void>;
    onDeclareBankruptcy: (pendingActionId: string) => Promise<void>;
  },
): void {
  const container = queryRequired<HTMLDivElement>("actionOptions");
  container.innerHTML = "";

  const canAct = state.phase === "playing" && isMyTurn(state);
  const selfPlayer = state.players.find(
    (p) => p.id === state.self.participant_id,
  );
  const selfInJail = Boolean(selfPlayer?.in_jail);
  const selfHasGoojf = (selfPlayer?.goojf_cards ?? 0) > 0;
  const selfCash = selfPlayer?.cash ?? 0;

  function addButton(params: {
    label: string;
    variant?: string;
    disabled?: boolean;
    onClick: () => void | Promise<void>;
  }): void {
    const button = document.createElement("component-button");
    button.setAttribute("type", "button");
    button.className = "w-full";
    if (params.variant) button.setAttribute("variant", params.variant);
    if (params.disabled) button.toggleAttribute("disabled", true);
    button.textContent = params.label;
    button.addEventListener("click", () => void params.onClick());
    container.appendChild(button);
  }

  function addSellButtons(): void {
    const owned = state.board
      .filter((t) => t.owner_participant_id === state.self.participant_id)
      .filter((t) => (t.purchase_price ?? 0) > 0);
    if (owned.length === 0) return;

    for (const tile of owned) {
      const price = tile.purchase_price ?? 0;
      const saleValue = Math.floor(price / 2);
      addButton({
        label: `Sell ${tile.name} (+$${saleValue})`,
        variant: "secondary",
        disabled: !canAct,
        onClick: async () => {
          await handlers.onSellProperty(tile.id);
        },
      });
    }
  }

  const rawOptions = payload?.options ?? [];
  const actionableOptions = rawOptions.filter((opt) => {
    const action = typeof opt["action"] === "string" ? opt["action"] : "";
    // roll/end-turn are rendered as core actions below to avoid duplicates.
    return action !== "roll_dice" && action !== "end_turn";
  });

  // Pending decision actions (buy/rent/skip) take precedence over core actions.
  if (actionableOptions.length > 0) {
    for (const opt of actionableOptions) {
      const action =
        typeof opt["action"] === "string" ? (opt["action"] as string) : "";
      const pendingActionId =
        typeof opt["pending_action_id"] === "string"
          ? (opt["pending_action_id"] as string)
          : "";

      const tileId =
        typeof opt["property_id"] === "string"
          ? (opt["property_id"] as string)
          : "";

      if (action === "buy_property") {
        const tile = tileId ? state.board.find((t) => t.id === tileId) : null;
        const tileName = tile?.name ? String(tile.name) : "property";
        const cost =
          typeof opt["cost"] === "number" ? Math.trunc(opt["cost"]) : null;
        const selfCash = selfPlayer?.cash ?? 0;
        const canAfford = cost != null && cost > 0 ? selfCash >= cost : false;
        const label =
          cost != null
            ? canAfford
              ? `Buy ${tileName} ($${cost})`
              : `Buy ${tileName} ($${cost}) — insufficient funds`
            : `Buy ${tileName} (invalid cost)`;

        addButton({
          label,
          disabled:
            !canAct ||
            !tileId ||
            !pendingActionId ||
            cost == null ||
            !canAfford,
          onClick: async () => {
            if (!tileId || !pendingActionId) return;
            await handlers.onBuy(tileId, pendingActionId);
          },
        });
        continue;
      }

      if (action === "pay_rent") {
        const amount =
          typeof opt["amount"] === "number" ? Math.trunc(opt["amount"]) : null;
        const canPay =
          amount != null && amount > 0 ? selfCash >= amount : false;
        const label =
          amount != null
            ? canPay
              ? `Pay rent ($${amount})`
              : `Pay rent ($${amount}) — sell properties first`
            : "Pay rent (invalid amount)";
        addButton({
          label,
          disabled:
            !canAct || !tileId || !pendingActionId || amount == null || !canPay,
          onClick: async () => {
            if (!tileId || !pendingActionId) return;
            await handlers.onPayRent(tileId, pendingActionId);
          },
        });
        continue;
      }

      if (action === "pay_bank_debt") {
        const amount =
          typeof opt["amount"] === "number" ? Math.trunc(opt["amount"]) : null;
        const canPay =
          amount != null && amount > 0 ? selfCash >= amount : false;
        const label =
          amount != null
            ? canPay
              ? `Pay Bank ($${amount})`
              : `Pay Bank ($${amount}) — sell properties first`
            : "Pay Bank (invalid amount)";
        addButton({
          label,
          disabled:
            !canAct ||
            !pendingActionId ||
            amount == null ||
            amount <= 0 ||
            !canPay,
          onClick: async () => {
            if (!pendingActionId) return;
            await handlers.onPayBankDebt(pendingActionId);
          },
        });
        continue;
      }

      if (action === "declare_bankruptcy") {
        addButton({
          label: "Declare bankruptcy",
          variant: "secondary",
          disabled: !canAct || !pendingActionId,
          onClick: async () => {
            if (!pendingActionId) return;
            await handlers.onDeclareBankruptcy(pendingActionId);
          },
        });
        continue;
      }

      if (action === "skip_purchase") {
        addButton({
          label: "Skip purchase",
          variant: "secondary",
          disabled: !canAct || !pendingActionId,
          onClick: async () => {
            if (!pendingActionId) return;
            await handlers.onSkip(pendingActionId);
          },
        });
        continue;
      }
    }

    addSellButtons();
    return;
  }

  if (state.phase === "waiting") {
    const me = userStorage.get();
    const isCreator = Boolean(me?.id) && me?.id === state.created_by;
    const canStart = isCreator && state.players.length >= 2;

    if (isCreator) {
      addButton({
        label: canStart ? "Start game" : "Start game (need at least 2 players)",
        disabled: !canStart,
        onClick: async () => {
          if (!canStart) return;
          await handlers.onStartGame();
        },
      });
      return;
    }

    addButton({
      label: "Waiting for host to start...",
      variant: "secondary",
      disabled: true,
      onClick: () => undefined,
    });
    return;
  }

  // Core actions: roll dice OR end turn, only when allowed.
  if (!canAct) {
    addButton({
      label: "Waiting for other player...",
      variant: "secondary",
      disabled: true,
      onClick: () => undefined,
    });
    return;
  }

  if (!ui.hasRolledThisTurn) {
    if (canAct && selfInJail) {
      addButton({
        label: "Roll for doubles",
        onClick: () => handlers.onRoll(),
      });
      const canPayJail = selfCash >= 50;
      addButton({
        label: canPayJail
          ? "Pay $50 and roll"
          : "Pay $50 and roll (insufficient funds)",
        disabled: !canPayJail,
        onClick: () => handlers.onRoll({ pay_to_leave_jail: true }),
      });
      if (selfHasGoojf) {
        addButton({
          label: "Use Get Out of Jail Free and roll",
          onClick: () => handlers.onRoll({ use_goojf: true }),
        });
      }
      addSellButtons();
    } else {
      addButton({
        label: "Roll dice",
        onClick: () => handlers.onRoll(),
      });
      addSellButtons();
    }
    return;
  }

  addButton({
    label: "End turn",
    variant: "secondary",
    onClick: handlers.onEndTurn,
  });

  addSellButtons();
}

function renderPropertyUpgrades(
  state: GameState,
  pending: PlayerOptionsPayload | null,
  handlers: { onUpgradeProperty: (tileId: string) => Promise<void> },
): void {
  const container = document.getElementById("propertyUpgrades");
  if (!container) return;

  const canAct = state.phase === "playing" && isMyTurn(state) && !pending;

  const owned = state.board
    .filter(
      (t) =>
        t.owner_participant_id === state.self.participant_id &&
        t.tile_type === "property",
    )
    .sort((a, b) => a.position - b.position);

  if (owned.length === 0) {
    container.innerHTML =
      '<div class="text-xs text-gray-500">You don\'t own any upgradable properties yet.</div>';
    return;
  }

  const costForGroup = (group: string | null): number => {
    switch ((group ?? "").toLowerCase()) {
      case "brown":
      case "light_blue":
        return 50;
      case "pink":
      case "orange":
        return 100;
      case "red":
      case "yellow":
        return 150;
      case "green":
      case "dark_blue":
        return 200;
      default:
        return 0;
    }
  };

  container.innerHTML = "";

  for (const tile of owned) {
    const houses = tile.houses ?? 0;
    const hotels = tile.hotels ?? 0;
    const cost = costForGroup(tile.property_group);
    const maxed = hotels > 0;
    const label = maxed ? "🏨 Hotel" : `🏠 Houses: ${houses}`;

    const row = document.createElement("div");
    row.className =
      "flex items-center justify-between gap-2 rounded-md border bg-white p-2";

    const left = document.createElement("div");
    left.className = "min-w-0";
    left.innerHTML = `
      <div class="text-xs font-semibold text-gray-900 truncate">${escapeHtml(
        tile.name,
      )}</div>
      <div class="text-[11px] text-gray-600">${escapeHtml(
        tile.property_group ?? "—",
      )} • ${label} • Upgrade: $${cost || "—"}</div>
    `;

    const btn = document.createElement("button");
    btn.className = clsx(
      "rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset",
      {
        "cursor-not-allowed bg-gray-100 text-gray-400 ring-gray-200":
          !canAct || maxed || cost <= 0,
        "bg-white text-gray-800 ring-gray-300 hover:bg-gray-50":
          canAct && !maxed && cost > 0,
      },
    );
    btn.textContent = maxed ? "Max" : "Upgrade";
    btn.disabled = !canAct || maxed || cost <= 0;

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      try {
        setActionBanner(null);
        await handlers.onUpgradeProperty(tile.id);
      } catch (err) {
        console.error(err);
        setActionBanner(
          err instanceof Error ? err.message : "Unable to upgrade property.",
        );
      }
    });

    row.appendChild(left);
    row.appendChild(btn);
    container.appendChild(row);
  }
}

function renderHostControls(
  state: GameState,
  handlers: { onDeleteGame: () => Promise<void> },
): void {
  const details = queryRequired<HTMLDetailsElement>("hostControlsDetails");
  const container = queryRequired<HTMLDivElement>("hostControlsList");
  container.innerHTML = "";

  const me = userStorage.get();
  const isCreator = Boolean(me?.id) && me?.id === state.created_by;
  if (!isCreator) return;

  details.classList.remove("hidden");
  const deleteBtn = document.createElement("component-button");
  deleteBtn.setAttribute("type", "button");
  deleteBtn.setAttribute("variant", "secondary");
  deleteBtn.className = "w-full";
  deleteBtn.textContent = "End game (delete)";
  deleteBtn.addEventListener("click", () => void handlers.onDeleteGame());
  container.appendChild(deleteBtn);
}

async function ensureAuthed(): Promise<User> {
  const local = userStorage.get();
  if (local) return local;

  const user = await client.whoAmI();
  if (!user) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  userStorage.set(user);
  return user;
}

async function main(): Promise<void> {
  const gameId = parseGameId();
  if (!gameId) {
    window.location.href = "/";
    return;
  }
  const gameIdValue = gameId;

  await ensureAuthed();

  const leave = queryRequired<HTMLElement>("leaveGame");
  leave.addEventListener("click", () => {
    window.location.href = "/";
  });

  async function loadStateEnsuringJoined(): Promise<GameState> {
    const response = await client.fetch(`/games/${gameIdValue}/state`, {
      method: "GET",
    });

    if (response.ok) {
      return response.json();
    }

    // Not a participant: auto-join with an available color, then retry.
    if (response.status === 403) {
      await client.joinAuto(gameIdValue);
      const retry = await client.fetch(`/games/${gameIdValue}/state`, {
        method: "GET",
      });
      if (!retry.ok) {
        throw new Error("Unable to load game after join");
      }
      return retry.json();
    }

    if (response.status === 404) {
      throw new Error("Game not found");
    }

    throw new Error("Unable to load game state");
  }

  let state = await loadStateEnsuringJoined();
  let currentOptions: PlayerOptionsPayload | null = null;
  let hasRolledThisTurn = hasRolledThisTurnFromState(state);
  let lastTurnKey = `${state.turn_number}:${state.current_player_id ?? ""}`;
  const bankruptKnown = new Set(
    state.players.filter((p) => p.is_bankrupt).map((p) => p.id),
  );

  const chatBox = queryRequired<HTMLDivElement>("gameChatMessages");
  chatBox.innerHTML = "";

  const history = await client.listGameChat(gameIdValue);
  for (const msg of history) {
    const tokenColor =
      state.players.find((p) => p.user_id === msg.user.id)?.token_color ?? null;
    renderChatMessage(chatBox, msg, tokenColor);
  }

  const realtime = await connectRealtime();

  realtime.on("game:state:update", (payload) => {
    const p = payload as Partial<GameState> | null;
    if (!p || p.game_id !== gameIdValue) return;
    const beforeKey = lastTurnKey;
    state = {
      ...state,
      ...p,
    };
    lastTurnKey = `${state.turn_number}:${state.current_player_id ?? ""}`;
    if (lastTurnKey !== beforeKey) {
      hasRolledThisTurn = hasRolledThisTurnFromState(state);
      currentOptions = null;
    }
    hasRolledThisTurn = hasRolledThisTurnFromState(state);

    const newlyBankrupt = state.players.filter(
      (p) => p.is_bankrupt && !bankruptKnown.has(p.id),
    );
    if (newlyBankrupt.length > 0) {
      newlyBankrupt.forEach((p) => bankruptKnown.add(p.id));
      const names = newlyBankrupt.map((p) => p.display_name).join(", ");
      setActionBanner(`${names} went bankrupt.`);
    }

    renderAll();
  });

  realtime.on("game:player:options", (payload) => {
    const p = payload as PlayerOptionsPayload | null;
    if (!p || p.game_id !== gameIdValue) return;
    currentOptions = p;
    renderAll();
  });

  realtime.on("game:player:balance:update", (payload) => {
    const p = payload as { game_id?: string; balance?: number };
    if (p.game_id !== gameIdValue) return;
    if (typeof p.balance === "number") {
      state = {
        ...state,
        self: {
          ...state.self,
          balance: p.balance,
        },
      };
      renderMeta(state);
    }
  });

  realtime.on("game:ended", (payload) => {
    const p = payload as {
      game_id?: string;
      winner_id?: string | null;
      deleted?: boolean;
      winner_participant_id?: string | null;
    };
    if (p.game_id !== gameIdValue) return;
    if (p.deleted) {
      setActionBanner("Game was ended by the host.");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 750);
      return;
    }
    if (p.winner_participant_id) {
      const winner =
        state.players.find((pl) => pl.id === p.winner_participant_id)
          ?.display_name ?? "Player";
      setActionBanner(`Winner: ${winner}`);
      return;
    }
    setActionBanner("Game ended.");
  });

  realtime.on("chat:game:message", (payload) => {
    const p = payload as { game_id?: string } & ChatMessage;
    if (p.game_id !== gameIdValue) return;
    const tokenColor =
      state.players.find((pl) => pl.user_id === p.user.id)?.token_color ?? null;
    renderChatMessage(chatBox, p, tokenColor);
  });

  // Join after registering handlers so "options on join" isn't missed.
  await realtime.joinGameRoom(gameIdValue);

  const onDeleteGame = async (): Promise<void> => {
    const ok = window.confirm(
      "End and delete this game? This cannot be undone.",
    );
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm:", "");
    if (typed !== "DELETE") return;

    try {
      await client.deleteGame(gameIdValue);
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setActionBanner("Unable to delete game.");
    }
  };

  function renderAll(): void {
    renderMeta(state);
    renderBoard(state);
    renderPlayers(state);
    renderMoves(state);
    renderTransactions(state);
    renderHostControls(state, { onDeleteGame });
    renderOptions(
      state,
      currentOptions,
      {
        hasRolledThisTurn,
      },
      {
        onRoll: async (rollPayload) => {
          if (!isMyTurn(state) || state.phase !== "playing") return;
          try {
            setActionBanner(null);
            const result = (await client.roll(gameIdValue, rollPayload)) as {
              dice?: [number, number];
              previous_position?: number;
              new_position?: number;
              messages?: string[];
              pending_action?: unknown;
            };
            hasRolledThisTurn = true;
            if (Array.isArray(result.messages) && result.messages.length > 0) {
              setActionBanner(result.messages.join(" • "));
            } else if (Array.isArray(result.dice) && result.dice.length === 2) {
              const total = result.dice[0] + result.dice[1];
              setActionBanner(
                `You rolled ${result.dice[0]} and ${result.dice[1]} (${total}).`,
              );
            }
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner(
              error instanceof Error ? error.message : "Unable to roll dice.",
            );
          }
        },
        onEndTurn: async () => {
          if (!isMyTurn(state) || state.phase !== "playing") return;
          if (!hasRolledThisTurn) return;
          try {
            setActionBanner(null);
            await client.endTurn(gameIdValue);
            hasRolledThisTurn = false;
            currentOptions = null;
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner("Unable to end turn.");
          }
        },
        onStartGame: async () => {
          if (state.phase !== "waiting") return;
          try {
            setActionBanner(null);
            await client.startGame(gameIdValue);
            state = await loadStateEnsuringJoined();
            hasRolledThisTurn = false;
            currentOptions = null;
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner("Unable to start game.");
          }
        },
        onDeleteGame: async () => {
          await onDeleteGame();
        },
        onBuy: async (tileId, pendingActionId) => {
          setActionBanner(null);
          await client.buy(gameIdValue, tileId, pendingActionId);
          currentOptions = null;
          hasRolledThisTurn = true;
          renderAll();
        },
        onPayRent: async (tileId, pendingActionId) => {
          try {
            setActionBanner(null);
            await client.payRent(gameIdValue, tileId, pendingActionId);
            state = await loadStateEnsuringJoined();
            currentOptions = null;
            hasRolledThisTurn = hasRolledThisTurnFromState(state);
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner(
              error instanceof Error ? error.message : "Unable to pay rent.",
            );
          }
        },
        onSkip: async (_pendingActionId) => {
          // Backend uses end-turn to cancel optional purchase pending actions.
          await client.endTurn(gameIdValue);
          currentOptions = null;
          hasRolledThisTurn = false;
          renderAll();
        },
        onSellProperty: async (tileId) => {
          try {
            setActionBanner(null);
            await client.sellProperty(gameIdValue, tileId);
            state = await loadStateEnsuringJoined();
            hasRolledThisTurn = hasRolledThisTurnFromState(state);
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner("Unable to sell property.");
          }
        },
        onPayBankDebt: async (pendingActionId) => {
          try {
            setActionBanner(null);
            await client.payBankDebt(gameIdValue, pendingActionId);
            state = await loadStateEnsuringJoined();
            currentOptions = null;
            hasRolledThisTurn = hasRolledThisTurnFromState(state);
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner(
              error instanceof Error ? error.message : "Unable to pay debt.",
            );
          }
        },
        onDeclareBankruptcy: async (pendingActionId) => {
          const ok = window.confirm(
            "Declare bankruptcy? You will be removed from the game.",
          );
          if (!ok) return;
          try {
            setActionBanner(null);
            await client.declareBankruptcy(gameIdValue, pendingActionId);
            state = await loadStateEnsuringJoined();
            currentOptions = null;
            hasRolledThisTurn = hasRolledThisTurnFromState(state);
            renderAll();
          } catch (error) {
            console.error(error);
            setActionBanner(
              error instanceof Error
                ? error.message
                : "Unable to declare bankruptcy.",
            );
          }
        },
      },
    );

    renderPropertyUpgrades(state, currentOptions, {
      onUpgradeProperty: async (tileId) => {
        await client.upgradeProperty(gameIdValue, tileId);
      },
    });
  }

  renderAll();

  const sendBtn = queryRequired<HTMLElement>("sendGameChat");
  sendBtn.addEventListener("click", async () => {
    const field = document.querySelector<HTMLInputElement>(
      "input[name='gameChatMessage']",
    );
    if (!field) return;
    const message = field.value.trim();
    if (!message) return;

    try {
      await client.sendGameChat(gameIdValue, message);
      field.value = "";
    } catch (error) {
      console.error(error);
    }
  });

  // Basic keyboard submit
  document.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== "gameChatMessage") return;
    e.preventDefault();
    sendBtn.click();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void main();
});

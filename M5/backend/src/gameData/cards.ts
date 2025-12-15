import type { DeckType, NewCard } from "../database/repositories/cards.js";

function json(value: unknown): string {
  return JSON.stringify(value);
}

export const chanceCards: NewCard[] = [
  {
    deck_type: "chance",
    card_order: 1,
    message: "Advance to GO. Collect $200.",
    action_type: "move",
    action_value: json({ position: 0, collect_pass_go: true }),
  },
  {
    deck_type: "chance",
    card_order: 2,
    message: "Bank pays you dividend of $50.",
    action_type: "collect",
    action_value: json({ amount: 50 }),
  },
  {
    deck_type: "chance",
    card_order: 3,
    message: "Go to Jail. Do not pass GO. Do not collect $200.",
    action_type: "go_to_jail",
    action_value: json({ position: 9 }),
  },
  {
    deck_type: "chance",
    card_order: 4,
    message: "Pay poor tax of $15.",
    action_type: "pay",
    action_value: json({ amount: 15 }),
  },
  {
    deck_type: "chance",
    card_order: 5,
    message: "Advance to Free Parking.",
    action_type: "move",
    action_value: json({ position: 20, collect_pass_go: false }),
  },
  {
    deck_type: "chance",
    card_order: 6,
    message: "Get Out of Jail Free. This card may be kept until needed.",
    action_type: "get_out_of_jail_free",
    action_value: null,
  },
  {
    deck_type: "chance",
    card_order: 7,
    message: "Advance to Go to Jail.",
    action_type: "move",
    action_value: json({ position: 30, collect_pass_go: false }),
  },
  {
    deck_type: "chance",
    card_order: 8,
    message: "Advance to Jail / Visiting.",
    action_type: "move",
    action_value: json({ position: 9, collect_pass_go: false }),
  },
  {
    deck_type: "chance",
    card_order: 9,
    message: "Collect $100.",
    action_type: "collect",
    action_value: json({ amount: 100 }),
  },
  {
    deck_type: "chance",
    card_order: 10,
    message: "Collect $25.",
    action_type: "collect",
    action_value: json({ amount: 25 }),
  },
  {
    deck_type: "chance",
    card_order: 11,
    message: "Pay $25.",
    action_type: "pay",
    action_value: json({ amount: 25 }),
  },
  {
    deck_type: "chance",
    card_order: 12,
    message: "Pay $100.",
    action_type: "pay",
    action_value: json({ amount: 100 }),
  },
  {
    deck_type: "chance",
    card_order: 13,
    message: "Advance to Lombard St.",
    action_type: "move",
    action_value: json({ position: 18, collect_pass_go: false }),
  },
  {
    deck_type: "chance",
    card_order: 14,
    message: "Advance to Embarcadero.",
    action_type: "move",
    action_value: json({ position: 39, collect_pass_go: false }),
  },
];

export const communityChestCards: NewCard[] = [
  {
    deck_type: "community_chest",
    card_order: 1,
    message: "Doctor's fees. Pay $50.",
    action_type: "pay",
    action_value: json({ amount: 50 }),
  },
  {
    deck_type: "community_chest",
    card_order: 2,
    message: "From sale of stock you get $50.",
    action_type: "collect",
    action_value: json({ amount: 50 }),
  },
  {
    deck_type: "community_chest",
    card_order: 3,
    message: "Income tax refund. Collect $20.",
    action_type: "collect",
    action_value: json({ amount: 20 }),
  },
  {
    deck_type: "community_chest",
    card_order: 4,
    message: "Go to Jail. Do not pass GO. Do not collect $200.",
    action_type: "go_to_jail",
    action_value: json({ position: 9 }),
  },
  {
    deck_type: "community_chest",
    card_order: 5,
    message: "You inherit $100.",
    action_type: "collect",
    action_value: json({ amount: 100 }),
  },
  {
    deck_type: "community_chest",
    card_order: 6,
    message: "Get Out of Jail Free. This card may be kept until needed.",
    action_type: "get_out_of_jail_free",
    action_value: null,
  },
  {
    deck_type: "community_chest",
    card_order: 7,
    message: "Collect $10.",
    action_type: "collect",
    action_value: json({ amount: 10 }),
  },
  {
    deck_type: "community_chest",
    card_order: 8,
    message: "Collect $200.",
    action_type: "collect",
    action_value: json({ amount: 200 }),
  },
  {
    deck_type: "community_chest",
    card_order: 9,
    message: "Pay $10.",
    action_type: "pay",
    action_value: json({ amount: 10 }),
  },
  {
    deck_type: "community_chest",
    card_order: 10,
    message: "Pay $100.",
    action_type: "pay",
    action_value: json({ amount: 100 }),
  },
  {
    deck_type: "community_chest",
    card_order: 11,
    message: "Advance to GO. Collect $200.",
    action_type: "move",
    action_value: json({ position: 0, collect_pass_go: true }),
  },
  {
    deck_type: "community_chest",
    card_order: 12,
    message: "Go to Free Parking.",
    action_type: "move",
    action_value: json({ position: 20, collect_pass_go: false }),
  },
  {
    deck_type: "community_chest",
    card_order: 13,
    message: "Go to Visiting (Jail).",
    action_type: "move",
    action_value: json({ position: 9, collect_pass_go: false }),
  },
  {
    deck_type: "community_chest",
    card_order: 14,
    message: "Receive a Get Out of Jail Free card.",
    action_type: "get_out_of_jail_free",
    action_value: null,
  },
];

export const allSeedCardsByDeck: Record<DeckType, NewCard[]> = {
  chance: chanceCards,
  community_chest: communityChestCards,
};

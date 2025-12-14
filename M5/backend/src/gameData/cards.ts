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
];

export const allSeedCardsByDeck: Record<DeckType, NewCard[]> = {
  chance: chanceCards,
  community_chest: communityChestCards,
};

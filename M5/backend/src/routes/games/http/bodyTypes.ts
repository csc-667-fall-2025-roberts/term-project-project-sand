export interface CreateGameBody {
  max_players?: number;
  starting_balance?: number;
  name?: string;
  token_color?: string;
}

export interface JoinGameBody {
  token_color?: string;
}

export interface JoinByCodeBody {
  game_code?: string;
  token_color?: string;
}

export interface BuyPropertyBody {
  pending_action_id?: string;
}

export interface PayRentBody {
  pending_action_id?: string;
}

export interface PayDebtBody {
  pending_action_id?: string;
}

export interface RollTurnBody {
  pay_to_leave_jail?: boolean;
  use_goojf?: boolean;
}

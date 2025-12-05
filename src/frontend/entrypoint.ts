// Game room functionality
const gameId = window.location.pathname.match(/\/games\/([^\/\?]+)/)?.[1];

// Automatically join the game when entering the game room (if not already joined)
if (gameId) {
  (async () => {
    try {
      const response = await fetch(`/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // If successfully joined, reload the page to show updated player list
          if (data.message === "Successfully joined game") {
            console.log('[Game] Successfully joined game, reloading to show updated player list...');
            window.location.reload();
          }
        }
      } else {
        const error = await response.json();
        // If already joined, that's fine - don't show error
        if (error.error && !error.error.includes("already")) {
          console.error('[Game] Error joining game:', error.error);
        }
      }
    } catch (error) {
      console.error('[Game] Error joining game:', error);
    }
  })();
}

// Custom Alert and Confirm functions
function showGameAlert(message: string, title: string = "Notification"): Promise<void> {
  return new Promise((resolve) => {
    const modal = document.getElementById("game-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalButtons = document.getElementById("modal-buttons");
    
    if (!modal || !modalTitle || !modalMessage || !modalButtons) {
      // Fallback to browser alert if modal doesn't exist
      alert(message);
      resolve();
      return;
    }
    
    // Clear any existing content
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = `
      <button id="modal-ok" class="btn-primary">OK</button>
    `;
    
    // Show modal
    modal.classList.remove("hidden");
    
    // Create one-time handlers
    const handleOk = () => {
      modal.classList.add("hidden");
      okBtn?.removeEventListener("click", handleOk);
      modal.removeEventListener("click", handleBackground);
      resolve();
    };
    
    const handleBackground = (e: MouseEvent) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        okBtn?.removeEventListener("click", handleOk);
        modal.removeEventListener("click", handleBackground);
        resolve();
      }
    };
    
    const okBtn = document.getElementById("modal-ok");
    if (okBtn) {
      okBtn.addEventListener("click", handleOk, { once: true });
    }
    
    modal.addEventListener("click", handleBackground, { once: true });
  });
}

function showGameConfirm(message: string, title: string = "Confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById("game-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalButtons = document.getElementById("modal-buttons");
    
    if (!modal || !modalTitle || !modalMessage || !modalButtons) {
      // Fallback to browser confirm if modal doesn't exist
      const result = confirm(message);
      resolve(result);
      return;
    }
    
    // Clear any existing content
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = `
      <button id="modal-cancel" class="btn-secondary">Cancel</button>
      <button id="modal-confirm" class="btn-primary">Confirm</button>
    `;
    
    // Show modal
    modal.classList.remove("hidden");
    
    // Create one-time handlers
    const handleCancel = () => {
      modal.classList.add("hidden");
      cancelBtn?.removeEventListener("click", handleCancel);
      confirmBtn?.removeEventListener("click", handleConfirm);
      modal.removeEventListener("click", handleBackground);
      resolve(false);
    };
    
    const handleConfirm = () => {
      modal.classList.add("hidden");
      cancelBtn?.removeEventListener("click", handleCancel);
      confirmBtn?.removeEventListener("click", handleConfirm);
      modal.removeEventListener("click", handleBackground);
      resolve(true);
    };
    
    const handleBackground = (e: MouseEvent) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        cancelBtn?.removeEventListener("click", handleCancel);
        confirmBtn?.removeEventListener("click", handleConfirm);
        modal.removeEventListener("click", handleBackground);
        resolve(false);
      }
    };
    
    const cancelBtn = document.getElementById("modal-cancel");
    const confirmBtn = document.getElementById("modal-confirm");
    
    if (cancelBtn) {
      cancelBtn.addEventListener("click", handleCancel, { once: true });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener("click", handleConfirm, { once: true });
    }
    
    modal.addEventListener("click", handleBackground, { once: true });
  });
}

function showGameNotification(message: string, type: "success" | "error" | "info" = "info"): void {
  const notification = document.getElementById("game-notification");
  const notificationMessage = document.getElementById("notification-message");
  const notificationIcon = document.getElementById("notification-icon");
  const notificationClose = document.getElementById("notification-close");
  
  if (!notification || !notificationMessage || !notificationIcon || !notificationClose) return;
  
  notificationMessage.textContent = message;
  
  // Set icon and color based on type
  let iconHtml = "";
  let bgColor = "";
  if (type === "success") {
    iconHtml = `<div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><span class="text-green-600 text-lg">✓</span></div>`;
    bgColor = "bg-green-50 border-green-200";
  } else if (type === "error") {
    iconHtml = `<div class="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><span class="text-red-600 text-lg">✕</span></div>`;
    bgColor = "bg-red-50 border-red-200";
  } else {
    iconHtml = `<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><span class="text-blue-600 text-lg">ℹ</span></div>`;
    bgColor = "bg-blue-50 border-blue-200";
  }
  
  notificationIcon.innerHTML = iconHtml;
  notification.className = `fixed top-4 right-4 z-50 ${bgColor} rounded-lg shadow-xl border p-4 max-w-sm transform transition-all`;
  notification.classList.remove("hidden");
  
  // Close button
  notificationClose.addEventListener("click", () => {
    notification.classList.add("hidden");
  });
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.classList.add("hidden");
  }, 5000);
}

// Card effect types
type CardEffect = 
  | { type: "move"; spaces: number }
  | { type: "go_to_jail" }
  | { type: "money"; amount: number }
  | { type: "collect_from_all"; amount: number }
  | { type: "pay_all"; amount: number }
  | { type: "go_to"; position: number }
  | { type: "repairs"; houseCost: number; hotelCost: number };

interface Card {
  title: string;
  description: string;
  effect: CardEffect;
}

// Card deck with various effects
const cardDeck: Card[] = [
  { title: "Go to Jail", description: "Go directly to Jail. Do not pass GO, do not collect $200.", effect: { type: "go_to_jail" } },
  { title: "Advance to GO", description: "Advance to GO. Collect $200.", effect: { type: "go_to", position: 0 } },
  { title: "Move Forward", description: "Advance 3 spaces.", effect: { type: "move", spaces: 3 } },
  { title: "Move Back", description: "Go back 3 spaces.", effect: { type: "move", spaces: -3 } },
  { title: "Birthday Money", description: "It's your birthday! Collect $400 from the bank.", effect: { type: "money", amount: 400 } },
  { title: "Tax Refund", description: "Income tax refund. Collect $200.", effect: { type: "money", amount: 200 } },
  { title: "Doctor's Fee", description: "Pay doctor's fee of $150.", effect: { type: "money", amount: -150 } },
  { title: "School Fees", description: "Pay school fees of $150.", effect: { type: "money", amount: -150 } },
  { title: "Street Repairs", description: "You are assessed for street repairs: $40 per house, $115 per hotel.", effect: { type: "repairs", houseCost: 40, hotelCost: 115 } },
  { title: "Bank Error", description: "Bank error in your favor. Collect $200.", effect: { type: "money", amount: 200 } },
  { title: "Beauty Contest", description: "You have won second prize in a beauty contest. Collect $100.", effect: { type: "money", amount: 100 } },
  { title: "Holiday Fund", description: "Holiday fund matures. Collect $100.", effect: { type: "money", amount: 100 } },
  { title: "Life Insurance", description: "Life insurance matures. Collect $100.", effect: { type: "money", amount: 100 } },
  { title: "Hospital Fees", description: "Pay hospital fees of $100.", effect: { type: "money", amount: -100 } },
  { title: "Advance to Union Square", description: "Advance to Union Square. If you pass GO, collect $200.", effect: { type: "go_to", position: 4 } },
  { title: "Advance to Chinatown", description: "Advance to Chinatown. If you pass GO, collect $200.", effect: { type: "go_to", position: 5 } },
  { title: "Go Back 3 Spaces", description: "Go back 3 spaces.", effect: { type: "move", spaces: -3 } },
  { title: "Advance 5 Spaces", description: "Advance 5 spaces.", effect: { type: "move", spaces: 5 } },
  { title: "Advance 7 Spaces", description: "Advance 7 spaces.", effect: { type: "move", spaces: 7 } },
  { title: "Pay Poor Tax", description: "Pay poor tax of $150.", effect: { type: "money", amount: -150 } },
];

// Property data organized by board position (clockwise from GO)
// This matches the actual visual board layout
const propertyData: { [key: number]: { name: string; price: number; type: string; rent: number; taxAmount?: number } } = {
  // Top row (0-10)
  0: { name: "GO", price: 0, type: "go", rent: 0 },
  1: { name: "Market St", price: 60, type: "property", rent: 2 },
  2: { name: "Mission St", price: 60, type: "property", rent: 4 },
  3: { name: "Chance", price: 0, type: "chance", rent: 0 },
  4: { name: "Union Square", price: 100, type: "property", rent: 6 },
  5: { name: "Chinatown", price: 100, type: "property", rent: 6 },
  6: { name: "Community Chest", price: 0, type: "community_chest", rent: 0 },
  7: { name: "Fisherman's Wharf", price: 120, type: "property", rent: 8 },
  8: { name: "Lombard St", price: 140, type: "property", rent: 10 },
  9: { name: "Income Tax", price: 0, type: "tax", rent: 0, taxAmount: 200 },
  10: { name: "JAIL", price: 0, type: "jail", rent: 0 },
  
  // Right column (11-19)
  11: { name: "Golden Gate Park", price: 140, type: "property", rent: 10 },
  12: { name: "Chance", price: 0, type: "chance", rent: 0 },
  13: { name: "Alcatraz", price: 160, type: "property", rent: 12 },
  14: { name: "Pier 39", price: 180, type: "property", rent: 14 },
  15: { name: "Coit Tower", price: 180, type: "property", rent: 14 },
  16: { name: "Cable Car", price: 200, type: "railroad", rent: 25 },
  17: { name: "Twin Peaks", price: 200, type: "property", rent: 16 },
  18: { name: "Community Chest", price: 0, type: "community_chest", rent: 0 },
  19: { name: "Haight-Ashbury", price: 220, type: "property", rent: 18 },
  
  // Bottom row (20-30) - goes RIGHT TO LEFT (from Go To Jail to Free Parking)
  20: { name: "Go To Jail", price: 0, type: "go_to_jail", rent: 0 },
  21: { name: "Luxury Tax", price: 0, type: "tax", rent: 0, taxAmount: 100 },
  22: { name: "Golden Gate Bridge", price: 400, type: "property", rent: 50 },
  23: { name: "Community Chest", price: 0, type: "community_chest", rent: 0 },
  24: { name: "Presidio", price: 400, type: "property", rent: 50 },
  25: { name: "BART", price: 200, type: "railroad", rent: 25 },
  26: { name: "Marina", price: 350, type: "property", rent: 35 },
  27: { name: "North Beach", price: 320, type: "property", rent: 28 },
  28: { name: "Chance", price: 0, type: "chance", rent: 0 },
  29: { name: "Castro", price: 300, type: "property", rent: 26 },
  30: { name: "Free Parking", price: 0, type: "free_parking", rent: 0 },
  
  // Left column (31-39, bottom to top)
  31: { name: "Russian Hill", price: 300, type: "property", rent: 26 },
  32: { name: "Nob Hill", price: 280, type: "property", rent: 24 },
  33: { name: "Chance", price: 0, type: "chance", rent: 0 },
  34: { name: "Muni", price: 200, type: "railroad", rent: 25 },
  35: { name: "Embarcadero", price: 260, type: "property", rent: 22 },
  36: { name: "Water Works", price: 150, type: "utility", rent: 0 },
  37: { name: "Financial Dist", price: 240, type: "property", rent: 20 },
  38: { name: "SOMA", price: 220, type: "property", rent: 18 },
  39: { name: "Luxury Tax", price: 0, type: "tax", rent: 0, taxAmount: 100 },
  
  // Position 40 wraps back to GO (position 0)
};

// Function to get property name from position
function getPropertyNameAtPosition(pos: number): string {
  const normalized = ((pos % 40) + 40) % 40;
  const prop = propertyData[normalized];
  if (normalized === 20 || normalized === 29) {
    console.log(`[Get Property] Position ${pos} -> normalized ${normalized} -> ${prop?.name || "Unknown"}`);
  }
  return prop?.name || "Unknown";
}

// Initialize token position on page load - use the position from the server if available
const positionEl = document.querySelector("#player-position");
if (positionEl) {
  // Get the initial position from the element (set by server) or default to 0
  const initialPosition = parseInt(positionEl.textContent || "0");
  positionEl.textContent = initialPosition.toString();
  moveTokenOnBoard(initialPosition);
  updateCurrentProperty(initialPosition);
  console.log(`Initialized player at position ${initialPosition}`);
}

// Roll Dice functionality
const rollDiceBtn = document.querySelector("#roll-dice-btn");
const diceContainer = document.querySelector("#dice-container");
const dice1El = document.querySelector("#dice-1");
const dice2El = document.querySelector("#dice-2");
const dice1Value = document.querySelector("#dice-1-value");
const dice2Value = document.querySelector("#dice-2-value");
const diceTotal = document.querySelector("#dice-total");
// Position display will be found by ID

if (rollDiceBtn && diceContainer && dice1El && dice2El && dice1Value && dice2Value && diceTotal) {
  rollDiceBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    
    // Disable button during roll
    rollDiceBtn.setAttribute("disabled", "true");
    rollDiceBtn.textContent = "Rolling...";
    
    // Show dice container
    diceContainer.classList.remove("hidden");
    
    // Start rolling animation
    dice1El.classList.add("dice-rolling");
    dice2El.classList.add("dice-rolling");
    dice1Value.textContent = "?";
    dice2Value.textContent = "?";
    diceTotal.textContent = "?";
    
    // Simulate dice roll with animation
    const rollDuration = 1500; // 1.5 seconds of rolling
    const startTime = Date.now();
    
    const rollInterval = setInterval(() => {
      // Show random numbers during roll
      dice1Value.textContent = (Math.floor(Math.random() * 6) + 1).toString();
      dice2Value.textContent = (Math.floor(Math.random() * 6) + 1).toString();
    }, 100);
    
    setTimeout(() => {
      clearInterval(rollInterval);
      
      // Final dice values
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2;
      
      // Stop animation and show final values
      dice1El.classList.remove("dice-rolling");
      dice2El.classList.remove("dice-rolling");
      dice1Value.textContent = dice1.toString();
      dice2Value.textContent = dice2.toString();
      diceTotal.textContent = total.toString();
      
      // Update position - always add dice roll to current position
      const positionEl = document.querySelector("#player-position");
      if (positionEl) {
        const currentPosition = parseInt(positionEl.textContent || "0");
        // Board has 40 spaces (0-39), wrap around at 40
        let newPosition = currentPosition + total;
        if (newPosition >= 40) {
          newPosition = newPosition % 40; // Wrap around to GO
        }
        
        console.log(`[Dice Roll] Rolled ${total}: Moving from position ${currentPosition} (${getPropertyNameAtPosition(currentPosition)}) to position ${newPosition} (${getPropertyNameAtPosition(newPosition)})`);
        console.log(`[Dice Roll] Calculation: ${currentPosition} + ${total} = ${currentPosition + total}, final position = ${newPosition}`);
        
        // Animate position change - step through each position
        positionEl.textContent = currentPosition.toString();
        let pos = currentPosition;
        let stepCount = 0;
        const stepInterval = setInterval(() => {
          stepCount++;
          pos = (currentPosition + stepCount) % 40; // Move forward one space at a time
          
          if (stepCount >= total) {
            // Reached final position
            pos = newPosition;
            clearInterval(stepInterval);
          }
          
          // Normalize position to 0-39
          const normalizedPos = ((pos % 40) + 40) % 40;
          positionEl.textContent = normalizedPos.toString();
          
          // Move token visually
          moveTokenOnBoard(normalizedPos);
          
          // Update property info when position changes
          if (normalizedPos === newPosition) {
            updateCurrentProperty(normalizedPos);
            // Check if landed on Income Tax (position 9) or Luxury Tax (position 21 on bottom row or 39 on left column)
            if (normalizedPos === 9) {
              // Income Tax - deduct $200
              handleTaxPayment(9, 200);
            } else if (normalizedPos === 21) {
              // Luxury Tax on bottom row - deduct $100
              handleTaxPayment(21, 100);
            } else if (normalizedPos === 39) {
              // Luxury Tax on left column - deduct $100
              handleTaxPayment(39, 100);
            }
          }
        }, 100);
      }
      
      // Re-enable button after a delay
      setTimeout(() => {
        rollDiceBtn.removeAttribute("disabled");
        rollDiceBtn.textContent = "Roll Dice";
      }, 1000);
    }, rollDuration);
  });
}

// Function to move token visually on the board
function moveTokenOnBoard(position: number) {
  // Find the player token element on the board
  const boardContainer = document.querySelector(".relative.bg-gradient-to-br");
  if (!boardContainer) {
    console.error("Board container not found");
    return;
  }
  
  // Remove existing token from board if present
  const existingToken = boardContainer.querySelector("#board-player-token");
  if (existingToken) {
    existingToken.remove();
  }
  
  // Normalize position to 0-39 range
  const boardSpaces = 40;
  const normalizedPos = ((position % boardSpaces) + boardSpaces) % boardSpaces;
  
  // Create token element with better visibility
  const token = document.createElement("div");
  token.id = "board-player-token";
  token.className = "player-token absolute w-8 h-8 rounded-full bg-blue-500 border-3 border-white shadow-xl z-50";
  token.style.transition = "all 0.5s ease-in-out";
  token.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
  
  // Simplified positioning - map to board grid cells
  // Board is 11x11 grid, positions map as:
  // Top row (0-10): GO(0), Market(1), Mission(2), Chance(3), Union(4), Chinatown(5), Community(6), Fisherman(7), Lombard(8), Income Tax(9), JAIL(10)
  // Right column (11-19): Golden Gate Park(10), Chance(11), Alcatraz(12), Pier 39(13), Coit(14), Cable Car(15), Twin Peaks(16), Community(17), Haight(18)
  // Bottom row (20-28): Free Parking(19), Castro(20), Chance(21), North Beach(22), Marina(23), BART(24), Presidio(25), Community(26), Golden Gate(27), Go To Jail(28)
  // Left column (29-37): Russian Hill(29), Nob Hill(30), Chance(31), Muni(32), Luxury Tax(33), Embarcadero(34), Water Works(35), Financial(36), SOMA(37)
  
  let top = "10px";
  let left = "10px";
  
  // Map positions to visual board layout (positions now match board order)
  // 0-10: Top row (GO through JAIL) - 11 spaces total, 9 properties between corners
  // 11-19: Right column (Golden Gate Park through Haight-Ashbury) - 9 spaces
  // 20-30: Bottom row (Free Parking through Go To Jail) - 11 spaces total, 9 properties between corners
  // 31-39: Left column (Russian Hill through SOMA, bottom to top) - 9 spaces
  
  if (normalizedPos === 0) {
    // GO - top left
    top = "10px";
    left = "10px";
  } else if (normalizedPos >= 1 && normalizedPos <= 9) {
    // Top row: 1-9 (Market St through Income Tax)
    const index = normalizedPos - 1; // 0-8
    const totalSpaces = 9;
    const percent = (index / (totalSpaces - 1)) * 100; // 0% to 100%
    top = "10px";
    left = `${10 + (percent * 0.85)}%`;
  } else if (normalizedPos === 10) {
    // JAIL - top right
    top = "10px";
    left = "calc(100% - 42px)";
  } else if (normalizedPos >= 11 && normalizedPos <= 19) {
    // Right column: 11-19 (Golden Gate Park through Haight-Ashbury)
    const index = normalizedPos - 11; // 0-8
    const percent = (index / 9) * 100;
    top = `${12 + (percent * 0.82)}%`;
    left = "calc(100% - 42px)";
  } else if (normalizedPos === 20) {
    // Go To Jail - bottom right (position 20 is now Go To Jail)
    top = "calc(100% - 42px)";
    left = "calc(100% - 42px)";
  } else if (normalizedPos >= 20 && normalizedPos <= 30) {
    // Bottom row: 20-30 (Go To Jail through Free Parking, RIGHT TO LEFT)
    // Go To Jail is at position 20 (bottom right corner)
    // Bottom row has 11 spaces: Go To Jail(20), Luxury Tax(21), Golden Gate Bridge(22), Community Chest(23), Presidio(24), BART(25), Marina(26), North Beach(27), Chance(28), Castro(29), Free Parking(30)
    // Space them evenly from RIGHT to LEFT (reverse of top row)
    const index = normalizedPos - 20; // 0-10 (Go To Jail=0, Free Parking=10)
    const totalSpaces = 11; // 20 through 30 inclusive
    const percent = (index / (totalSpaces - 1)) * 100; // 0% (Go To Jail) to 100% (Free Parking)
    // Reverse the spacing: Go To Jail at right (90%), Free Parking at left (10%)
    top = "calc(100% - 42px)";
    left = `${90 - (percent * 0.85)}%`; // Start at 90% (right) and go to 10% (left)
    console.log(`[Bottom Row] Position ${normalizedPos} (${getPropertyNameAtPosition(normalizedPos)}), index ${index}, percent ${percent.toFixed(1)}%, left ${(90 - (percent * 0.85)).toFixed(1)}%`);
  } else if (normalizedPos >= 31 && normalizedPos <= 39) {
    // Left column: 31-39 (Russian Hill through Luxury Tax, bottom to top)
    const index = normalizedPos - 31; // 0-8
    const percent = (index / 9) * 100;
    // Russian Hill(31) at top (12%), Luxury Tax(39) at bottom (90%)
    const topPercent = 12 + (percent * 0.78);
    top = `${topPercent}%`;
    left = "10px";
  } else {
    // Position 40 (wrap around to GO, position 0)
    top = "10px";
    left = "10px";
  }
  
  // Ensure token is visible and positioned correctly
  token.style.top = top;
  token.style.left = left;
  token.style.position = "absolute";
  token.style.zIndex = "50";
  token.style.pointerEvents = "none"; // Don't block clicks
  
  // Debug logging with property name
  const propName = getPropertyNameAtPosition(normalizedPos);
  console.log(`[Token Movement] Position: ${normalizedPos} (${propName}), CSS: top=${top}, left=${left}`);
  
  // Append to board container
  if (boardContainer) {
    boardContainer.appendChild(token);
    
    // Verify token is visible
    setTimeout(() => {
      const rect = token.getBoundingClientRect();
      const containerRect = (boardContainer as HTMLElement).getBoundingClientRect();
      if (rect.top < containerRect.top || rect.top > containerRect.bottom || 
          rect.left < containerRect.left || rect.left > containerRect.right) {
        console.warn(`Token may be outside visible area. Position: ${normalizedPos}, Rect:`, rect, "Container:", containerRect);
      }
    }, 100);
  }
}

// Function to get random cards from the deck
function getRandomCards(count: number): Card[] {
  const shuffled = [...cardDeck].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Function to apply card effect
async function applyCardEffect(effect: CardEffect, currentPosition: number, cardTitle?: string, cardDescription?: string) {
  if (!gameId) {
    console.error("Game ID not found");
    return;
  }

  try {
    const response = await fetch(`/games/${gameId}/card-effect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effect, currentPosition }),
    });

    const data = await response.json();

    if (response.ok) {
      // Update balance if money changed
      if (data.newBalance !== undefined) {
        const balanceEl = document.querySelector(".text-2xl.font-bold.text-primary-700");
        if (balanceEl) {
          balanceEl.textContent = `$${data.newBalance}`;
        }
      }

      // Update position if moved
      if (data.newPosition !== undefined) {
        const positionEl = document.querySelector("#player-position");
        if (positionEl) {
          positionEl.textContent = data.newPosition.toString();
          moveTokenOnBoard(data.newPosition);
          updateCurrentProperty(data.newPosition);
        }
      }

      // Show message with card details if provided
      let notificationMessage = data.message || "";
      if (cardTitle && cardDescription) {
        if (notificationMessage) {
          notificationMessage = `${cardTitle}: ${notificationMessage}`;
        } else {
          notificationMessage = `${cardTitle}: ${cardDescription}`;
        }
      }
      if (notificationMessage) {
        showGameNotification(notificationMessage, "success");
      } else if (cardTitle && cardDescription) {
        showGameNotification(`${cardTitle}: ${cardDescription}`, "success");
      }

      // Reload page if needed (for major changes)
      if (data.reload) {
        setTimeout(() => {
          window.location.reload();
  }, 1000);
      }
    } else {
      showGameNotification(`Error: ${data.error || "Failed to apply card effect"}`, "error");
    }
  } catch (error) {
    console.error("Error applying card effect:", error);
    showGameNotification("Failed to apply card effect. Please try again.", "error");
  }
}

// Function to update current property display
async function updateCurrentProperty(position: number) {
  const propertyCard = document.querySelector("#current-property-content");
  if (!propertyCard) {
    console.error("[Update Property] Property card element not found!");
    return;
  }
  if (!gameId) {
    console.error("[Update Property] Game ID not found!");
    return;
  }

  // Normalize position to 0-39
  const normalizedPos = ((position % 40) + 40) % 40;
  console.log(`[Update Property] Position: ${position} -> normalized: ${normalizedPos}`);

  try {
    // Fetch tile info from backend
    const response = await fetch(`/games/${gameId}/tile/${normalizedPos}`);
    if (!response.ok) {
      throw new Error("Failed to fetch tile");
    }

    const data = await response.json();
    const tile = data.tile;
    const isOwned = data.isOwned;
    const owner = data.owner;

    // Get property data - use normalized position
    const frontendData = propertyData[normalizedPos];
    console.log(`[Update Property] Property data for position ${normalizedPos}:`, frontendData);
    console.log(`[Update Property] Backend tile for position ${normalizedPos}:`, tile);
    let propData;
    
    if (frontendData) {
      // Use frontend data (has correct types for Chance/Community Chest)
      propData = frontendData;
      console.log(`[Update Property] Using FRONTEND data for position ${normalizedPos}`);
    } else if (tile) {
      // Use backend data
      propData = {
        name: tile.name || "Unknown",
        price: tile.purchase_price || 0,
        type: tile.tile_type || "unknown",
        rent: tile.rent_base || 0,
      };
      console.log(`[Update Property] Using BACKEND data for position ${normalizedPos}`);
    } else {
      // Fallback
      propData = {
        name: "Unknown",
        price: 0,
        type: "unknown",
        rent: 0,
      };
      console.log(`[Update Property] Using FALLBACK data for position ${normalizedPos}`);
    }
    
    // Normalize type for comparison (handle both "community_chest" and "Community Chest")
    const normalizedType = propData.type.toLowerCase().replace(/\s+/g, '_');
    console.log(`[Update Property] Position ${normalizedPos}, Type: ${propData.type} -> normalized: ${normalizedType}`);
    console.log(`[Update Property] Will show Chance cards? ${normalizedType === "chance"}`);

    // Update property card
    let html = `
      <div class="space-y-2">
        <div>
          <h4 class="font-bold text-lg text-gray-800">${propData.name}</h4>
          <p class="text-sm text-gray-600">${propData.type.charAt(0).toUpperCase() + propData.type.slice(1).replace('_', ' ')}</p>
        </div>
    `;

    console.log(`[Update Property] Checking type: ${normalizedType} === "chance"? ${normalizedType === "chance"}`);
    if (normalizedType === "chance") {
      // Chance: Show 3 face-down cards to choose from
      console.log(`[Update Property] Showing Chance cards`);
      const selectedCards = getRandomCards(3);
      html += `
        <div class="border-t pt-3">
          <p class="text-sm font-semibold text-gray-700 mb-3">Choose a card:</p>
          <div class="grid grid-cols-3 gap-2" id="chance-cards-container">
            ${selectedCards.map((card, index) => `
              <div class="chance-card relative cursor-pointer transform transition-transform hover:scale-105" 
                   data-card-index="${index}" 
                   data-card-title="${card.title}" 
                   data-card-description="${card.description}"
                   data-card-effect='${JSON.stringify(card.effect)}'>
                <div class="card-back bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg p-4 h-24 flex items-center justify-center border-2 border-yellow-700 shadow-md">
                  <div class="text-center">
                    <div class="text-yellow-900 font-bold text-sm">CHANCE</div>
                    <div class="text-yellow-800 text-xs mt-1">Click to reveal</div>
                  </div>
                </div>
                <div class="card-front hidden bg-white rounded-lg p-4 h-32 border-2 border-gray-300 shadow-md">
                  <div class="text-sm font-bold text-gray-800 mb-2">${card.title}</div>
                  <div class="text-xs text-gray-700 leading-tight">${card.description}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (normalizedType === "community_chest") {
      // Community Chest: Show 1 face-down card that flips on click
      console.log(`[Update Property] Showing Community Chest card`);
      const selectedCard = getRandomCards(1)[0];
      html += `
        <div class="border-t pt-3">
          <p class="text-sm font-semibold text-gray-700 mb-3">Click to reveal your card:</p>
          <div class="community-chest-card relative cursor-pointer" 
               data-card-title="${selectedCard.title}" 
               data-card-description="${selectedCard.description}"
               data-card-effect='${JSON.stringify(selectedCard.effect)}'>
            <div class="card-back bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-6 h-32 flex items-center justify-center border-2 border-blue-700 shadow-md">
              <div class="text-center">
                <div class="text-blue-900 font-bold text-lg">COMMUNITY</div>
                <div class="text-blue-800 font-bold text-lg">CHEST</div>
                <div class="text-blue-700 text-xs mt-2">Click to reveal</div>
              </div>
            </div>
            <div class="card-front hidden bg-white rounded-lg p-4 h-32 border-2 border-gray-300 shadow-md">
              <div class="text-sm font-bold text-gray-800 mb-2">${selectedCard.title}</div>
              <div class="text-xs text-gray-600">${selectedCard.description}</div>
            </div>
          </div>
        </div>
      `;
    } else if (normalizedType === "tax") {
      // Tax spaces (Income Tax, Luxury Tax)
      const taxAmount = (propData as any).taxAmount || 0;
      html += `
        <div class="border-t pt-2">
          <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded">
            <p class="text-sm font-semibold text-red-800 mb-2">Tax Amount</p>
            <p class="text-lg font-bold text-red-700">$${taxAmount}</p>
            <p class="text-xs text-red-600 mt-1">This amount will be deducted automatically</p>
          </div>
        </div>
      `;
    } else if (normalizedType === "property" || normalizedType === "railroad" || normalizedType === "utility") {
      html += `
        <div class="border-t pt-2">
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600">Price:</span>
            <span class="font-semibold text-primary-700">$${propData.price}</span>
          </div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600">Rent:</span>
            <span class="font-semibold text-gray-800">$${propData.rent}</span>
          </div>
      `;

      if (isOwned) {
        html += `
          <div class="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p class="text-sm text-yellow-800">
              <span class="font-semibold">Owned by:</span> ${owner?.display_name || "Unknown"}
            </p>
          </div>
        `;
      } else if (propData.price > 0) {
        html += `
          <button id="buy-property-btn" class="btn-primary w-full mt-3" data-position="${position}" data-price="${propData.price}">
            Buy for $${propData.price}
          </button>
        `;
      }
    } else {
      // Other spaces (GO, JAIL, Chance, Community Chest, etc.)
      html += `
        <div class="mt-3 p-2 bg-gray-50 border border-gray-200 rounded">
          <p class="text-sm text-gray-600">This space cannot be purchased</p>
        </div>
      `;
    }

    html += `</div></div>`;
    propertyCard.innerHTML = html;
    console.log(`[Update Property] Set HTML for position ${normalizedPos}, type ${normalizedType}`);
    console.log(`[Update Property] HTML length: ${html.length}, contains chance-card: ${html.includes('chance-card')}`);

    // Add buy button event listener
    const buyBtn = document.querySelector("#buy-property-btn");
    if (buyBtn) {
      buyBtn.addEventListener("click", handleBuyProperty);
    }

    // Add Chance card selection listeners - use setTimeout to ensure DOM is updated
    if (normalizedType === "chance") {
      setTimeout(() => {
        console.log(`[Update Property] Looking for .chance-card elements...`);
        const chanceCards = document.querySelectorAll(".chance-card");
        console.log(`[Update Property] Found ${chanceCards.length} chance cards in DOM`);
        
        if (chanceCards.length === 0) {
          console.error(`[Update Property] No chance cards found! HTML content:`, propertyCard.innerHTML.substring(0, 500));
        }
        
        chanceCards.forEach((cardEl, index) => {
          console.log(`[Update Property] Adding click listener to chance card ${index}`);
        cardEl.addEventListener("click", () => {
          const cardIndex = cardEl.getAttribute("data-card-index");
          const cardTitle = cardEl.getAttribute("data-card-title");
          const cardDescription = cardEl.getAttribute("data-card-description");
          const cardEffect = JSON.parse(cardEl.getAttribute("data-card-effect") || "{}");
          
          // Reveal the selected card
          const cardBack = cardEl.querySelector(".card-back");
          const cardFront = cardEl.querySelector(".card-front");
          if (cardBack && cardFront) {
            cardBack.classList.add("hidden");
            cardFront.classList.remove("hidden");
          }
          
          // Disable all other cards
          chanceCards.forEach((otherCard) => {
            if (otherCard !== cardEl) {
              (otherCard as HTMLElement).style.opacity = "0.5";
              (otherCard as HTMLElement).style.pointerEvents = "none";
            }
          });
          
          // Disable the selected card to prevent double-clicks
          (cardEl as HTMLElement).style.pointerEvents = "none";
          
          // Show notification with card details
          showGameNotification(`${cardTitle || 'Card'}: ${cardDescription || 'Effect applied'}`, "info");
          
          // Apply card effect after a delay so user can read the card
          setTimeout(() => {
            applyCardEffect(cardEffect, position, cardTitle || undefined, cardDescription || undefined);
          }, 3000);
        });
      });
      }, 100); // Small delay to ensure DOM is updated
    }

    // Add Community Chest card flip listener - use setTimeout to ensure DOM is updated
    if (normalizedType === "community_chest") {
      setTimeout(() => {
        console.log(`[Update Property] Looking for .community-chest-card element...`);
        const communityChestCard = document.querySelector(".community-chest-card");
        console.log(`[Update Property] Found community chest card: ${!!communityChestCard}`);
        if (communityChestCard) {
        let isFlipped = false;
        communityChestCard.addEventListener("click", () => {
          if (isFlipped) return; // Already flipped
          
          const cardTitle = communityChestCard.getAttribute("data-card-title");
          const cardDescription = communityChestCard.getAttribute("data-card-description");
          const cardEffect = JSON.parse(communityChestCard.getAttribute("data-card-effect") || "{}");
          
          // Flip the card
          const cardBack = communityChestCard.querySelector(".card-back");
          const cardFront = communityChestCard.querySelector(".card-front");
          if (cardBack && cardFront) {
            cardBack.classList.add("hidden");
            cardFront.classList.remove("hidden");
            isFlipped = true;
            (communityChestCard as HTMLElement).style.pointerEvents = "none";
          }
          
          // Show notification with card details
          showGameNotification(`${cardTitle || 'Card'}: ${cardDescription || 'Effect applied'}`, "info");
          
          // Apply card effect after a delay so user can read the card
          setTimeout(() => {
            applyCardEffect(cardEffect, position, cardTitle || undefined, cardDescription || undefined);
          }, 3000);
        });
      } else {
        console.error(`[Update Property] Community chest card not found! HTML content:`, propertyCard.innerHTML.substring(0, 500));
      }
      }, 100); // Small delay to ensure DOM is updated
    }
  } catch (error) {
    console.error("Error updating property:", error);
    // Fallback to property data
    const propData = propertyData[position];
    if (propData) {
      propertyCard.innerHTML = `
        <div class="space-y-2">
          <h4 class="font-bold text-lg text-gray-800">${propData.name}</h4>
          <p class="text-sm text-gray-600">${propData.type}</p>
          ${propData.price > 0 ? `
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Price:</span>
              <span class="font-semibold text-primary-700">$${propData.price}</span>
            </div>
            <button id="buy-property-btn" class="btn-primary w-full mt-3" data-position="${position}" data-price="${propData.price}">
              Buy for $${propData.price}
            </button>
          ` : ''}
        </div>
      `;
      const buyBtn = document.querySelector("#buy-property-btn");
      if (buyBtn) {
        buyBtn.addEventListener("click", handleBuyProperty);
      }
    }
  }
}

// Function to handle tax payment
async function handleTaxPayment(position: number, amount: number) {
  if (!gameId) {
    console.error("Game ID not found");
    return;
  }

  try {
    const response = await fetch(`/games/${gameId}/tax`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ position, amount }),
    });

    const data = await response.json();

    if (response.ok) {
      // Update balance display - find the balance in "Your Status" card
      // The balance is in a <p> tag with class "text-2xl font-bold text-primary-700" 
      // that's inside a div with "Balance" text
      const statusCard = document.querySelector('h3:contains("Your Status")')?.closest('.card') ||
                         document.querySelector('.card.bg-primary-50');
      
      let balanceEl: HTMLElement | null = null;
      if (statusCard) {
        // Find the paragraph that contains the balance (starts with $)
        const paragraphs = statusCard.querySelectorAll('p');
        for (const p of paragraphs) {
          if (p.textContent?.includes('$') && p.classList.contains('text-2xl')) {
            balanceEl = p as HTMLElement;
            break;
          }
        }
      }
      
      // Fallback: try direct selector
      if (!balanceEl) {
        const allBalanceEls = document.querySelectorAll('.text-2xl.font-bold.text-primary-700');
        for (const el of allBalanceEls) {
          if (el.textContent?.startsWith('$') && el.textContent.match(/^\$\d+$/)) {
            balanceEl = el as HTMLElement;
            break;
          }
        }
      }
      
      if (balanceEl && data.newBalance !== undefined) {
        balanceEl.textContent = `$${data.newBalance}`;
        console.log(`[Tax Payment] Updated balance display to $${data.newBalance}`);
      } else {
        console.error("[Tax Payment] Could not find balance element. Available elements:", 
          document.querySelectorAll('.text-2xl.font-bold.text-primary-700'));
      }
      
      // Show notification
      showGameNotification(`You paid $${amount} in taxes. New balance: $${data.newBalance}`, "info");
    } else {
      console.error("Error paying tax:", data.error);
      showGameNotification(`Error: ${data.error || "Failed to pay tax"}`, "error");
    }
  } catch (error) {
    console.error("Error paying tax:", error);
    showGameNotification("Failed to pay tax. Please try again.", "error");
  }
}

// Function to handle buying a property
async function handleBuyProperty(event: Event) {
  const button = event.target as HTMLButtonElement;
  const position = parseInt(button.getAttribute("data-position") || "0");
  const price = parseInt(button.getAttribute("data-price") || "0");

  if (!gameId) {
    showGameNotification("Game ID not found", "error");
    return;
  }

  // Confirm purchase
  const confirmed = await showGameConfirm(`Are you sure you want to buy this property for $${price}?`, "Buy Property");
  if (!confirmed) {
    return;
  }

  // Disable button
  button.disabled = true;
  button.textContent = "Processing...";

  try {
    const response = await fetch(`/games/${gameId}/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ position }),
    });

    const data = await response.json();

    if (response.ok) {
      showGameNotification(data.message, "success");
      
      // Update balance display - use same logic as tax payment
      const statusCard = document.querySelector('.card.bg-primary-50');
      let balanceEl: HTMLElement | null = null;
      if (statusCard) {
        const paragraphs = statusCard.querySelectorAll('p');
        for (const p of paragraphs) {
          if (p.textContent?.includes('$') && p.classList.contains('text-2xl')) {
            balanceEl = p as HTMLElement;
            break;
          }
        }
      }
      
      if (!balanceEl) {
        const allBalanceEls = document.querySelectorAll('.text-2xl.font-bold.text-primary-700');
        for (const el of allBalanceEls) {
          if (el.textContent?.startsWith('$') && el.textContent.match(/^\$\d+$/)) {
            balanceEl = el as HTMLElement;
            break;
          }
        }
      }
      
      if (balanceEl && data.newBalance !== undefined) {
        balanceEl.textContent = `$${data.newBalance}`;
        console.log(`[Buy Property] Updated balance to $${data.newBalance}`);
      }
      
      // Refresh property info - use current position from display, not button data
      const positionEl = document.querySelector("#player-position");
      const currentPosition = positionEl ? parseInt(positionEl.textContent || "0") : position;
      console.log(`[Buy Property] Refreshing property info at position ${currentPosition} (button had position ${position})`);
      updateCurrentProperty(currentPosition);
      
      // Update "Your Properties" section
      updatePropertiesList();
      
      // Don't reload the page - just update the UI
    } else {
      showGameNotification(`Error: ${data.error || "Failed to purchase property"}`, "error");
      button.disabled = false;
      button.textContent = `Buy for $${price}`;
    }
  } catch (error) {
    console.error("Error buying property:", error);
    showGameNotification("Failed to purchase property. Please try again.", "error");
    button.disabled = false;
    button.textContent = `Buy for $${price}`;
  }
}

// Function to update the "Your Properties" list
async function updatePropertiesList() {
  if (!gameId) return;
  
  try {
    // Fetch owned properties from backend
    const response = await fetch(`/games/${gameId}/properties`);
    if (response.ok) {
      const data = await response.json();
      // Find the properties container - it's a div with class "space-y-2" inside the "Your Properties" card
      const propertiesCard = Array.from(document.querySelectorAll('.card')).find(card => {
        const h3 = card.querySelector('h3');
        return h3 && h3.textContent?.includes('Your Properties');
      });
      
      const propertiesContainer = propertiesCard?.querySelector('.space-y-2, .max-h-64');
      
      if (propertiesContainer && data.properties) {
        if (data.properties.length === 0) {
          propertiesContainer.innerHTML = '<p class="text-sm text-gray-500">No properties yet</p>';
        } else {
          propertiesContainer.innerHTML = data.properties.map((prop: any) => `
            <div class="p-2 bg-gray-50 rounded text-sm">
              <div class="font-semibold">${prop.name}</div>
              <div class="text-xs text-gray-600">$${prop.rent || prop.rent_base || 0}</div>
            </div>
          `).join('');
        }
        console.log(`[Properties List] Updated with ${data.properties.length} properties`);
      } else {
        console.error("[Properties List] Could not find properties container");
      }
    }
  } catch (error) {
    console.error("Error updating properties list:", error);
  }
}

// Chat functionality
const chatForm = document.querySelector("#chat-form") as HTMLFormElement;
const chatInput = document.querySelector("#chat-input") as HTMLInputElement;
const chatMessages = document.querySelector("#chat-messages");

if (chatForm && chatInput && gameId) {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Disable form during submission
    const submitBtn = chatForm.querySelector("button[type='submit']") as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    
    try {
      const response = await fetch(`/games/${gameId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Add message to chat display
        if (chatMessages) {
          // Remove "No messages yet" if present
          const noMessages = chatMessages.querySelector(".text-center");
          if (noMessages) {
            noMessages.remove();
          }
          
          // Create message element
          const messageDiv = document.createElement("div");
          messageDiv.className = "text-sm";
          messageDiv.innerHTML = `
            <span class="font-semibold text-primary-700">${data.display_name}:</span>
            <span class="text-gray-700 ml-1">${data.message}</span>
            <span class="text-xs text-gray-400 ml-2">${new Date(data.created_at).toLocaleTimeString()}</span>
          `;
          
          chatMessages.appendChild(messageDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Clear input
        chatInput.value = "";
      } else {
        const error = await response.json();
        showGameNotification(`Error: ${error.error || "Failed to send message"}`, "error");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showGameNotification("Failed to send message. Please try again.", "error");
    } finally {
      // Re-enable form
      submitBtn.disabled = false;
      submitBtn.textContent = "Send";
    }
  });
}

// San Francisco properties for the board
// This will be used to populate the tiles table later
const sfProperties = [
  // Top row (positions 1-8)
  { position: 1, name: "Market Street", group: "brown" },
  { position: 2, name: "Mission Street", group: "brown" },
  { position: 3, name: "Chance", type: "chance" },
  { position: 4, name: "Union Square", group: "light-blue" },
  { position: 5, name: "Chinatown", group: "light-blue" },
  { position: 6, name: "Community Chest", type: "community_chest" },
  { position: 7, name: "Fisherman's Wharf", group: "light-blue" },
  { position: 8, name: "Lombard Street", group: "pink" },
  
  // Right column (positions 10-19)
  { position: 10, name: "Golden Gate Park", group: "orange" },
  { position: 11, name: "Chance", type: "chance" },
  { position: 12, name: "Alcatraz Island", group: "orange" },
  { position: 13, name: "Pier 39", group: "orange" },
  { position: 14, name: "Coit Tower", group: "red" },
  { position: 15, name: "Cable Car", type: "railroad" },
  { position: 16, name: "Twin Peaks", group: "red" },
  { position: 17, name: "Community Chest", type: "community_chest" },
  { position: 18, name: "Haight-Ashbury", group: "red" },
  { position: 19, name: "Pacific Heights", group: "yellow" },
  
  // Bottom row (positions 20-29)
  { position: 20, name: "Free Parking", type: "free_parking" },
  { position: 21, name: "Castro District", group: "yellow" },
  { position: 22, name: "Chance", type: "chance" },
  { position: 23, name: "North Beach", group: "yellow" },
  { position: 24, name: "Marina District", group: "green" },
  { position: 25, name: "BART Station", type: "railroad" },
  { position: 26, name: "Presidio", group: "green" },
  { position: 27, name: "Community Chest", type: "community_chest" },
  { position: 28, name: "Golden Gate Bridge", group: "green" },
  { position: 29, name: "Go To Jail", type: "go_to_jail" },
  
  // Left column (positions 30-39)
  { position: 30, name: "SOMA", group: "dark-blue" },
  { position: 31, name: "Financial District", group: "dark-blue" },
  { position: 32, name: "Water Works", type: "utility" },
  { position: 33, name: "Embarcadero", group: "dark-blue" },
  { position: 34, name: "Income Tax", type: "tax" },
  { position: 35, name: "Muni", type: "railroad" },
  { position: 36, name: "Chance", type: "chance" },
  { position: 37, name: "Nob Hill", group: "purple" },
  { position: 38, name: "Luxury Tax", type: "tax" },
  { position: 39, name: "Russian Hill", group: "purple" },
];

module.exports = sfProperties;


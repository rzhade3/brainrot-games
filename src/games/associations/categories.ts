/**
 * Category pool for Associations. The layout builder picks categories and a
 * subset of their words for each fixed, solver-validated level.
 * Words must be unique across the whole pool to keep every card unambiguous.
 *
 * Ordered categories list their words in sequence. A deal uses the first N
 * words so every category always starts from the same familiar point; the
 * words must enter the slot first→last and be stacked last→first down a column.
 */
export interface CategoryDef {
  name: string;
  words: string[];
  ordered?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { name: 'Planets', words: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Neptune', 'Uranus'] },
  { name: 'Fruits', words: ['Apple', 'Banana', 'Mango', 'Kiwi', 'Papaya', 'Cherry', 'Grape', 'Lychee'] },
  { name: 'Brainrot', words: ['Skibidi', 'Rizz', 'Gyatt', 'Delulu', 'Fanum Tax', 'Mewing', 'Aura', 'Ohio'] },
  { name: 'Chess', words: ['Bishop', 'Rook', 'Pawn', 'Castling', 'Checkmate', 'Gambit', 'En Passant'] },
  { name: 'Coffee', words: ['Espresso', 'Latte', 'Mocha', 'Cappuccino', 'Americano', 'Macchiato', 'Cortado'] },
  { name: 'Dog Breeds', words: ['Poodle', 'Beagle', 'Corgi', 'Husky', 'Pug', 'Dachshund', 'Labrador'] },
  { name: 'Pasta', words: ['Penne', 'Fusilli', 'Rigatoni', 'Linguine', 'Farfalle', 'Orzo', 'Ravioli'] },
  { name: 'Weather', words: ['Drizzle', 'Hail', 'Fog', 'Blizzard', 'Thunder', 'Sleet', 'Monsoon'] },
  { name: 'Music', words: ['Violin', 'Trumpet', 'Cello', 'Banjo', 'Flute', 'Oboe', 'Ukulele'] },
  { name: 'Coding', words: ['Python', 'Rust', 'TypeScript', 'Haskell', 'Kotlin', 'Ruby', 'Swift'] },
  { name: 'Gems', words: ['Garnet', 'Emerald', 'Sapphire', 'Diamond', 'Opal', 'Topaz', 'Amethyst'] },
  { name: 'Sports', words: ['Soccer', 'Tennis', 'Rugby', 'Cricket', 'Hockey', 'Golf', 'Volleyball'] },
  { name: 'Shapes', words: ['Circle', 'Triangle', 'Hexagon', 'Rhombus', 'Oval', 'Pentagon', 'Trapezoid'] },
  { name: 'Ocean Life', words: ['Octopus', 'Dolphin', 'Jellyfish', 'Starfish', 'Seahorse', 'Narwhal', 'Squid'] },
  { name: 'Furniture', words: ['Sofa', 'Ottoman', 'Dresser', 'Bookshelf', 'Recliner', 'Futon', 'Armoire'] },
  { name: 'Cheese', words: ['Cheddar', 'Brie', 'Gouda', 'Feta', 'Parmesan', 'Mozzarella', 'Camembert'] },
  { name: 'Dances', words: ['Tango', 'Salsa', 'Waltz', 'Foxtrot', 'Polka', 'Breakdance', 'Flamenco'] },
  { name: 'Memes', words: ['Doge', 'Rickroll', 'Nyan Cat', 'Stonks', 'Pepe', 'Harambe', 'Trollface'] },
  { name: 'Clouds', words: ['Cumulus', 'Cirrus', 'Stratus', 'Nimbus', 'Altostratus', 'Contrail'] },
  { name: 'Board Games', words: ['Monopoly', 'Scrabble', 'Catan', 'Risk', 'Clue', 'Battleship', 'Jenga'] },
  { name: 'Spices', words: ['Cumin', 'Paprika', 'Turmeric', 'Cinnamon', 'Nutmeg', 'Saffron', 'Cardamom'] },
  { name: 'Birds', words: ['Penguin', 'Toucan', 'Flamingo', 'Pelican', 'Ostrich', 'Parrot', 'Owl'] },
  { name: 'Currencies', words: ['Dollar', 'Euro', 'Yen', 'Peso', 'Rupee', 'Franc', 'Won'] },
  { name: 'Greek Letters', words: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Lambda', 'Epsilon'] },
];

export const ORDERED_CATEGORIES: CategoryDef[] = [
  { name: 'Time Units', ordered: true, words: ['Second', 'Minute', 'Hour', 'Day', 'Week', 'Month', 'Year', 'Decade', 'Century'] },
  { name: 'Weekdays', ordered: true, words: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  { name: 'Months', ordered: true, words: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'] },
  { name: 'Rainbow', ordered: true, words: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'] },
  { name: 'Do Re Mi', ordered: true, words: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'] },
  { name: 'Data Sizes', ordered: true, words: ['Bit', 'Byte', 'Kilobyte', 'Megabyte', 'Gigabyte', 'Terabyte', 'Petabyte'] },
  { name: 'Life Stages', ordered: true, words: ['Baby', 'Toddler', 'Child', 'Teen', 'Adult', 'Senior'] },
  { name: 'Counting', ordered: true, words: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'] },
];

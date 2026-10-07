/**
 * Category pool for Associations. Each deal picks a handful of categories and
 * a random subset of their words, so card counts vary per category.
 * Words must be unique across the whole pool to keep every card unambiguous.
 */
export interface CategoryDef {
  name: string;
  words: string[];
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

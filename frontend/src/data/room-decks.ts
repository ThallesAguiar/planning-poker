export const entryCards = ['1', '3', '5', '8', '13', '?'] as const;

export const deckPresets = {
  fibonacci: { deckType: 'fibonacci', deckValues: [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'] },
  fibonacci_modificado: { deckType: 'fibonacci_modificado', deckValues: [0, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?'] },
  tshirt: { deckType: 'tshirt', deckValues: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'] },
} as const;

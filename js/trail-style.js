// Regional grading follows OpenSkiData's RunDifficultyConvention definitions.
const GREEN = '#219c60', BLUE = '#198be8', RED = '#e24545', BLACK = '#172c41';
export function trailColor(difficulty, convention) {
  if (!['north_america', 'europe', 'japan'].includes(convention)) {
    throw new Error(`Unsupported trail grading convention: ${convention}`);
  }
  if (difficulty === 'novice') return GREEN;
  if (difficulty === 'easy') return convention === 'europe' ? BLUE : GREEN;
  if (difficulty === 'intermediate') return convention === 'north_america' ? BLUE : RED;
  if (['advanced', 'expert'].includes(difficulty)) return BLACK;
  if (['freeride', 'extreme'].includes(difficulty)) return '#ec8645';
  return '#859cac'; // An unmapped grade stays visibly unrated.
}

export function trailLegend(convention) {
  if (convention === 'europe') return [
    ['Beginner', 'circle.svg'], ['Easy', 'circle-blue.svg'],
    ['Intermediate', 'circle-red.svg'], ['Advanced', 'diamond.svg']
  ];
  if (convention === 'japan') return [
    ['Easy', 'circle.svg'], ['Intermediate', 'circle-red.svg'], ['Advanced', 'diamond.svg']
  ];
  if (convention === 'north_america') return [
    ['Easy', 'circle.svg'], ['Intermediate', 'square.svg'], ['Advanced', 'diamond.svg']
  ];
  throw new Error(`Unsupported trail grading convention: ${convention}`);
}

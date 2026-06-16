import React from 'react'

type MuscleFigureProps = {
  activeMuscles: string[]
  className?: string
  width?: number
  height?: number
}

const MUSCLE_MAP: Record<string, string[]> = {
  // Chest
  'brust': ['chest'],

  // Back
  'rücken': ['lats', 'traps', 'lowerback'],
  'ruecken': ['lats', 'traps', 'lowerback'],
  'latissimus': ['lats'],
  'nacken': ['traps'],
  'unterer rücken': ['lowerback'],

  // Legs
  'beine': ['quads', 'hamstrings', 'calves', 'glutes'],
  'bein': ['quads', 'hamstrings', 'calves', 'glutes'],
  'oberschenkel': ['quads', 'hamstrings'],
  'oberschenkel vorne': ['quads'],
  'oberschenkel hinten': ['hamstrings'],
  'beinbeuger': ['hamstrings'],
  'beinstrecker': ['quads'],
  'waden': ['calves'],
  'wade': ['calves'],
  'unterschenkel': ['calves'],
  'unterbein': ['calves'],
  'unterbeine': ['calves'],
  'po': ['glutes'],
  'gesäß': ['glutes'],
  'gesaess': ['glutes'],

  // Arms
  'bizeps': ['biceps', 'forearms'],
  'trizeps': ['triceps', 'forearms'],
  'arme': ['biceps', 'triceps', 'forearms'],
  'arm': ['biceps', 'triceps', 'forearms'],
  'unterarme': ['forearms'],

  // Shoulders
  'schulter': ['deltoids'],
  'schultern': ['deltoids'],

  // Core
  'bauch': ['abs', 'obliques'],
  'core': ['abs', 'obliques', 'lowerback'],

  // Specific compound exercises that hit multiple secondary muscles
  'kreuzheben': ['glutes', 'hamstrings', 'lowerback', 'traps'],
  'rückentrainer': ['glutes', 'lowerback']
}

export default function MuscleFigure({ activeMuscles = [], className = '', width = 56, height = 70 }: MuscleFigureProps) {
  const activeSet = new Set<string>()
  activeMuscles.forEach(m => {
    const groups = MUSCLE_MAP[m.toLowerCase()]
    if (groups) groups.forEach(g => activeSet.add(g))
  })

  const activeColor = 'var(--accent)'
  const inactiveColor = 'var(--text-muted)'
  const baseColor = 'rgba(120, 120, 130, 0.2)' 

  const getColor = (part: string) => activeSet.has(part) ? activeColor : inactiveColor

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible' }}
    >
      {/* FRONT FIGURE */}
      <g transform="translate(0, 0)">
        {/* Head */}
        <ellipse cx="30" cy="10" rx="3.5" ry="5" fill={baseColor} />
        {/* Traps Front */}
        <path d="M 28 14 L 25 16 L 27 18 Z" fill={getColor('traps')} />
        <path d="M 32 14 L 35 16 L 33 18 Z" fill={getColor('traps')} />
        {/* Deltoids Front */}
        <path d="M 25 16 C 21 16, 19 20, 20 24 L 22.5 22 C 22.5 19, 24 18, 26 18 Z" fill={getColor('deltoids')} />
        <path d="M 35 16 C 39 16, 41 20, 40 24 L 37.5 22 C 37.5 19, 36 18, 34 18 Z" fill={getColor('deltoids')} />
        {/* Chest */}
        <path d="M 29.5 18 L 24.5 18 C 23 20, 23 22, 24 23.5 L 29.5 23.5 Z" fill={getColor('chest')} />
        <path d="M 30.5 18 L 35.5 18 C 37 20, 37 22, 36 23.5 L 30.5 23.5 Z" fill={getColor('chest')} />
        {/* Abs */}
        <rect x="25.5" y="24.5" width="4" height="3.5" rx="0.5" fill={getColor('abs')} />
        <rect x="30.5" y="24.5" width="4" height="3.5" rx="0.5" fill={getColor('abs')} />
        <rect x="26" y="29" width="3.5" height="3.5" rx="0.5" fill={getColor('abs')} />
        <rect x="30.5" y="29" width="3.5" height="3.5" rx="0.5" fill={getColor('abs')} />
        <rect x="26.5" y="33.5" width="3" height="4" rx="0.5" fill={getColor('abs')} />
        <rect x="30.5" y="33.5" width="3" height="4" rx="0.5" fill={getColor('abs')} />
        {/* Obliques */}
        <path d="M 24.5 24.5 L 23 25 L 22 31 L 25 32 Z" fill={getColor('obliques')} />
        <path d="M 35.5 24.5 L 37 25 L 38 31 L 35 32 Z" fill={getColor('obliques')} />
        {/* Biceps */}
        <path d="M 20 25 C 17 26, 17 31, 18.5 32 L 21 30 C 21 28, 21 26, 20 25 Z" fill={getColor('biceps')} />
        <path d="M 40 25 C 43 26, 43 31, 41.5 32 L 39 30 C 39 28, 39 26, 40 25 Z" fill={getColor('biceps')} />
        {/* Forearms */}
        <path d="M 18 33 C 15 34, 15 41, 16 44 L 18.5 42 C 18.5 38, 19 35, 18 33 Z" fill={getColor('forearms')} />
        <path d="M 42 33 C 45 34, 45 41, 44 44 L 41.5 42 C 41.5 38, 41 35, 42 33 Z" fill={getColor('forearms')} />
        {/* Hands */}
        <path d="M 16 45 C 13 47, 14 50, 16 51 L 18 48 Z" fill={baseColor} />
        <path d="M 44 45 C 47 47, 46 50, 44 51 L 42 48 Z" fill={baseColor} />
        {/* Quads */}
        <path d="M 26.5 39 C 22 41, 21 54, 23 60 L 27 58 C 26.5 50, 27 43, 29 40 Z" fill={getColor('quads')} />
        <path d="M 33.5 39 C 38 41, 39 54, 37 60 L 33 58 C 33.5 50, 33 43, 31 40 Z" fill={getColor('quads')} />
        {/* Calves Front */}
        <path d="M 23.5 62 C 21.5 65, 21.5 75, 22.5 79 L 25 78 C 24.5 73, 25.5 65, 26 62 Z" fill={getColor('calves')} />
        <path d="M 36.5 62 C 38.5 65, 38.5 75, 37.5 79 L 35 78 C 35.5 73, 34.5 65, 34 62 Z" fill={getColor('calves')} />
        {/* Feet */}
        <path d="M 22.5 80 L 19 82 L 21 84 L 26 84 L 25 80 Z" fill={baseColor} />
        <path d="M 37.5 80 L 41 82 L 39 84 L 34 84 L 35 80 Z" fill={baseColor} />
      </g>

      {/* BACK FIGURE */}
      <g transform="translate(0, 0)">
        {/* Head */}
        <ellipse cx="70" cy="10" rx="3.5" ry="5" fill={baseColor} />
        {/* Traps */}
        <path d="M 70 14 L 65 17 L 69 22 L 70 24 L 71 22 L 75 17 Z" fill={getColor('traps')} />
        {/* Rear Delts */}
        <path d="M 64 17 C 60 17, 58 21, 59 25 L 61.5 23 C 61.5 20, 63 19, 64.5 19 Z" fill={getColor('deltoids')} />
        <path d="M 76 17 C 80 17, 82 21, 81 25 L 78.5 23 C 78.5 20, 77 19, 75.5 19 Z" fill={getColor('deltoids')} />
        {/* Lats */}
        <path d="M 69.5 24 L 63 21 C 61 26, 62 33, 67 36 L 69.5 33 Z" fill={getColor('lats')} />
        <path d="M 70.5 24 L 77 21 C 79 26, 78 33, 73 36 L 70.5 33 Z" fill={getColor('lats')} />
        {/* Lower Back */}
        <path d="M 69.5 34 L 66 37 L 68 41 L 69.5 41 Z" fill={getColor('lowerback')} />
        <path d="M 70.5 34 L 74 37 L 72 41 L 70.5 41 Z" fill={getColor('lowerback')} />
        {/* Triceps */}
        <path d="M 59 25 C 56 26, 56 31, 57.5 32 L 60 30 C 60 28, 60 26, 59 25 Z" fill={getColor('triceps')} />
        <path d="M 81 25 C 84 26, 84 31, 82.5 32 L 80 30 C 80 28, 80 26, 81 25 Z" fill={getColor('triceps')} />
        {/* Forearms */}
        <path d="M 57 33 C 54 34, 54 41, 55 44 L 57.5 42 C 57.5 38, 58 35, 57 33 Z" fill={getColor('forearms')} />
        <path d="M 83 33 C 86 34, 86 41, 85 44 L 82.5 42 C 82.5 38, 82 35, 83 33 Z" fill={getColor('forearms')} />
        {/* Hands */}
        <path d="M 55 45 C 52 47, 53 50, 55 51 L 57 48 Z" fill={baseColor} />
        <path d="M 85 45 C 88 47, 87 50, 85 51 L 83 48 Z" fill={baseColor} />
        {/* Glutes */}
        <path d="M 69.5 42 L 63 43 C 62 47, 64 50, 69.5 50 Z" fill={getColor('glutes')} />
        <path d="M 70.5 42 L 77 43 C 78 47, 76 50, 70.5 50 Z" fill={getColor('glutes')} />
        {/* Hamstrings */}
        <path d="M 69 51 L 64 51 C 63 55, 64 61, 66 62 L 68 60 Z" fill={getColor('hamstrings')} />
        <path d="M 71 51 L 76 51 C 77 55, 76 61, 74 62 L 72 60 Z" fill={getColor('hamstrings')} />
        {/* Calves */}
        <path d="M 66 64 C 63 67, 63 74, 64 78 L 67 77 C 67 72, 68 66, 66 64 Z" fill={getColor('calves')} />
        <path d="M 74 64 C 77 67, 77 74, 76 78 L 73 77 C 73 72, 72 66, 74 64 Z" fill={getColor('calves')} />
        {/* Feet */}
        <path d="M 65 79 L 62 82 L 64 84 L 68 84 L 67 80 Z" fill={baseColor} />
        <path d="M 75 79 L 78 82 L 76 84 L 72 84 L 73 80 Z" fill={baseColor} />
      </g>
    </svg>
  )
}

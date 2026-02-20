export type LogLevel = 'quiet' | 'normal' | 'verbose';

let currentLevel: LogLevel = 'normal';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function supportsColor(): boolean {
  return process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
}

function c(color: keyof typeof COLORS, text: string): string {
  if (!supportsColor()) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export const log = {
  info(msg: string): void {
    if (currentLevel === 'quiet') return;
    console.log(msg);
  },
  success(msg: string): void {
    if (currentLevel === 'quiet') return;
    console.log(c('green', '✓') + ' ' + msg);
  },
  warn(msg: string): void {
    console.log(c('yellow', '⚠') + ' ' + msg);
  },
  error(msg: string): void {
    console.error(c('red', '✗') + ' ' + msg);
  },
  debug(msg: string): void {
    if (currentLevel !== 'verbose') return;
    console.log(c('gray', '  ' + msg));
  },
  dim(msg: string): void {
    if (currentLevel === 'quiet') return;
    console.log(c('dim', msg));
  },
  header(msg: string): void {
    if (currentLevel === 'quiet') return;
    console.log('\n' + c('bold', c('cyan', msg)));
  },
  table(rows: [string, string][]): void {
    if (currentLevel === 'quiet') return;
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, val] of rows) {
      console.log(`  ${c('dim', key.padEnd(maxKey))}  ${val}`);
    }
  },
};

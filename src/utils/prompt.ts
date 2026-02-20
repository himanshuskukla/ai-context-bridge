import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/** Ask a question and get a text answer. */
export async function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  try {
    const answer = await rl.question(`${question}${suffix}: `);
    return answer.trim() || defaultValue || '';
  } finally {
    rl.close();
  }
}

/** Ask a yes/no question. */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${question} ${hint}`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/** Ask user to pick from a list. Returns the index. */
export async function choose(question: string, options: string[]): Promise<number> {
  console.log(`\n${question}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}. ${options[i]}`);
  }
  const answer = await ask('Choice', '1');
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) return idx;
  return 0;
}

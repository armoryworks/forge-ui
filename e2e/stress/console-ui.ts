import chalk from 'chalk';

import type { StressMetrics, WorkerState, WorkerStatus } from '../lib/types';

const BOX_TL = '\u2554'; // ╔
const BOX_TR = '\u2557'; // ╗
const BOX_BL = '\u255A'; // ╚
const BOX_BR = '\u255D'; // ╝
const BOX_H  = '\u2550'; // ═
const BOX_V  = '\u2551'; // ║
const BOX_ML = '\u2560'; // ╠
const BOX_MR = '\u2563'; // ╣

const BLOCK_FULL  = '\u2588'; // █
const BLOCK_LIGHT = '\u2591'; // ░

const MAX_EVENTS = 8;

interface ConsoleEvent {
  time: Date;
  message: string;
}

export class ConsoleUI {
  private events: ConsoleEvent[] = [];
  private startedAt: Date;
  private durationMs: number;
  private renderInterval?: ReturnType<typeof setInterval>;
  private metrics: StressMetrics | null = null;

  constructor(durationMs: number) {
    this.durationMs = durationMs;
    this.startedAt = new Date();
  }

  start(): void {
    this.startedAt = new Date();
    // Hide cursor
    process.stdout.write('\x1B[?25l');
    this.render();
    this.renderInterval = setInterval(() => this.render(), 500);
  }

  stop(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = undefined;
    }
    // Show cursor
    process.stdout.write('\x1B[?25h');
    this.render();
    process.stdout.write('\n');
    this.printFinalSummary();
  }

  updateMetrics(m: StressMetrics): void {
    this.metrics = m;
  }

  addEvent(message: string): void {
    this.events.unshift({ time: new Date(), message });
    if (this.events.length > MAX_EVENTS) {
      this.events.length = MAX_EVENTS;
    }
  }

  // ── Render pipeline ──────────────────────────────────────────────

  private render(): void {
    const w = this.getWidth();
    const lines: string[] = [];

    lines.push(...this.renderHeader(w));
    lines.push(this.hLine(w, BOX_ML, BOX_MR));
    lines.push(...this.renderTeams(w));
    lines.push(this.hLine(w, BOX_ML, BOX_MR));
    lines.push(...this.renderStats(w));
    lines.push(this.hLine(w, BOX_ML, BOX_MR));
    lines.push(...this.renderEvents(w));
    lines.push(this.boxLine(BOX_BL, BOX_H.repeat(w - 2), BOX_BR));

    // Clear screen, move to top, write frame
    process.stdout.write('\x1B[2J\x1B[H' + lines.join('\n') + '\n');
  }

  private renderHeader(w: number): string[] {
    const elapsed = Date.now() - this.startedAt.getTime();
    const pct = Math.min(100, (elapsed / this.durationMs) * 100);
    const elapsedStr = this.formatDuration(elapsed);
    const totalStr = this.formatDuration(this.durationMs);
    const pctStr = pct.toFixed(1) + '%';

    const barWidth = Math.max(10, w - 58);
    const progressBar = this.renderProgressBar(pct, barWidth);

    const title = chalk.bold.cyan('QB ENGINEER STRESS TEST');
    const timing = `${elapsedStr} / ${totalStr}`;
    const right = `${progressBar}  ${chalk.bold.white(pctStr)}`;

    // Build the content: title + timing + progress
    const contentRaw = `  ${title}   ${timing}    ${right}  `;
    const contentVisible = this.stripAnsi(contentRaw);
    const pad = Math.max(0, w - 2 - contentVisible.length);

    const topBorder = this.boxLine(BOX_TL, BOX_H.repeat(w - 2), BOX_TR);
    const headerLine = BOX_V + contentRaw + ' '.repeat(pad) + BOX_V;

    return [topBorder, headerLine];
  }

  private renderTeams(w: number): string[] {
    const lines: string[] = [];
    const m = this.metrics;

    const alphaWorkers = m ? m.workers.filter(wr => wr.team === 'alpha') : [];
    const bravoWorkers = m ? m.workers.filter(wr => wr.team === 'bravo') : [];
    const supportWorkers = m ? m.workers.filter(wr => wr.team === null) : [];

    const inner = w - 4; // 2 for box chars + 2 padding
    const colWidth = Math.floor(inner / 2);

    // Blank line
    lines.push(this.padLine('', w));

    // Team headers
    const alphaHeader = chalk.bold.yellow('ALPHA TEAM (Production)');
    const bravoHeader = chalk.bold.magenta('BRAVO TEAM (Maintenance)');
    lines.push(this.twoColLine(alphaHeader, bravoHeader, colWidth, w));

    // Team rows
    const maxTeamRows = Math.max(alphaWorkers.length, bravoWorkers.length);
    for (let i = 0; i < maxTeamRows; i++) {
      const left = i < alphaWorkers.length
        ? this.formatWorkerLine(alphaWorkers[i])
        : '';
      const right = i < bravoWorkers.length
        ? this.formatWorkerLine(bravoWorkers[i])
        : '';
      lines.push(this.twoColLine(left, right, colWidth, w));
    }

    // Blank line
    lines.push(this.padLine('', w));

    // Support roles header
    lines.push(this.padLine(chalk.bold.blue('SUPPORT ROLES'), w));

    // Support rows (2-column layout)
    for (let i = 0; i < supportWorkers.length; i += 2) {
      const left = this.formatWorkerLine(supportWorkers[i]);
      const right = i + 1 < supportWorkers.length
        ? this.formatWorkerLine(supportWorkers[i + 1])
        : '';
      lines.push(this.twoColLine(left, right, colWidth, w));
    }

    // Blank line
    lines.push(this.padLine('', w));

    return lines;
  }

  private renderStats(w: number): string[] {
    const m = this.metrics;
    const lines: string[] = [];

    const actions = m ? this.formatNum(m.totalActions) : '0';
    const errors = m ? m.totalErrors.toString() : '0';
    const loops = m ? m.totalLoops.toString() : '0';
    const avg = m ? m.avgResponseMs.toFixed(0) + 'ms' : '—';
    const p99 = m ? (m.p99ResponseMs / 1000).toFixed(1) + 's' : '—';

    const line1Parts = [
      `Actions: ${chalk.bold.white(actions)}`,
      `Errors: ${m && m.totalErrors > 0 ? chalk.red(errors) : chalk.bold.white(errors)}`,
      `Loops: ${chalk.bold.white(loops)}`,
      `Avg: ${chalk.bold.white(avg)}`,
      `P99: ${chalk.bold.white(p99)}`,
    ];

    const signalr = m ? this.formatNum(m.signalrEvents) : '0';
    const chat = m ? m.chatMessages.toString() : '0';
    const notify = m ? m.notificationsSent.toString() : '0';
    const conflicts = m ? m.conflicts409.toString() : '0';
    const deadlocks = m ? m.deadlocks.toString() : '0';

    const line2Parts = [
      `SignalR: ${chalk.bold.white(signalr)} evts`,
      `Chat: ${chalk.bold.white(chat)} msgs`,
      `Notify: ${chalk.bold.white(notify)}`,
      `409s: ${m && m.conflicts409 > 0 ? chalk.yellow(conflicts) : chalk.bold.white(conflicts)}`,
      `Deadlocks: ${m && m.deadlocks > 0 ? chalk.red(deadlocks) : chalk.bold.white(deadlocks)}`,
    ];

    lines.push(this.padLine(line1Parts.join('    '), w));
    lines.push(this.padLine(line2Parts.join('    '), w));

    return lines;
  }

  private renderEvents(w: number): string[] {
    const lines: string[] = [];

    lines.push(this.padLine(chalk.bold.white('RECENT EVENTS'), w));

    if (this.events.length === 0) {
      lines.push(this.padLine(chalk.dim('  No events yet...'), w));
    } else {
      for (const evt of this.events) {
        const elapsed = evt.time.getTime() - this.startedAt.getTime();
        const ts = chalk.dim(this.formatDuration(elapsed));
        const maxMsgLen = w - 12; // box chars + timestamp + padding
        const msg = this.truncate(evt.message, maxMsgLen);
        lines.push(this.padLine(`  ${ts} ${msg}`, w));
      }
    }

    return lines;
  }

  // ── Worker formatting ────────────────────────────────────────────

  private formatWorkerLine(worker: WorkerState): string {
    const icon = this.getWorkerIcon(worker.status);
    const colorFn = this.getWorkerColor(worker.status);

    const wId = `W${String(worker.workerId).padStart(2, '0')}`;
    const initial = worker.email.charAt(0).toUpperCase();
    const namePart = worker.email.split('@')[0];
    const shortName = this.truncate(namePart, 12);

    if (worker.status === 'failed') {
      const failStep = this.truncate(worker.currentStep || '???', 10);
      return `${icon} ${chalk.dim(wId)} ${colorFn(shortName.padEnd(13))}${chalk.red('[FAIL]')} ${chalk.cyan(failStep)}`;
    }

    const step = this.truncate(worker.currentStep || '...', 8);
    const desc = this.truncate(worker.currentScript || 'idle', 14);
    return `${icon} ${chalk.dim(wId)} ${colorFn(shortName.padEnd(13))}${chalk.cyan(step.padEnd(9))}${chalk.dim(desc)}`;
  }

  private getWorkerIcon(status: WorkerStatus): string {
    switch (status) {
      case 'running':
        return chalk.green('\u25CF'); // ●
      case 'failed':
        return chalk.red('\u26A0'); // ⚠
      case 'completed':
        return chalk.dim('\u25CF'); // ●
      case 'paused':
        return chalk.yellow('\u25CF'); // ●
      case 'initializing':
        return chalk.dim('\u25CB'); // ○
      default:
        return chalk.dim('\u25CF');
    }
  }

  private getWorkerColor(status: WorkerStatus): (s: string) => string {
    switch (status) {
      case 'running':
        return chalk.green;
      case 'failed':
        return chalk.red;
      case 'completed':
        return chalk.dim;
      case 'paused':
        return chalk.yellow;
      case 'initializing':
        return chalk.dim;
      default:
        return chalk.white;
    }
  }

  // ── Layout helpers ───────────────────────────────────────────────

  private getWidth(): number {
    return Math.max(80, Math.min(process.stdout.columns || 80, 120));
  }

  private boxLine(left: string, middle: string, right: string): string {
    return left + middle + right;
  }

  private hLine(w: number, left: string, right: string): string {
    return left + BOX_H.repeat(w - 2) + right;
  }

  /** Wrap content in box verticals with padding */
  private padLine(content: string, w: number): string {
    const visible = this.stripAnsi(content);
    const pad = Math.max(0, w - 4 - visible.length);
    return BOX_V + '  ' + content + ' '.repeat(pad) + '  ' + BOX_V;
  }

  /** Two-column layout inside box */
  private twoColLine(left: string, right: string, colWidth: number, w: number): string {
    const leftVisible = this.stripAnsi(left);
    const rightVisible = this.stripAnsi(right);
    const leftPad = Math.max(0, colWidth - leftVisible.length);
    const combined = left + ' '.repeat(leftPad) + right;
    const combinedVisible = leftVisible + ' '.repeat(leftPad) + rightVisible;
    const outerPad = Math.max(0, w - 4 - combinedVisible.length);
    return BOX_V + '  ' + combined + ' '.repeat(outerPad) + '  ' + BOX_V;
  }

  private renderProgressBar(pct: number, width: number): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return chalk.green(BLOCK_FULL.repeat(filled)) + chalk.dim(BLOCK_LIGHT.repeat(empty));
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private formatNum(n: number): string {
    return n.toLocaleString('en-US');
  }

  private truncate(s: string, maxLen: number): string {
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + '\u2026'; // …
  }

  private stripAnsi(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1B\[[0-9;]*m/g, '');
  }

  // ── Final summary ────────────────────────────────────────────────

  private printFinalSummary(): void {
    const m = this.metrics;
    const elapsed = Date.now() - this.startedAt.getTime();

    console.log('');
    console.log(chalk.bold.cyan('=== STRESS TEST COMPLETE ==='));
    console.log('');
    console.log(`  Duration:     ${this.formatDuration(elapsed)}`);
    console.log(`  Actions:      ${m ? this.formatNum(m.totalActions) : 0}`);
    console.log(`  Errors:       ${m ? chalk[m.totalErrors > 0 ? 'red' : 'green'](m.totalErrors) : 0}`);
    console.log(`  Loops:        ${m ? m.totalLoops : 0}`);
    console.log(`  Avg response: ${m ? m.avgResponseMs.toFixed(0) + 'ms' : '—'}`);
    console.log(`  P95 response: ${m ? m.p95ResponseMs.toFixed(0) + 'ms' : '—'}`);
    console.log(`  P99 response: ${m ? m.p99ResponseMs.toFixed(0) + 'ms' : '—'}`);
    console.log(`  SignalR:      ${m ? this.formatNum(m.signalrEvents) + ' events' : '—'}`);
    console.log(`  Chat:         ${m ? m.chatMessages + ' messages' : '—'}`);
    console.log(`  Notifications:${m ? ' ' + m.notificationsSent : '—'}`);
    console.log(`  409 conflicts:${m ? ' ' + m.conflicts409 : '—'}`);
    console.log(`  Deadlocks:    ${m ? m.deadlocks : '—'}`);
    console.log('');

    if (m) {
      const failed = m.workers.filter(wr => wr.status === 'failed');
      if (failed.length > 0) {
        console.log(chalk.red(`  ${failed.length} worker(s) failed:`));
        for (const wr of failed) {
          console.log(chalk.red(`    W${String(wr.workerId).padStart(2, '0')} ${wr.email}: ${wr.lastError ?? 'unknown error'}`));
        }
        console.log('');
      }

      const completedWorkers = m.workers.filter(wr => wr.status === 'completed' || wr.status === 'running');
      console.log(`  ${completedWorkers.length}/${m.workers.length} workers completed successfully`);
    }

    console.log('');
    console.log(chalk.dim('  Error screenshots saved to: e2e/stress/errors/'));
    console.log(chalk.dim('  Metrics log saved to:       e2e/stress/metrics/'));
    console.log('');
  }
}

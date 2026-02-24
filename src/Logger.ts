/**
 * Logger - Simple structured logger with env-var-based configuration.
 *
 * SIGNALWIRE_LOG_LEVEL: debug | info | warn | error (default: info)
 * SIGNALWIRE_LOG_MODE: off to suppress all logging (used by CLI --raw)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

let globalLevel: LogLevel = (process.env['SIGNALWIRE_LOG_LEVEL'] as LogLevel) ?? 'info';
let globalSuppressed = process.env['SIGNALWIRE_LOG_MODE'] === 'off';

export function setGlobalLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function suppressAllLogs(suppress = true): void {
  globalSuppressed = suppress;
}

export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (globalSuppressed) return;
    if (LEVELS[level] < LEVELS[globalLevel]) return;

    const prefix = `[${level.toUpperCase()}] [${this.name}]`;
    const suffix = data && Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    const line = `${prefix} ${msg}${suffix}`;

    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info': console.info(line); break;
      case 'warn': console.warn(line); break;
      case 'error': console.error(line); break;
    }
  }
}

export function getLogger(name: string): Logger {
  return new Logger(name);
}

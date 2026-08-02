import type { LoggerService } from '@nestjs/common';
import { redactLogValue, redactText } from '@fulishe/config';

export class SafeJsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, _trace?: string, context?: string): void {
    this.write('error', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(level: string, message: unknown, context?: string): void {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      context: redactText(context ?? 'Application'),
      message: redactLogValue(message),
    });
    const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  }
}

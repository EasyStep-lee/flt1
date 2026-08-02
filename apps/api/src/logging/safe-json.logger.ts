import type { LoggerService } from '@nestjs/common';

const redact = (value: unknown): string => {
  const text = value instanceof Error ? value.name : String(value);
  return text
    .replace(/:\/\/[^@\s]+@/g, '://[REDACTED]@')
    .replace(
      /(DATABASE_URL|REDIS_URL|PASSWORD|SECRET|TOKEN)=\S+/gi,
      '$1=[REDACTED]',
    );
};

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
      context: context ?? 'Application',
      message: redact(message),
    });
    const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  }
}

import { ILogger, LogLevel } from '@microsoft/signalr';

const STOPPED_WHILE_STARTING = [
  'The connection was stopped during negotiation.',
  'Failed to start the HttpConnection before stop() was called.',
];

export class SignalrConsoleLogger implements ILogger {
  constructor(private readonly minimumLevel: LogLevel) {}

  log(logLevel: LogLevel, message: string): void {
    if (STOPPED_WHILE_STARTING.some(text => message.includes(text))) {
      console.debug(`[SignalR] ${message}`);
      return;
    }
    if (logLevel < this.minimumLevel) return;
    const line = `[${new Date().toISOString()}] ${LogLevel[logLevel]}: ${message}`;
    switch (logLevel) {
      case LogLevel.Critical:
      case LogLevel.Error:
        console.error(line);
        break;
      case LogLevel.Warning:
        console.warn(line);
        break;
      case LogLevel.Information:
        console.info(line);
        break;
      default:
        console.debug(line);
        break;
    }
  }
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogLevel } from '@microsoft/signalr';

import { SignalrConsoleLogger } from './signalr-console-logger';

describe('SignalrConsoleLogger', () => {
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('logs a stop during negotiation at debug level instead of as an error', () => {
    const logger = new SignalrConsoleLogger(LogLevel.Warning);

    logger.log(LogLevel.Error, 'Failed to start the connection: AbortError: The connection was stopped during negotiation.');
    logger.log(LogLevel.Error, 'Failed to start the HttpConnection before stop() was called.');

    expect(error).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledTimes(2);
  });

  it('still reports genuine connection errors', () => {
    const logger = new SignalrConsoleLogger(LogLevel.Warning);

    logger.log(LogLevel.Error, 'Failed to start the connection: Error: WebSocket failed to connect.');

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('drops messages below the minimum level', () => {
    const logger = new SignalrConsoleLogger(LogLevel.Error);

    logger.log(LogLevel.Warning, 'Connection slow.');
    logger.log(LogLevel.Debug, 'Sending handshake.');

    expect(warn).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
  });
});

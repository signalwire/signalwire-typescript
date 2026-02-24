import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, getLogger, setGlobalLogLevel, suppressAllLogs } from '../src/Logger.js';

describe('Logger', () => {
  let spyDebug: ReturnType<typeof vi.spyOn>;
  let spyInfo: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;
  let spyError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setGlobalLogLevel('debug');
    suppressAllLogs(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setGlobalLogLevel('info');
    suppressAllLogs(false);
  });

  it('getLogger returns Logger instance', () => {
    const log = getLogger('test');
    expect(log).toBeInstanceOf(Logger);
  });

  it('logs at debug level', () => {
    const log = getLogger('mymod');
    log.debug('hello');
    expect(spyDebug).toHaveBeenCalledWith('[DEBUG] [mymod] hello');
  });

  it('logs at info level', () => {
    const log = getLogger('mymod');
    log.info('world');
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [mymod] world');
  });

  it('logs at warn level', () => {
    const log = getLogger('mymod');
    log.warn('caution');
    expect(spyWarn).toHaveBeenCalledWith('[WARN] [mymod] caution');
  });

  it('logs at error level', () => {
    const log = getLogger('mymod');
    log.error('failure');
    expect(spyError).toHaveBeenCalledWith('[ERROR] [mymod] failure');
  });

  it('includes data object in output', () => {
    const log = getLogger('test');
    log.info('msg', { key: 'val' });
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [test] msg {"key":"val"}');
  });

  it('respects log level filtering', () => {
    setGlobalLogLevel('warn');
    const log = getLogger('test');
    log.debug('hidden');
    log.info('hidden');
    log.warn('shown');
    log.error('shown');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyError).toHaveBeenCalledOnce();
  });

  it('setGlobalLogLevel changes level', () => {
    setGlobalLogLevel('error');
    const log = getLogger('test');
    log.warn('nope');
    log.error('yes');
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledOnce();
  });

  it('suppressAllLogs suppresses everything', () => {
    suppressAllLogs(true);
    const log = getLogger('test');
    log.debug('nope');
    log.info('nope');
    log.warn('nope');
    log.error('nope');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('suppressAllLogs can be turned off', () => {
    suppressAllLogs(true);
    const log = getLogger('test');
    log.info('hidden');
    expect(spyInfo).not.toHaveBeenCalled();
    suppressAllLogs(false);
    log.info('shown');
    expect(spyInfo).toHaveBeenCalledOnce();
  });

  it('empty data object does not append to output', () => {
    const log = getLogger('test');
    log.info('clean', {});
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [test] clean');
  });

  it('debug level shows all messages', () => {
    setGlobalLogLevel('debug');
    const log = getLogger('test');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(spyDebug).toHaveBeenCalledOnce();
    expect(spyInfo).toHaveBeenCalledOnce();
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyError).toHaveBeenCalledOnce();
  });
});

import { RestError, SignalWireRestError } from '../../src/rest/RestError.js';

describe('RestError', () => {
  it('formats error message from status, body, url, method', () => {
    const err = new RestError(404, 'Not Found', 'https://x.signalwire.com/api/test', 'GET');
    expect(err.message).toBe('GET https://x.signalwire.com/api/test returned 404: Not Found');
    expect(err.statusCode).toBe(404);
    expect(err.body).toBe('Not Found');
    expect(err.url).toBe('https://x.signalwire.com/api/test');
    expect(err.method).toBe('GET');
    expect(err.name).toBe('RestError');
  });

  it('is an instance of Error', () => {
    const err = new RestError(500, 'Internal', '/api/test', 'POST');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RestError);
  });

  it('captures stack trace', () => {
    const err = new RestError(400, 'Bad Request', '/api/test', 'PUT');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('RestError');
  });

  it('defaults method to GET when omitted', () => {
    const err = new RestError(500, 'Server Error', '/api/test');
    expect(err.method).toBe('GET');
    expect(err.message).toBe('GET /api/test returned 500: Server Error');
  });

  it('accepts an object body and stringifies it in the message', () => {
    const bodyObj = { errors: ['invalid field'] };
    const err = new RestError(422, bodyObj, '/api/test', 'POST');
    expect(err.body).toEqual(bodyObj);
    expect(typeof err.body).toBe('object');
    expect(err.message).toBe('POST /api/test returned 422: {"errors":["invalid field"]}');
  });

  it('preserves string body as-is', () => {
    const err = new RestError(400, 'Bad Request', '/api/test', 'POST');
    expect(err.body).toBe('Bad Request');
    expect(typeof err.body).toBe('string');
  });

  it('SignalWireRestError is the same class as RestError', () => {
    expect(SignalWireRestError).toBe(RestError);
    const err = new SignalWireRestError(404, 'Not Found', '/api/test');
    expect(err).toBeInstanceOf(RestError);
    expect(err).toBeInstanceOf(SignalWireRestError);
    expect(err.name).toBe('RestError');
  });
});

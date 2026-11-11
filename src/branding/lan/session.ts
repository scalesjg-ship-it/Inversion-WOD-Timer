import { formPage, messagePage, type PageDefaults } from './page';
import { isPairingToken, tokensEqual } from './token';
import { decideUpload, parseMultipart, textField, type AcceptedUpload } from './upload';
import type { ParsedRequest } from './http';

export type TransferResult = { status: number; html: string };

export class LogoSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogoSaveError';
  }
}

export class LogoTransferSession {
  used = false;
  private busy = false;

  constructor(
    public token: string,
    private readonly isExpired: () => boolean,
    private readonly defaults: () => PageDefaults,
    private readonly onUpload: (upload: AcceptedUpload) => Promise<void>,
  ) {}

  rotate(next: string): void {
    this.token = next;
    this.used = false;
  }

  async handle(request: ParsedRequest): Promise<TransferResult> {
    if (this.isExpired()) {
      return page(410, 'Link closed', 'The TV stopped waiting. Open Brand on the TV and scan again.');
    }
    const pathname = request.pathname === '/' || request.pathname === '/upload';
    if (!pathname) return page(404, 'Not found', 'Scan the code on the TV.');
    if (request.method === 'GET' || request.method === 'HEAD') return this.serveForm(request.query.get('t') ?? '');
    if (request.method !== 'POST') return page(405, 'Use the form', 'Send the logo from the form on this page.');
    return this.acceptPost(request);
  }

  private serveForm(token: string): TransferResult {
    if (!this.tokenMatches(token)) return page(403, 'Link not valid', 'This link is not valid. Scan the code on the TV again.');
    if (this.used) return page(410, 'Already sent', 'This code was already used. Scan the new code on the TV.');
    return { status: 200, html: formPage(this.token, this.defaults()) };
  }

  private async acceptPost(request: ParsedRequest): Promise<TransferResult> {
    if (this.busy) return page(409, 'Busy', 'The TV is saving a logo. Wait a moment and try again.');
    const contentType = request.headers.get('content-type') ?? '';
    const parts = parseMultipart(request.body, contentType);
    if (!parts) return page(400, 'Try again', 'That upload could not be read. Try the photo again.');
    const queryToken = request.query.get('t') ?? '';
    const fieldToken = textField(parts, 't');
    if (queryToken && fieldToken && !tokensEqual(queryToken, fieldToken)) {
      return page(403, 'Link not valid', 'This link is not valid. Scan the code on the TV again.');
    }
    const presented = queryToken || fieldToken;
    if (!this.tokenMatches(presented)) {
      return page(403, 'Link not valid', 'This link is not valid. Scan the code on the TV again.');
    }
    if (this.used) return page(410, 'Already sent', 'This code was already used. Scan the new code on the TV.');
    const decision = decideUpload(parts);
    if (!decision.ok) return page(decision.status, 'Try again', decision.message);

    this.busy = true;
    this.used = true;
    try {
      await this.onUpload(decision.upload);
      return page(200, 'Sent', 'The TV has the logo. You can close this page.');
    } catch (error) {
      this.used = false;
      const message =
        error instanceof LogoSaveError
          ? error.message
          : 'This TV could not save that image. Try a smaller JPEG or PNG.';
      return page(500, 'Not saved', message);
    } finally {
      this.busy = false;
    }
  }

  private tokenMatches(token: string): boolean {
    return isPairingToken(token) && isPairingToken(this.token) && tokensEqual(token, this.token);
  }
}

function page(status: number, title: string, message: string): TransferResult {
  return { status, html: messagePage(title, message) };
}

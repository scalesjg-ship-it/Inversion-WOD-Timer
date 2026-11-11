import type { Branding } from '../types';
import { LogoSaveError } from './session';
import type { AcceptedUpload } from './upload';

export type LogoSaveDeps = {
  writeTempFile: (name: string, bytes: Uint8Array) => Promise<string>;
  prepareLogo: (uri: string) => Promise<string>;
  update: (patch: Partial<Branding>) => Promise<void>;
  deleteTempFile: (uri: string) => Promise<void>;
};

/** Write the phone's bytes, then run the same resize-and-store path as a local pick. */
export async function applyUploadedLogo(upload: AcceptedUpload, deps: LogoSaveDeps): Promise<void> {
  const uri = await deps.writeTempFile(`americana-logo-${Date.now()}.${upload.extension}`, upload.image);
  try {
    let logoUri: string;
    try {
      logoUri = await deps.prepareLogo(uri);
    } catch {
      throw new LogoSaveError(
        upload.extension === 'heic'
          ? 'This TV could not read that HEIC photo. Send a JPEG or PNG.'
          : 'This TV could not save that image. Try a smaller JPEG or PNG.',
      );
    }
    await deps.update({ ...upload.patch, logoUri });
  } finally {
    await deps.deleteTempFile(uri).catch(() => undefined);
  }
}

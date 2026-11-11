/** Image bytes the phone may send. The multipart envelope can be a little larger. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export const MAX_HEADER_BYTES = 16 * 1024;

/** Stop listening after this long even if Brand stays open. */
export const LOGO_LISTEN_MS = 10 * 60 * 1000;

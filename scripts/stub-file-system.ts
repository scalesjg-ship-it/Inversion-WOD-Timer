export class File {
  static downloadFileAsync(): Promise<never> {
    return Promise.reject(new Error('file system is not used in the TV screenshot'));
  }
}

export const Paths = { cache: 'cache' };

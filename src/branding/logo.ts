import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const PNG_LIMIT = 900_000;

export async function prepareLogo(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 960, maxHeight: 960 });
  const rendered = await context.renderAsync();
  const png = await rendered.saveAsync({ base64: true, format: SaveFormat.PNG });
  if (png.base64 && png.base64.length <= PNG_LIMIT) {
    return `data:image/png;base64,${png.base64}`;
  }
  const jpeg = await rendered.saveAsync({
    base64: true,
    compress: 0.72,
    format: SaveFormat.JPEG,
  });
  if (jpeg.base64) return `data:image/jpeg;base64,${jpeg.base64}`;
  return jpeg.uri || png.uri;
}

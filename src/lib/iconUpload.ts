const ACCEPTED_TYPES = new Set(['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']);
const MAX_ICON_BYTES = 512 * 1024;

export async function readIconFileAsDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Unsupported file type');
  }
  if (file.size > MAX_ICON_BYTES) {
    throw new Error('File too large');
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid file result'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

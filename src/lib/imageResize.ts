// Skalowanie zdjęć postów społeczności do max 1280×1600 px JPEG q=0.82.
// Zwraca data URL (base64) — zgodne ze sposobem trzymania awatarów / aut w bazie.
export async function resizeImageForPost(file: File): Promise<string> {
  const MAX_W = 1280;
  const MAX_H = 1600;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        const ratio = Math.min(MAX_W / width, MAX_H / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Brak kontekstu canvas.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error('Resize failed'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nie można otworzyć pliku.'));
    };
    img.src = url;
  });
}

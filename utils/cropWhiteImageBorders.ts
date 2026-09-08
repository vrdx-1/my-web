/** ตัดขอบขาว/โปร่งใสออกจากรูป แล้วคืน URL ของรูปที่ครอปแล้ว (blob หรือของเดิมถ้าไม่ต้องตัด) */

const WHITE_THRESHOLD = 248;
const DETECT_MAX = 200;
const MIN_KEEP_RATIO = 0.2;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const MAX_CACHE = 200;

function isEmptyPixel(data: Uint8ClampedArray, offset: number): boolean {
  const a = data[offset + 3];
  if (a < 12) return true;
  return data[offset] >= WHITE_THRESHOLD && data[offset + 1] >= WHITE_THRESHOLD && data[offset + 2] >= WHITE_THRESHOLD;
}

function rowHasContent(data: Uint8ClampedArray, width: number, y: number): boolean {
  const minHits = Math.max(2, Math.floor(width * 0.002));
  let hits = 0;
  const row = y * width * 4;
  for (let x = 0; x < width; x++) {
    if (!isEmptyPixel(data, row + x * 4)) {
      hits += 1;
      if (hits > minHits) return true;
    }
  }
  return false;
}

function colHasContent(data: Uint8ClampedArray, width: number, height: number, x: number): boolean {
  const minHits = Math.max(2, Math.floor(height * 0.002));
  let hits = 0;
  for (let y = 0; y < height; y++) {
    if (!isEmptyPixel(data, (y * width + x) * 4)) {
      hits += 1;
      if (hits > minHits) return true;
    }
  }
  return false;
}

function findContentBox(data: Uint8ClampedArray, width: number, height: number) {
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top < height && !rowHasContent(data, width, top)) top += 1;
  while (bottom > top && !rowHasContent(data, width, bottom)) bottom -= 1;
  while (left < width && !colHasContent(data, width, height, left)) left += 1;
  while (right > left && !colHasContent(data, width, height, right)) right -= 1;

  return { top, bottom, left, right };
}

function remember(src: string, out: string): string {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (typeof first === 'string') {
      const old = cache.get(first);
      cache.delete(first);
      if (old && old.startsWith('blob:') && old !== out) URL.revokeObjectURL(old);
    }
  }
  cache.set(src, out);
  return out;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

async function loadImage(src: string): Promise<{ img: HTMLImageElement; revoke?: string }> {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('image fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImageElement(objectUrl);
      return { img, revoke: objectUrl };
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err;
    }
  }
  return { img: await loadImageElement(src) };
}

async function cropOnce(src: string): Promise<string> {
  const { img, revoke } = await loadImage(src);
  try {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 8 || h < 8) return src;

    const detectScale = Math.min(1, DETECT_MAX / w, DETECT_MAX / h);
    const dw = Math.max(1, Math.round(w * detectScale));
    const dh = Math.max(1, Math.round(h * detectScale));

    const detect = document.createElement('canvas');
    detect.width = dw;
    detect.height = dh;
    const dctx = detect.getContext('2d', { willReadFrequently: true });
    if (!dctx) return src;
    dctx.drawImage(img, 0, 0, dw, dh);

    let box: ReturnType<typeof findContentBox>;
    try {
      box = findContentBox(dctx.getImageData(0, 0, dw, dh).data, dw, dh);
    } catch {
      return src;
    }

    if (box.top >= box.bottom || box.left >= box.right) return src;

    const scaleX = w / dw;
    const scaleY = h / dh;
    const sx = Math.floor(box.left * scaleX);
    const sy = Math.floor(box.top * scaleY);
    const sw = Math.min(w - sx, Math.ceil((box.right - box.left + 1) * scaleX));
    const sh = Math.min(h - sy, Math.ceil((box.bottom - box.top + 1) * scaleY));

    const insetX = Math.min(sx, w - sx - sw);
    const insetY = Math.min(sy, h - sy - sh);
    if (insetX < 2 && insetY < 2) return src;
    if (sw / w < MIN_KEEP_RATIO || sh / h < MIN_KEEP_RATIO) return src;

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const octx = out.getContext('2d');
    if (!octx) return src;
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob(resolve, 'image/jpeg', 0.92);
    });
    if (!blob) return src;
    return remember(src, URL.createObjectURL(blob));
  } finally {
    if (revoke) URL.revokeObjectURL(revoke);
  }
}

export function peekWhiteCroppedUrl(src: string): string | undefined {
  return cache.get(src);
}

export function cropWhiteImageBorders(src: string): Promise<string> {
  if (typeof src !== 'string' || !src) return Promise.resolve(src);
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(src);
  if (pending) return pending;

  const task = cropOnce(src)
    .catch(() => src)
    .then((out) => {
      if (!cache.has(src)) remember(src, out);
      inflight.delete(src);
      return cache.get(src) ?? out;
    });

  inflight.set(src, task);
  return task;
}

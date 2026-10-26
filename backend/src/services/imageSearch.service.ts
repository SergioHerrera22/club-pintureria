import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middleware/errorHandler';

/**
 * Búsqueda de imágenes de productos en internet sin claves de API:
 * usa el buscador de imágenes de DuckDuckGo.
 * Es frágil por naturaleza: si el buscador cambia su web, hay que ajustar
 * estas funciones. Si falla, el front muestra el aviso y queda el alta manual.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface ProductImageCandidate {
  /** Imagen en su resolución original (la que se descarga y guarda) */
  image: string;
  /** Miniatura para la grilla del selector */
  thumbnail: string;
  width: number;
  height: number;
  title: string;
  source: string;
}

/** Carpeta donde se guardan las fotos descargadas (servida en /uploads) */
export const UPLOADS_PRODUCTS_DIR = path.resolve(__dirname, '../../uploads/products');

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ar,es;q=0.9,en;q=0.7', ...headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new AppError(502, `El buscador respondió ${res.status}`);
  return res.text();
}

/**
 * Devuelve candidatas de imágenes para una consulta (nombre + marca + categoría
 * del producto). Filtra por tamaño mínimo y descarta archivos raros.
 */
export async function searchImageCandidates(query: string, limit = 8): Promise<ProductImageCandidate[]> {
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < 3) throw new AppError(400, 'Escribí el nombre del producto para buscar su foto');

  // 1. Obtener el token vqd de la página de resultados de DuckDuckGo
  const html = await fetchText(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`);
  const vqd =
    html.match(/vqd=["']([^"']+)["']/)?.[1] ?? html.match(/vqd=([\d-]+)/)?.[1];
  if (!vqd) throw new AppError(502, 'No se pudo iniciar la búsqueda de imágenes (token)');

  // 2. Pedir los resultados de imágenes (endpoint JSON interno)
  const api = `https://duckduckgo.com/i.js?l=es-ar&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
  const raw = await fetchText(api, { Referer: 'https://duckduckgo.com/' });
  const data = JSON.parse(raw) as {
    results?: Array<{
      title?: string;
      image?: string;
      thumbnail?: string;
      url?: string;
      width?: number;
      height?: number;
    }>;
  };

  const seen = new Set<string>();
  const out: ProductImageCandidate[] = [];
  for (const r of data.results ?? []) {
    const image = r.image;
    if (!image || !/^https?:\/\//i.test(image)) continue;
    // Tamaño adecuado: como mínimo ~400px por lado
    if ((r.width ?? 0) < 400 || (r.height ?? 0) < 400) continue;
    // Descartar formatos/URLs poco fiables (svg, avif de fuente rara, gifs animados)
    if (/\.(svg|gif)(\?|$)/i.test(image)) continue;
    if (out.some(c => c.image === image)) continue;
    const dup = `${image.split('//')[1]?.split('/')[0] ?? ''}/${image.split('.').pop()}`;
    if (seen.has(dup)) continue;
    seen.add(dup);
    out.push({
      image,
      thumbnail: r.thumbnail || image,
      width: r.width ?? 0,
      height: r.height ?? 0,
      title: (r.title || '').replace(/<[^>]*>/g, '').slice(0, 80),
      source: r.url?.slice(0, 120) ?? new URL(image).hostname,
    });
    if (out.length >= limit) break;
  }
  if (out.length === 0) {
    throw new AppError(404, 'No se encontraron imágenes con buen tamaño para esa búsqueda');
  }
  return out;
}

function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // jpeg
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // png
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return true; // webp
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // gif
  return false;
}

function extFrom(contentType: string, urlPath: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  const m = urlPath.match(/\.(jpe?g|png|webp|gif)(?:$|[?#])/i);
  if (m) return m[1].toLowerCase();
  return 'jpg';
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

/**
 * Descarga la imagen indicada y la guarda en uploads/products/.
 * Devuelve la ruta pública relativa para product.imageUrl.
 */
export async function downloadProductImage(code: string, imageUrl: string): Promise<string> {
  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new AppError(400, 'La URL de la imagen no es válida');
  }
  const origin = new URL(imageUrl).origin;
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: origin + '/',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new AppError(502, `La imagen no se pudo descargar (respuesta ${res.status})`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new AppError(502, 'La imagen descargada está vacía');
  if (buf.length > 5 * 1024 * 1024) throw new AppError(400, 'La imagen es demasiado grande (máximo 5 MB)');
  const ct = res.headers.get('content-type') ?? '';
  if (ct && !ct.startsWith('image/') && !looksLikeImage(buf)) {
    throw new AppError(400, 'El contenido de la URL no es una imagen');
  }

  await fs.promises.mkdir(UPLOADS_PRODUCTS_DIR, { recursive: true });
  const fileName = `${sanitizeName(code)}.${extFrom(ct, imageUrl)}`;
  const filePath = path.join(UPLOADS_PRODUCTS_DIR, fileName);
  await fs.promises.writeFile(filePath, buf);
  return `/uploads/products/${fileName}`;
}

/**
 * Resuelve qué valor guardar en product.imageUrl a partir de lo que envió el
 * admin (URL externa elegida del buscador, o null para quitar la foto).
 * Devuelve:
 *  - string  → la ruta local (/uploads/...) o la URL externa si falló la descarga
 *  - null    → el admin quitó la foto
 *  - undefined → no se indicó nada (no cambiar)
 * Si la descarga falla, guarda la URL externa tal cual para no bloquear el alta.
 */
export async function settleProductImageUrl(
  code: string,
  imageUrl?: string | null
): Promise<string | null | undefined> {
  if (imageUrl === null) return null; // el admin quitó la foto
  if (!imageUrl) return undefined; // no enviar nada (no cambia)
  if (imageUrl.startsWith('/uploads/')) return imageUrl; // ya es de nuestro servidor
  try {
    return await downloadProductImage(code, imageUrl);
  } catch (err) {
    // No bloquear el alta del producto: dejamos la URL externa pegada
    console.warn(`No se pudo descargar la imagen del producto ${code}:`, err);
    return imageUrl;
  }
}

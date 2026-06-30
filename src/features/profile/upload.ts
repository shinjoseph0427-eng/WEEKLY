// Avatar upload — ADAPTED from web src/lib/upload.js.
// The web version took a browser `File`. On RN the image picker returns an
// asset with a `uri` instead, so we: (1) keep the same type/size validation,
// (2) fetch the uri into an ArrayBuffer (the Supabase RN docs pattern), then
// upload to the `avatars` bucket. Public-URL/delete logic is unchanged.
import { supabase } from '../../lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPE_ERROR = 'Only JPG, PNG, WEBP, or GIF images are allowed.';
const IMAGE_SIZE_ERROR = 'Image must be under 5MB.';

// Maps the few content types our picker emits → canonical extension.
const TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function fileNameFromAsset(asset: ImagePickerAsset): string {
  return asset.fileName ?? asset.uri.split('/').pop() ?? '';
}

function validateImageAsset(asset: ImagePickerAsset): { ext: string; contentType: string } {
  const name = fileNameFromAsset(asset);
  const rawExt = name.split('.').pop()?.toLowerCase() ?? '';
  // expo-image-picker may omit mimeType; fall back to inferring from extension.
  const contentType =
    asset.mimeType ??
    (rawExt === 'jpg' || rawExt === 'jpeg'
      ? 'image/jpeg'
      : rawExt === 'png'
        ? 'image/png'
        : rawExt === 'webp'
          ? 'image/webp'
          : rawExt === 'gif'
            ? 'image/gif'
            : '');

  if (!ALLOWED_IMAGE_TYPES.has(contentType) || !ALLOWED_EXTENSIONS.has(rawExt)) {
    throw new Error(IMAGE_TYPE_ERROR);
  }

  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_SIZE) {
    throw new Error(IMAGE_SIZE_ERROR);
  }

  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  return { ext, contentType: contentType || TYPE_TO_EXT[ext] || 'image/jpeg' };
}

export async function uploadPhoto(userId: string, asset: ImagePickerAsset): Promise<string> {
  const { ext, contentType } = validateImageAsset(asset);

  // Convert the picked file:// (or content://) uri into an ArrayBuffer the
  // storage client can upload directly — RN has no `File` object.
  const arraybuffer = await fetch(asset.uri).then((res) => res.arrayBuffer());

  // Defensive size check when the picker didn't report fileSize.
  if (arraybuffer.byteLength > MAX_IMAGE_SIZE) {
    throw new Error(IMAGE_SIZE_ERROR);
  }

  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, arraybuffer, {
    contentType,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePhoto(url: string): Promise<void> {
  const marker = '/avatars/';
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  await supabase.storage.from('avatars').remove([path]);
}

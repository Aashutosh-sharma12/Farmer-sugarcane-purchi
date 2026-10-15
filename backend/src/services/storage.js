const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

// Cloudinary when CLOUDINARY_URL is set (production), otherwise the local uploads folder (dev only).
const useCloud = () => !!process.env.CLOUDINARY_URL;
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// One image per user per file content, so uploading twice reuses the same stored file.
const keyFor = (userId, hash) => `${userId}-${hash}`;
const publicIdFor = (userId, hash) => `purchi/${keyFor(userId, hash)}`;

async function saveImage(userId, hash, buffer, mimeType) {
  if (useCloud()) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { public_id: publicIdFor(userId, hash), overwrite: true, resource_type: 'image', invalidate: true },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(buffer);
    });
    return result.secure_url;
  }
  const fileName = keyFor(userId, hash) + EXT[mimeType];
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}

// Returns the stored image's URL/path, or null if this user never uploaded that image.
async function findImage(userId, hash) {
  if (useCloud()) {
    try {
      const res = await cloudinary.api.resource(publicIdFor(userId, hash));
      return res.secure_url;
    } catch (err) {
      if (err.http_code === 404 || err.error?.http_code === 404) return null;
      throw err;
    }
  }
  const prefix = keyFor(userId, hash) + '.';
  const file = fs.readdirSync(UPLOAD_DIR).find((f) => f.startsWith(prefix));
  return file ? `/uploads/${file}` : null;
}

async function deleteImage(imagePath, userId, hash) {
  try {
    if (/^https?:\/\//.test(imagePath)) {
      await cloudinary.uploader.destroy(publicIdFor(userId, hash), { invalidate: true });
    } else {
      fs.rmSync(path.join(UPLOAD_DIR, path.basename(imagePath)), { force: true });
    }
  } catch (err) {
    console.error('Could not delete image:', err.message);
  }
}

module.exports = { saveImage, findImage, deleteImage, useCloud };

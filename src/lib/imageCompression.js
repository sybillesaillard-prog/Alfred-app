// Compression d'image côté client pour le Pense-bête (31/08/2026).
//
// Choix volontairement différent du circuit des justificatifs de dépenses
// (qui passe par Google Drive, cf. googleDrive.js) : les photos du
// Pense-bête sont des références casuelles (affiche d'un film, capture
// d'un article...), pas des documents à conserver à l'identique. Éviter
// Drive ici évite (1) la friction OAuth pour une fonctionnalité mineure et
// (2) le fait que les `thumbnailLink` Drive expirent, ce qui aurait cassé
// l'affichage des vignettes après un moment. On stocke donc directement une
// image compressée en base64 dans le document Firestore, en visant large
// sous la limite de 1 Mio par document (~900px de côté max, qualité JPEG
// ~0.6-0.65 → typiquement quelques dizaines de Ko).
export async function compressImageToDataUrl(file, maxDim = 900, quality = 0.62) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Compression de l'image impossible");

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

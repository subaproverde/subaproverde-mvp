import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("public/mobile", { recursive: true });
await sharp("mobile/assets/icon.svg").resize(1024, 1024).png().toFile("mobile/assets/icon.png");
for (const size of [180, 192, 512]) {
  await sharp("mobile/assets/icon.svg").resize(size, size).png().toFile(`public/mobile/icon-${size}.png`);
}

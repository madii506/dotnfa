// Tiny PNG encoder (RGBA, no dependencies beyond node:zlib) for the pixel agents.
const zlib = require('node:zlib');
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function encode(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// the agent on paper, scaled up with hard pixels
function agentPng(AgentPx, traits, { size = 768, bg = [247, 246, 242], scale = 0 } = {}) {
  const img = AgentPx.draw(traits);
  const s = scale || Math.floor(size * 0.62 / img.h);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
  const ox = Math.floor((size - img.w * s) / 2), oy = Math.floor((size - img.h * s) / 2) + Math.floor(s * 2);
  // floor shadow
  const fy = oy + img.feet * s, fw = 24 * s, fx = Math.floor((size - fw) / 2);
  const sh = [bg[0] - 18, bg[1] - 18, bg[2] - 18];
  for (let y = fy - s; y < fy + s; y++) for (let x = fx; x < fx + fw; x++) { const i = (y * size + x) * 4; out[i] = sh[0]; out[i + 1] = sh[1]; out[i + 2] = sh[2]; }
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const j = (y * img.w + x) * 4; if (!img.data[j + 3]) continue;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
      const i = ((oy + y * s + yy) * size + ox + x * s + xx) * 4; out[i] = img.data[j]; out[i + 1] = img.data[j + 1]; out[i + 2] = img.data[j + 2];
    }
  }
  return encode(size, size, out);
}
module.exports = { encode, agentPng };

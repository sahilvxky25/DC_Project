/**
 * Minimal PCAP / PCAPNG reader for Ethernet captures.
 * Most capture interfaces omit Ethernet FCS bytes; returned frames say hasFcs:false.
 */
const u32 = (v, o, le) => v.getUint32(o, le);
const align4 = n => (n + 3) & ~3;

export async function parseCaptureFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4) throw new Error('The selected file is too small.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = Array.from(bytes.slice(0, 4), x => x.toString(16).padStart(2, '0')).join('');
  if (magic === '0a0d0d0a') return parsePcapNg(bytes, view);
  return parseClassicPcap(bytes, view, magic);
}

function parseClassicPcap(bytes, view, magic) {
  const formats = {
    d4c3b2a1: { le: true, ns: false },
    a1b2c3d4: { le: false, ns: false },
    4d3cb2a1: { le: true, ns: true },
    a1b23c4d: { le: false, ns: true },
  };
  const fmt = formats[magic];
  if (!fmt) throw new Error('Unsupported file. Select a PCAP or PCAPNG capture.');
  if (bytes.length < 24) throw new Error('Invalid PCAP global header.');
  const linkType = u32(view, 20, fmt.le) & 0xffff;
  if (linkType !== 1) throw new Error('This capture is not Ethernet (LINKTYPE_ETHERNET).');
  const frames = [];
  let offset = 24, firstTime = null;
  while (offset < bytes.length) {
    if (offset + 16 > bytes.length) throw new Error('Truncated PCAP packet header.');
    const seconds = u32(view, offset, fmt.le);
    const fraction = u32(view, offset + 4, fmt.le);
    const captured = u32(view, offset + 8, fmt.le);
    offset += 16;
    if (captured > bytes.length - offset) throw new Error('Truncated PCAP packet data.');
    const timestamp = seconds * 1000 + fraction / (fmt.ns ? 1e6 : 1e3);
    if (firstTime === null) firstTime = timestamp;
    frames.push({ t: timestamp - firstTime, bytes: Array.from(bytes.slice(offset, offset + captured)), hasFcs: false });
    offset += captured;
  }
  return { format: 'PCAP', frames, unsupported: 0 };
}

function parsePcapNg(bytes, view) {
  let offset = 0, little = true, interfaces = [], firstTime = null, unsupported = 0;
  const frames = [];
  while (offset + 12 <= bytes.length) {
    const isSection = bytes[offset] === 0x0a && bytes[offset + 1] === 0x0d && bytes[offset + 2] === 0x0d && bytes[offset + 3] === 0x0a;
    if (isSection) {
      if (offset + 12 > bytes.length) throw new Error('Truncated PCAPNG section header.');
      const bom = Array.from(bytes.slice(offset + 8, offset + 12)).map(x => x.toString(16).padStart(2, '0')).join('');
      if (bom === '4d3c2b1a') little = true;
      else if (bom === '1a2b3c4d') little = false;
      else throw new Error('Invalid PCAPNG byte-order marker.');
      interfaces = [];
    }
    const type = u32(view, offset, little);
    const length = u32(view, offset + 4, little);
    if (length < 12 || length % 4 || offset + length > bytes.length) throw new Error('Invalid or truncated PCAPNG block.');
    if (type === 1) {
      const linkType = view.getUint16(offset + 8, little);
      let resolution = 1e-6;
      for (let p = offset + 16; p < offset + length - 4;) {
        const code = view.getUint16(p, little), size = view.getUint16(p + 2, little);
        if (!code) break;
        if (code === 9 && size >= 1) {
          const value = bytes[p + 4];
          resolution = value & 0x80 ? Math.pow(2, -(value & 0x7f)) : Math.pow(10, -value);
        }
        p += 4 + align4(size);
      }
      interfaces.push({ linkType, resolution });
    } else if (type === 6) {
      const interfaceId = u32(view, offset + 8, little);
      const high = u32(view, offset + 12, little), low = u32(view, offset + 16, little);
      const captured = u32(view, offset + 20, little);
      const iface = interfaces[interfaceId];
      if (offset + 28 + captured > offset + length - 4) throw new Error('Invalid PCAPNG packet length.');
      if (iface && iface.linkType === 1) {
        const stamp = (high * 0x100000000 + low) * iface.resolution * 1000;
        if (firstTime === null) firstTime = stamp;
        frames.push({ t: stamp - firstTime, bytes: Array.from(bytes.slice(offset + 28, offset + 28 + captured)), hasFcs: false });
      } else unsupported++;
    } else if (type === 3) {
      const iface = interfaces[0];
      const captured = Math.min(u32(view, offset + 8, little), length - 16);
      if (iface && iface.linkType === 1) {
        frames.push({ t: frames.length, bytes: Array.from(bytes.slice(offset + 12, offset + 12 + captured)), hasFcs: false });
      } else unsupported++;
    }
    offset += length;
  }
  if (!frames.length) throw new Error('No Ethernet packets found in this PCAPNG file.');
  return { format: 'PCAPNG', frames, unsupported };
}

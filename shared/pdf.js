// FP10 Manager 2 by ED&G™ — shared PDF helpers (jsPDF)

// Loads the trust logo as a PNG data URL with its natural size, so it can be
// placed on PDFs without stretching. Returns null if there is no logo.
async function loadLogoForPdf(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 100;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

// Draws the logo inside a box, keeping its proportions. `align` is 'left',
// 'center' or 'right' within the box.
function drawLogo(pdf, logo, x, y, maxW, maxH, align = 'left') {
  if (!logo) return;
  const scale = Math.min(maxW / logo.w, maxH / logo.h);
  const w = logo.w * scale;
  const h = logo.h * scale;
  let dx = x;
  if (align === 'center') dx = x + (maxW - w) / 2;
  if (align === 'right') dx = x + maxW - w;
  pdf.addImage(logo.data, 'PNG', dx, y + (maxH - h) / 2, w, h);
}

function newLandscapePdf() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
}

function safeFilePart(s) {
  return String(s || '').replace(/[^a-z0-9-]/gi, '');
}

function dateForFile(d = new Date()) {
  return formatDateGB(d).replace(/\//g, '-');
}

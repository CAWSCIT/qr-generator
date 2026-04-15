import QRCode from 'qrcode'

const QR_OPTIONS = {
  errorCorrectionLevel: 'H',
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
}

const imageCache = new Map()

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      imageCache.delete(src)
      reject(new Error(`Failed to load logo: ${src}`))
    }
    img.src = src
  })
  imageCache.set(src, promise)
  return promise
}

export async function renderQrToCanvas(canvas, { url, logoSrc, size, logoRatio = 0.22, padding = 0.04 }) {
  if (!url) {
    const ctx = canvas.getContext('2d')
    canvas.width = size
    canvas.height = size
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    return
  }

  await QRCode.toCanvas(canvas, url, { ...QR_OPTIONS, width: size })

  if (!logoSrc) return

  const img = await loadImage(logoSrc)
  const ctx = canvas.getContext('2d')
  const logoSize = Math.round(size * logoRatio)
  const pad = Math.round(logoSize * padding)
  const boxSize = logoSize + pad * 2
  const cx = size / 2
  const cy = size / 2
  const radius = boxSize / 2

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.clip()

  const { dw, dh } = fitCover(img.width, img.height, boxSize, boxSize)
  const dx = cx - dw / 2
  const dy = cy - dh / 2
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

function fitCover(sw, sh, maxW, maxH) {
  const ratio = Math.max(maxW / sw, maxH / sh)
  return { dw: sw * ratio, dh: sh * ratio }
}

export async function downloadQrPng(filename, opts) {
  const canvas = document.createElement('canvas')
  await renderQrToCanvas(canvas, opts)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadLogoRegistry } from './logoRegistry'
import { renderQrToCanvas, downloadQrPng } from './qrRenderer'
import './App.css'

const PREVIEW_SIZE = 420
const DOWNLOAD_SIZE = 2048
const DEFAULT_URL = 'https://ca.org/'
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

function variantLabel(v) {
  return `${v.outline} outline · ${v.background} background · ${v.trademark}`
}

function validateUrl(value) {
  if (!value) return 'URL is required'
  if (!value.startsWith('https://')) return 'URL must start with https://'
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return 'Enter a valid URL'
  }
  if (!DOMAIN_RE.test(parsed.hostname)) return 'Enter a valid domain name'
  return null
}

export default function App() {
  const [registry, setRegistry] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [language, setLanguage] = useState('')
  const [variantFilename, setVariantFilename] = useState('')
  const [url, setUrl] = useState(DEFAULT_URL)
  const [downloading, setDownloading] = useState(false)
  const urlError = validateUrl(url)
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadLogoRegistry()
      .then((data) => {
        if (cancelled) return
        setRegistry(data)
        const defaultLang = data.languages.includes('English') ? 'English' : data.languages[0]
        setLanguage(defaultLang)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const variants = useMemo(() => {
    if (!registry || !language) return []
    return registry.variantsByLanguage[language] || []
  }, [registry, language])

  useEffect(() => {
    if (!variants.length) {
      setVariantFilename('')
      return
    }
    const preferred = variants.find(
      (v) => v.outline === 'Green' && v.background === 'Transparent' && v.trademark.startsWith('Inner')
    )
    setVariantFilename((current) => {
      if (current && variants.some((v) => v.filename === current)) return current
      return (preferred || variants[0]).filename
    })
  }, [variants])

  const selectedVariant = useMemo(
    () => variants.find((v) => v.filename === variantFilename) || null,
    [variants, variantFilename]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    renderQrToCanvas(canvas, {
      url,
      logoSrc: selectedVariant?.fullUrl,
      size: PREVIEW_SIZE,
    }).catch((err) => {
      if (!cancelled) console.error('QR render failed', err)
    })
    return () => {
      cancelled = true
    }
  }, [url, selectedVariant])

  const handleDownload = async () => {
    if (urlError || !selectedVariant || downloading) return
    setDownloading(true)
    try {
      await downloadQrPng('ca-qr-code.png', {
        url,
        logoSrc: selectedVariant.fullUrl,
        size: DOWNLOAD_SIZE,
      })
    } catch (err) {
      console.error(err)
      alert(`Download failed: ${err.message || err}`)
    } finally {
      setDownloading(false)
    }
  }

  const canDownload = Boolean(!urlError && selectedVariant && !downloading)

  return (
    <main className="app">
      <header className="app-header">
        <h1>C.A. QR Code Generator</h1>
      </header>

      {loadError && (
        <div className="notice error">
          Could not load logos from GitHub: {loadError}
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!registry && !loadError && <div className="notice">Loading logos…</div>}

      {registry && (
        <div className="layout">
          <section className="controls">
            <label className="field">
              <span className="field-label">URL or link</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                spellCheck={false}
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? 'url-error' : undefined}
              />
              {urlError && (
                <span id="url-error" className="field-error">{urlError}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {registry.languages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span className="field-label">Logo style ({variants.length})</span>
              <div className="variant-grid" role="radiogroup" aria-label="Logo style">
                {variants.map((v) => {
                  const selected = v.filename === variantFilename
                  return (
                    <button
                      key={v.filename}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`variant${selected ? ' selected' : ''}`}
                      onClick={() => setVariantFilename(v.filename)}
                      title={variantLabel(v)}
                    >
                      <img src={v.thumbUrl} alt={variantLabel(v)} loading="lazy" />
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="preview">
            <div className="canvas-frame">
              <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                aria-label="QR code preview"
              />
            </div>
            <button
              type="button"
              className="download"
              onClick={handleDownload}
              disabled={!canDownload}
            >
              {downloading ? 'Generating…' : `Download PNG (${DOWNLOAD_SIZE}×${DOWNLOAD_SIZE})`}
            </button>
            {selectedVariant && (
              <p className="caption">{variantLabel(selectedVariant)}</p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

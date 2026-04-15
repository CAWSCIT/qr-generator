const REPO = 'CAWSCIT/logo-finder'
const BRANCH = 'main'
const IMG_PREFIX = 'public/img/'
const THUMB_PREFIX = 'public/img/thumbnail/'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`
const CACHE_KEY = 'cawscit-logo-registry-v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const rawUrl = (path) => RAW_BASE + path.split('/').map(encodeURIComponent).join('/')

function parseFilename(name) {
  const base = name.replace(/\.png$/i, '')
  const parts = base.split(' - ')
  if (parts.length < 4) return null
  const [language, outlinePart, backgroundPart, trademarkPart] = parts
  const outline = outlinePart.replace(/\s+Outline$/, '')
  const background = backgroundPart.replace(/\s+Background$/, '')
  return { language, outline, background, trademark: trademarkPart, filename: name }
}

function buildRegistry(paths) {
  const imagePaths = new Set()
  const thumbnailPaths = new Set()
  for (const p of paths) {
    if (!p.toLowerCase().endsWith('.png')) continue
    if (p.startsWith(THUMB_PREFIX)) {
      thumbnailPaths.add(p.slice(THUMB_PREFIX.length))
    } else if (p.startsWith(IMG_PREFIX)) {
      imagePaths.add(p.slice(IMG_PREFIX.length))
    }
  }

  const byLanguage = new Map()
  for (const filename of imagePaths) {
    const parsed = parseFilename(filename)
    if (!parsed) continue
    if (parsed.outline === 'White' && parsed.background === 'Transparent') continue
    const hasThumb = thumbnailPaths.has(filename)
    const variant = {
      ...parsed,
      fullUrl: rawUrl(IMG_PREFIX + filename),
      thumbUrl: rawUrl((hasThumb ? THUMB_PREFIX : IMG_PREFIX) + filename),
    }
    if (!byLanguage.has(parsed.language)) byLanguage.set(parsed.language, [])
    byLanguage.get(parsed.language).push(variant)
  }

  const languages = [...byLanguage.keys()].sort((a, b) => a.localeCompare(b))
  const variantsByLanguage = {}
  for (const lang of languages) {
    variantsByLanguage[lang] = byLanguage.get(lang).sort((a, b) => a.filename.localeCompare(b.filename))
  }
  return { languages, variantsByLanguage }
}

async function fetchPaths() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = await res.json()
  return data.tree.filter((n) => n.type === 'blob').map((n) => n.path)
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { savedAt, paths } = JSON.parse(raw)
    if (!Array.isArray(paths) || Date.now() - savedAt > CACHE_TTL_MS) return null
    return paths
  } catch {
    return null
  }
}

function writeCache(paths) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), paths }))
  } catch {
    // localStorage full or disabled — ignore
  }
}

export async function loadLogoRegistry() {
  const cached = readCache()
  if (cached) return buildRegistry(cached)
  const paths = await fetchPaths()
  writeCache(paths)
  return buildRegistry(paths)
}

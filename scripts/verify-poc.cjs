const { app, BrowserWindow } = require('electron')
const { join } = require('node:path')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  await window.loadFile(join(__dirname, '../out/renderer/index.html'))
  await wait(1200)

  const initial = await window.webContents.executeJavaScript(`
    (() => {
      const preview = document.querySelector('.markdown-preview')
      const probe = document.createElement('span')
      probe.className = 'hljs-keyword'
      preview?.appendChild(probe)
      const hljsColor = preview ? getComputedStyle(probe).color : ''
      probe.remove()
      return {
      title: document.title,
      tabs: document.querySelectorAll('.tab').length,
      splitView: Boolean(document.querySelector('.split-view')),
      sourceEditor: Boolean(document.querySelector('.cm-editor')),
      previewPane: Boolean(document.querySelector('.markdown-preview')),
      preload: Boolean(window.mdwriter),
      noImagesSidebar: !document.body.innerText.includes('图片目录'),
      tooltipButtons: document.querySelectorAll('.icon-button[data-tooltip]').length,
      hljsColor
      }
    })()
  `)

  await window.webContents.executeJavaScript(`
    document.querySelectorAll('.mode-button')[0].click()
  `)
  await wait(500)

  const sourceMode = await window.webContents.executeJavaScript(`
    ({
      sourceEditor: Boolean(document.querySelector('.cm-editor')),
      splitView: Boolean(document.querySelector('.split-view'))
    })
  `)

  await window.webContents.executeJavaScript(`
    document.querySelectorAll('.mode-button')[2].click()
  `)
  await wait(1500)

  const previewMode = await window.webContents.executeJavaScript(`
    (async () => {
      const root = document.querySelector('[data-milkdown-root]')
      const prose = root?.querySelector('.ProseMirror')
      const blocks = prose ? Array.from(prose.children).map((node) => node.tagName.toLowerCase()) : []
      document.querySelector('.milkdown-code-block')?.scrollIntoView({ block: 'center' })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const copyStyle = getComputedStyle(document.querySelector('.milkdown-code-block .copy-button'))
      const languageStyle = getComputedStyle(document.querySelector('.milkdown-code-block .language-button'))
      const languageOpacityBefore = languageStyle.opacity
      const pickerStyle = getComputedStyle(document.querySelector('.milkdown-code-block .language-picker'))
      const hostStyle = getComputedStyle(document.querySelector('.milkdown-code-block .codemirror-host'))
      const block = document.querySelector('.milkdown-code-block')
      block?.classList.add('selected')
      await new Promise((resolve) => setTimeout(resolve, 250))
      const selectedStyle = block ? getComputedStyle(block) : null
      const languageOpacitySelected = block
        ? getComputedStyle(block.querySelector('.language-button')).opacity
        : null
      const cmTokenSpans = document.querySelectorAll('.milkdown-code-block .cm-content span[style]').length
      const cmSpans = document.querySelectorAll('.milkdown-code-block .cm-content span')
      const cmSampleClass = cmSpans[0]?.getAttribute('class') ?? ''
      const cmInlineSpans = Array.from(cmSpans).filter((span) => span.getAttribute('style')).length
      return {
        milkdown: Boolean(root),
        editable: Boolean(prose),
        codeLanguageButton: Boolean(document.querySelector('.milkdown-code-block .language-button')),
        copyBorderWidth: copyStyle.borderWidth,
        copyBackground: copyStyle.backgroundColor,
        languagePosition: languageStyle.position,
        languageRight: languageStyle.right,
        languageBottom: languageStyle.bottom,
        hostPaddingBottom: hostStyle.paddingBottom,
        languageOpacityBefore,
        languageOpacitySelected,
        languageBoxShadow: languageStyle.boxShadow,
        languageBorderBottomWidth: languageStyle.borderBottomWidth,
        languageBorderBottomStyle: languageStyle.borderBottomStyle,
        languageOutlineStyle: languageStyle.outlineStyle,
        pickerTop: pickerStyle.top,
        pickerBottom: pickerStyle.bottom,
        pickerZIndex: pickerStyle.zIndex,
        blockOverflow: getComputedStyle(block).overflow,
        selectedOutlineStyle: selectedStyle?.outlineStyle,
        cmTokenSpans,
        cmSpans: cmSpans.length,
        cmInlineSpans,
        cmSampleClass,
        noPreviewPanel: !Boolean(document.querySelector('.milkdown-code-block .preview-panel')),
        noPreviewLabel: !Boolean(document.querySelector('.milkdown-code-block .preview-label')),
        lastBlock: blocks.at(-1),
        secondToLastBlock: blocks.at(-2)
      }
    })()
  `)

  const imagePreview = await window.webContents.executeJavaScript(`
    (() => {
      const host = document.querySelector('.milkdown-host')
      if (!host) return { lightbox: false }
      const image = document.createElement('img')
      image.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="%23c96442"/></svg>'
      host.appendChild(image)
      image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            lightbox: Boolean(document.querySelector('.image-lightbox')),
            lightboxImage: Boolean(document.querySelector('.image-lightbox img'))
          })
        }, 200)
      })
    })()
  `)

  const tabWheel = await window.webContents.executeJavaScript(`
    (async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 100))
      const strip = document.querySelector('.tab-strip')
      const addButton = document.querySelector('.icon-button[data-tooltip="新建标签页"]')
      for (let i = 0; i < 16; i += 1) {
        addButton?.click()
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      const before = strip?.scrollLeft ?? 0
      strip?.dispatchEvent(new WheelEvent('wheel', { deltaY: 180, bubbles: true }))
      return new Promise((resolve) => {
        setTimeout(() => {
          const after = strip?.scrollLeft ?? 0
          resolve({
            addButtonFound: Boolean(addButton),
            tabCount: document.querySelectorAll('.tab').length,
            before,
            after,
            changed: after > before
          })
        }, 100)
      })
    })()
  `)

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })
  await pdfWindow.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent('<html><body><h1>MDWriter PDF Test</h1></body></html>')
  )
  const pdf = await pdfWindow.webContents.printToPDF({ printBackground: true })
  pdfWindow.destroy()

  const pdfExport = {
    bytes: pdf.byteLength,
    ok: pdf.byteLength > 1000
  }

  console.log(
    JSON.stringify({ initial, sourceMode, previewMode, imagePreview, tabWheel, pdfExport }, null, 2)
  )
  app.quit()
})

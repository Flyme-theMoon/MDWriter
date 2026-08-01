import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  src: string
  onClose: () => void
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onDoubleClick={onClose}
    >
      <img
        src={src}
        alt="图片预览"
        onDoubleClick={(event) => event.stopPropagation()}
      />
      <button
        className="lightbox-close"
        type="button"
        aria-label="关闭图片预览"
        onClick={onClose}
      >
        <X size={18} />
      </button>
    </div>
  )
}

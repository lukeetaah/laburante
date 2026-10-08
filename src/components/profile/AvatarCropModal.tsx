import { useState, useRef, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react'

interface AvatarCropModalProps {
  file: File | null
  isOpen: boolean
  onClose: () => void
  onSave: (croppedFile: File, previewUrl: string) => void
}

export default function AvatarCropModal({
  file,
  isOpen,
  onClose,
  onSave,
}: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!file) {
      setImageSrc(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }, [file])

  if (!isOpen || !imageSrc) return null

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    })
  }

  const handleTouchEnd = () => setIsDragging(false)

  const handleConfirmCrop = async () => {
    if (!imageRef.current) return

    const canvas = document.createElement('canvas')
    const size = 400 // resolución estándar óptima 400x400
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = imageRef.current
    const displaySize = 250 // tamaño del contenedor visual de recorte
    const scale = (img.naturalWidth / img.width) * (1 / zoom)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // Coordenadas relativas mapeadas de pantalla a canvas 400x400
    const factor = size / displaySize
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.translate(pan.x * factor, pan.y * factor)
    ctx.scale(zoom, zoom)
    ctx.drawImage(
      img,
      -(img.width * factor) / 2,
      -(img.height * factor) / 2,
      img.width * factor,
      img.height * factor
    )
    ctx.restore()

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const croppedFile = new File([blob], 'avatar.webp', { type: 'image/webp' })
        const previewUrl = URL.createObjectURL(blob)
        onSave(croppedFile, previewUrl)
        onClose()
      },
      'image/webp',
      0.85
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <h3 className="font-heading text-base font-bold text-[var(--color-laburante-text)]">
          Ajustar foto de perfil
        </h3>
        <p className="text-xs text-[var(--color-laburante-text-secondary)]">
          Arrastrá para centrar y usá el control para hacer zoom.
        </p>

        {/* Viewport de recorte circular 1:1 */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative mx-auto h-[250px] w-[250px] overflow-hidden rounded-full border-4 border-indigo-600 bg-slate-900 cursor-grab active:cursor-grabbing select-none"
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Ajuste de avatar"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            className="pointer-events-none absolute inset-0 m-auto select-none"
          />
        </div>

        {/* Controles de Zoom */}
        <div className="flex items-center justify-center gap-3 px-4 pt-2">
          <ZoomOut size={16} className="text-[var(--color-laburante-text-muted)]" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <ZoomIn size={16} className="text-[var(--color-laburante-text-muted)]" />
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            className="p-1 rounded text-gray-500 hover:text-gray-700"
            title="Restablecer"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            className="flex-1 py-2.5 px-4 rounded-xl btn-dark font-heading font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> Usar esta foto
          </button>
        </div>
      </div>
    </div>
  )
}

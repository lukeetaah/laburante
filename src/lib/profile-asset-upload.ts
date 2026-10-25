export type ProfileAssetKind = 'photo' | 'resume'

type UploadableProfileAsset = {
  name: string
  size: number
  type: string
}

type StorageUploadOptions = {
  upsert: boolean
  contentType: string
}

type StorageBucket = {
  upload: (path: string, file: UploadableProfileAsset, options: StorageUploadOptions) => Promise<{ error: any | null }>
  remove?: (paths: string[]) => Promise<{ error: any | null }>
  getPublicUrl?: (path: string) => { data?: { publicUrl?: string | null } } | null | undefined
}

type StorageClient = {
  from: (bucket: string) => StorageBucket
}

const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/pjpeg']
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const DOCUMENT_MIMES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-pdf',
  'application/octet-stream',
]
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'csv', 'txt']

function createProfileAssetError(
  message: string,
  stage: string,
  resource: string,
  code?: string,
  bucket?: string,
) {
  const error = new Error(message) as Error & Record<string, unknown>
  error._stage = stage
  error._resource = resource
  if (code) error._code = code
  if (bucket) error._bucket = bucket
  return error
}

function annotateStorageError(error: unknown, kind: ProfileAssetKind, bucket: string) {
  const resource = kind === 'photo' ? 'avatar' : 'resume'
  if (error && typeof error === 'object') {
    const annotated = error as Record<string, unknown>
    annotated._stage = 'storage_upload'
    annotated._resource = resource
    annotated._bucket = bucket
    return error
  }
  return createProfileAssetError(
    'No se pudo subir el archivo a Supabase Storage.',
    'storage_upload',
    resource,
    undefined,
    bucket,
  )
}

function fallbackContentType(kind: ProfileAssetKind, extension: string) {
  if (kind === 'photo') {
    if (extension === 'png') return 'image/png'
    if (extension === 'webp') return 'image/webp'
    return 'image/jpeg'
  }
  const byExtension: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    csv: 'text/csv',
    txt: 'text/plain',
  }
  return byExtension[extension] || 'application/pdf'
}

function getUploadDetails(file: unknown, kind: ProfileAssetKind, bucket: string) {
  const resource = kind === 'photo' ? 'avatar' : 'resume'
  if (!file || typeof file !== 'object') {
    throw createProfileAssetError('El archivo seleccionado ya no está disponible. Volvé a elegirlo.', 'validation', resource, 'missing_file', bucket)
  }

  const candidate = file as Partial<UploadableProfileAsset>
  if (typeof candidate.name !== 'string' || typeof candidate.size !== 'number' || typeof candidate.type !== 'string') {
    throw createProfileAssetError('El archivo seleccionado no es válido. Volvé a elegirlo.', 'validation', resource, 'invalid_file_object', bucket)
  }

  const extension = candidate.name.split('.').pop()?.toLowerCase() || ''
  const mime = candidate.type.toLowerCase()
  const allowedMimes = kind === 'photo' ? PHOTO_MIMES : DOCUMENT_MIMES
  const allowedExtensions = kind === 'photo' ? PHOTO_EXTENSIONS : DOCUMENT_EXTENSIONS
  const hasAllowedMime = allowedMimes.includes(mime)
  const hasAllowedExtension = allowedExtensions.includes(extension)
  const mimeIsGeneric = !mime || mime === 'application/octet-stream'
  const isValid = mimeIsGeneric ? hasAllowedExtension : hasAllowedMime && hasAllowedExtension

  if (!isValid) {
    throw createProfileAssetError(
      kind === 'photo' ? 'La foto debe ser formato JPG, PNG o WebP.' : 'El CV debe ser PDF, DOC, DOCX, CSV o TXT.',
      'validation',
      resource,
      'invalid_format',
      bucket,
    )
  }

  const maxSize = kind === 'photo' ? 5 * 1024 * 1024 : 10 * 1024 * 1024
  if (candidate.size > maxSize) {
    throw createProfileAssetError(
      kind === 'photo' ? 'La foto no puede superar los 5 MB.' : 'El archivo de CV no puede superar los 10 MB.',
      'validation',
      resource,
      'size_exceeded',
      bucket,
    )
  }

  return {
    file: candidate as UploadableProfileAsset,
    extension: extension || (kind === 'photo' ? 'jpg' : 'pdf'),
    contentType: !mime || ['application/octet-stream', 'application/x-pdf', 'image/jpg', 'image/pjpeg'].includes(mime)
      ? fallbackContentType(kind, extension)
      : mime,
  }
}

export function getOwnedProfileAssetPath({
  kind,
  userId,
  storedUrl,
}: {
  kind: ProfileAssetKind
  userId: string | undefined
  storedUrl: string | null | undefined
}) {
  if (!userId || typeof storedUrl !== 'string' || !storedUrl) return null

  let path = ''
  if (kind === 'resume' && storedUrl.startsWith('profile-documents:')) {
    path = storedUrl.slice('profile-documents:'.length).split('?')[0]
  } else if (kind === 'photo') {
    const marker = '/storage/v1/object/public/profile-photos/'
    const markerIndex = storedUrl.indexOf(marker)
    if (markerIndex >= 0) path = storedUrl.slice(markerIndex + marker.length).split('?')[0]
  }

  const expectedPrefix = `${userId}/${kind}-`
  if (!path.startsWith(expectedPrefix) || path.split('/').length !== 2 || path.includes('..')) return null
  return path
}

export async function removeOwnedProfileAsset({
  storage,
  kind,
  userId,
  storedUrl,
}: {
  storage: StorageClient
  kind: ProfileAssetKind
  userId: string | undefined
  storedUrl: string | null | undefined
}) {
  const path = getOwnedProfileAssetPath({ kind, userId, storedUrl })
  if (!path) return { removed: false, error: null }
  const bucket = kind === 'photo' ? 'profile-photos' : 'profile-documents'
  const bucketClient = storage.from(bucket)
  const remover = bucketClient.remove
  if (!remover) return { removed: false, error: new Error('Storage no admite eliminación de objetos.') }
  const { error } = await bucketClient.remove?.([path]) as { error: any | null }
  return { removed: !error, error }
}

export async function uploadProfileAsset({
  file,
  kind,
  userId,
  existingUrl,
  storage,
}: {
  file: unknown
  kind: ProfileAssetKind
  userId: string | undefined
  existingUrl: string
  storage: StorageClient
}) {
  if (!file || !userId) return existingUrl

  const bucket = kind === 'photo' ? 'profile-photos' : 'profile-documents'
  const { file: uploadFile, extension, contentType } = getUploadDetails(file, kind, bucket)
  const objectId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const path = `${userId}/${kind}-${objectId}.${extension}`

  try {
    const bucketClient = storage.from(bucket)
    const { error: uploadError } = await bucketClient.upload(path, uploadFile, {
      upsert: false,
      contentType,
    })
    if (uploadError) {
      const error = new Error(uploadError.message || 'No se pudo subir el archivo a Supabase Storage.') as Error & Record<string, unknown>
      error.name = uploadError.name || 'StorageApiError'
      error._code = uploadError.code || uploadError.error
      error.status = uploadError.status || uploadError.statusCode
      error.statusCode = uploadError.statusCode || uploadError.status
      throw annotateStorageError(error, kind, bucket)
    }

    if (kind === 'resume') return `profile-documents:${path}`
    const publicUrlResult = bucketClient.getPublicUrl?.(path)
    const publicUrl = publicUrlResult?.data?.publicUrl || null
    if (!publicUrl) {
      try {
        await bucketClient.remove?.([path])
      } catch (cleanupError) {
        console.warn('No se pudo limpiar una foto sin URL pública después de subirla:', cleanupError)
      }
      throw createProfileAssetError('Storage no devolvió la URL pública de la foto.', 'storage_upload', 'avatar', 'public_url_missing', bucket)
    }
    return publicUrl
  } catch (error) {
    throw annotateStorageError(error, kind, bucket)
  }
}

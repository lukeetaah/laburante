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
  const isValid = kind === 'photo'
    ? PHOTO_MIMES.includes(mime) || PHOTO_EXTENSIONS.includes(extension)
    : DOCUMENT_MIMES.includes(mime) || DOCUMENT_EXTENSIONS.includes(extension)

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
  const path = `${userId}/${kind}-${Date.now()}.${extension}`

  try {
    const bucketClient = storage.from(bucket)
    const { error: uploadError } = await bucketClient.upload(path, uploadFile, {
      upsert: true,
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
    return publicUrlResult?.data?.publicUrl || null
  } catch (error) {
    throw annotateStorageError(error, kind, bucket)
  }
}

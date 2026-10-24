import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadProfileAsset } from '../src/lib/profile-asset-upload.ts'

function file(name: string, type: string, size = 10) {
  return { name, type, size }
}

function storageWith(upload: (path: string, asset: unknown, options: unknown) => Promise<{ error: any | null }>) {
  const calls: Array<{ path: string; asset: unknown; options: unknown }> = []
  return {
    calls,
    storage: {
      from: () => ({
        upload: async (path: string, asset: unknown, options: unknown) => {
          calls.push({ path, asset, options })
          return upload(path, asset, options)
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  }
}

test('uploads a valid photo and returns its public URL', async () => {
  const fake = storageWith(async () => ({ error: null }))
  const result = await uploadProfileAsset({
    file: file('foto.png', 'image/png'),
    kind: 'photo',
    userId: 'user-1',
    existingUrl: '',
    storage: fake.storage,
  })

  assert.match(result || '', /^https:\/\/cdn\.test\/user-1\/photo-\d+\.png$/)
  assert.equal(fake.calls[0].options && (fake.calls[0].options as any).contentType, 'image/png')
})

test('keeps the existing URL when no new file was selected', async () => {
  const fake = storageWith(async () => ({ error: null }))
  const result = await uploadProfileAsset({
    file: null,
    kind: 'photo',
    userId: 'user-1',
    existingUrl: 'existing-photo-url',
    storage: fake.storage,
  })

  assert.equal(result, 'existing-photo-url')
  assert.equal(fake.calls.length, 0)
})

test('rejects invalid files before calling Storage', async () => {
  const fake = storageWith(async () => ({ error: null }))
  await assert.rejects(
    uploadProfileAsset({
      file: file('malware.exe', 'application/octet-stream'),
      kind: 'photo',
      userId: 'user-1',
      existingUrl: '',
      storage: fake.storage,
    }),
    (error: any) => error._stage === 'validation' && error._resource === 'avatar' && error._code === 'invalid_format',
  )
  assert.equal(fake.calls.length, 0)
})

test('turns a malformed file value into a validation error instead of a TypeError', async () => {
  const fake = storageWith(async () => ({ error: null }))
  await assert.rejects(
    uploadProfileAsset({
      file: {},
      kind: 'photo',
      userId: 'user-1',
      existingUrl: '',
      storage: fake.storage,
    }),
    (error: any) => error._stage === 'validation' && error._resource === 'avatar' && error._code === 'invalid_file_object',
  )
  assert.equal(fake.calls.length, 0)
})

test('normalizes an empty document MIME to the extension MIME accepted by Storage', async () => {
  const fake = storageWith(async () => ({ error: null }))
  const result = await uploadProfileAsset({
    file: file('cv.docx', ''),
    kind: 'resume',
    userId: 'user-1',
    existingUrl: '',
    storage: fake.storage,
  })

  assert.match(result, /^profile-documents:user-1\/resume-\d+\.docx$/)
  assert.equal((fake.calls[0].options as any).contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
})

test('preserves Storage errors with upload context', async () => {
  const fake = storageWith(async () => ({ error: { message: 'permission denied', name: 'StorageApiError', statusCode: 403, code: 'Unauthorized' } }))
  await assert.rejects(
    uploadProfileAsset({
      file: file('foto.webp', 'image/webp'),
      kind: 'photo',
      userId: 'user-1',
      existingUrl: '',
      storage: fake.storage,
    }),
    (error: any) => error.message === 'permission denied'
      && error.name === 'StorageApiError'
      && error._stage === 'storage_upload'
      && error._resource === 'avatar'
      && error._bucket === 'profile-photos'
      && error.statusCode === 403,
  )
})

test('annotates unexpected SDK TypeErrors instead of misclassifying them as generic assets', async () => {
  const fake = storageWith(async () => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(
    uploadProfileAsset({
      file: file('cv.pdf', 'application/pdf'),
      kind: 'resume',
      userId: 'user-1',
      existingUrl: '',
      storage: fake.storage,
    }),
    (error: any) => error.name === 'TypeError'
      && error.message === 'Failed to fetch'
      && error._stage === 'storage_upload'
      && error._resource === 'resume'
      && error._bucket === 'profile-documents',
  )
})

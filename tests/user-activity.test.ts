import assert from 'node:assert/strict'
import test from 'node:test'
import { recordUserActivity, getArgentinaWeekStartKey, type ActivityStorage } from '../src/lib/user-activity.ts'

function createMockStorage(initialData: Record<string, string> = {}): ActivityStorage & { data: Record<string, string> } {
  const store = { ...initialData }
  return {
    data: store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
  }
}

function createMockClient(shouldFail = false) {
  let callCount = 0
  let lastRpcName = ''
  return {
    get callCount() {
      return callCount
    },
    get lastRpcName() {
      return lastRpcName
    },
    rpc: async (name: string) => {
      callCount++
      lastRpcName = name
      if (shouldFail) {
        return { error: { message: 'Database connection failed', code: 'PGRST500' } }
      }
      return { data: true, error: null }
    },
  }
}

test('Escenario 1: Dos ingresos en la misma semana calendario', async () => {
  const storage = createMockStorage()
  const client = createMockClient()
  const date = new Date('2026-11-04T15:00:00Z') // Miércoles

  // Primer ingreso: debe registrar e invocar RPC
  const first = await recordUserActivity('user-1', { now: date, client, storage })
  assert.equal(first, true)
  assert.equal(client.callCount, 1)
  assert.equal(storage.data['laburante_activity_week:user-1'], '2026-11-02')

  // Segundo ingreso en la misma semana (Viernes 2026-11-06): no debe invocar RPC
  const secondDate = new Date('2026-11-06T18:00:00Z')
  const second = await recordUserActivity('user-1', { now: secondDate, client, storage })
  assert.equal(second, false, 'El segundo ingreso en la misma semana debe ser omitido en el cliente')
  assert.equal(client.callCount, 1, 'No debe generar llamadas RPC redundantes a Supabase')
})

test('Escenario 2: Ingreso jueves y regreso martes (diferente semana calendario)', async () => {
  const storage = createMockStorage()
  const client = createMockClient()

  // Jueves 5 de noviembre de 2026
  const thursday = new Date('2026-11-05T18:00:00Z')
  const res1 = await recordUserActivity('user-2', { now: thursday, client, storage })
  assert.equal(res1, true)
  assert.equal(client.callCount, 1)
  assert.equal(storage.data['laburante_activity_week:user-2'], '2026-11-02')

  // Martes 10 de noviembre de 2026 (siguiente semana calendario)
  const tuesday = new Date('2026-11-10T14:00:00Z')
  const res2 = await recordUserActivity('user-2', { now: tuesday, client, storage })
  assert.equal(res2, true, 'El regreso el martes de la nueva semana debe registrarse')
  assert.equal(client.callCount, 2, 'Debe invocar el RPC para la nueva semana')
  assert.equal(storage.data['laburante_activity_week:user-2'], '2026-11-09')
})

test('Escenario 3: Ingreso domingo y regreso lunes', async () => {
  const storage = createMockStorage()
  const client = createMockClient()

  // Domingo 8 de noviembre 2026 a las 20:00 UTC (17:00 en Argentina)
  const sunday = new Date('2026-11-08T20:00:00Z')
  const resSunday = await recordUserActivity('user-3', { now: sunday, client, storage })
  assert.equal(resSunday, true)
  assert.equal(storage.data['laburante_activity_week:user-3'], '2026-11-02')

  // Lunes 9 de noviembre 2026 a las 14:00 UTC (11:00 en Argentina)
  const monday = new Date('2026-11-09T14:00:00Z')
  const resMonday = await recordUserActivity('user-3', { now: monday, client, storage })
  assert.equal(resMonday, true, 'El lunes pertenece a la semana siguiente y debe registrarse')
  assert.equal(client.callCount, 2)
  assert.equal(storage.data['laburante_activity_week:user-3'], '2026-11-09')
})

test('Escenario 4: Frontera horaria respetando zona horaria de Argentina (America/Argentina/Buenos_Aires)', async () => {
  // Domingo 23:59:00 hora argentina (UTC-3) -> 2026-11-09T02:59:00Z
  const sundayNight = new Date('2026-11-09T02:59:00Z')
  assert.equal(getArgentinaWeekStartKey(sundayNight), '2026-11-02')

  // Lunes 00:01:00 hora argentina (UTC-3) -> 2026-11-09T03:01:00Z
  const mondayMorning = new Date('2026-11-09T03:01:00Z')
  assert.equal(getArgentinaWeekStartKey(mondayMorning), '2026-11-09')

  const storage = createMockStorage()
  const client = createMockClient()

  await recordUserActivity('user-4', { now: sundayNight, client, storage })
  assert.equal(storage.data['laburante_activity_week:user-4'], '2026-11-02')

  await recordUserActivity('user-4', { now: mondayMorning, client, storage })
  assert.equal(storage.data['laburante_activity_week:user-4'], '2026-11-09')
  assert.equal(client.callCount, 2)
})

test('Escenario 5: Error de Supabase (no marca localStorage y permite reintentos)', async () => {
  const storage = createMockStorage()
  const failingClient = createMockClient(true) // Simula error de Supabase
  const date = new Date('2026-11-04T12:00:00Z')

  // Primer intento con error de Supabase
  const firstAttempt = await recordUserActivity('user-5', { now: date, client: failingClient, storage })
  assert.equal(firstAttempt, false)
  assert.equal(storage.data['laburante_activity_week:user-5'], undefined, 'No debe escribir en storage si el RPC falló')

  // Segundo intento cuando se recupera Supabase
  const healthyClient = createMockClient(false)
  const secondAttempt = await recordUserActivity('user-5', { now: date, client: healthyClient, storage })
  assert.equal(secondAttempt, true, 'Debe reintentar y tener éxito')
  assert.equal(storage.data['laburante_activity_week:user-5'], '2026-11-02')
})

test('Escenario 6: Dos dispositivos diferentes para el mismo usuario', async () => {
  const device1Storage = createMockStorage()
  const device2Storage = createMockStorage()
  const client = createMockClient()
  const date = new Date('2026-11-04T12:00:00Z')

  // Dispositivo 1 ingresa
  const d1 = await recordUserActivity('user-6', { now: date, client, storage: device1Storage })
  assert.equal(d1, true)
  assert.equal(device1Storage.data['laburante_activity_week:user-6'], '2026-11-02')

  // Dispositivo 2 ingresa (no tiene la clave en su storage local)
  // La base de datos es idempotente gracias a ON CONFLICT DO NOTHING
  const d2 = await recordUserActivity('user-6', { now: date, client, storage: device2Storage })
  assert.equal(d2, true)
  assert.equal(device2Storage.data['laburante_activity_week:user-6'], '2026-11-02')
  assert.equal(client.callCount, 2)

  // Siguiente visita en dispositivo 1: omitida
  const d1Repeat = await recordUserActivity('user-6', { now: date, client, storage: device1Storage })
  assert.equal(d1Repeat, false)

  // Siguiente visita en dispositivo 2: omitida
  const d2Repeat = await recordUserActivity('user-6', { now: date, client, storage: device2Storage })
  assert.equal(d2Repeat, false)
  assert.equal(client.callCount, 2)
})

test('Escenario 7: Usuario sin sesión autenticada (userId vacío)', async () => {
  const storage = createMockStorage()
  const client = createMockClient()

  const resEmpty = await recordUserActivity('', { client, storage })
  assert.equal(resEmpty, false)
  assert.equal(client.callCount, 0, 'No debe llamar al RPC si no hay sesión')

  const resNull = await recordUserActivity(null as any, { client, storage })
  assert.equal(resNull, false)
  assert.equal(client.callCount, 0)
})

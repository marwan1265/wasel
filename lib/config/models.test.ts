import { getModels } from './models'
import defaultModels from './default-models.json'
import type { Model } from '@/lib/types/models'

const remoteModel: Model = {
  id: 'remote-test-model',
  name: 'Remote Test Model',
  provider: 'Remote Provider',
  providerId: 'remote-provider',
  enabled: true,
  toolCallType: 'native'
}

describe('getModels', () => {
  const originalBaseUrl = process.env.BASE_URL
  let fetchMock: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    process.env.BASE_URL = 'https://wasel.test'
    fetchMock = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL
    } else {
      process.env.BASE_URL = originalBaseUrl
    }
    fetchMock.mockRestore()
  })

  it('loads models from the configured models.json URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ models: [remoteModel] })
    } as Response)

    await expect(getModels()).resolves.toEqual([remoteModel])

    const [requestedUrl, options] = fetchMock.mock.calls[0]
    expect(requestedUrl.toString()).toBe(
      'https://wasel.test/config/models.json'
    )
    expect(options).toEqual({
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })
  })

  it('falls back to default models when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'))

    await expect(getModels()).resolves.toEqual(defaultModels.models)
  })

  it('falls back to default models when models.json is malformed JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '{ invalid json'
    } as Response)

    await expect(getModels()).resolves.toEqual(defaultModels.models)
  })

  it('falls back to default models when the endpoint returns HTML', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '<!doctype html><html><body>Not JSON</body></html>'
    } as Response)

    await expect(getModels()).resolves.toEqual(defaultModels.models)
  })
})

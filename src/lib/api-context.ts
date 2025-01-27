import { Storage } from 'src/state/cache'
import { randomKey } from './randomKey'

type ApiRequestOptions = {
  idempotency?: true
}

export class ApiContext {
  constructor(
    public readonly instanceHostName: string,
    public readonly token: string
  ) {
    if (instanceHostName.length === 0) {
      throw new Error('failed to create ApiContext: instance host name missing')
    }
    if (token.length === 0) {
      throw new Error('failed to create ApiContext: token missing')
    }
  }

  // TODO: private
  async request(
    path: string,
    fetch_options: RequestInit,
    options?: ApiRequestOptions
  ): Promise<Response> {
    const url = `https://${this.instanceHostName}/${path}`
    fetch_options.headers = {
      ...fetch_options.headers,
      Accept: 'application/json',
      Authorization: `Bearer ${this.token}`,
      ...(options?.idempotency ? { 'Idempotency-Key': randomKey(40) } : {}),
    }

    let response = await fetch(url, fetch_options)
    if (!response.ok) {
      let errorResponse
      try {
        errorResponse = await response.json()
        console.log('API Request Failed', { errorResponse })
        if (
          typeof errorResponse.error === 'undefined' ||
          errorResponse.error.length === 0
        ) {
          throw new Error('request failed, but error field is empty')
        }
      } catch (error) {
        console.error('API Request Failed - Failed to decode error:', error)
        throw new Error('API Request Failed without error message')
      }
      throw new Error(`API Request Failed: ${errorResponse}`)
    }

    return response
  }

  /** request in json data and gets back json data */
  async jsonRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    params = {}
  ) {
    return await (
      await this.request(path, {
        method,
        body: JSON.stringify(params),
        headers: { 'Content-Type': 'application/json' },
      })
    ).json()
  }

  async get(url: string) {
    const response = await this.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return await response.json()
  }
}

export function ContextFromStorage(): ApiContext {
  const instance = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!instance || !token) {
    throw new Error('api token or instance undefined')
  }
  return new ApiContext(instance, token)
}
// For debugging
;(global as any).API = ContextFromStorage()

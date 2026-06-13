import type { BaseDoc } from '@shared/types'
import { getDb, syncedCollections } from '../db/datastore'

/**
 * Bi-directional sync between the local embedded store and MongoDB Atlas.
 * Strategy: last-write-wins by `updatedAt`, soft-delete tombstones propagate,
 * and only changed documents are transferred (those not yet `syncedAt`, or
 * changed since). The `mongodb` driver is imported lazily so the app runs fine
 * with no cloud configured.
 */

export interface CloudResult {
  ok: boolean
  message: string
  pushed?: number
  pulled?: number
}

async function getClient(uri: string) {
  const { MongoClient } = await import('mongodb')
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000
  })
  await client.connect()
  return client
}

export async function testConnection(uri: string, dbName: string): Promise<CloudResult> {
  if (!uri) return { ok: false, message: 'No connection string provided' }
  try {
    const client = await getClient(uri)
    await client.db(dbName || 'nexus_pos').command({ ping: 1 })
    await client.close()
    return { ok: true, message: 'Connected to MongoDB Atlas successfully' }
  } catch (err) {
    return { ok: false, message: `Connection failed: ${(err as Error).message}` }
  }
}

export async function syncWithCloud(uri: string, dbName: string): Promise<CloudResult> {
  if (!uri) return { ok: false, message: 'Cloud sync is not configured' }
  let client: Awaited<ReturnType<typeof getClient>> | null = null
  try {
    client = await getClient(uri)
    const remoteDb = client.db(dbName || 'nexus_pos')
    const localDb = getDb()
    let pushed = 0
    let pulled = 0

    for (const { name, col } of syncedCollections(localDb)) {
      const remote = remoteDb.collection<BaseDoc>(name)
      await remote.createIndex({ _id: 1 })

      // PUSH: every local doc changed since its last sync.
      const localDocs = await col.findRaw({})
      const toPush = localDocs.filter((d) => !d.syncedAt || (d.updatedAt ?? 0) > d.syncedAt)
      const syncTs = Date.now()
      for (const doc of toPush) {
        const remoteDoc = await remote.findOne({ _id: doc._id } as never)
        if (!remoteDoc || (remoteDoc.updatedAt ?? 0) <= (doc.updatedAt ?? 0)) {
          await remote.replaceOne({ _id: doc._id } as never, { ...doc, syncedAt: syncTs }, { upsert: true })
          await col.store.updateAsync({ _id: doc._id }, { $set: { syncedAt: syncTs } }, {})
          pushed++
        }
      }

      // PULL: remote docs newer than local (or missing locally).
      const remoteDocs = await remote.find({}).toArray()
      for (const rdoc of remoteDocs) {
        const local = await col.store.findOneAsync({ _id: rdoc._id })
        if (!local || (local.updatedAt ?? 0) < (rdoc.updatedAt ?? 0)) {
          await col.store.updateAsync(
            { _id: rdoc._id },
            { ...rdoc, syncedAt: Date.now() },
            { upsert: true }
          )
          pulled++
        }
      }
    }

    await client.close()
    return { ok: true, message: `Synced — pushed ${pushed}, pulled ${pulled}`, pushed, pulled }
  } catch (err) {
    if (client) await client.close().catch(() => undefined)
    return { ok: false, message: `Sync failed: ${(err as Error).message}` }
  }
}

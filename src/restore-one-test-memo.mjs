import { createHash, createPublicKey, verify, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const equalHash = (a, b) => /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b)
  && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

export function verifyPrivateMemoSnapshot({ snapshot, trustedPublicKey, incidentAt, expectedOwner, requestedId }) {
  if (!snapshot || !snapshot.payload || !snapshot.signature || !trustedPublicKey)
    throw new Error('SNAPSHOT_UNAVAILABLE');
  const { payload, signature } = snapshot;
  if (!UUID.test(requestedId ?? '') || !UUID.test(expectedOwner ?? '')
      || payload.id !== requestedId || payload.owner_id !== expectedOwner
      || typeof payload.title !== 'string' || !payload.title.trim()
      || typeof payload.content !== 'string' || !payload.content.trim()
      || !/^[a-f0-9]{64}$/.test(payload.contentSha256 ?? '')
      || typeof payload.version !== 'string' || !payload.version.trim()
      || !Number.isFinite(Date.parse(payload.verifiedAt))
      || !Number.isFinite(Date.parse(incidentAt))
      || Date.parse(payload.verifiedAt) >= Date.parse(incidentAt))
    throw new Error('SNAPSHOT_INVALID');
  let valid = false;
  try {
    const key = createPublicKey(trustedPublicKey);
    valid = key.asymmetricKeyType === 'ed25519'
      && typeof signature === 'string'
      && /^[A-Za-z0-9+/]+={0,2}$/.test(signature)
      && verify(null, Buffer.from(JSON.stringify(payload)), key, Buffer.from(signature, 'base64'));
  } catch { valid = false; }
  if (!valid || !equalHash(sha256(payload.content), payload.contentSha256))
    throw new Error('SNAPSHOT_VERIFICATION_FAILED');
  return payload;
}

export async function previewOneTestMemo({ db, ...args }) {
  const payload = verifyPrivateMemoSnapshot(args);
  const { data: row, error } = await db.from('learning_memos')
    .select('id,owner_id,title,content').eq('id', args.requestedId)
    .eq('owner_id', args.expectedOwner).maybeSingle();
  if (error) throw new Error('MEMO_READ_FAILED');
  if (!row || row.id !== payload.id || row.owner_id !== payload.owner_id)
    throw new Error('MEMO_NOT_FOUND_OR_NOT_OWNED');
  const changeFields = ['title', 'content'].filter(k => row[k] !== payload[k]);
  const confirmationToken = sha256(JSON.stringify({
    version: payload.version, id: payload.id, owner_id: payload.owner_id,
    snapshotHash: payload.contentSha256, beforeTitle: row.title,
    beforeHash: sha256(row.content), changeFields,
  }));
  return { mode: 'preview_only', version: payload.version,
    verifiedAt: payload.verifiedAt, id: payload.id, owner_id: payload.owner_id,
    changeFields, confirmationToken };
}

// A single existing B-owned row is updated. No INSERT/UPSERT or audit operations.
export async function restoreOneTestMemo({ db, snapshot, trustedPublicKey, incidentAt,
  expectedOwner, requestedId, confirmationToken }) {
  const args = { snapshot, trustedPublicKey, incidentAt, expectedOwner, requestedId };
  const preview = await previewOneTestMemo({ db, ...args });
  if (typeof confirmationToken !== 'string'
      || !equalHash(confirmationToken, preview.confirmationToken))
    throw new Error('RESTORE_CONFIRMATION_REQUIRED');
  const payload = verifyPrivateMemoSnapshot(args);
  const { data: before, error: readError } = await db.from('learning_memos')
    .select('id,owner_id,title,content').eq('id', requestedId)
    .eq('owner_id', expectedOwner).maybeSingle();
  if (readError) throw new Error('MEMO_READ_FAILED');
  if (!before || before.id !== requestedId || before.owner_id !== expectedOwner)
    throw new Error('MEMO_NOT_FOUND_OR_NOT_OWNED');
  // Optimistic concurrency: do not overwrite another concurrent change.
  const { data: after, error: updateError } = await db.from('learning_memos')
    .update({ title: payload.title, content: payload.content })
    .eq('id', requestedId).eq('owner_id', expectedOwner)
    .eq('title', before.title).eq('content', before.content)
    .select('id,owner_id,title,content').maybeSingle();
  if (updateError) throw new Error('MEMO_UPDATE_FAILED');
  if (!after || after.id !== payload.id || after.owner_id !== payload.owner_id
      || after.title !== payload.title || !equalHash(sha256(after.content), payload.contentSha256))
    throw new Error('RESTORE_VERIFICATION_FAILED');
  return { id: after.id, owner_id: after.owner_id, contentSha256: sha256(after.content),
    version: payload.version, restored: true };
}

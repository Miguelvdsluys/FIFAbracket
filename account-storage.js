import { DEFAULT_CATALOG_ID } from './catalog.js?v=19da33637738c554';

const chunkSize = 700_000;
const maxChunks = 8;

async function pack(state) {
  const body = JSON.stringify({
    versions: state.versions.filter(version => version.id !== DEFAULT_CATALOG_ID),
    tournaments: state.tournaments,
  });
  const compressed = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, offset + chunkSize));
  }
  if (chunks.length > maxChunks) throw Error('Deze toernooien zijn samen te groot voor je accountopslag.');
  return chunks;
}

async function unpack(chunks) {
  const stream = new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

function readMetadata(snapshot) {
  if (!snapshot.exists()) return { revision: 0, count: 0 };
  const { revision, count } = snapshot.data();
  if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isInteger(count) || count < 1 || count > maxChunks) {
    throw Error('De accountopslag bevat ongeldige gegevens.');
  }
  return { revision, count };
}

export function createAccountStorage(sdk, auth, uid) {
  const database = sdk.getFirestore(auth.app);
  const metadata = sdk.doc(database, 'trackerAccounts', uid, 'state', 'current');
  const chunkRef = index => sdk.doc(metadata.parent, 'chunk-' + index);
  function checkAccount() {
    if (auth.currentUser?.uid !== uid) throw Error('Je account is gewijzigd. Open de app opnieuw.');
  }

  return {
    async load() {
      checkAccount();
      const { revision, chunks } = await sdk.runTransaction(database, async transaction => {
        checkAccount();
        const { revision, count } = readMetadata(await transaction.get(metadata));
        const chunks = await Promise.all(Array.from({ length: count }, async (_, index) => {
          const snapshot = await transaction.get(chunkRef(index));
          if (!snapshot.exists()) throw Error('De accountopslag is onvolledig.');
          return snapshot.data().data.toUint8Array();
        }));
        return { revision, chunks };
      });
      const body = chunks.length ? await unpack(chunks) : { versions: [], tournaments: [] };
      checkAccount();
      return { ...body, revision };
    },
    async save(state) {
      checkAccount();
      const expectedRevision = state.revision;
      const chunks = await pack(state);
      return sdk.runTransaction(database, async transaction => {
        checkAccount();
        const { revision, count } = readMetadata(await transaction.get(metadata));
        if (revision !== expectedRevision) {
          throw Error('Toernooien zijn op een ander apparaat gewijzigd. De bijgewerkte gegevens worden geladen.');
        }
        checkAccount();
        for (const [index, chunk] of chunks.entries()) {
          transaction.set(chunkRef(index), { data: sdk.Bytes.fromUint8Array(chunk) });
        }
        for (let index = chunks.length; index < count; index++) transaction.delete(chunkRef(index));
        transaction.set(metadata, { revision: revision + 1, count: chunks.length });
        return revision + 1;
      });
    },
  };
}

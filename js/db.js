// Camada de dados local-first sobre IndexedDB (sem dependências externas).
// Stores: eventos, pessoas, tarefas. Todos os dados ficam no dispositivo.

const NOME_DB = 'producao-cultural';
const VERSAO = 1;

let _db = null;

function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_DB, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('eventos')) {
        db.createObjectStore('eventos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pessoas')) {
        db.createObjectStore('pessoas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tarefas')) {
        const st = db.createObjectStore('tarefas', { keyPath: 'id' });
        st.createIndex('eventoId', 'eventoId');
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const resultado = fn(t.objectStore(store));
    t.oncomplete = () => resolve(resultado.result !== undefined ? resultado.result : resultado);
    t.onerror = () => reject(t.error);
  }));
}

export function novoId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

export const db = {
  async listar(store) {
    const db_ = await abrir();
    return new Promise((resolve, reject) => {
      const req = db_.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async obter(store, id) {
    const db_ = await abrir();
    return new Promise((resolve, reject) => {
      const req = db_.transaction(store).objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async salvar(store, obj) {
    if (!obj.id) obj.id = novoId();
    await tx(store, 'readwrite', (st) => st.put(obj));
    return obj;
  },

  async remover(store, id) {
    await tx(store, 'readwrite', (st) => st.delete(id));
  },

  async tarefasDoEvento(eventoId) {
    const db_ = await abrir();
    return new Promise((resolve, reject) => {
      const req = db_.transaction('tarefas').objectStore('tarefas').index('eventoId').getAll(eventoId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async removerTarefasDoEvento(eventoId) {
    const tarefas = await this.tarefasDoEvento(eventoId);
    for (const t of tarefas) await this.remover('tarefas', t.id);
  },
};

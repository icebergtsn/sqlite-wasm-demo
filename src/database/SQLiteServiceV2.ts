const worker = new Worker(new URL("src/database/SQLiteWorker.ts", import.meta.url));

const requestMap = new Map();

type MessageType = 'init' | 'close' | 'execute' | 'query';

export function sendMessageToWorker(type: MessageType, payload = {}, id = `${Date.now()}-${Math.random()}`) {
  return new Promise((resolve, reject) => {
    requestMap.set(id, {resolve, reject});
    worker.postMessage({id, type, payload});
  });
}

worker.onmessage = (event) => {
  const {id, result, error} = event.data;

  if (requestMap.has(id)) {
    const {resolve, reject} = requestMap.get(id);
    requestMap.delete(id);

    if (error) {
      reject(new Error(error));
    } else {
      resolve(result);
    }
  }
};

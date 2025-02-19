const worker = new Worker(new URL("src/database/SQLiteWorker.ts", import.meta.url));

const requestMap = new Map();
const subscriptionCallbacks = new Map();

type MessageType = 'init' | 'close' | 'execute' | 'query' | 'subscribe' | 'unsubscribe';

export function sendMessageToWorker(type: MessageType, payload = {}, id = `${Date.now()}-${Math.random()}`) {
  return new Promise((resolve, reject) => {
    requestMap.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

class Subscription {
  private subscriptionId: string;
  private subscribeCallback: (result: any) => void;

  constructor(subscriptionId: string) {
    this.subscriptionId = subscriptionId;
    this.subscribeCallback = () => {};
  }

  subscribe(callback: (result: any) => void) {
    this.subscribeCallback = callback;
    subscriptionCallbacks.set(this.subscriptionId, callback);
    return this;
  }

  unsubscribe() {
    subscriptionCallbacks.delete(this.subscriptionId);
    worker.postMessage({ id: this.subscriptionId, type: "unsubscribe" });
  }
}

export function liveQuery(subscriptionId : string,sql: string, params: any[], tables: string[]): Subscription {
  const subscription = new Subscription(subscriptionId);
  worker.postMessage({
    id: subscriptionId,
    type: "subscribe",
    payload: { sql, params, tables },
  });

  return subscription;
}

worker.onmessage = (event) => {
  const { id, type, result, error } = event.data;

  if (type === "subscribe") {
    const callback = subscriptionCallbacks.get(id);
    if (callback) {
      callback(result);
    }
  } else if (requestMap.has(id)) {
    const { resolve, reject } = requestMap.get(id);
    requestMap.delete(id);

    if (error) {
      reject(new Error(error));
    } else {
      resolve(result);
    }
  }
};

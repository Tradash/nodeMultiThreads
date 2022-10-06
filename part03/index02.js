const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrtime = process.hrtime.bigint;

const THREAD_FREE = -1;

const EventEmitter = require("events");
class WorkersPool extends EventEmitter {
  #queue;
  #workersPoll;

  constructor({ queue, workersPool }) {
    super();

    this.#queue = queue;
    this.#workersPoll = [...workersPool];
  }

  #shareMessage(worker, { id, data }) {
    worker.data.set(data, 0);
    worker.lock[0] = id;

    Atomics.notify(worker.lock, 0, 1);

    const lock = Atomics.waitAsync(worker.lock, 0, id);
    if (lock.value === "not-equal") {
      this.#onMessage(worker);
    } else {
      lock.value.then((result) => {
        this.#onMessage(worker);
      });
    }
  }

  #onMessage(worker) {
    const msg = this.#queue.shift();
    if (msg) {
      this.#shareMessage(worker, msg);
    } else {
      this.#workersPoll.push(worker);
    }
  }

  postMessage(msg) {
    const worker = this.#workersPoll.pop();
    if (worker) {
      this.#shareMessage(worker, msg);
    } else {
      this.#queue.push(msg);
    }
  }
}

if (isMainThread) {
  const taskSize = 1 << 16;

  const tsg = hrtime();
  const messages = Array(1<<12)
    .fill()
    .map((_) => randomBytes(taskSize));
  console.log("generated:", (Number(hrtime() - tsg) / 1e6) | 0, "ms");

  const hashes = messages.map(() => undefined);
  let remain;

  const workers = [];
  let active = 1;
  let tsh;

  process
    .on("test:start", () => {
      hashes.fill();
      remain = hashes.length;

      workers.forEach(
        (worker) => (worker.eLU = worker.performance.eventLoopUtilization())
      );
      tsh = hrtime();

      const Pow2Buffer = require("../Pow2Buffer");
      const pool = new WorkersPool({
        queue: new Pow2Buffer(8, 16),
        workersPool: workers.slice(0, active),
      });

      messages.forEach((data, id) => {
        pool.postMessage({ id, data });
      });
    })
    .on("test:end", () => {
      const duration = hrtime() - tsh;
      workers.forEach(
        (worker) =>
          (worker.util = worker.performance.eventLoopUtilization(
            worker.eLU
          ).utilization)
      );
      const avg =
        workers.slice(0, active).reduce((sum, worker) => sum + worker.util, 0) /
        active;

      console.log(
        "hashed " + active.toString().padStart(2) + ":",
        ((Number(duration) / 1e6) | 0).toString().padStart(4),
        "ms | " + ((avg * 100) | 0) + " | ",
        workers
          .map((worker) => ((worker.util * 100) | 0).toString().padStart(2))
          .join(" ")
      );
      if (active < n) {
        active++;
        process.emit("test:start");
      } else {
        process.exit();
      }
    });

  const n = 16;
  Promise.all(
    Array(n)
      .fill()
      .map(
        (_, idx) =>
          new Promise((resolve, reject) => {
            const sharedBufferData = new SharedArrayBuffer(taskSize);
            const sharedBufferLock = new SharedArrayBuffer(
              Int32Array.BYTES_PER_ELEMENT
            );
            const lock = new Int32Array(sharedBufferLock);
            lock.fill(THREAD_FREE);

            const worker = new Worker(__filename, {
              workerData: {
                data: sharedBufferData,
                lock: sharedBufferLock,
              },
            });
            worker.data = new Uint8Array(sharedBufferData);
            worker.lock = lock;
            worker
              .on("online", () => resolve(worker))
              .on("message", ({ id, hash }) => {
                hashes[id] = hash;
                if (!--remain) {
                  process.emit("test:end");
                }
              });
          })
      )
  ).then((result) => {
    workers.push(...result);
    process.emit("test:start");
  });
} else {
  const { data, lock } = workerData;
  const sharedData = new Uint8Array(data);
  const sharedLock = new Int32Array(lock);

  do {
    const lock = Atomics.wait(sharedLock, 0, THREAD_FREE);
    parentPort.postMessage({
      id: sharedLock[0],
      hash: createHash("sha256").update(sharedData).digest("hex"),
    });
    sharedLock[0] = THREAD_FREE;
    Atomics.notify(sharedLock, 0, 1);
  } while (true);
}

/*
generated: 153 ms
hashed  1:  574 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  2:  290 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  3:  194 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  4:  149 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  5:  135 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  6:  109 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  7:   98 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  8:  113 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed  9:  108 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 10:  109 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 11:  110 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 12:  109 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 13:  106 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 14:  111 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 15:  111 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
hashed 16:  106 ms | 100 |  100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
 */

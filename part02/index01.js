// Пул потоков и очередь задач

const { Worker, isMainThread, parentPort } = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrTime = process.hrtime.bigint;

const EventEmitter = require("node:events");
class WorkersPool extends EventEmitter {
  #queue;
  #workersPool;
  #currentWorker;
  #onMessageHandler = Symbol("handler");

  constructor({ queue, workersPool }) {
    super();
    this.#queue = queue;
    this.#workersPool = [...workersPool];

    this.#workersPool.forEach((worker) => {
      worker[this.#onMessageHandler] = this.#onMessage.bind(this, worker);
      worker.prependListener("message", worker[this.#onMessageHandler]);
    });
  }

  destructor() {
    this.#workersPool.forEach((worker) => {
      worker.off("message", worker[this.#onMessageHandler]);
      delete worker[this.#onMessageHandler];
    });
  }

  #onMessage(worker) {
    const msg = this.#queue.shift();
    if (msg) {
      worker.postMessage(msg);
    } else {
      this.#workersPool.push(worker);
    }
  }

  postMessage(msg) {
    const worker = this.#workersPool.pop();
    if (worker) {
      worker.postMessage(msg);
    } else {
      this.#queue.push(msg);
    }
  }
}

if (isMainThread) {
  const tsg = hrTime();
  const messages = Array(1 << 12)
    .fill()
    .map((_) => randomBytes(1 << 16));
  console.log("generated:", (Number(hrTime() - tsg) / 1e6) | 0, "ms");

  const hashes = messages.map(() => undefined);
  let remain;

  const workers = [];
  let active = 1;
  let tsh;

  let pool;

  process
    .on("test:start", () => {
      hashes.fill();
      remain = hashes.length;

      const Pow2Buffer = require("../Pow2Buffer");
      pool = new WorkersPool({
        queue: new Pow2Buffer(8, 16),
        workersPool: workers.slice(0, active),
      });

      workers.forEach(
        (worker) => (worker.eLU = worker.performance.eventLoopUtilization())
      );
      tsh = hrTime();
      messages.forEach((data, id) => {
        pool.postMessage({ id, data });
      });
    })
    .on("test:end", () => {
      const duration = hrTime() - tsh;
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
        "hashed " + active.toString().padStart(2) + "+",
        ((Number(duration) / 1e6) | 0).toString().padStart(4),
        "ms | " + ((avg * 100) | 0) + " | ",
        workers
          .map((worker) => ((worker.util * 100) | 0).toString().padStart(2))
          .join(" ")
      );

      if (active < n) {
        pool.destructor()
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
      .map((_) => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(__filename);
          worker
            .on("online", () => resolve(worker))
            .on("message", ({ id, hash }) => {
              hashes[id] = hash;
              if (!--remain) {
                process.emit("test:end");
              }
            });
        });
      })
  ).then((result) => {
    workers.push(...result);
    process.emit("test:start");
  });
} else {
  parentPort.on("message", ({ id, data }) => {
    parentPort.postMessage({
      id,
      hash: createHash("sha256").update(data).digest("hex"),
    });
  });
}

/*
generated: 145 ms
hashed  1+  588 ms | 99 |  99  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  2+  323 ms | 99 |  98 99  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  3+  221 ms | 99 |  98 99 99  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  4+  172 ms | 98 |  96 97 99 99  0  0  0  0  0  0  0  0  0  0  0  0
hashed  5+  154 ms | 98 |  97 97 98 99 99  0  0  0  0  0  0  0  0  0  0  0
hashed  6+  131 ms | 97 |  95 96 97 99 97 98  0  0  0  0  0  0  0  0  0  0
hashed  7+  108 ms | 97 |  96 92 97 99 99 98 95  0  0  0  0  0  0  0  0  0
hashed  8+  117 ms | 94 |  96 92 93 99 89 99 91 90  0  0  0  0  0  0  0  0
hashed  9+  114 ms | 86 |  75 75 99 92 91 99 88 77 77  0  0  0  0  0  0  0
hashed 10+  112 ms | 81 |  84 81 85 80 86 91 76 78 79 71  0  0  0  0  0  0
hashed 11+  128 ms | 80 |  81 84 73 81 88 71 80 68 83 72 97  0  0  0  0  0
hashed 12+  113 ms | 73 |  66 80 79 89 79 61 58 76 83 78 74 58  0  0  0  0
hashed 13+  108 ms | 81 |  82 90 70 81 66 82 81 83 90 78 96 65 89  0  0  0
hashed 14+  111 ms | 82 |  91 60 77 57 72 90 92 95 99 96 90 73 76 79  0  0
hashed 15+  116 ms | 65 |  55 51 65 87 60 63 51 41 79 53 71 93 59 61 91  0
hashed 16+  101 ms | 62 |  64 62 45 70 49 76 62 63 55 42 50 54 89 73 69 71

generated: 147 ms
hashed  1+  724 ms | 82 |  82  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  2+  357 ms | 83 |  80 86  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  3+  256 ms | 79 |  78 79 80  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  4+  187 ms | 78 |  76 78 79 80  0  0  0  0  0  0  0  0  0  0  0  0
hashed  5+  156 ms | 75 |  74 74 76 77 73  0  0  0  0  0  0  0  0  0  0  0
hashed  6+  137 ms | 76 |  76 75 77 78 76 75  0  0  0  0  0  0  0  0  0  0
hashed  7+  117 ms | 82 |  82 79 80 84 81 82 81  0  0  0  0  0  0  0  0  0
hashed  8+  100 ms | 83 |  82 82 83 84 84 83 83 83  0  0  0  0  0  0  0  0
hashed  9+   99 ms | 76 |  74 76 76 77 77 76 75 75 77  0  0  0  0  0  0  0
hashed 10+  110 ms | 66 |  59 63 65 70 69 67 63 63 69 66  0  0  0  0  0  0
hashed 11+  104 ms | 63 |  62 57 60 67 64 65 67 69 65 58 59  0  0  0  0  0
hashed 12+  109 ms | 60 |  59 50 55 66 60 65 62 70 67 64 58 48  0  0  0  0
hashed 13+  101 ms | 54 |  62 47 48 50 47 65 63 69 61 48 47 48 49  0  0  0
hashed 14+   98 ms | 50 |  56 52 47 55 47 49 50 50 53 47 50 46 46 56  0  0
hashed 15+   98 ms | 48 |  47 48 43 44 45 49 47 58 54 47 44 45 44 54 49  0
hashed 16+  104 ms | 45 |  42 39 37 54 41 42 43 51 49 59 39 39 53 43 50 43


 */

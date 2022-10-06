// Каналы данных и сигналов

const { Worker, isMainThread, parentPort, MessageChannel, receiveMessageOnPort } = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrTime = process.hrtime.bigint;

const EventEmitter = require("node:events");
class WorkersPool extends EventEmitter {
  #queue;
  #workers;
  #portPoll;

  constructor({ queue, workersPool }) {
    super();
    this.#queue = queue;
    this.#workers = workersPool.length;
    this.#portPoll = [];

    workersPool.forEach((worker) => {
      const channelS = new MessageChannel();
      const channelD = new MessageChannel();
      worker.postMessage(
        {
          portS: channelS.port1,
          portD: channelD.port1,
        },
        [channelS.port1, channelD.port1]
      );
      this.#portPoll.push(channelD.port2)
      channelS.port2.on('message', this.#onMessage.bind(this, channelD.port2))
    });
  }

  #onMessage(port) {
    const part = Math.ceil(this.#queue.length / this.#workers)
      if (part) {
          for (let i=0; i<part; i++) {
              port.postMessage(this.#queue.shift())
          }
      } else {
          this.#portPoll.push(port)
      }
  }

  postMessage(msg) {
    const port = this.#portPoll.pop()
      if (port) {
          port.postMessage(msg)
      } else {
          this.#queue.push(msg)
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
  const processMessage = ({id, data})=> parentPort.postMessage({id, hash: createHash("sha256").update(data).digest("hex")})
  parentPort.on("message", ({ portS, portD }) => {
      portD.on('message', message => {
          processMessage((message))
          do {
              const recv = receiveMessageOnPort(portD)
              if (!recv) { break }
              processMessage((recv.message))
          } while (true)
          portS.postMessage(undefined)
      })
  });
}

/*
generated: 146 ms
hashed  1+  585 ms | 99 |  99  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  2+  326 ms | 92 |  99 85  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  3+  236 ms | 88 |  86 99 79  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  4+  188 ms | 86 |  80 88 99 74  0  0  0  0  0  0  0  0  0  0  0  0
hashed  5+  160 ms | 84 |  75 89 83 99 73  0  0  0  0  0  0  0  0  0  0  0
hashed  6+  148 ms | 82 |  74 83 78 90 98 69  0  0  0  0  0  0  0  0  0  0
hashed  7+  125 ms | 78 |  67 76 81 88 70 97 64  0  0  0  0  0  0  0  0  0
hashed  8+  130 ms | 79 |  77 76 82 85 91 91 67 59  0  0  0  0  0  0  0  0
hashed  9+  109 ms | 74 |  61 66 71 87 72 89 94 76 48  0  0  0  0  0  0  0
hashed 10+  176 ms | 44 |  38 43 26 45 33 32 49 52 52 70  0  0  0  0  0  0
hashed 11+  128 ms | 65 |  58 61 47 72 69 68 75 74 70 77 45  0  0  0  0  0
hashed 12+  128 ms | 69 |  68 58 67 55 82 77 64 80 87 86 59 49  0  0  0  0
hashed 13+  114 ms | 57 |  32 33 46 64 62 43 66 67 71 62 76 89 27  0  0  0
hashed 14+  110 ms | 54 |  27 29 36 54 64 40 64 71 45 64 72 88 74 33  0  0
hashed 15+  113 ms | 61 |  32 66 44 44 68 59 62 70 77 71 70 75 69 80 25  0
hashed 16+  111 ms | 62 |  36 57 53 53 72 48 42 78 52 81 47 90 78 87 85 31
 */

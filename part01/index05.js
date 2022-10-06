// Несколько потоков, Round-robin, аналитика  worker.eventLoopUtilization

const { Worker, isMainThread, parentPort } = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrTime = process.hrtime.bigint;

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

  process
    .on("test:start", () => {
      hashes.fill();
      remain = hashes.length;

      workers.forEach(
        (worker) => (worker.eLU = worker.performance.eventLoopUtilization())
      );
      tsh = hrTime();
      messages.forEach((data, id) => {
        const worker = workers[id % active];
        worker.postMessage({ id, data });
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
 */

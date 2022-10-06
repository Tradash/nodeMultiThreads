const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrtime = process.hrtime.bigint;

const tasksCount = 1 << 12;
const taskSize = 1 << 16;

if (isMainThread) {
  const tsg = hrtime();
  const messages = Array(tasksCount)
    .fill()
    .map((_) => randomBytes(taskSize));
  console.log("generated:", (Number(hrtime() - tsg) / 1e6) | 0, "ms");

  const hashes = messages.map(() => undefined);
  let remain;

  const workers = [];
  let active = 1;
  let tsh;

  const sharedBufferData = new SharedArrayBuffer(tasksCount * taskSize);
  const sharedBufferNext = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT);
  const sharedData = new Uint8Array(sharedBufferData);
  const sharedNext = new Uint32Array(sharedBufferNext);

  process
    .on("test:start", () => {
      hashes.fill();
      remain = hashes.length;
      sharedData.fill(0);
      Atomics.store(sharedNext, 0, 0);

      workers.forEach(
        (worker) => (worker.eLU = worker.performance.eventLoopUtilization())
      );
      tsh = hrtime();

      messages.forEach((data, id) => {
        sharedData.set(data, id * taskSize);
      });
      workers
        .slice(0, active)
        .forEach((worker) => worker.postMessage(undefined));
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
        (_) =>
          new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
              workerData: {
                data: sharedBufferData,
                next: sharedBufferNext,
              },
            });
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
  const { data, next } = workerData;
  const sharedData = new Uint8Array(data);
  const sharedNext = new Uint32Array(next);

  const processMessage = ({ id, data }) =>
    parentPort.postMessage({
      id,
      hash: createHash("sha256").update(data).digest("hex"),
    });
  parentPort.on("message", () => {
    do {
      const id = Atomics.add(sharedNext, 0, 1);
      if (id >= tasksCount) {
        break;
      }
      processMessage({
        id,
        data: sharedData.subarray(id * taskSize, (id + 1) * taskSize),
      });
    } while (true);
  });
}

/*
generated: 141 ms
hashed  1:  536 ms | 95 |  95  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  2:  287 ms | 90 |  90 90  0  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  3:  194 ms | 86 |  86 86 86  0  0  0  0  0  0  0  0  0  0  0  0  0
hashed  4:  149 ms | 82 |  82 82 82 82  0  0  0  0  0  0  0  0  0  0  0  0
hashed  5:  128 ms | 79 |  79 79 79 79 79  0  0  0  0  0  0  0  0  0  0  0
hashed  6:  119 ms | 77 |  77 77 77 77 77 77  0  0  0  0  0  0  0  0  0  0
hashed  7:  108 ms | 76 |  76 76 76 76 76 76 76  0  0  0  0  0  0  0  0  0
hashed  8:  101 ms | 74 |  74 75 74 74 74 74 75 74  0  0  0  0  0  0  0  0
hashed  9:   99 ms | 70 |  74 74 74 74 74 74 74 74 42  0  0  0  0  0  0  0
hashed 10:   99 ms | 68 |  74 75 74 74 74 74 74 74 43 43  0  0  0  0  0  0
hashed 11:  100 ms | 65 |  74 74 74 74 74 74 74 74 43 42 42  0  0  0  0  0
hashed 12:  102 ms | 63 |  74 74 74 74 74 74 74 43 42 41 41 74  0  0  0  0
hashed 13:  100 ms | 62 |  75 75 75 75 75 75 75 43 43 42 38 75 43  0  0  0
hashed 14:   98 ms | 60 |  74 74 74 74 74 74 74 42 42 42 40 74 42 42  0  0
hashed 15:  100 ms | 58 |  73 73 73 73 73 73 73 41 42 41 41 73 41 42 41  0
hashed 16:  100 ms | 55 |  73 73 75 73 73 73 73 41 41 39 40 73 41 41 42  9

 */

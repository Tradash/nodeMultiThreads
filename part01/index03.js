// Слишком много потоков

const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("node:worker_threads");

const { randomBytes, createHash } = require("node:crypto");

const hrTime = process.hrtime.bigint;

if (isMainThread) {
  const tsg = hrTime();
  const messages = Array(1 << 12)
    .fill()
    .map((_) => randomBytes(1 << 16));
  console.log("generated:", (Number(hrTime() - tsg) / 1e6) | 0, "ms");

  const hashes = messages.map(() => undefined);
  let remain = hashes.length;

  const tsh = hrTime();
  messages.forEach((data, id) => {
    const worker = new Worker(__filename, {
      workerData: { id, data },
    });
    worker.on("message", ({ id, hash }) => {
      hashes[id] = hash;
      if (!--remain) {
        console.log("hashed:  ", (Number(hrTime() - tsh) / 1e6) | 0, "ms");
      }
    });
  });
} else {
  const { id, data } = workerData;
  parentPort.postMessage({
    id,
    hash: createHash("sha256").update(data).digest(),
  });
  process.exit();
}

/*
Result:         1       2       3       mid
generated:      151,    142,    143,    145
hashed:         21401,  21270,  23763,  22144 +4438%
 */

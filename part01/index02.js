// Вспомогательный поток

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
  let remain = hashes.length;

  let tsh;

  const worker = new Worker(__filename);
  worker
    .on("online", () => {
      tsh = hrTime();
      messages.forEach((data, id) => worker.postMessage({ id, data }));
    })
    .on("message", ({ id, hash }) => {
      hashes[id] = hash;
      if (!--remain) {
        console.log("hashed:    ", (Number(hrTime() - tsh) / 1e6) | 0, "ms");
        worker.unref();
      }
    });
} else {
  parentPort.on("message", ({ id, data }) => {
    parentPort.postMessage({
      id,
      hash: createHash("sha256").update(data).digest(),
    });
  });
}

/*
Result:         1       2       3       mid
generated:      141,    140,    144,    142
hashed:         622,    612,    612,    615 +26%
 */

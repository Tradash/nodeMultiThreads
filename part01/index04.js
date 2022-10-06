// Несколько потоков, Round-robin

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
  const n = require("node:os").cpus().length;
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
                console.log(
                  "hashed:  ",
                  (Number(hrTime() - tsh) / 1e6) | 0,
                  "ms"
                );
                process.exit();
              }
            });
        });
      })
  ).then((workers) => {
    const ln = workers.length;
    tsh = hrTime();
    messages.forEach((data, id) => {
      const worker = workers[id % ln];
      worker.postMessage({ id, data });
    });
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
Result:         1     2       3     mid
generated:      143,  142,  141,    142
hashed:         144,  122,  136,    134 -73%
 */

// Без многопоточности

const { randomBytes, createHash } = require("node:crypto");

const hrTime = process.hrtime.bigint;

const tsg = hrTime();

const messages = Array(1 << 12)
  .fill()
  .map((_) => randomBytes(1 << 16));

console.log("generated:", (Number(hrTime() - tsg) / 1e6) | 0, "ms");

const tsh = hrTime();

const hashes = messages.map((data) =>
  createHash("sha256").update(data).digest("hex")
);
console.log("hashed:  ", (Number(hrTime() - tsh) / 1e6) | 0, "ms");

/*
Result:     1       2       3       mid
generated:  143,    144,    141,    142
hashed:     486,    496,    483,    488
 */

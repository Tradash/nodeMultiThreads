const {
    Worker
    , isMainThread
    , parentPort
    , workerData
    , MessageChannel
} = require('node:worker_threads');

const {
    randomBytes
    , createHash
} = require('node:crypto');

const hrtime = process.hrtime.bigint;

if (isMainThread) {
    const tsg = hrtime();
    const messages = Array(1 << 12).fill().map(_ => randomBytes(1 << 16));
    console.log('generated:', Number(hrtime() - tsg)/1e6 | 0, 'ms');

    const hashes = messages.map(() => undefined);
    let remain;

    const workers = [];
    let active = 1;
    let tsh;

    process
        .on('test:start', () => {
            hashes.fill();
            remain = hashes.length;

            // формируем поток-координатор и служебный канал общения с ним
            const channel = new MessageChannel();
            const coordinator = new Worker(__filename,
                {
                    workerData   : {
                        signalPort : channel.port1
                        , workerType : 'coordinator'
                    }
                    , transferList : [channel.port1]
                }
            );
            coordinator.signalPort = channel.port2;
            coordinator.signalPort.setMaxListeners(0);

            coordinator.on('online', () => {
                Promise.all(
                    workers.slice(0, active)
                        // для каждого активного потока формируем канал обмена информацией
                        // один порт вспомогательному потоку, второй - координатору
                        .flatMap(worker => {
                            const {port1, port2} = new MessageChannel();
                            return [{worker, port : port1}, {worker : coordinator, port : port2}];
                        })
                        .map(adressee => new Promise((resolve, reject) => {
                            const {worker, port} = adressee;
                            worker.signalPort.once('message', () => resolve(adressee));
                            worker.signalPort.postMessage(port, [port]);
                        }))
                )
                    .then(ports => {
                        // запуск теста
                        workers.forEach(worker => worker.eLU = worker.performance.eventLoopUtilization());
                        tsh = hrtime();
                        messages.forEach((data, id) => {
                            coordinator.postMessage({id, data}); // отправляем все координатору
                        });
                    });
            });
        })
        .on('test:end', () => {
            const duration = hrtime() - tsh;
            workers.forEach(worker => worker.util = worker.performance.eventLoopUtilization(worker.eLU).utilization);
            const avg = workers.slice(0, active).reduce((sum, worker) => sum + worker.util, 0)/active;

            console.log(
                'hashed ' + active.toString().padStart(2) + ':'
                , (Number(duration)/1e6 | 0).toString().padStart(4)
                , 'ms | ' + (avg * 100 | 0) + ' | '
                , workers.map(
                    worker => (worker.util * 100 | 0).toString().padStart(2)
                ).join(' ')
            );

            if (active < n) {
                active++;
                process.emit('test:start');
            }
            else {
                process.exit();
            }
        });

    const n = 16;
    Promise.all(
        Array(n).fill().map(_ => new Promise((resolve, reject) => {
            // формируем вспомогательный поток и служебный канал общения с ним
            const channel = new MessageChannel();
            const worker = new Worker(__filename,
                {
                    workerData   : {
                        signalPort : channel.port1
                        , workerType : 'worker'
                    }
                    , transferList : [channel.port1]
                }
            );
            worker.signalPort = channel.port2;
            worker
                .on('online', () => resolve(worker))
                .on('message', ({id, hash}) => {
                    hashes[id] = hash;
                    if (!--remain) {
                        process.emit('test:end');
                    }
                });
        }))
    )
        .then(result => {
            workers.push(...result);
            process.emit('test:start');
        });
}
else {
    const {signalPort, workerType} = workerData;
    switch (workerType) {
        case 'worker':
            const processMessage = ({id, data}) => parentPort.postMessage({id, hash : createHash('sha256').update(data).digest('hex')});
            // по сигнальному каналу передаем порт координатора
            signalPort.on('message', port => {
                port.on('message', message => {
                    processMessage(message);
                    port.postMessage(undefined); // отправляем 'ready for task'
                });
                signalPort.postMessage(undefined); // отправляем 'online'
            });
            break;
        case 'coordinator':
            const pool = [];
            const queue = new (require('../Pow2Buffer'))(8, 16);
            // по сигнальному каналу передаем порт worker'а
            signalPort.on('message', port => {
                // добавляем в пул и подписываемся на обработку сигнала готовности от worker'а
                pool.push(port);
                port.on('message', () => {
                    const message = queue.shift();
                    if (message) {
                        port.postMessage(message);
                    }
                    else {
                        pool.push(port);
                    }
                });
                signalPort.postMessage(undefined);
            });
            // обработка входящего сообщения координатору
            parentPort.on('message', message => {
                const port = pool.pop();
                if (port) {
                    port.postMessage(message);
                }
                else {
                    queue.push(message);
                }
            });
            break;
    }
}

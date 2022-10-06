// test.js
const queue = [];

const usec = hrtb => {
    const us = process.hrtime(hrtb);
    return us[0] * 1e9 + us[1];
};

const totalLength = 1 << 20; // обрабатываем миллион элементов

console.log('scale | push, us | shift, us');
for (let n = 0; n <= 16; n++) { // перебираем размеры массивов по 2^N
    const ln = 1 << n;
    let tw = 0;
    let tr = 0;
    for (let iter = 0; iter < (totalLength >> n); iter++) { // прогоняем 1M/2^N итераций
        // записываем 2^N случайных целых чисел в массив
        {
            const hrt = process.hrtime();
            for (let i = 0; i < ln; i++) {
                queue.push(Math.random() * 1e9 | 0);
            }
            tw += usec(hrt);
        }
        // считываем все числа
        {
            const hrt = process.hrtime();
            while (queue.length) {
                queue.shift();
            }
            tr += usec(hrt);
        }
    }
    // выводим усредненные данные на один элемент
    console.log(`${n.toString().padStart(5)} | ${(tw/totalLength | 0).toString().padStart(8)} | ${(tr/totalLength | 0).toString().padStart(9)}`);
}

class Pow2Buffer {
    #buffer;
    #tail = 0;
    #head = 0;
    #mask;
    #MIN_BUFFER;
    #MAX_BUFFER;

    constructor(powMin, powMax) {
        this.#MAX_BUFFER = 1 << powMax;
        this.#MIN_BUFFER = 1 << powMin;
        this.#buffer = Array(this.#MIN_BUFFER).fill();
        this.#mask = this.#buffer.length -1;

        Object.defineProperties(this, 0, {
            get: () => this.#head<this.#tail ? this.#buffer[this.#head] : undefined
        })
    }

    get length() {
        return this.#tail - this.#head
    }

    #tryExpand() {
        const ln = this.#buffer.length;
        if (ln < this.#MAX_BUFFER) {
            this.#buffer.splice(this.#head, 0, ...Array(ln).fill());
            this.#mask = this.#buffer.length -1;
            this.#tail += ln;
            this.#head += ln
            return true
        }
    }

    push(val) {
        if ((this.#tail & this.#mask) === this.#head && this.#tail > this.#head) {
            if (!this.#tryExpand()) {
                this.#head++;
                this.#head &=this.#mask
                this.#tail = this.#head+this.#mask
            }
        }
        this.#buffer[this.#tail++ & this.#mask] = val;
        return this.length;
    }

    #tryCollapse() {
        const ln=this.#buffer.length
        if (ln>this.#MIN_BUFFER && (this.#tail << 1) < ln) {
            this.#buffer.length = Math.max(1 << Math.ceil(Math.log2(this.#tail+1)), this.#MIN_BUFFER);
            this.#mask = this.#buffer.length-1
            return true;
        }
    }

    shift() {
        if (this.#head < this.#tail) {
            const val = this.#buffer[this.#head++];
            if ((this.#head & this.#mask) === 0) {
                this.#head =0
                this.#tail &= this.#mask;
                this.#tryCollapse()
            }
            return val;
        }
    }

    * [Symbol.iterator]() {
        while (this.length) {
            yield this.shift()
        }
    }

    toArray() {
        return this.#tail <= this.#buffer.length ? this.#buffer.slice(this.#head, this.#tail) : this.#buffer.slice(this.#head).concat(this.#buffer.slice(0, this.#tail & this.#mask))
    }

    toString() {
        return this.toArray().toString()
    }
}

module.exports = Pow2Buffer

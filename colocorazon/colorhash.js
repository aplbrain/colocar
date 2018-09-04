import ColorHash from 'color-hash';

export default function CHash(str, opts) {
    opts = opts || {};

    const _defaults = {
        "axon": "#ff0000",
        "dendrite": "#00ffff",
    };

    if (str in _defaults) {
        return _defaults[str];
    }
    return new ColorHash(opts).hex(str);
}
